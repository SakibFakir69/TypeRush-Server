/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { prisma } from "../../../lib/prisma.db.js";

/**
 * Derived from the real `prisma` instance's $transaction signature instead of
 * `Prisma.TransactionClient` directly — that separate type wasn't binding to
 * the generated client here (same trick as the achievement service).
 */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The lifetime totals the progress screen shows. */
type OverviewTotals = {
  totalSessions: number;
  totalTimeTyped: number;
  bestWpm: number;
  bestAccuracy: number;
  avgWpm: number;
  avgAccuracy: number;
};

export class ProgressService {

  /**
   * Lifetime totals for the progress screen.
   *
   * `UserStats` is the fast path, but the row is only written when a run is
   * saved — accounts that typed before that writer existed have no row at all.
   * When the row is missing the numbers are recomputed from the user's own
   * results and the row is backfilled, so the endpoint is never empty for an
   * account that actually typed something.
   */
  async getOverview(userId: string) {
    const stats = await prisma.userStats.findUnique({ where: { userId } });

    if (stats && stats.totalSessions > 0) {
      return {
        userId,
        totalSessions: stats.totalSessions,
        totalTimeTyped: stats.totalTimeTyped,
        bestWpm: stats.bestWpm,
        bestAccuracy: stats.bestAccuracy,
        avgWpm: stats.avgWpm,
        avgAccuracy: stats.avgAccuracy,
      };
    }

    const totals = await this.computeTotals(userId);

    // Backfill quietly: a missing table or a slow write must never break the
    // read the progress screen is waiting on.
    try {
      await this.writeTotals(userId, totals);
    } catch (error) {
      console.error("progress stats backfill failed:", error);
    }

    return { userId, ...totals };
  }

  /** The same totals, recomputed from the user's own results. */
  private async computeTotals(userId: string): Promise<OverviewTotals> {
    const agg = await prisma.result.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { timeTaken: true },
      _max: { wpm: true, accuracy: true },
      _avg: { wpm: true, accuracy: true },
    });

    return {
      totalSessions: agg._count._all,
      // `timeTaken` is the seconds the run really took.
      totalTimeTyped: agg._sum.timeTaken ?? 0,
      bestWpm: agg._max.wpm ?? 0,
      bestAccuracy: agg._max.accuracy ?? 0,
      avgWpm: agg._avg.wpm ?? 0,
      avgAccuracy: agg._avg.accuracy ?? 0,
    };
  }

  /** Replace the stored totals with freshly computed ones. */
  private async writeTotals(userId: string, totals: OverviewTotals) {
    await prisma.userStats.upsert({
      where: { userId },
      update: {
        totalSessions: totals.totalSessions,
        totalTimeTyped: totals.totalTimeTyped,
        bestWpm: totals.bestWpm,
        bestAccuracy: totals.bestAccuracy,
        avgWpm: totals.avgWpm,
        avgAccuracy: totals.avgAccuracy,
      },
      create: {
        userId,
        totalSessions: totals.totalSessions,
        totalTimeTyped: totals.totalTimeTyped,
        bestWpm: totals.bestWpm,
        bestAccuracy: totals.bestAccuracy,
        avgWpm: totals.avgWpm,
        avgAccuracy: totals.avgAccuracy,
      },
    });
  }

  /**
   * Fold a finished run into the stored totals.
   *
   * Called from the practice/contest write paths inside their own
   * transaction, so `UserStats` always matches the results table.
   */
  async recordUserStats(
    tx: TxClient,
    userId: string,
    data: { wpm: number; accuracy: number; timeTyped: number }
  ) {
    await tx.$executeRaw`
      INSERT INTO "UserStats" ("userId", "totalSessions", "totalTimeTyped", "bestWpm", "bestAccuracy", "avgWpm", "avgAccuracy", "updatedAt")
      VALUES (${userId}, 1, ${data.timeTyped}, ${data.wpm}, ${data.accuracy}, ${data.wpm}, ${data.accuracy}, now())
      ON CONFLICT ("userId") DO UPDATE SET
        "totalSessions" = "UserStats"."totalSessions" + 1,
        "totalTimeTyped" = "UserStats"."totalTimeTyped" + ${data.timeTyped},
        "bestWpm" = GREATEST("UserStats"."bestWpm", ${data.wpm}),
        "bestAccuracy" = GREATEST("UserStats"."bestAccuracy", ${data.accuracy}),
        "avgWpm" = (("UserStats"."avgWpm" * "UserStats"."totalSessions") + ${data.wpm}) / ("UserStats"."totalSessions" + 1),
        "avgAccuracy" = (("UserStats"."avgAccuracy" * "UserStats"."totalSessions") + ${data.accuracy}) / ("UserStats"."totalSessions" + 1),
        "updatedAt" = now()
    `;
  }

  /**
   * The same fold, but in its own short transaction so a slow stats write
   * never holds the run that triggered it open — and a failure here is never
   * fatal: the totals are recomputed from the results on the next read.
   */
  async recordUserStatsSafe(
    userId: string,
    data: { wpm: number; accuracy: number; timeTyped: number }
  ) {
    try {
      await prisma.$transaction((tx) => this.recordUserStats(tx, userId, data));
    } catch (error) {
      console.error("progress stats update failed:", error);
    }
  }

  async getChartData(userId: string, range: '7d' | '30d' | '90d') {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
    return prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") as day,
             AVG(wpm)::float as "avgWpm",
             MAX(wpm)::float as "maxWpm",
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

    // Two plain reads in parallel: the batch-transaction form needs two
    // connections at once, and the remote pooler behind this database
    // regularly refuses to hand out a second one in time.
    const [items, total] = await Promise.all([
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

      await this.recordUserStats(tx, userId, {
        wpm: data.wpm,
        accuracy: data.accuracy,
        timeTyped: data.duration,
      });

      return result;
    });
  }
}

export const progressService = new ProgressService();
