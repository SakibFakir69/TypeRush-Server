
import type { Request, Response, NextFunction } from 'express';
import { progressService } from './progress.service.js';
import { getHistorySchema, getChartSchema } from './progress.validation.js';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId; 
    const data = await progressService.getOverview(userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getCharts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { range } = getChartSchema.parse(req.query);
    const data = await progressService.getChartData(userId, range);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { from, to, page, limit } = getHistorySchema.parse(req.query);
    const data = await progressService.getHistory(userId, from, to, page, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export const progressController = {
    getHistory,getCharts,getOverview
}