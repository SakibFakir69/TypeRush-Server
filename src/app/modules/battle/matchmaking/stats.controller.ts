import type { Request, Response } from "express";
import * as statsService from "./stats.service.js";
import { returnResponse } from "../../../../helpers/return-response.js";

export async function overview(req: Request, res: Response) {
  try {
    const result = await statsService.getOverview(req.user!.userId);
    return returnResponse(res, true, 200, "match overview", result);
  } catch (err) {
    console.error("overview error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
}

export async function timeSeries(req: Request, res: Response) {
  try {
    const { limit } = req.query as { limit?: string };
    const result = await statsService.getTimeSeries(req.user!.userId, Number(limit));
    return returnResponse(res, true, 200, "match time series", { series: result });
  } catch (err) {
    console.error("timeSeries error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
}

export async function deltas(req: Request, res: Response) {
  try {

    const result = await statsService.getDeltas(req.user!.userId);
    return returnResponse(res, true, 200, "match deltas", { deltas: result });
  } catch (err) {
    console.error("deltas error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
}

export async function history(req: Request, res: Response) {
  try {
    const { limit } = req.query as { limit?: string };
    const result = await statsService.getHistory(req.user!.userId, Number(limit));
    return returnResponse(res, true, 200, "match history", { matches: result });
  } catch (err) {
    console.error("history error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
}

export async function matchmakingTimeseries(req: Request, res: Response) {
  const granularity = (req.query.granularity as string) || "day";
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

  if (!["day", "week", "month"].includes(granularity)) {
    return returnResponse(
      res,
      false,
      400,
      "granularity must be day, week, or month"
    );
  }

  try {
    const result = await statsService.getMatchmakingTimeseries(
      granularity as "day" | "week" | "month",
      days
    );
    return returnResponse(res, true, 200, "matchmaking timeseries", {
      granularity,
      days,
      series: result,
    });
  } catch (err) {
    console.error("matchmakingTimeseries error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
}

export const matchmakingStatController = {
    history,timeSeries,overview,deltas,matchmakingTimeseries
}