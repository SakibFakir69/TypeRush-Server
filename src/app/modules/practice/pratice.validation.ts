import { z } from "zod";

// ---------- Paragraph ----------

export const createParagraphSchema = z
  .object({
    content: z.string().trim().min(1, "Content is required"),
    category: z.string().trim().min(1).optional(),
    difficulty: z.string().trim().min(1).optional(),
    wordCount: z.number().int().nonnegative(),
  })
  .strict();

export type CreateParagraphInput = z.infer<typeof createParagraphSchema>;

// ---------- Result ----------

// Shared fields for a practice result. userId is intentionally excluded:
// the server takes it from the auth session, never from the client.
export const submitResultBodySchema = z
  .object({
    paragraphId: z.string().uuid(),
    wpm: z.number().nonnegative().finite(),
    accuracy: z.number().min(0).max(100).finite(),
    errors: z.number().int().nonnegative(),
    timeTaken: z.number().int().nonnegative(),
  })
  .strict();

export type SubmitResultBody = z.infer<typeof submitResultBodySchema>;

// Server-side record shape, if you need to validate what you're about to persist.
export const createResultSchema = submitResultBodySchema.extend({
  userId: z.string().uuid().nullable().optional(),
});

export type CreateResultInput = z.infer<typeof createResultSchema>;

export const resultQuerySchema = z.object({
  paragraphId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type ResultQuery = z.infer<typeof resultQuerySchema>;