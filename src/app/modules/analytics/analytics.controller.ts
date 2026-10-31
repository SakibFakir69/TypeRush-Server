/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Redis } from 'ioredis';
import { AnalyticsService } from './analytics.service.js';
import { ActiveNowService } from './Active.now.service.js';
import { ALLOWED_RANGES, type AllowedRange } from './analytics.types.js';

import { prisma } from '../../../lib/prisma.db.js';
import { redis } from '../../../config/redis-config.js';

// --- Replace with your actual shared instances ---

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const activeNowService = new ActiveNowService(redis as Redis);
// If `redis` from your config file is already typed as `Redis`, drop the `as Redis` cast above.
const analyticsService = new AnalyticsService(prisma, activeNowService);

const CACHE_TTL_SECONDS = 60;

const rangeSchema = z.object({
  range: z
    .string()
    .optional()
    .default('7')
    .transform((v) => Number(v))
    .refine((v) => ALLOWED_RANGES.includes(v as AllowedRange), {
      message: `range must be one of: ${ALLOWED_RANGES.join(', ')}`,
    }),
});

async function getCached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis read failure shouldn't break the endpoint — fall through to compute.
  }

  const result = await compute();

  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
  } catch {
    // Cache write failure is non-fatal.
  }

  return result;
}

function parseRange(req: Request, res: Response): AllowedRange | null {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid range' });
    return null;
  }
  return parsed.data.range as AllowedRange;
}

export class AnalyticsController {
  async getSummary(req: Request, res: Response): Promise<void> {
    const range = parseRange(req, res);
    if (range === null) return;

    const summary = await getCached(`analytics:summary:${range}`, CACHE_TTL_SECONDS, () =>
      analyticsService.getSummary(range),
    );

    res.json(summary);
  }

  async getTimeseries(req: Request, res: Response): Promise<void> {
    const range = parseRange(req, res);
    if (range === null) return;

    const data = await getCached(`analytics:timeseries:${range}`, CACHE_TTL_SECONDS, () =>
      analyticsService.getTimeseries(range),
    );

    res.json(data);
  }

  async heartbeat(req: Request, res: Response): Promise<void> {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await activeNowService.heartbeat(userId);
    res.status(204).end();
  }
}

export const analyticsController = new AnalyticsController();