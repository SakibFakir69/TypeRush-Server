// achievement.service.ts
import type { Achievement, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.db.js";
import type {
  CreateAchievementBody,
  UpdateAchievementBody,
  GetAchievementsQuery,
} from "./achivement.validation.js";

// Derived from the real `prisma` instance's $transaction signature instead of
// `Prisma.TransactionClient` directly — that separate type wasn't binding to
// the generated client here, so TS fell back to `any` inside callbacks and
// ESLint flagged every tx.* call as unsafe. This form always matches
// whatever `prisma` actually is.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * With `exactOptionalPropertyTypes: true`, zod's `.optional()`/`.partial()`
 * types a missing field as `key?: T | undefined` — the key can be explicitly
 * set to `undefined`, not just omitted. Prisma's input types don't accept
 * that: an optional field must be left out entirely, never present with
 * value `undefined`. This drops every `undefined`-valued key so the object
 * actually matches what Prisma expects.
 */
type WithoutUndefined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

function stripUndefined<T extends Record<string, unknown>>(
  obj: T
): WithoutUndefined<T> {
  const result = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result as WithoutUndefined<T>;
}

// ---------- admin CRUD ----------

const createAchievement = async (data: CreateAchievementBody) => {
  return prisma.achievement.create({ data: stripUndefined(data) });
};

const getAllAchievementsAdmin = async (query: GetAchievementsQuery) => {
  const { category, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AchievementWhereInput = category ? { category } : {};

  const [achievements, total] = await Promise.all([
    prisma.achievement.findMany({
      where,
      orderBy: [{ category: "asc" }, { tier: "asc" }],
      take: limit,
      skip,
      include: { _count: { select: { users: true } } }, // how many users unlocked it
    }),
    prisma.achievement.count({ where }),
  ]);

  return {
    achievements: achievements.map(({ _count, ...a }) => ({
      ...a,
      unlockedByCount: _count.users,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getAchievementById = async (achievementId: string) => {
  return prisma.achievement.findUnique({
    where: { id: achievementId },
    include: { _count: { select: { users: true } } },
  });
};

const updateAchievement = async (
  achievementId: string,
  data: UpdateAchievementBody
) => {
  return prisma.achievement.update({
    where: { id: achievementId },
    data: stripUndefined(data),
  });
};

/**
 * Deleting an achievement also removes every UserAchievement row that
 * unlocked it (no onDelete: Cascade on UserAchievement.achievement in the
 * schema, so this is done explicitly in a transaction instead of relying
 * on the DB to clean up — change the schema to Cascade if you'd rather
 * have the DB handle it).
 */
const deleteAchievement = async (achievementId: string) => {
  return prisma.$transaction(async (tx) => {
    await tx.userAchievement.deleteMany({ where: { achievementId } });
    return tx.achievement.delete({ where: { id: achievementId } });
  });
};

/** Revoke one user's unlock without touching the achievement definition. */
const revokeUserAchievement = async (userId: string, achievementId: string) => {
  return prisma.userAchievement.delete({
    where: { userId_achievementId: { userId, achievementId } },
  });
};

/** Admin-granted unlock, bypassing the normal threshold check entirely. */
const grantUserAchievement = async (userId: string, achievementId: string) => {
  return prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    update: {},
    create: { userId, achievementId },
  });
};

// ---------- user-facing read ----------

const getUserAchievements = async (userId: string) => {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });
};

/**
 * Every published achievement plus the unlock date for this user
 * (`unlockedAt: null` = still locked). This is what the member achievements
 * page renders: the full catalogue with the locked ones greyed out.
 */
const getAchievementCatalog = async (userId: string) => {
  // Badges unlock the moment the user's numbers cross a threshold — a run
  // that was saved outside the practice flow (a battle, a seeded result) must
  // count too. The check only ever writes the rows that are missing, and it
  // never fails the read: a badge that cannot be unlocked yet simply stays
  // locked until the next run.
  await unlockAchievementsForUser(userId);

  const rows = await prisma.achievement.findMany({
    orderBy: [
      { category: "asc" },
      { tier: "asc" },
      { threshold: "asc" },
    ],
    include: {
      users: {
        where: { userId },
        select: { id: true, unlockedAt: true },
      },
    },
  });

  return rows.map(({ users, ...achievement }) => ({
    ...achievement,
    unlockedAt: users[0]?.unlockedAt ?? null,
  }));
};

// ---------- automatic unlock check (called from practice/match/contest flows) ----------

/**
 * Compares `currentValue` against every Achievement in `category` the user
 * hasn't unlocked yet, and unlocks every threshold crossed in one pass.
 * Call this inside the same transaction as the stat-changing write.
 */
async function checkAchievements(
  tx: TxClient,
  userId: string,
  category: "speed" | "accuracy" | "volume" | "streak" | "contest" | "social",
  currentValue: number
): Promise<string[]> {
  const candidates = await tx.achievement.findMany({
    where: {
      category,
      threshold: { lte: currentValue },
      users: { none: { userId } },
    },
    orderBy: { tier: "asc" },
  });

  if (candidates.length === 0) return [];

  await tx.userAchievement.createMany({
    data: candidates.map((a) => ({ userId, achievementId: a.id })),
    skipDuplicates: true,
  });

  return candidates.map((a) => a.key);
}

/** The categories an achievement can belong to. */
export type AchievementCategory =
  | "speed"
  | "accuracy"
  | "volume"
  | "streak"
  | "contest"
  | "social";

/** One number per category: how far the user has come in it. */
export type AchievementSnapshot = Partial<
  Record<AchievementCategory, number>
>;

/**
 * Consecutive days (UTC) with at least one result. The streak survives
 * until the end of the day after the last run, so it doesn't break just
 * because the user hasn't trained yet today.
 */
function currentStreak(dayKeys: string[], today: Date = new Date()): number {
  if (dayKeys.length === 0) return 0;
  const days = new Set(dayKeys);
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const key = (d: Date) => d.toISOString().slice(0, 10);

  if (!days.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** One row of the snapshot query below. Counts come back as strings. */
type SnapshotRow = {
  speed: number | string | null;
  accuracy: number | string | null;
  volume: number | string | null;
  contest: number | string | null;
  social: number | string | null;
  days: string[] | null;
};

/**
 * Where the user currently stands in every category, read from their own
 * rows.
 *
 * The database sits behind a remote pooler where every round trip costs
 * about a quarter of a second, so all six numbers come back in one query
 * instead of six.
 */
async function achievementSnapshot(
  tx: TxClient,
  userId: string
): Promise<AchievementSnapshot> {
  const rows = await tx.$queryRaw<SnapshotRow[]>`
    SELECT
      (SELECT COALESCE(MAX("wpm"), 0::double precision)
         FROM "Result" WHERE "userId" = ${userId}) AS speed,
      (SELECT COALESCE(MAX("accuracy"), 0::double precision)
         FROM "Result" WHERE "userId" = ${userId}) AS accuracy,
      (SELECT COUNT(*) FROM "Result"
         WHERE "userId" = ${userId}) AS volume,
      (SELECT COUNT(*) FROM "ContestParticipant"
         WHERE "userId" = ${userId}) AS contest,
      (SELECT COUNT(*) FROM "MatchParticipant"
         WHERE "userId" = ${userId}) AS social,
      COALESCE(
        (SELECT array_agg(days.day)
           FROM (
             SELECT DISTINCT to_char("createdAt", 'YYYY-MM-DD') AS day
             FROM "Result" WHERE "userId" = ${userId}
             ORDER BY day DESC
             LIMIT 200
           ) days),
        ARRAY[]::text[]
      ) AS days
  `;

  const row = rows[0];
  if (!row) return {};

  const days = Array.isArray(row.days) ? row.days : [];

  return {
    speed: Number(row.speed ?? 0),
    accuracy: Number(row.accuracy ?? 0),
    volume: Number(row.volume ?? 0),
    contest: Number(row.contest ?? 0),
    social: Number(row.social ?? 0),
    streak: currentStreak(days),
  };
}

/**
 * The full unlock pass used by the practice / contest / battle flows:
 * snapshot the user's numbers, then unlock whatever they now qualify for.
 *
 * `overrides` raises a category's value — a battle run, for example, is not
 * stored as a `Result`, so its WPM is merged in here instead.
 */
export async function evaluateAchievements(
  tx: TxClient,
  userId: string,
  overrides: AchievementSnapshot = {}
): Promise<Achievement[]> {
  // One query for the whole catalogue, including this user's unlocks.
  const definitions = await tx.achievement.findMany({
    include: { users: { where: { userId }, select: { id: true } } },
    orderBy: [{ category: "asc" }, { tier: "asc" }, { threshold: "asc" }],
  });

  if (definitions.length === 0) return [];

  const snapshot = await achievementSnapshot(tx, userId);

  for (const [category, value] of Object.entries(overrides) as [
    AchievementCategory,
    number | undefined,
  ][]) {
    if (typeof value !== "number") continue;
    const current = snapshot[category];
    snapshot[category] =
      typeof current === "number" ? Math.max(current, value) : value;
  }

  // Every badge whose goal is met and that the user doesn't hold yet.
  const unlocked = definitions.filter((definition) => {
    const value = snapshot[definition.category as AchievementCategory];
    if (typeof value !== "number") return false;
    if (definition.threshold > value) return false;
    return definition.users.length === 0;
  });

  if (unlocked.length === 0) return [];

  await tx.userAchievement.createMany({
    data: unlocked.map((definition) => ({
      userId,
      achievementId: definition.id,
    })),
    skipDuplicates: true,
  });

  return unlocked.map(({ users: _users, ...definition }) => definition);
}

/**
 * The unlock pass as the flows call it: its own short transaction, so the
 * write that triggered it (a saved run, a settled battle) is never held
 * open by the badge check.
 *
 * A failure here is never fatal — the badge unlocks on the next run.
 */
export async function unlockAchievementsForUser(
  userId: string,
  overrides: AchievementSnapshot = {}
): Promise<Achievement[]> {
  try {
    return await prisma.$transaction(
      (tx) => evaluateAchievements(tx, userId, overrides),
      // The database is remote: a full read of the user's history needs
      // more than the default 5 s transaction budget.
      { timeout: 20000 }
    );
  } catch (error) {
    console.error("achievement unlock failed:", error);
    return [];
  }
}

export const AchievementServices = {
  createAchievement,
  getAllAchievementsAdmin,
  getAchievementById,
  updateAchievement,
  deleteAchievement,
  revokeUserAchievement,
  grantUserAchievement,
  getUserAchievements,
  getAchievementCatalog,
  checkAchievements,
  evaluateAchievements,
};