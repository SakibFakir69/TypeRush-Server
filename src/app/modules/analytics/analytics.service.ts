/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { PrismaClient } from '@prisma/client';
import type { ActiveNowService } from './Active.now.service.js';
import type {
  AnalyticsSummary,
  TimeseriesPoint,
  RawDayCount,
  AllowedRange,
} from './analytics.types.js';

const DAY_MS = 86_400_000;

function percentChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** Builds a contiguous list of ISO day strings from start to end (inclusive). */
function buildDayRange(start: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(dayKey(new Date(start.getTime() + i * DAY_MS)));
  }
  return out;
}

/** Converts a raw grouped-by-day Prisma query result into a date -> count map. */
function toDayMap(rows: RawDayCount[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(dayKey(row.day), Number(row.count));
  }
  return map;
}

export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly activeNow: ActiveNowService,
  ) {}

  async getSummary(range: AllowedRange): Promise<AnalyticsSummary> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - range * DAY_MS);
    const prevStart = new Date(periodStart.getTime() - range * DAY_MS);

    const [
      matches,
      prevMatches,
      practiceTests,
      prevPracticeTests,
      newUsers,
      prevNewUsers,
      activeNow,
    ] = await Promise.all([
      this.prisma.result.count({
        where: { contestId: { not: null }, createdAt: { gte: periodStart } },
      }),
      this.prisma.result.count({
        where: {
          contestId: { not: null },
          createdAt: { gte: prevStart, lt: periodStart },
        },
      }),
      this.prisma.result.count({
        where: { contestId: null, createdAt: { gte: periodStart } },
      }),
      this.prisma.result.count({
        where: { contestId: null, createdAt: { gte: prevStart, lt: periodStart } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: prevStart, lt: periodStart } },
      }),
      this.activeNow.getActiveNow(),
    ]);

    return {
      matches,
      matchesChange: percentChange(matches, prevMatches),
      practiceTests,
      practiceTestsChange: percentChange(practiceTests, prevPracticeTests),
      newUsers,
      newUsersChange: percentChange(newUsers, prevNewUsers),
      activeNow,
    };
  }

  async getTimeseries(range: AllowedRange): Promise<TimeseriesPoint[]> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - range * DAY_MS);
    periodStart.setUTCHours(0, 0, 0, 0);

    const [matchRows, practiceRows, userRows] = await Promise.all([
      this.prisma.$queryRaw<RawDayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Result"
        WHERE "contestId" IS NOT NULL AND "createdAt" >= ${periodStart}
        GROUP BY day
        ORDER BY day
      `,
      this.prisma.$queryRaw<RawDayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Result"
        WHERE "contestId" IS NULL AND "createdAt" >= ${periodStart}
        GROUP BY day
        ORDER BY day
      `,
      this.prisma.$queryRaw<RawDayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "User"
        WHERE "createdAt" >= ${periodStart}
        GROUP BY day
        ORDER BY day
      `,
    ]);

    const matchMap = toDayMap(matchRows);
    const practiceMap = toDayMap(practiceRows);
    const userMap = toDayMap(userRows);

    return buildDayRange(periodStart, range).map((date) => ({
      date,
      matches: matchMap.get(date) ?? 0,
      practiceTests: practiceMap.get(date) ?? 0,
      newUsers: userMap.get(date) ?? 0,
    }));
  }
}