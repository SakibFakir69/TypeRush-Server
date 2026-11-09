/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response } from "express";
import { ablyClient } from "../../../../config/ably-config.js";
import { redis } from "../../../../config/redis-config.js";
import { prisma } from "../../../../lib/prisma.db.js";
import { returnResponse } from "../../../../helpers/return-response.js";
import crypto from "crypto";

const INVITE_TTL_SECONDS = 5 * 60; // invite dies if not accepted in 5 min
const MAX_CODE_RETRY = 3;

// --- helpers ---

const generateUniqueCode = async (): Promise<string | null> => {
  for (let i = 0; i < MAX_CODE_RETRY; i++) {
    const code = crypto.randomBytes(3).toString("hex");
    const exists = await prisma.privateInvite.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  return null; // astronomically unlikely with 16.7M combos, but handle it
};

const inviteChannelFor = (code: string) => ablyClient.channels.get(`private-match:${code}`);

// --- invite ---

const inviteUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { time, paragraphId } = req.body as { time?: number; paragraphId?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!time || typeof time !== "number" || time <= 0) {
      return returnResponse(res, false, 400, "invalid time");
    }
    if (!paragraphId || typeof paragraphId !== "string") {
      return returnResponse(res, false, 400, "paragraphId required");
    }

    const [existingUser, paragraph] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.paragraph.findUnique({ where: { id: paragraphId }, select: { id: true, isDeleted: true } }),
    ]);

    if (!existingUser) {
      return returnResponse(res, false, 404, "user not found");
    }
    if (!paragraph || paragraph.isDeleted) {
      return returnResponse(res, false, 404, "paragraph not found");
    }

    const code = await generateUniqueCode();
    if (!code) {
      return returnResponse(res, false, 500, "could not generate invite code, try again");
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_SECONDS * 1000);

    const invite = await prisma.privateInvite.create({
      data: {
        code,
        inviterId: userId,
        duration: time,
        paragraphId,
        status: "PENDING",
        expiresAt,
      },
    });

    // fast lookup cache, TTL as auto-cleanup — Postgres is still the source of truth
    await redis.set(`private-match:${code}`, invite.id, "EX", INVITE_TTL_SECONDS);

    return returnResponse(res, true, 200, "invite created", {
      code,
      expiresIn: INVITE_TTL_SECONDS,
    });
  } catch (err) {
    console.error("inviteUser error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- accept ---

const acceptInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.privateInvite.findUnique({ where: { code } });

      if (!invite) return { error: "NOT_FOUND" as const };
      if (invite.status !== "PENDING") return { error: "ALREADY_USED" as const };
      if (invite.expiresAt < new Date()) return { error: "EXPIRED" as const };
      if (invite.inviterId === userId) return { error: "SELF_ACCEPT" as const };

      // Snapshot both ratings so the Elo settlement starts from real values
      // instead of the column default.
      const [inviter, invitee] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: invite.inviterId },
          select: { rating: true },
        }),
        tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { rating: true },
        }),
      ]);

      const match = await tx.match.create({
        data: {
          paragraphId: invite.paragraphId,
          duration: invite.duration,
          status: "ACTIVE",
          startedAt: new Date(),
          participants: {
            create: [
              { userId: invite.inviterId, ratingBefore: inviter.rating },
              { userId, ratingBefore: invitee.rating },
            ],
          },
        },
      });

      const updatedInvite = await tx.privateInvite.update({
        where: { id: invite.id },
        data: { status: "MATCHED", inviteeId: userId, matchId: match.id, respondedAt: new Date() },
      });

      return { invite: updatedInvite, match };
    });

    if ("error" in result) {
      const map = {
        NOT_FOUND: [404, "invite not found"],
        ALREADY_USED: [409, "invite already used"],
        EXPIRED: [410, "invite expired"],
        SELF_ACCEPT: [400, "cannot accept your own invite"],
      } as const;
      const [statusCode, msg] = map[result.error];
      return returnResponse(res, false, statusCode, msg);
    }

    await redis.del(`private-match:${code}`);

    await inviteChannelFor(code).publish("match_found", {
      matchId: result.match.id,
      paragraphId: result.match.paragraphId,
    });

    // TODO: grant match:{id} channel capability to inviterId and userId only

    return returnResponse(res, true, 200, "match started", {
      matchId: result.match.id,
      paragraphId: result.match.paragraphId,
    });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- decline (invitee rejects, without becoming inviteeId) ---

const declineInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const invite = await prisma.privateInvite.findUnique({ where: { code } });

    if (!invite) {
      return returnResponse(res, false, 404, "invite not found or already expired");
    }
    if (invite.inviterId === userId) {
      return returnResponse(res, false, 400, "cannot decline your own invite, use cancel");
    }
    if (invite.status !== "PENDING") {
      return returnResponse(res, false, 409, "invite already used");
    }

    await prisma.privateInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });

    await redis.del(`private-match:${code}`);

    await inviteChannelFor(code).publish("invite_declined", { code });

    return returnResponse(res, true, 200, "invite declined");
  } catch (err) {
    console.error("declineInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- cancel (inviter revokes their own invite) ---

const cancelInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const invite = await prisma.privateInvite.findUnique({ where: { code } });

    if (!invite) {
      return returnResponse(res, false, 404, "invite not found or already expired");
    }
    if (invite.inviterId !== userId) {
      return returnResponse(res, false, 403, "not your invite");
    }
    if (invite.status !== "PENDING") {
      return returnResponse(res, false, 409, "invite already accepted, cannot cancel");
    }

    await prisma.privateInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });

    await redis.del(`private-match:${code}`);

    await inviteChannelFor(code).publish("invite_cancelled", { code });

    return returnResponse(res, true, 200, "invite cancelled");
  } catch (err) {
    console.error("cancelInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- status (polling fallback if an Ably event is missed) ---

const getInviteStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.params as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code) {
      return returnResponse(res, false, 400, "code required");
    }

    const invite = await prisma.privateInvite.findUnique({ where: { code } });

    if (!invite) {
      return returnResponse(res, false, 404, "invite not found or expired");
    }
    if (invite.inviterId !== userId && invite.inviteeId !== userId) {
      return returnResponse(res, false, 403, "not part of this invite");
    }

    return returnResponse(res, true, 200, "invite status", {
      status: invite.status,
      matchId: invite.matchId ?? null,
      paragraphId: invite.paragraphId,
    });
  } catch (err) {
    console.error("getInviteStatus error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};



const getPlatformOverview = async (req: Request, res: Response) => {
  try {
    

    const [totalUsers, totalMatches, matchStatusCounts, resultCounts, aggregates, totalInvites, inviteStatusCounts] =
      await Promise.all([
        prisma.user.count({ where: { isDelete: false } }),
        prisma.match.count(),

        prisma.match.groupBy({
          by: ["status"],
          _count: { status: true },
        }),

        prisma.matchParticipant.groupBy({
          by: ["result"],
          where: { result: { not: null } },
          _count: { result: true },
        }),

        prisma.matchParticipant.aggregate({
          where: { wpm: { not: null } },
          _avg: { wpm: true, accuracy: true },
          _max: { wpm: true },
        }),

        prisma.privateInvite.count(),

        prisma.privateInvite.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
      ]);

    const active = matchStatusCounts.find((m) => m.status === "ACTIVE")?._count.status ?? 0;
    const completed = matchStatusCounts.find((m) => m.status === "COMPLETED")?._count.status ?? 0;
    const waiting = matchStatusCounts.find((m) => m.status === "WAITING")?._count.status ?? 0;
    const abandoned = matchStatusCounts.find((m) => m.status === "ABANDONED")?._count.status ?? 0;

    const matched = inviteStatusCounts.find((i) => i.status === "MATCHED")?._count.status ?? 0;
    const inviteAcceptRate = totalInvites > 0 ? Number(((matched / totalInvites) * 100).toFixed(1)) : 0;

    return returnResponse(res, true, 200, "platform overview", {
      totalUsers,
      totalMatches,
      matchesByStatus: { active, completed, waiting, abandoned },
      wins: resultCounts.find((r) => r.result === "WIN")?._count.result ?? 0,
      losses: resultCounts.find((r) => r.result === "LOSS")?._count.result ?? 0,
      draws: resultCounts.find((r) => r.result === "DRAW")?._count.result ?? 0,
      avgWpm: aggregates._avg.wpm ? Number(aggregates._avg.wpm.toFixed(1)) : 0,
      avgAccuracy: aggregates._avg.accuracy ? Number(aggregates._avg.accuracy.toFixed(1)) : 0,
      bestWpm: aggregates._max.wpm ?? 0,
      totalInvites,
      inviteAcceptRate,
    });
  } catch (err) {
    console.error("getPlatformOverview error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- matches over time (for a line/bar chart: matches created per day) ---

const getMatchesTimeSeries = async (req: Request, res: Response) => {
  try {
    

    const { days } = req.query as { days?: string };
    const range = Math.min(Number(days) || 30, 180);
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "Match"
      WHERE "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    const series = rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      matches: Number(r.count),
    }));

    return returnResponse(res, true, 200, "matches time series", { series });
  } catch (err) {
    console.error("getMatchesTimeSeries error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- avg WPM / accuracy trend over time (platform-wide) ---

const getPerformanceTimeSeries = async (req: Request, res: Response) => {
  try {
    

    const { days } = req.query as { days?: string };
    const range = Math.min(Number(days) || 30, 180);
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<
      { day: Date; avg_wpm: number; avg_accuracy: number; sample_size: bigint }[]
    >`
      SELECT
        date_trunc('day', mp."joinedAt") AS day,
        AVG(mp.wpm) AS avg_wpm,
        AVG(mp.accuracy) AS avg_accuracy,
        COUNT(*)::bigint AS sample_size
      FROM "MatchParticipant" mp
      WHERE mp."joinedAt" >= ${since} AND mp.wpm IS NOT NULL
      GROUP BY day
      ORDER BY day ASC
    `;

    const series = rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      avgWpm: Number(Number(r.avg_wpm).toFixed(1)),
      avgAccuracy: Number(Number(r.avg_accuracy).toFixed(1)),
      sampleSize: Number(r.sample_size),
    }));

    return returnResponse(res, true, 200, "performance time series", { series });
  } catch (err) {
    console.error("getPerformanceTimeSeries error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- invite funnel (pending/matched/declined/cancelled/expired breakdown) ---

const getInviteFunnel = async (req: Request, res: Response) => {
  try {
   

    const counts = await prisma.privateInvite.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const funnel = {
      pending: counts.find((c) => c.status === "PENDING")?._count.status ?? 0,
      matched: counts.find((c) => c.status === "MATCHED")?._count.status ?? 0,
      declined: counts.find((c) => c.status === "DECLINED")?._count.status ?? 0,
      cancelled: counts.find((c) => c.status === "CANCELLED")?._count.status ?? 0,
      expired: counts.find((c) => c.status === "EXPIRED")?._count.status ?? 0,
    };

    return returnResponse(res, true, 200, "invite funnel", { funnel });
  } catch (err) {
    console.error("getInviteFunnel error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- top players leaderboard (table, not just a chart) ---

const getTopPlayers = async (req: Request, res: Response) => {
  try {
    

    const { limit } = req.query as { limit?: string };
    const take = Math.min(Number(limit) || 20, 100);

    const users = await prisma.user.findMany({
      where: { isDelete: false },
      select: { id: true, name: true, rating: true, xp: true, country: true },
      orderBy: { rating: "desc" },
      take,
    });

    return returnResponse(res, true, 200, "top players", { users });
  } catch (err) {
    console.error("getTopPlayers error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

export const invitedController = {
  inviteUser,
  acceptInvite,
  declineInvite,
  cancelInvite,
  getInviteStatus,
  getTopPlayers,
  getInviteFunnel , getPerformanceTimeSeries,
   getMatchesTimeSeries,
   getPlatformOverview
};