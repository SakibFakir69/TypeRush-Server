import type { Request, Response } from "express";
import { joinQueue, cancelQueue, getStatus,getMatchHistory } from "./matchmakeing.service.js";

export async function join(req: Request, res: Response) {
  const result = await joinQueue(req.user!.userId);
  res.json(result);
}

export async function cancel(req: Request, res: Response) {
  const result = await cancelQueue(req.user!.userId);
  res.json(result);
}

export async function status(req: Request, res: Response) {
  const result = await getStatus(req.user!.userId);
  res.json(result);
}
// self user match history

export async function history(req: Request, res: Response) {
  const { limit } = req.query as { limit?: string };
  const result = await getMatchHistory(req.user!.userId, Number(limit) || 20);
  res.json(result);
}