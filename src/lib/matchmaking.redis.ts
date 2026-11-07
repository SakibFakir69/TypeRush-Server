import { redis } from "../config/redis-config.js";



const QUEUE_KEY = 'matchmaking:queue';


export async function enqueue(userId: string, rating: number) {
  await redis.zadd(QUEUE_KEY, rating, userId);
}

export async function dequeue(userId: string) {
  await redis.zrem(QUEUE_KEY, userId);
}

export async function findOpponent(userId: string, rating: number, range = 100) {
  // get users within rating range, excluding self
  const candidates = await redis.zrangebyscore(QUEUE_KEY, rating - range, rating + range);
  return candidates.find(id => id !== userId) ?? null;
}