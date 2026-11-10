import { prisma } from "../../../../lib/prisma.db.js";

export async function getOverview(userId: string) {
  const [totalMatches, resultCounts, aggregates, user] = await Promise.all([
    prisma.matchParticipant.count({ where: { userId } }),

    prisma.matchParticipant.groupBy({
      by: ["result"],
      where: { userId, result: { not: null } },
      _count: { result: true },
    }),

    prisma.matchParticipant.aggregate({
      where: { userId, wpm: { not: null } },
      _avg: { wpm: true, accuracy: true },
      _max: { wpm: true },
    }),

    prisma.user.findUnique({ where: { id: userId }, select: { rating: true } }),
  ]);

  const wins = resultCounts.find((r) => r.result === "WIN")?._count.result ?? 0;
  const losses = resultCounts.find((r) => r.result === "LOSS")?._count.result ?? 0;
  const draws = resultCounts.find((r) => r.result === "DRAW")?._count.result ?? 0;
  const abandoned = resultCounts.find((r) => r.result === "ABANDONED")?._count.result ?? 0;
  const decided = wins + losses + draws;

  return {
    totalMatches,
    wins,
    losses,
    draws,
    abandoned,
    winRate: decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0,
    avgWpm: aggregates._avg.wpm ? Number(aggregates._avg.wpm.toFixed(1)) : 0,
    avgAccuracy: aggregates._avg.accuracy ? Number(aggregates._avg.accuracy.toFixed(1)) : 0,
    bestWpm: aggregates._max.wpm ?? 0,
    currentRating: user?.rating ?? 0,
  };
}

export async function getTimeSeries(userId: string, limit: number) {
  const take = Math.min(limit || 50, 200);

  const rows = await prisma.matchParticipant.findMany({
    where: { userId, wpm: { not: null } },
    select: {
      wpm: true,
      accuracy: true,
      errors: true,
      result: true,
      ratingBefore: true,
      ratingAfter: true,
      joinedAt: true,
      match: { select: { id: true, endedAt: true } },
    },
    orderBy: { joinedAt: "asc" },
    take,
  });

  return rows.map((r) => ({
    matchId: r.match.id,
    date: (r.match.endedAt ?? r.joinedAt).toISOString(),
    wpm: r.wpm,
    accuracy: r.accuracy,
    errors: r.errors,
    result: r.result,
    rating: r.ratingAfter ?? r.ratingBefore,
    ratingDelta: r.ratingAfter !== null ? r.ratingAfter - r.ratingBefore : 0,
  }));
}

export async function getDeltas(userId: string) {

  const rows = await prisma.matchParticipant.findMany({
    where: { userId, wpm: { not: null } },
    select: { wpm: true, accuracy: true, joinedAt: true, match: { select: { id: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const deltas: { matchId: string; date: string; wpmDelta: number; accuracyDelta: number }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    if (!prev || !curr) continue; // narrows both for TS, also just safe

    deltas.push({
      matchId: curr.match.id,
      date: curr.joinedAt.toISOString(),
      wpmDelta: Number(((curr.wpm ?? 0) - (prev.wpm ?? 0)).toFixed(1)),
      accuracyDelta: Number(((curr.accuracy ?? 0) - (prev.accuracy ?? 0)).toFixed(1)),
    });
  }

  return deltas;
}

export async function getHistory(userId: string, limit: number) {
  const take = Math.min(limit || 20, 100);

  return prisma.matchParticipant.findMany({
    where: { userId },
    select: {
      wpm: true,
      accuracy: true,
      errors: true,
      result: true,
      ratingBefore: true,
      ratingAfter: true,
      match: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          paragraph: { select: { content: true, difficulty: true } },
          participants: {
            select: { userId: true, wpm: true, result: true, user: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    take,
  });
}



type Granularity = "day" | "week" | "month";

export async function getMatchmakingTimeseries(
  granularity: Granularity = "day",
  days: number = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const truncUnit = granularity; 

  const rows = await prisma.$queryRawUnsafe<
    { bucket: Date; count: bigint }[]
  >(
    `
    SELECT date_trunc('${truncUnit}', "createdAt") AS bucket,
           COUNT(*) AS count
    FROM "Match"
    WHERE "createdAt" >= $1
    GROUP BY bucket
    ORDER BY bucket ASC
    `,
    since
  );

  return rows.map((r) => ({
    date: r.bucket.toISOString(),
    count: Number(r.count),
  }));
}