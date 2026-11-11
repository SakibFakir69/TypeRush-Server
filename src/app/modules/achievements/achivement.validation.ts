// achievement.validation.ts
import { z } from "zod";

export const achievementCategorySchema = z.enum([
  "speed",
  "accuracy",
  "volume",
  "streak",
  "contest",
  "social",
]);

export const createAchievementSchema = z.object({
  key: z.string().min(1).max(64), // stable slug, e.g. "speed_100"
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  category: achievementCategorySchema,
  tier: z.number().int().min(1).max(3), // 1 bronze, 2 silver, 3 gold
  threshold: z.number().int().min(0),
  iconUrl: z.string().url().max(2048).optional(),
});

export const updateAchievementSchema = createAchievementSchema.partial();

export const getAchievementsQuerySchema = z.object({
  category: achievementCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAchievementBody = z.infer<typeof createAchievementSchema>;
export type UpdateAchievementBody = z.infer<typeof updateAchievementSchema>;
export type GetAchievementsQuery = z.infer<typeof getAchievementsQuerySchema>;