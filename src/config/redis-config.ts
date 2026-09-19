// src/config/redis.ts
import { Redis } from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL is not set");

export const redis = new Redis(url, {
  connectTimeout: 10_000,
  keepAlive: 10_000,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5_000),
  reconnectOnError: (err: Error) => err.message.includes("READONLY"),
  ...(url.startsWith("rediss://") ? { tls: {} } : {}),
});

redis.on("ready", () => console.log("Redis ready"));
redis.on("reconnecting", () => console.warn("Redis reconnecting"));
redis.on("error", (err: Error) => console.error("Redis error:", err.message));

export const closeRedis = async () => {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};