/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { prisma } from "../../../lib/prisma.db.js";
import { Prisma } from "@prisma/client";
import type {
  CreateContestBody,
  GetContestsQuery,
  GetContestsQueryAll,
  SubmitContestResultBody,
} from "./contest.validation.js";

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

  return prisma.contest.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
};

const getMyContests = async (userId: string) => {
  return prisma.contest.findMany({
    where: { userId },
    include: { participants: true },
    orderBy: { createdAt: "desc" },
  });
};

const findContestById = async (contestId: string) => {
  return prisma.contest.findFirst({ where: { id: contestId } });
};

const getContestById = async (contestId: string) => {
  return prisma.contest.findFirst({
    where: { id: contestId },
    include: {
      user: true,
      participants: { include: { user: true } },
    },
  });
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

const getAllContests = async (query: GetContestsQueryAll) => {
  const { limit, page, sortBy } = query;
  const skip = (page - 1) * limit;

  const [contests, total] = await Promise.all([
    prisma.contest.findMany({
      include: { user: true },
      orderBy: { createdAt: sortBy === "asc" ? "asc" : "desc" },
      take: limit,
      skip,
    }),
    prisma.contest.count(),
  ]);

  return {
    contests,
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

const submitContestResult = async (
  data: SubmitContestResultBody,
  userId: string,
  contestId: string
) => {
  return prisma.result.create({
    data: { ...data, userId, contestId },
  });
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
    select: { id: true, name: true, condition: true, contestDate: true },
  });

  return Promise.all(
    contests.map(async (contest) => ({
      contest,
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