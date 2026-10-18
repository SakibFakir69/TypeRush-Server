import { z } from "zod";

export const createAnnouncementSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000),
  isActive: z.boolean().optional().default(true),
});

export const updateAnnouncementSchema = z.object({
  message: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;