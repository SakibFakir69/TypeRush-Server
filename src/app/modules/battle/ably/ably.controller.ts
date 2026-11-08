/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ablyClient } from "../../../../config/ably-config.js";
import { prisma } from "../../../../lib/prisma.db.js";

/**
 * Token for the lobby: lets a player subscribe to their own matchmaking
 * channel, hold lobby presence, and talk on any match they are already in.
 * Without this the client cannot receive `match_found` — the per-match token
 * only exists after a match has been created.
 */
export const getUserToken = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ success: false, message: "Unauthorized" });
  }

  const activeMatches = await prisma.matchParticipant.findMany({
    where: { userId, match: { status: "ACTIVE" } },
    select: { matchId: true },
  });

  const capability: Record<string, Array<"subscribe" | "publish" | "presence">> = {
    [`matchmaking:user:${userId}`]: ["subscribe"],
    "matchmaking:lobby": ["subscribe", "presence"],
  };
  for (const { matchId } of activeMatches) {
    capability[`match:${matchId}`] = ["subscribe", "publish", "presence"];
  }

  const tokenRequest = await ablyClient.auth.createTokenRequest({
    clientId: userId,
    capability,
    ttl: 60 * 60 * 1000,
  });

  return res.json(tokenRequest);
};

export const getMatchToken = async (req: Request, res: Response) => {
  const { matchId } = req.params as { matchId: string };
  const userId = req.user?.userId as string;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId, userId } },
    include: { match: true },
  });

  if (!participant) {
    return res.status(403).json({ success: false, message: "Not a participant in this match" });
  }

  if (participant.match.status !== "ACTIVE") {
    return res.status(409).json({ success: false, message: "Match is not active" });
  }

  const tokenRequest = await ablyClient.auth.createTokenRequest({
    clientId: userId,
    capability: {
      [`match:${matchId}`]: ["subscribe", "publish", "presence"],
    },
    ttl: 60 * 60 * 1000,
  });

  return res.json(tokenRequest);
};