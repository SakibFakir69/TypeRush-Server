/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import { ContestServices } from "./contest.service.js";
import {
  createContestSchema,
  getContestsQuerySchema,
  getContestByIdSchema,
  joinContestSchema,
  leaveContestSchema,
  deleteContestSchema,
  getContestsQuerySchemaAll,
  submitContestResultSchema,
} from "./contest.validation.js";

/**
 * NOTE: userId/role come from req.user (auth middleware), not the request
 * body — not reintroduced by this Prisma 7 conversion.
 */

const createContest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const parsed = createContestSchema.safeParse({ body: req.body });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const contest = await ContestServices.createContest(parsed.data.body, userId);
    return returnResponse(res, true, StatusCodes.CREATED, "Contest created successfully", contest);
  } catch (error) {
    next(error);
  }
};

const getContests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestsQuerySchema.safeParse({ query: req.query });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid query parameters", parsed.error.flatten());
    }

    const contests = await ContestServices.getContests(parsed.data.query);
    return returnResponse(res, true, StatusCodes.OK, "Contests fetched", contests);
  } catch (error) {
    next(error);
  }
};

const getMyContests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    // userId comes from the authenticated session, not a query param — a
    // client can't pass ?userId=<someone-else> to list someone else's
    // contests under "my contests".
    const contests = await ContestServices.getMyContests(userId);
    return returnResponse(res, true, StatusCodes.OK, "Your contests fetched", contests);
  } catch (error) {
    next(error);
  }
};

const getContestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestByIdSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const contest = await ContestServices.getContestById(parsed.data.params.id);
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
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten().fieldErrors);
    }

    const contestId = parsed.data.params.id;

    const contest = await ContestServices.findContestById(contestId);
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    try {
      const participant = await ContestServices.joinContest(userId, contestId);
      return returnResponse(res, true, StatusCodes.CREATED, "Joined contest successfully", participant);
    } catch (error) {
      // Prisma 7: unique constraint violations throw
      // PrismaClientKnownRequestError with code "P2002".
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const contestId = parsed.data.params.id;

    try {
      await ContestServices.leaveContest(userId, contestId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return returnResponse(res, false, StatusCodes.NOT_FOUND, "Not a participant");
      }
      throw error;
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
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const { id } = parsed.data.params;

    const contest = await ContestServices.findContestById(id);
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    if (contest.userId !== requesterId && requesterRole !== "ADMIN") {
      return returnResponse(res, false, StatusCodes.FORBIDDEN, "Not authorized");
    }

    await ContestServices.deleteContest(id);
    return returnResponse(res, true, StatusCodes.OK, "Contest deleted");
  } catch (error) {
    next(error);
  }
};

const getAllContests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestsQuerySchemaAll.safeParse({ query: req.query });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid query parameters", parsed.error.flatten());
    }

    const result = await ContestServices.getAllContests(parsed.data.query);
    return returnResponse(res, true, StatusCodes.OK, "All contests fetched successfully", result);
  } catch (error) {
    next(error);
  }
};

const submitContestResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const parsed = submitContestResultSchema.safeParse({ params: req.params, body: req.body });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const contestId = parsed.data.params.id;

    const contest = await ContestServices.findContestById(contestId);
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }
    if (contest.condition !== "RUNNING") {
      return returnResponse(res, false, StatusCodes.FORBIDDEN, "Contest is not currently running");
    }

    const isParticipant = await ContestServices.findParticipant(userId, contestId);
    if (!isParticipant) {
      return returnResponse(res, false, StatusCodes.FORBIDDEN, "Join the contest before submitting a result");
    }

    const result = await ContestServices.submitContestResult(parsed.data.body, userId, contestId);
    return returnResponse(res, true, StatusCodes.CREATED, "Result submitted", result);
  } catch (error) {
    next(error);
  }
};

const getContestLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = getContestByIdSchema.safeParse({ params: req.params });
    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide correct data", parsed.error.flatten());
    }

    const contestId = parsed.data.params.id;
    const contest = await ContestServices.findContestById(contestId);
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    const leaderboard = await ContestServices.getContestLeaderboard(contestId);
    return returnResponse(res, true, StatusCodes.OK, "Leaderboard fetched", leaderboard);
  } catch (error) {
    next(error);
  }
};

const getAllContestLeaderboards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leaderboards = await ContestServices.getAllLeaderboards();
    return returnResponse(res, true, StatusCodes.OK, "Leaderboards fetched", leaderboards);
  } catch (error) {
    next(error);
  }
};

export const contestController = {
  createContest,
  getContests,
  getMyContests,
  getContestById,
  joinContest,
  leaveContest,
  deleteContest,
  getAllContests,
  submitContestResult,
  getContestLeaderboard,
  getAllContestLeaderboards,
};