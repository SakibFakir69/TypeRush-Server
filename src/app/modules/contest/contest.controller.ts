import type { Request, Response, NextFunction } from "express";
import { DB } from "../../../../prisma/db/prisma.db.js";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import {
  createContestSchema,
  getContestsQuerySchema,
  getContestByIdSchema,
  joinContestSchema,
  leaveContestSchema,
  deleteContestSchema,
} from "./contest.validation.js";

/**
 * NOTE: userId/role now come from req.user (auth middleware), not the request
 * body. The old controller took them from req.body as a TODO placeholder —
 * trusting a client-supplied userId/role is a privilege-escalation bug, so
 * this rewrite closes it. Update createContestSchema / joinContestSchema /
 * leaveContestSchema / deleteContestSchema to drop userId (and role, for
 * delete) from their body shape, since they're no longer read from there.
 */

const createContest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(" [ call create contest ]")
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }
    console.log(req.body, "[ create contest ]")

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = createContestSchema.safeParse({ body: req.body });

    if (!parsed.success) {
      console.log(JSON.stringify(parsed.error.flatten(), null, 2)); 
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const { name, content, time } = parsed.data.body;

    // Prisma 8: .create(...) takes the fields directly, no `data` wrapper.
    const contest = await DB.Contest.create({ name, content, time, userId });

    return returnResponse(res, true, StatusCodes.CREATED, "Contest created successfully", contest);
  } catch (error) {
    next(error);
  }
};

const getContests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestsQuerySchema.safeParse({ query: req.query });
    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Invalid query parameters",
        parsed.error.flatten()
      );
    }

    const { userId } = parsed.data.query;

    let query = DB.Contest.include("user");
    if (userId) {
      query = query.where({ userId });
    }

    const contests = await query.orderBy((c) => c.createdAt.desc()).all();

    return returnResponse(res, true, StatusCodes.OK, "Contests fetched", contests);
  } catch (error) {
    next(error);
  }
};

const getContestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestByIdSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const { id } = parsed.data.params;

    const contest = await DB.Contest.where({ id })
      .include("user")
      .include("participants", (p) => p.include("user"))
      .first();

    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    return returnResponse(res, true, StatusCodes.OK, "Contest fetched", contest);
  } catch (error) {
    next(error);
  }
};

const joinContest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const parsed = joinContestSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const contestId = parsed.data.params.id;

    const contest = await DB.Contest.where({ id: contestId }).first();
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    try {
      const participant = await DB.ContestParticipant.create({ contestId, userId });
      return returnResponse(res, true, StatusCodes.CREATED, "Joined contest successfully", participant);
    } catch (error) {
      // Prisma 8 has no P2002: a unique violation surfaces as a DB-driver
      // error with sqlState "23505" on PostgreSQL (or MongoDB code 11000).
      if ((error as { sqlState?: string }).sqlState === "23505") {
        return returnResponse(res, false, StatusCodes.CONFLICT, "Already joined this contest");
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

const leaveContest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const parsed = leaveContestSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const contestId = parsed.data.params.id;

    // Prisma 8: .delete() returns the deleted record, or null if nothing
    // matched — it no longer throws P2025. Check the return value instead
    // of catching an error code.
    const deleted = await DB.ContestParticipant.where({ contestId, userId }).delete();

    if (!deleted) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Not a participant");
    }

    return returnResponse(res, true, StatusCodes.OK, "Left contest");
  } catch (error) {
    next(error);
  }
};

const deleteContest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requesterId = req.user?.userId as string;

    const requesterRole = req.user?.role;

    if (!requesterId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const parsed = deleteContestSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const { id } = parsed.data.params;

    const contest = await DB.Contest.where({ id }).first();
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    if (contest.userId !== requesterId && requesterRole !== "ADMIN") {
      return returnResponse(res, false, StatusCodes.FORBIDDEN, "Not authorized");
    }

    await DB.Contest.where({ id }).delete();

    return returnResponse(res, true, StatusCodes.OK, "Contest deleted");
  } catch (error) {
    next(error);
  }
};

export const contestController = {
  createContest,
  getContests,
  getContestById,
  joinContest,
  leaveContest,
  deleteContest,
};