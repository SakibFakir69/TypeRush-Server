import type { Request, Response } from "express";
import { joinQueue, cancelQueue, getStatus } from "./matchmakeing.service.js";

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