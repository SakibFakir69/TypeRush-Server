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

export const PracticeServices = {
  createData, getPracticeParagraph, submitPracticeResult, deletePracticeContent
}