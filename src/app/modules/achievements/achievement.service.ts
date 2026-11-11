// achievement.service.ts
import type { Prisma } from "@prisma/client";
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

export const AchievementServices = {
  createAchievement,
  getAllAchievementsAdmin,
  getAchievementById,
  updateAchievement,
  deleteAchievement,
  revokeUserAchievement,
  grantUserAchievement,
  getUserAchievements,
  checkAchievements,
};