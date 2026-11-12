/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { prisma } from "../../../lib/prisma.db.js";


export class ProgressService {
  
  async getOverview(userId: string) {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    return stats ?? {
      userId, totalSessions: 0, totalTimeTyped: 0,
      bestWpm: 0, bestAccuracy: 0, avgWpm: 0, avgAccuracy: 0,
    };
  }

  async getChartData(userId: string, range: '7d' | '30d' | '90d') {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
    return prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") as day,
             AVG(wpm)::float as "avgWpm",
             AVG(accuracy)::float as "avgAccuracy",
             COUNT(*)::int as sessions
      FROM "Result"
      WHERE "userId" = ${userId}
        AND "createdAt" >= now() - (${days} || ' days')::interval
      GROUP BY day
      ORDER BY day
    `;
  }

  async getHistory(userId: string, from?: string, to?: string, page = 1, limit = 20) {
    let dateFilter = {};
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
      if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
        const err: any = new Error('Date range exceeds 1 year');
        err.status = 400;
        throw err;
      }
      if (fromDate > toDate) {
        const err: any = new Error('"from" must be before "to"');
        err.status = 400;
        throw err;
      }
      dateFilter = { createdAt: { gte: fromDate, lte: toDate } };
    }

    const [items, total] = await prisma.$transaction([
      prisma.result.findMany({
        where: { userId, ...dateFilter },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.result.count({ where: { userId, ...dateFilter } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async recordSession(userId: string, data: {
    paragraphId?: string; wpm: number; accuracy: number;
    errors: number; timeTaken: number; duration: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.result.create({ data: { userId, ...data } });

      await tx.$executeRaw`
        INSERT INTO "UserStats" ("userId", "totalSessions", "totalTimeTyped", "bestWpm", "bestAccuracy", "avgWpm", "avgAccuracy", "updatedAt")
        VALUES (${userId}, 1, ${data.duration}, ${data.wpm}, ${data.accuracy}, ${data.wpm}, ${data.accuracy}, now())
        ON CONFLICT ("userId") DO UPDATE SET
          "totalSessions" = "UserStats"."totalSessions" + 1,
          "totalTimeTyped" = "UserStats"."totalTimeTyped" + ${data.duration},
          "bestWpm" = GREATEST("UserStats"."bestWpm", ${data.wpm}),
          "bestAccuracy" = GREATEST("UserStats"."bestAccuracy", ${data.accuracy}),
          "avgWpm" = (("UserStats"."avgWpm" * "UserStats"."totalSessions") + ${data.wpm}) / ("UserStats"."totalSessions" + 1),
          "avgAccuracy" = (("UserStats"."avgAccuracy" * "UserStats"."totalSessions") + ${data.accuracy}) / ("UserStats"."totalSessions" + 1),
          "updatedAt" = now()
      `;

      return result;
    });
  }
}

export const progressService = new ProgressService();