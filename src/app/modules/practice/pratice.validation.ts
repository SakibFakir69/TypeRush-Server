

import { z } from "zod";

export const createParagraphSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required"),

  category: z
    .string()
    .optional(),

  difficulty: z
    .string()
    .optional(),

  wordCount: z
    .number()
    .int()
    .nonnegative(),
});