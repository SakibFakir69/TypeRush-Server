import { prisma } from "../../../../lib/prisma.db.js";
import { ablyClient } from "../../../../config/ably-config.js";
import { markAcked } from "../matchmaking/matchAck.service.js";
import { grantMatchXp } from "../../xp/xp.service.js";


/** Everyone starts at 100 and moves in whole points. */
const K_FACTOR = 24;

export type MatchResultInput = {
  wpm: number;
  accuracy: number;
  errors: number;
};

export type MatchView = {
  id: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  paragraph: string;
  /** Race length in seconds (invites choose it, ranked matches use the default). */
  duration: number;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  createdAt: string;
  participants: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    ratingBefore: number;
    ratingAfter: number | null;
    wpm: number | null;
    accuracy: number | null;
    errors: number | null;
    result: "WIN" | "LOSS" | "DRAW" | "ABANDONED" | null;
    finished: boolean;
  }>;
};

function expectedScore(rating: number, opponent: number) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** Elo with a draw as half a win. Ratings never go below zero. */
export function nextRatings(
  ratingA: number,
  ratingB: number,
  outcomeA: 0 | 0.5 | 1
) {
  const delta = Math.round(K_FACTOR * (outcomeA - expectedScore(ratingA, ratingB)));
  return {
    a: Math.max(0, ratingA + delta),
    b: Math.max(0, ratingB - delta),
  };
}

const matchInclude = {
  paragraph: true,
  participants: {
    include: { user: { select: { name: true, avatarUrl: true } } },
  },
} as const;

type MatchWithParticipants = {
  id: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  duration: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  winnerId: string | null;
  paragraph: { content: string };
  participants: Array<{
    userId: string;
    ratingBefore: number;
    ratingAfter: number | null;
    wpm: number | null;
    accuracy: number | null;
    errors: number | null;
    result: "WIN" | "LOSS" | "DRAW" | "ABANDONED" | null;
    user: { name: string; avatarUrl: string | null };
  }>;
};

function toView(match: MatchWithParticipants): MatchView {
  return {
    id: match.id,
    status: match.status,
    paragraph: match.paragraph.content,
    duration: match.duration,
    startedAt: match.startedAt ? match.startedAt.toISOString() : null,
    endedAt: match.endedAt ? match.endedAt.toISOString() : null,
    winnerId: match.winnerId,
    createdAt: match.createdAt.toISOString(),
    participants: match.participants.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      avatarUrl: p.user.avatarUrl,
      ratingBefore: p.ratingBefore,
      ratingAfter: p.ratingAfter,
      wpm: p.wpm,
      accuracy: p.accuracy,
      errors: p.errors,
      result: p.result,
      finished: p.wpm !== null,
    })),
  };
}

async function loadMatch(matchId: string) {
  return prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: matchInclude,
  });
}

export async function getMatchForUser(matchId: string, userId: string) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, participants: { some: { userId } } },
    include: matchInclude,
  });
  if (!match) return null;

  // Reading the match proves the player is in the room, so a client whose
  // realtime connection is blocked still counts as ready.
  if (match.status === "ACTIVE") markAcked(matchId, userId);

  return toView(match);
}

/**
 * Records one participant's run. The match finishes as soon as both have
 * submitted; a repeated submit is a no-op and just returns the current state.
 */
export async function submitMatchResult(
  matchId: string,
  userId: string,
  input: MatchResultInput
) {
  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId, userId } },
    include: { match: true },
  });

  if (!participant) return { error: "not_participant" as const };
  if (participant.match.status !== "ACTIVE") {
    return { error: "not_active" as const };
  }

  await prisma.matchParticipant.update({
    where: { matchId_userId: { matchId, userId } },
    data: {
      wpm: Math.max(0, Math.round(input.wpm)),
      accuracy: Math.min(100, Math.max(0, Math.round(input.accuracy))),
      errors: Math.max(0, Math.round(input.errors)),
    },
  });

  const channel = ablyClient.channels.get(`match:${matchId}`);
  await channel
    .publish("opponent_finished", { matchId, userId })
    .catch(() => undefined);

  const match = await loadMatch(matchId);
  const everyoneFinished = match.participants.every((p) => p.wpm !== null);
  if (!everyoneFinished) {
    return { match: toView(match), finished: false as const };
  }

  const finished = await finishMatch(matchId);
  return { match: toView(finished), finished: true as const };
}

