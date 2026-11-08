import { prisma } from "../../../../lib/prisma.db.js";
import {
  dequeue,
  enqueue,
  findAndRemoveOpponent,
  getWaitingUsers,
  isUserQueued,
} from "../../../../lib/matchmaking.redis.js";
import { ablyClient } from "../../../../config/ably-config.js";
import type { MatchFoundPayload } from "./matchmaking.type.js";
import { awaitMatchAck } from "./matchAck.service.js";

const BASE_RANGE = 100;
const RANGE_STEP = 50;
const RANGE_STEP_MS = 5000;

export async function joinQueue(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await enqueue(userId, user.rating);
  return { status: "waiting" as const };
}

export async function cancelQueue(userId: string) {
  await dequeue(userId);
  return { status: "cancelled" as const };
}

export async function sweepQueue() {
  const waiting = await getWaitingUsers();
  if (waiting.length === 0) return;

  // oldest-waiting first so they get priority on widened range
  waiting.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  const alreadyMatched = new Set<string>();

  for (const user of waiting) {
    if (alreadyMatched.has(user.userId)) continue;

    const waitedMs = Date.now() - user.enqueuedAt;
    const range = BASE_RANGE + Math.floor(waitedMs / RANGE_STEP_MS) * RANGE_STEP;

    const opponentId = await findAndRemoveOpponent(user.userId, user.rating, range);
    if (!opponentId) continue;

    // user is now matched too — remove them from the queue
    await dequeue(user.userId);

    alreadyMatched.add(user.userId);
    alreadyMatched.add(opponentId);

    await createMatch(user.userId, user.rating, opponentId);
  }
}

async function createMatch(userId: string, userRating: number, opponentId: string) {
  const opponent = await prisma.user.findUniqueOrThrow({ where: { id: opponentId } });
  const paragraph = await prisma.paragraph.findFirstOrThrow({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
  });

  const match = await prisma.match.create({
    data: {
      paragraphId: paragraph.id,
      status: "ACTIVE",
      startedAt: new Date(),
      participants: {
        create: [
          { userId, ratingBefore: userRating },
          { userId: opponentId, ratingBefore: opponent.rating },
        ],
      },
    },
  });

  await notifyMatchFound([userId, opponentId], {
    matchId: match.id,
    paragraph: paragraph.content,
    matchChannel: `match:${match.id}`,
  });

  awaitMatchAck(match.id, [userId, opponentId]);
}

async function notifyMatchFound(userIds: string[], payload: MatchFoundPayload) {
  await Promise.all(
    userIds.map((id) =>
      ablyClient.channels.get(`matchmaking:user:${id}`).publish("match_found", payload)
    )
  );
}

export async function handlePresenceLeave(userId: string) {
  await dequeue(userId);
}

export async function getStatus(userId: string) {
  const activeParticipant = await prisma.matchParticipant.findFirst({
    where: {
      userId,
      match: { status: "ACTIVE" },
    },
    include: { match: true },
    orderBy: { joinedAt: "desc" },
  });

  if (activeParticipant) {
    return {
      status: "matched" as const,
      matchId: activeParticipant.match.id,
    };
  }

  const inQueue = await isUserQueued(userId);
  return { status: inQueue ? ("waiting" as const) : ("idle" as const) };
}