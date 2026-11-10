import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../../../helpers/return-response.js";
import {
  forfeitMatch,
  getMatchForUser,
  getRecentMatchesForUser,
  submitMatchResult,
  getLatestMatchesAdmin,getRecentMatchesAdmin
} from "./match.service.js";

export async function getMatch(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const userId = req.user!.userId;

  const match = await getMatchForUser(id, userId);
  if (!match) {
    return returnResponse(
      res,
      false,
      StatusCodes.NOT_FOUND,
      "Match not found"
    );
  }

  return res.status(StatusCodes.OK).json({ success: true, data: match });
}

export async function submitResult(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const userId = req.user!.userId;
  const { wpm, accuracy, errors } = req.body as {
    wpm?: unknown;
    accuracy?: unknown;
    errors?: unknown;
  };

  if (
    typeof wpm !== "number" ||
    typeof accuracy !== "number" ||
    typeof errors !== "number" ||
    !Number.isFinite(wpm) ||
    !Number.isFinite(accuracy) ||
    !Number.isFinite(errors)
  ) {
    return returnResponse(
      res,
      false,
      StatusCodes.BAD_REQUEST,
      "Send wpm, accuracy and errors as numbers"
    );
  }

  const result = await submitMatchResult(id, userId, { wpm, accuracy, errors });

  if ("error" in result) {
    const status =
      result.error === "not_participant"
        ? StatusCodes.FORBIDDEN
        : StatusCodes.CONFLICT;
    const message =
      result.error === "not_participant"
        ? "You are not in this match"
        : "This match is no longer active";
    return returnResponse(res, false, status, message);
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: { match: result.match, finished: result.finished },
  });
}

export async function forfeit(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const userId = req.user!.userId;

  const result = await forfeitMatch(id, userId);
  if ("error" in result) {
    return returnResponse(
      res,
      false,
      result.error === "not_participant"
        ? StatusCodes.FORBIDDEN
        : StatusCodes.CONFLICT,
      result.error === "not_participant"
        ? "You are not in this match"
        : "This match is no longer active"
    );
  }

  return res.status(StatusCodes.OK).json({ success: true });
}


export async function getLatestMatches(req: Request, res: Response) {
  const userId = req.user!.userId;
  

  const matches = await getRecentMatchesForUser(userId, 50, 0);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: matches.matches,
  });
}

export async function getRecentMatches(req: Request, res: Response) {
  const userId = req.user!.userId;

  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const { matches, total } = await getRecentMatchesForUser(
    userId,
    limit,
    offset
  );

  return res.status(StatusCodes.OK).json({
    success: true,
    data: matches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}



export async function getRecentMatchesAdminHandler(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const { matches, total } = await getRecentMatchesAdmin(limit, offset);
  

  return res.status(StatusCodes.OK).json({
    success: true,
    data: matches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getLatestMatchesAdminHandler(req: Request, res: Response) {
  const matches = await getLatestMatchesAdmin(50);

  return res.status(StatusCodes.OK).json({
    success: true,
    data: matches,
  });
}