/** Compares the two runs, applies Elo, grants XP, and publishes the final state. */
async function finishMatch(matchId: string) {
  const before = await loadMatch(matchId);
  if (before.status === "COMPLETED") return before;

  const [a, b] = before.participants;
  if (!a || !b || a.wpm === null || b.wpm === null) return before;

  // Faster wins; accuracy breaks a WPM tie; otherwise a draw.
  let outcomeA: 0 | 0.5 | 1 = 0.5;
  if (a.wpm !== b.wpm) outcomeA = a.wpm > b.wpm ? 1 : 0;
  else if ((a.accuracy ?? 0) !== (b.accuracy ?? 0)) {
    outcomeA = (a.accuracy ?? 0) > (b.accuracy ?? 0) ? 1 : 0;
  }

  const ratings = nextRatings(a.ratingBefore, b.ratingBefore, outcomeA);
  const resultA = outcomeA === 0.5 ? "DRAW" : outcomeA === 1 ? "WIN" : "LOSS";
  const resultB = outcomeA === 0.5 ? "DRAW" : outcomeA === 1 ? "LOSS" : "WIN";

  const claimed = await prisma.match.updateMany({
    where: { id: matchId, status: "ACTIVE" },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      winnerId: outcomeA === 0.5 ? null : outcomeA === 1 ? a.userId : b.userId,
    },
  });

  // Another request already finished it — return the settled match.
  if (claimed.count === 0) return loadMatch(matchId);

  await prisma.$transaction(async (tx) => {
    await tx.matchParticipant.update({
      where: { matchId_userId: { matchId, userId: a.userId } },
      data: { ratingAfter: ratings.a, result: resultA },
    });
    await tx.matchParticipant.update({
      where: { matchId_userId: { matchId, userId: b.userId } },
      data: { ratingAfter: ratings.b, result: resultB },
    });
    await tx.user.update({
      where: { id: a.userId },
      data: { rating: ratings.a },
    });
    await tx.user.update({
      where: { id: b.userId },
      data: { rating: ratings.b },
    });

    // An invite-born match gets reduced, once-per-opponent-per-day XP.
    const invite = await tx.privateInvite.findUnique({ where: { matchId } });

    await grantMatchXp(tx, a.userId, resultA, a.wpm!, a.accuracy ?? 0, {
      isInvited: !!invite,
      opponentId: b.userId,
    });
    await grantMatchXp(tx, b.userId, resultB, b.wpm!, b.accuracy ?? 0, {
      isInvited: !!invite,
      opponentId: a.userId,
    });
  });

  const settled = await loadMatch(matchId);
  await ablyClient.channels
    .get(`match:${matchId}`)
    .publish("match_finished", toView(settled))
    .catch(() => undefined);

  return settled;
}

/** Leaving an unfinished race settles it as abandoned for both players. No XP: ABANDONED earns 0. */
export async function forfeitMatch(matchId: string, userId: string) {
  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId, userId } },
    include: { match: true },
  });
  if (!participant) return { error: "not_participant" as const };
  if (participant.match.status !== "ACTIVE") {
    return { error: "not_active" as const };
  }

  const claimed = await prisma.match.updateMany({
    where: { id: matchId, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: true as const };

  await prisma.matchParticipant.updateMany({
    where: { matchId, result: null },
    data: { result: "ABANDONED" },
  });

  await ablyClient.channels
    .get(`match:${matchId}`)
    .publish("match_voided", { matchId, reason: "left" })
    .catch(() => undefined);

  return { ok: true as const };
}




export async function getRecentMatchesForUser(
  userId: string,
  limit: number,
  offset: number
) {
  const where = {
    participants: { some: { userId } },
  };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        participants: {
          select: { userId: true, wpm: true, accuracy: true, errors: true },
        },
      },
    }),
    prisma.match.count({ where }),
  ]);

  return { matches, total };
}



export async function getRecentMatchesAdmin(limit: number, offset: number) {
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        participants: {
          select: { userId: true, wpm: true, accuracy: true, errors: true },
        },
      },
    }),
    prisma.match.count(),
  ]);

  return { matches, total };
}

export async function getLatestMatchesAdmin(limit: number) {
  return prisma.match.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      participants: {
        select: { userId: true, wpm: true, accuracy: true, errors: true },
      },
    },
  });
}