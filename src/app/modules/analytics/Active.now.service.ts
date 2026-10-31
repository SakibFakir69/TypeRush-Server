import type { Redis } from 'ioredis';

/**
 * Tracks "active now" users via a Redis key per user with a short TTL.
 * Call `heartbeat(userId)` from the client every ~20s (or on socket connect
 * + a periodic ping) and `getActiveNow()` to read the current count.
 *
 * Uses a Redis SET with per-member scoring via a sorted set (ZSET) so we
 * don't have to SCAN key patterns in production (SCAN on KEYS is avoided
 * on purpose — it blocks/costs on large keyspaces).
 */
const ACTIVE_ZSET_KEY = 'analytics:active_users';
const ACTIVE_WINDOW_SECONDS = 60; // consider "active" if seen in last 60s

export class ActiveNowService {
  constructor(private readonly redis: Redis) {}

  async heartbeat(userId: string): Promise<void> {
    const now = Date.now();
    await this.redis.zadd(ACTIVE_ZSET_KEY, now, userId);
  }

  async getActiveNow(): Promise<number> {
    const cutoff = Date.now() - ACTIVE_WINDOW_SECONDS * 1000;
    // Lazily evict stale members, then count what's left.
    await this.redis.zremrangebyscore(ACTIVE_ZSET_KEY, 0, cutoff);
    return this.redis.zcard(ACTIVE_ZSET_KEY);
  }

  async removeUser(userId: string): Promise<void> {
    await this.redis.zrem(ACTIVE_ZSET_KEY, userId);
  }
}