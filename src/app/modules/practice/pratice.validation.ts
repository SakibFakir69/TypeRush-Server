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
    // Optional: arena runs (words / quotes / custom text) have no admin
    // passage behind them. The column is already nullable, so a free-typed
    // run can still be recorded and counted in the user's stats.
    paragraphId: z.string().uuid().optional(),
    wpm: z.number().nonnegative().finite(),
    accuracy: z.number().min(0).max(100).finite(),
    errors: z.number().int().nonnegative(),
    timeTaken: z.number().int().nonnegative(),
    // The run length the typist picked (15 / 30 / 60 s …). It is what the
    // per-duration leaderboards group by. Optional for older clients.
    duration: z.number().int().positive().optional(),
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
  /** Cursor mode (existing) — takes precedence over offset when both are sent. */
  cursor: z.string().uuid().optional(),
  /** Offset mode: page N of the leaderboard. */
  offset: z.coerce.number().int().min(0).default(0),
  /** Time category: only runs of this length (seconds), e.g. 60. */
  duration: z.coerce.number().int().min(1).max(3600).optional(),
});

export type ResultQuery = z.infer<typeof resultQuerySchema>;