// practice.service.ts
import type { SubmitResultBody } from './pratice.validation.js';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { prisma } from "../../../lib/prisma.db.js";
import type { CreateParagraphInput } from "./pratice.validation.js";
import { grantPracticeXp } from "../xp/xp.service.js";
import { unlockAchievementsForUser } from "../achievements/achievement.service.js";

const createData = async (data: CreateParagraphInput, userId: string) => {
  const create_paragraph_data = await prisma.paragraph.create({
    data: {
      content: data.content,
      wordCount: data.wordCount,
      category: data.category ?? null,
      difficulty: data.difficulty ?? null,

      results: {
        create: {
          userId: userId ?? null,
          wpm: 0,
          accuracy: 0,
          errors: 0,
          timeTaken: 0,
        },
      },
    },
  });
  return create_paragraph_data;
}

const getPracticeParagraph = async (paragraphId: string) => {
  const paragraphData = await prisma.paragraph.findFirst({ where: { id: paragraphId } });
  return paragraphData;
}

const deletePracticeContent = async (paragraphId: string) => {
  return prisma.paragraph.update({ where: { id: paragraphId }, data: { isDeleted: true } });
};

const submitPracticeResult = async (
  data: SubmitResultBody,
  userId: string
) => {
  const createData = {
    ...data,
    userId,
    // Arena runs (words / quotes / custom text) have no passage behind them.
    paragraphId: data.paragraphId ?? null,
    // Older clients don't send the run length; fall back to the elapsed time
    // so the row still lands in a sensible time category.
    duration: data.duration ?? data.timeTaken ?? null,
  }

  // This endpoint's body has no contestId — it's practice-only, so every
  // submission here earns practice XP. Contest XP is granted separately,
  // from the ranked finishContest job once a contest ends.
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.result.create({ data: createData });
    const xpAwarded = await grantPracticeXp(
      tx,
      userId,
      created.wpm,
      created.accuracy
    );
    // Hand the award back so the client can show it (and keep its cached
    // session XP in sync) instead of silently changing the user's level.
    return { ...created, xpAwarded };
  });

  // Badges are unlocked right after the run is stored, in their own short
  // transaction: the run that crosses a threshold unlocks the badge, and a
  // slow badge check never delays (or fails) the saved run.
  const unlockedAchievements = await unlockAchievementsForUser(userId);

  return { ...result, unlockedAchievements };
};


type UserStatsHistoryPoint = {
  /** UTC day key, e.g. "2026-11-01". */
  date: string;
  wpm: number;
  accuracy: number;
  tests: number;
};

/** One logged run, shown as a dashboard activity row. */
type UserStatsRecentRun = {
  id: string;
  wpm: number;
  accuracy: number;
  timeTaken: number;
  /** Chosen run length (15 / 30 / 60 …), null for legacy rows. */
  duration: number | null;
  /** Set when the run was posted to a contest. */
  contestId: string | null;
  createdAt: string;
};

type UserStats = {
  currentWpm: number;
  wpmChangePercent: number;
  bestWpm: number;
  currentAccuracy: number;
  accuracyChangePercent: number;
  sampleSize: number; // how many of the "last 10" actually existed
  totalTests: number;
  /** Contests the user has joined. */
  contestsJoined: number;
  /** Runs posted to a contest. */
  contestRuns: number;
  /** The newest runs, newest first — powers the dashboard activity feed. */
  recent: UserStatsRecentRun[];
  /** Per-day averages for the last 90 days, oldest first. */
  history: UserStatsHistoryPoint[];
};

const getUserStats = async (userId: string): Promise<UserStats | null> => {
  // Most recent result = "current"
  const [latest, last10, bestResult] = await Promise.all([
    prisma.result.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.result.findFirst({
      where: { userId },
      orderBy: { wpm: "desc" },
    }),
  ]);

  if (!latest || !bestResult) return null;

  // Progress curve: per-day averages for the last 90 days, so the client can
  // slice 7D / 30D / 90D without another round-trip.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [historyRows, totalTests, recentRows, contestsJoined, contestRuns] =
    await Promise.all([
      prisma.result.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { wpm: true, accuracy: true, createdAt: true },
      }),
      prisma.result.count({ where: { userId } }),
      prisma.result.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          wpm: true,
          accuracy: true,
          timeTaken: true,
          duration: true,
          contestId: true,
          createdAt: true,
        },
      }),
      prisma.contestParticipant.count({ where: { userId } }),
      prisma.result.count({ where: { userId, contestId: { not: null } } }),
    ]);

  const buckets = new Map<
    string,
    { wpm: number; accuracy: number; tests: number }
  >();
  for (const row of historyRows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(date) ?? { wpm: 0, accuracy: 0, tests: 0 };
    bucket.wpm += row.wpm;
    bucket.accuracy += row.accuracy;
    bucket.tests += 1;
    buckets.set(date, bucket);
  }

  const history: UserStatsHistoryPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      wpm: Math.round(b.wpm / b.tests),
      accuracy: Math.round(b.accuracy / b.tests),
      tests: b.tests,
    }));

  // Baseline = average of the last 10 tests EXCLUDING the current one,
  // so "current" is compared against what came before it, not itself.
  const baseline = last10.filter((r) => r.id !== latest.id);

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

  const avgWpm = avg(baseline.map((r) => r.wpm));
  const avgAccuracy = avg(baseline.map((r) => r.accuracy));

  const pctChange = (current: number, prev: number) =>
    prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;

  return {
    currentWpm: latest.wpm,
    wpmChangePercent: pctChange(latest.wpm, avgWpm),
    bestWpm: bestResult.wpm,
    currentAccuracy: latest.accuracy,
    accuracyChangePercent: pctChange(latest.accuracy, avgAccuracy),
    sampleSize: baseline.length,
    totalTests,
    contestsJoined,
    contestRuns,
    recent: recentRows.map((row) => ({
      id: row.id,
      wpm: row.wpm,
      accuracy: row.accuracy,
      timeTaken: row.timeTaken,
      duration: row.duration,
      contestId: row.contestId,
      createdAt: row.createdAt.toISOString(),
    })),
    history,
  };
};



export const PracticeServices = {
  createData, getPracticeParagraph, submitPracticeResult, deletePracticeContent,getUserStats
}