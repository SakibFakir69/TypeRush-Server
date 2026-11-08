import { ablyRealtime } from "../../../../config/ably-config.js";
import { sweepQueue, handlePresenceLeave } from "./matchmakeing.service.js";

const SWEEP_INTERVAL_MS = 1500;

export function startMatchmakingWorker() {
  // presence-based auto-dequeue on disconnect/leave
  const lobby = ablyRealtime.channels.get("matchmaking:lobby");
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  lobby.presence.subscribe("leave", (member) => {
    if (typeof member.clientId === "string") {
      void handlePresenceLeave(member.clientId);
    }
  });

  // periodic sweep — this is what actually matches people now
  setInterval(() => {
    sweepQueue().catch((err) => console.error("sweepQueue error", err));
  }, SWEEP_INTERVAL_MS);

  console.log("Matchmaking worker started");
}