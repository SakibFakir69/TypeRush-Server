import Ably from "ably";

if (!process.env.ABLY_API_KEY) {
  throw new Error("ABLY_API_KEY is missing");
}

// REST client — for token requests, one-off publishes
export const ablyClient = new Ably.Rest({
  key: process.env.ABLY_API_KEY,
});

// Realtime client — only this one supports presence.subscribe()
export const ablyRealtime = new Ably.Realtime({
  key: process.env.ABLY_API_KEY,
});