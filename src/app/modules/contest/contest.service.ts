import { prisma } from "../../../lib/prisma.db.js";
import { Prisma } from "@prisma/client";
import type {
  CreateContestBody,
  GetContestsQuery,
  GetContestsQueryAll,
  SubmitContestResultBody,
} from "./contest.validation.js";
import { grantContestXp } from "../xp/xp.service.js";
import { unlockAchievementsForUser } from "../achievements/achievement.service.js";
import { progressService } from "../progress/progress.service.js";

const createContest = async (data: CreateContestBody, userId: string) => {
  return prisma.contest.create({
    data: { ...data, userId },
  });
};

const getContests = async (query: GetContestsQuery) => {
  const where: Prisma.ContestWhereInput = {};
  if (query.userId) {
    where.userId = query.userId;
  }

  const contests = await prisma.contest.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  // The stored column never advances, so every read derives the phase from
  // the scheduled window instead of trusting `Contest.condition`.
  const now = Date.now();
  return contests.map((contest) => ({
    ...contest,
    condition: resolveContestCondition(contest, now),
  }));
};

const getMyContests = async (userId: string) => {
  const contests = await prisma.contest.findMany({
    where: { userId },
    include: { participants: true },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  return contests.map((contest) => ({
    ...contest,
    condition: resolveContestCondition(contest, now),
  }));
};

const findContestById = async (contestId: string) => {
  const contest = await prisma.contest.findFirst({ where: { id: contestId } });
  if (!contest) return contest;
  return { ...contest, condition: resolveContestCondition(contest, Date.now()) };
};

const getContestById = async (contestId: string) => {
  const contest = await prisma.contest.findFirst({
    where: { id: contestId },
    include: {
      user: true,
      participants: { include: { user: true } },
    },
  });
  if (!contest) return contest;
  return { ...contest, condition: resolveContestCondition(contest, Date.now()) };
};

const findParticipant = async (userId: string, contestId: string) => {
  return prisma.contestParticipant.findUnique({
    where: { userId_contestId: { userId, contestId } },
  });
};

const joinContest = async (userId: string, contestId: string) => {
  return prisma.contestParticipant.create({ data: { contestId, userId } });
};

const leaveContest = async (userId: string, contestId: string) => {
  return prisma.contestParticipant.delete({
    where: { userId_contestId: { userId, contestId } },
  });
};

const deleteContest = async (contestId: string) => {
  return prisma.contest.delete({ where: { id: contestId } });
};

type ContestWindow = { contestDate: Date; time: number };

/**
 * `Contest.condition` is written once on create (default `UPCOMING`) and no cron
 * ever advances it, so a finished contest still reads `UPCOMING` in the DB.
 * Derive the state from `contestDate` + `time` (seconds) on read instead.
 */
export function resolveContestCondition(
  contest: ContestWindow,
  nowMs: number
): "UPCOMING" | "RUNNING" | "FINISHED" {
  const start = contest.contestDate.getTime();
  if (Number.isNaN(start)) return "UPCOMING";
  const durationMs = Number.isFinite(contest.time) ? Math.max(0, contest.time) * 1000 : 0;
  if (nowMs < start) return "UPCOMING";
  if (nowMs < start + durationMs) return "RUNNING";
  return "FINISHED";
}

const getAllContests = async (query: GetContestsQueryAll) => {
  const { limit, page, sortBy } = query;
  const skip = (page - 1) * limit;

  const [contests, total] = await Promise.all([
    prisma.contest.findMany({
      include: {
        user: true,
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: sortBy === "asc" ? "asc" : "desc" },
      take: limit,
      skip,
    }),
    prisma.contest.count(),
  ]);

  const now = Date.now();

  return {
    // `participants` is exposed as a count (the raw join rows are not useful to
    // an admin table) and `condition` is derived from the contest window: the
    // column is only written on create, so a finished contest still reads
    // UPCOMING in the DB and would otherwise render as "Upcoming" forever.
    contests: contests.map(({ _count, ...contest }) => ({
      ...contest,
      participants: _count.participants,
      condition: resolveContestCondition(contest, now),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },
  };
};

type LivePlacementRow = {
  userId: string;
  wpm: number;
  accuracy: number;
  errors: number;
};

/**
 * Best-result-per-user rank for a contest, computed live. There's no
 * separate "contest finished" event in this codebase (condition is derived,
 * never written), so placement-based XP is awarded off this live ranking
 * at the moment of a user's first submission instead of waiting for a job
 * that doesn't exist.
 */
async function getLivePlacement(
  tx: Prisma.TransactionClient,
  contestId: string,
  userId: string
): Promise<number | null> {
  const rows = await tx.$queryRaw<LivePlacementRow[]>(Prisma.sql`
    SELECT DISTINCT ON (r."userId")
      r."userId", r."wpm", r."accuracy", r."errors"
    FROM "Result" r
    WHERE r."contestId" = ${contestId}
    ORDER BY r."userId", r."wpm" DESC, r."accuracy" DESC, r."errors" ASC, r."createdAt" ASC
  `);

  const ranked = rows.sort(
    (a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.errors - b.errors
  );

  const idx = ranked.findIndex((r) => r.userId === userId);
  return idx === -1 ? null : idx + 1;
}

const submitContestResult = async (
  data: SubmitContestResultBody,
  userId: string,
  contestId: string
) => {
  const created = await prisma.$transaction(async (tx) => {
    // XP is paid out once per contest per user — repeat submissions still
    // improve their leaderboard row, they just don't pay out XP again.
    const priorSubmission = await tx.result.findFirst({
      where: { userId, contestId },
      select: { id: true },
    });

    const result = await tx.result.create({
      data: { ...data, userId, contestId },
    });

    if (!priorSubmission) {
      const placement = await getLivePlacement(tx, contestId, userId);
      await grantContestXp(tx, userId, result.wpm, result.accuracy, placement);
    }

    return result;
  });

  // A contest run counts towards the same badges a practice run does.
  const unlockedAchievements = await unlockAchievementsForUser(userId);

  // …and towards the same lifetime totals behind the progress screen.
  await progressService.recordUserStatsSafe(userId, {
    wpm: created.wpm,
    accuracy: created.accuracy,
    timeTyped: created.timeTaken ?? created.duration ?? 0,
  });

  return { ...created, unlockedAchievements };
};

type LeaderboardRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  wpm: number;
  accuracy: number;
  errors: number;
  timeTaken: number;
  createdAt: Date;
};

const getContestLeaderboard = async (contestId: string) => {
  const rows = await prisma.$queryRaw<LeaderboardRow[]>(Prisma.sql`
    SELECT DISTINCT ON (r."userId")
      r."userId", u."name", u."avatarUrl",
      r."wpm", r."accuracy", r."errors", r."timeTaken", r."createdAt"
    FROM "Result" r
    JOIN "User" u ON u."id" = r."userId"
    WHERE r."contestId" = ${contestId}
    ORDER BY r."userId", r."wpm" DESC, r."accuracy" DESC, r."errors" ASC, r."createdAt" ASC
  `);

  return rows
    .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || a.errors - b.errors)
    .map((row, i) => ({ rank: i + 1, ...row }));
};

const getAllLeaderboards = async () => {
  const contests = await prisma.contest.findMany({
    orderBy: { contestDate: "desc" },
    select: { id: true, name: true, condition: true, contestDate: true, time: true },
  });

  const now = Date.now();

  return Promise.all(
    contests.map(async (contest) => ({
      contest: {
        ...contest,
        condition: resolveContestCondition(contest, now),
      },
      leaderboard: await getContestLeaderboard(contest.id),
    }))
  );
};

export const ContestServices = {
  createContest,
  getContests,
  getMyContests,
  findContestById,
  getContestById,
  findParticipant,
  joinContest,
  leaveContest,
  deleteContest,
  getAllContests,
  submitContestResult,
  getContestLeaderboard,
  getAllLeaderboards,
};