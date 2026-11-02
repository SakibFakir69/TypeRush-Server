// practice.service.ts
import type { SubmitResultBody } from './pratice.validation.js';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { prisma } from "../../../lib/prisma.db.js";
import type { CreateParagraphInput } from "./pratice.validation.js";

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
    ...data, userId
  }

  const result = await prisma.result.create({ data: createData });

  return result;
};


type UserStats = {
  currentWpm: number;
  wpmChangePercent: number;
  bestWpm: number;
  currentAccuracy: number;
  accuracyChangePercent: number;
  sampleSize: number; // how many of the "last 10" actually existed
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
  };
};



export const PracticeServices = {
  createData, getPracticeParagraph, submitPracticeResult, deletePracticeContent,getUserStats
}