// progress.validation.ts
import { z } from 'zod';

export const getHistorySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getChartSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('7d'),
});