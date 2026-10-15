import { z } from "zod";

export const createContestSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    content: z.string().min(1, "Content is required"),
    time: z.number().positive("Time must be greater than 0"),
    userId: z.string().uuid().optional(),
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
  body: z.object({
    userId: z.string().uuid(), // drop once pulled from req.user.id instead
  }),
});

export const leaveContestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid(), // drop once pulled from req.user.id instead
  }),
});

export const deleteContestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid(),         // drop once pulled from req.user.id instead
    role: z.enum(["USER", "ADMIN", "ORG"]).optional(),
  }),
});

export type CreateContestInput = z.infer<typeof createContestSchema>["body"];
export type JoinContestInput = z.infer<typeof joinContestSchema>;