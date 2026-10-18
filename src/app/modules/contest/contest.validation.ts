import { z } from "zod";

export const createContestSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    content: z.string().min(1, "Content is required"),
    time: z.number().positive("Time must be greater than 0"),
  }),
});

export const getContestsQuerySchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
  }),
});

export const getContestByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const joinContestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const leaveContestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const deleteContestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});