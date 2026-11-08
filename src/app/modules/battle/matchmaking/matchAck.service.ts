import type { InboundMessage } from "ably";
import { prisma } from "../../../../lib/prisma.db.js";
import { ablyRealtime } from "../../../../config/ably-config.js";
import { enqueue } from "../../../../lib/matchmaking.redis.js";

const ACK_TIMEOUT_MS = 5000;

export function awaitMatchAck(matchId: string, userIds: [string, string]) {
  const acked = new Set<string>();
  const channel = ablyRealtime.channels.get(`match:${matchId}`);

  const listener = (msg: InboundMessage) => {
    if (typeof msg.clientId === "string") {
      acked.add(msg.clientId);
    }
  };

  void channel.subscribe("ack", listener);

  setTimeout(() => {
    void channel.unsubscribe("ack", listener);
    void resolveAck(matchId, userIds, acked);
  }, ACK_TIMEOUT_MS);
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