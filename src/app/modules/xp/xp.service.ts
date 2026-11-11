// src/modules/xp/xp.service.ts
import type { Prisma, MatchResult } from '@prisma/client';
import { redis } from '../../../config/redis-config.js';

type TxClient = Prisma.TransactionClient;

// ---------- internal helpers ----------

async function incrementXp(tx: TxClient, userId: string, amount: number) {
  if (amount <= 0) return;
  await tx.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
}

/**
 * Atomically reserves up to `amount` xp under a daily cap for `key`.
 * Returns how much is actually allowed (0..amount).
 */
async function checkAndConsumeDailyCap(
  key: string,
  amount: number,
  cap: number,
): Promise<number> {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const redisKey = `xp:${key}:${dateKey}`;

  const current = parseInt((await redis.get(redisKey)) ?? '0', 10);
  const allowed = Math.max(0, Math.min(amount, cap - current));
  if (allowed <= 0) return 0;

  const newTotal = await redis.incrby(redisKey, allowed);
  if (newTotal === allowed) {
    // first write today for this key — set expiry so it self-cleans
    await redis.expire(redisKey, 60 * 60 * 26); // 26h safety margin over a calendar day
  }
  return allowed;
}

// ---------- formulas ----------

function practiceXpFormula(wpm: number, accuracy: number): number {
  const raw = Math.floor(wpm * (accuracy / 100) * 0.4);
  return Math.min(raw, 20); // per-session ceiling
}

function contestXpFormula(
  wpm: number,
  accuracy: number,
  placement: number | null,
): number {
  const base = Math.floor(wpm * (accuracy / 100) * 1.0);
  let bonus = 0;
  if (placement === 1) bonus = 100;
  else if (placement === 2) bonus = 50;
  else if (placement === 3) bonus = 25;
  else if (placement !== null && placement <= 10) bonus = 15;
  return base + bonus;
}

function matchXpFormula(
  result: MatchResult,
  wpm: number,
  accuracy: number,
): number {
  const ratio = accuracy / 100;
  if (result === 'WIN') return 30 + Math.floor(wpm * ratio * 0.3);
  if (result === 'LOSS') return 10 + Math.floor(wpm * ratio * 0.15);
  if (result === 'DRAW') return 15;
  return 0; // ABANDONED
}

// ---------- public API ----------

export async function grantPracticeXp(
  tx: TxClient,
  userId: string,
  wpm: number,
  accuracy: number,
): Promise<number> {
  const raw = practiceXpFormula(wpm, accuracy);
  const allowed = await checkAndConsumeDailyCap(`practice:${userId}`, raw, 150);
  await incrementXp(tx, userId, allowed);
  return allowed;
}

export async function grantContestXp(
  tx: TxClient,
  userId: string,
  wpm: number,
  accuracy: number,
  placement: number | null,
): Promise<number> {
  const amount = contestXpFormula(wpm, accuracy, placement);
  await incrementXp(tx, userId, amount); // no daily cap — contests are schedule-limited already
  return amount;
}

export async function grantMatchXp(
  tx: TxClient,
  userId: string,
  result: MatchResult,
  wpm: number,
  accuracy: number,
  opts: { isInvited: boolean; opponentId?: string },
): Promise<number> {
  let amount = matchXpFormula(result, wpm, accuracy);
  if (amount <= 0) return 0;

  if (opts.isInvited) {
    amount = Math.floor(amount * 0.5);
    if (!opts.opponentId) {
      throw new Error('opponentId required for invited match xp');
    }
    const pairKey = [userId, opts.opponentId].sort().join(':');
    // cap = amount itself -> only the FIRST match vs this opponent today pays out
    amount = await checkAndConsumeDailyCap(`invite-pair:${pairKey}`, amount, amount);
  }

  await incrementXp(tx, userId, amount);
  return amount;
}