import type { InboundMessage } from "ably";
import { prisma } from "../../../../lib/prisma.db.js";
import { ablyRealtime } from "../../../../config/ably-config.js";
import { enqueue } from "../../../../lib/matchmaking.redis.js";

/**
 * Both players have this long to show up. `ack` over realtime and a plain
 * HTTP read of the match both count, so a blocked WebSocket cannot stop a race.
 */
const ACK_TIMEOUT_MS = 8000;

type AckSession = {
  userIds: [string, string];
  acked: Set<string>;
  listener: (msg: InboundMessage) => void;
  timer: ReturnType<typeof setTimeout>;
  done: boolean;
};

const sessions = new Map<string, AckSession>();

export function awaitMatchAck(matchId: string, userIds: [string, string]) {
  const channel = ablyRealtime.channels.get(`match:${matchId}`);

  const listener = (msg: InboundMessage) => {
    if (typeof msg.clientId === "string") markAcked(matchId, msg.clientId);
  };

  void channel.subscribe("ack", listener);

  sessions.set(matchId, {
    userIds,
    acked: new Set<string>(),
    listener,
    timer: setTimeout(() => {
      void settleAck(matchId);
    }, ACK_TIMEOUT_MS),
    done: false,
  });
}

/** Records a player as present; starts the race as soon as both are in. */
export function markAcked(matchId: string, userId: string) {
  const session = sessions.get(matchId);
  if (!session || session.done) return;
  if (!session.userIds.includes(userId)) return;

  session.acked.add(userId);
  if (session.userIds.every((id) => session.acked.has(id))) {
    void settleAck(matchId);
  }
}

async function settleAck(matchId: string) {
  const session = sessions.get(matchId);
  if (!session || session.done) return;

  // Claim the session first so the timer and an ack cannot both settle it.
  session.done = true;
  sessions.delete(matchId);
  clearTimeout(session.timer);

  const channel = ablyRealtime.channels.get(`match:${matchId}`);
  channel.unsubscribe("ack", session.listener);
  await resolveAck(matchId, session.userIds, session.acked);
}

async function resolveAck(
  matchId: string,
  userIds: [string, string],
  acked: Set<string>
) {
  const bothAcked = userIds.every((id) => acked.has(id));
  const channel = ablyRealtime.channels.get(`match:${matchId}`);

  if (bothAcked) {
    // Give both clients the same starting gun so neither gets a head start.
    const startsAt = new Date(Date.now() + 3000);
    await prisma.match.update({
      where: { id: matchId },
      data: { startedAt: startsAt },
    });
    await channel.publish("match_started", {
      matchId,
      startsAt: startsAt.toISOString(),
    });
    return;
  }

  // abandon the match, requeue whoever acked
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "ABANDONED", endedAt: new Date() },
  });

  await channel.publish("match_voided", { matchId, reason: "ack_timeout" });

  for (const userId of userIds) {
    if (acked.has(userId)) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await enqueue(userId, user.rating);
    }
  }
}
