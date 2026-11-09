import { redis } from "../config/redis-config.js";

const QUEUE_KEY = "matchmaking:queue";
const META_KEY = "matchmaking:meta"; 

const FIND_AND_REMOVE_LUA = `
local candidates = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[2], ARGV[3])
for _, id in ipairs(candidates) do
  if id ~= ARGV[1] then
    redis.call('ZREM', KEYS[1], id)
    redis.call('HDEL', KEYS[2], id)
    return id
  end
end
return nil
`;

export async function enqueue(userId: string, rating: number) {
  const now = String(Date.now());
  await redis
    .multi()
    .zadd(QUEUE_KEY, rating, userId)
    .hset(META_KEY, userId, now)
    .exec();
}

export async function dequeue(userId: string) {
  await redis
    .multi()
    .zrem(QUEUE_KEY, userId)
    .hdel(META_KEY, userId)
    .exec();
}

export async function findAndRemoveOpponent(
  userId: string,
  rating: number,
  range: number
): Promise<string | null> {

  const result = await redis.eval(
    FIND_AND_REMOVE_LUA,
    2,
    QUEUE_KEY,
    META_KEY,
    userId,
    String(rating - range),
    String(rating + range)
  );
  return result as string | null;
}


export async function getWaitingUsers(): Promise<
  { userId: string; rating: number; enqueuedAt: number }[]
> {

  const ids = await redis.zrange(QUEUE_KEY, "0", "-1", "WITHSCORES");
  const meta = await redis.hgetall(META_KEY);
 
  const result: { userId: string; rating: number; enqueuedAt: number }[] = [];
  
  for (let i = 0; i < ids.length; i += 2) {

    const userId = ids[i];
    const ratingStr = ids[i + 1];
    if (!userId || !ratingStr) continue;

    const rating = Number(ratingStr);
    const enqueuedAt = Number(meta[userId] ?? Date.now());

    result.push({ userId, rating, enqueuedAt });
  }
  return result;
}

export async function isUserQueued(userId: string): Promise<boolean> {
  const score = await redis.zscore(QUEUE_KEY, userId);
  return score !== null;
}