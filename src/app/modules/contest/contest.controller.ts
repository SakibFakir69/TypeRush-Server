/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.db.js";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import {
  createContestSchema,
  getContestsQuerySchema,
  getContestByIdSchema,
  joinContestSchema,
  leaveContestSchema,
  deleteContestSchema,
  getContestsQuerySchemaAll,
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
    console.log(req.body , "[ CREATE CONTEST BODY ] ")

    const parsed = createContestSchema.safeParse({ body: req.body });
    console.log(parsed )

    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const { name, content, time, contestDate } = parsed.data.body;

    // Prisma 7: timestamptz columns take/return a plain JS Date — no
    // Temporal conversion needed (that's a Prisma 8-only change).
    const contest = await prisma.contest.create({
      data: {
        name,
        content,
        time,
        contestDate,
        userId,
      },
    });

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

    const where: Prisma.ContestWhereInput = {};
    if (userId) {
      where.userId = userId;
    }

    const contests = await prisma.contest.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

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
    const contests = await prisma.contest.findMany({
      where: { userId },
      include: { participants: true },
      orderBy: { createdAt: "desc" },
    });

    return returnResponse(res, true, StatusCodes.OK, "Your contests fetched", contests);
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

    const contest = await prisma.contest.findFirst({
      where: { id },
      include: {
        user: true,
        participants: { include: { user: true } },
      },
    });

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
    console.log(req.params , userId)

    const parsed = joinContestSchema.safeParse({ params: req.params });
    console.log(parsed , "[ join contest paras params ]")

    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten().fieldErrors
      );
    }

    const contestId = parsed.data.params.id;

    const contest = await prisma.contest.findFirst({ where: { id: contestId } });
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    try {
      const participant = await prisma.contestParticipant.create({ data: { contestId, userId } });
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
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const contestId = parsed.data.params.id;

    try {
      await prisma.contestParticipant.delete({
        where: { userId_contestId: { userId, contestId } },
      });
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
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        parsed.error.flatten()
      );
    }

    const { id } = parsed.data.params;

    const contest = await prisma.contest.findFirst({ where: { id } });
    if (!contest) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Contest not found");
    }

    if (contest.userId !== requesterId && requesterRole !== "ADMIN") {
      return returnResponse(res, false, StatusCodes.FORBIDDEN, "Not authorized");
    }

    await prisma.contest.delete({ where: { id } });

    return returnResponse(res, true, StatusCodes.OK, "Contest deleted");
  } catch (error) {
    next(error);
  }
};


const getAllContests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = getContestsQuerySchemaAll.safeParse({
      query: req.query,
    });

    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Invalid query parameters",
        parsed.error.flatten()
      );
    }

    const {
      limit,
      page,
      sortBy,
    } = parsed.data.query;

    const skip = (page - 1) * limit;

    const [contests, total] = await Promise.all([
      prisma.contest.findMany({
        include: { user: true },
        orderBy: { createdAt: sortBy === "asc" ? "asc" : "desc" },
        take: limit,
        skip,
      }),
      prisma.contest.count(),
    ]);

    return returnResponse(
      res,
      true,
      StatusCodes.OK,
      "All contests fetched successfully",
      {
        contests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
      }
    );
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
  getAllContests
};