import Ably from "ably";

if (!process.env.ABLY_API_KEY) {
  throw new Error("ABLY_API_KEY is missing");
}

export const ablyClient = new Ably.Rest({
  key: process.env.ABLY_API_KEY,
});