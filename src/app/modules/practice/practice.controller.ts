// practice.controller.ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Response, Request, NextFunction } from "express";
import { prisma } from "../../../lib/prisma.db.js";
import type { Prisma } from "@prisma/client";
import { createParagraphSchema, resultQuerySchema, submitResultBodySchema } from "./pratice.validation.js";

import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";

import { PracticeServices } from "./practice.service.js";
import { redis } from "../../../config/redis-config.js";

const addPracticeContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorize")
    }
    console.log(req.body, '[BODY]')

    const result = createParagraphSchema.safeParse(req.body);

    if (!result.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        result.error.flatten()
      );
    }

    const createData = await PracticeServices.createData(result.data, userId);

    return returnResponse(
      res,
      true,
      StatusCodes.CREATED,
      "Content Created Successfully",
      createData
    );
  } catch (error) {
    next(error);
  }
};

const practiceAllTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, page, orderBy, sortBy, search } = req.query;

    const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const skip = (currentPage - 1) * take;

    const allowedSortFields = ['createdAt', 'content', 'difficulty', 'wordCount', 'category'] as const;
    const sortField = allowedSortFields.includes(orderBy as any)
      ? (orderBy as typeof allowedSortFields[number])
      : 'createdAt';
    const sortDir = sortBy === 'asc' ? 'asc' : 'desc';
    const searchValue = typeof search === 'string' ? search.trim() : '';

    const where: Prisma.ParagraphWhereInput = { isDeleted: false };
    if (searchValue) {
      where.content = { contains: searchValue, mode: "insensitive" };
    }

    const [rowData, total] = await Promise.all([
      prisma.paragraph.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        take,
        skip,
      }),
      prisma.paragraph.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: rowData,
      pagination: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPracticeParagraph = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: paragraphId } = req.params as { id: string };
    console.log(paragraphId)

    if (!paragraphId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found paragraph id")
    }
    const result = await PracticeServices.getPracticeParagraph(paragraphId);
    if (!result) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Paragraph data not founded");
    }
    return returnResponse(res, true, StatusCodes.OK, "Paragraph data", result);
  } catch (error) {
    next(error);
  }
}

const submitPracticeResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return returnResponse(
        res,
        false,
        StatusCodes.UNAUTHORIZED,
        "User not authenticated"
      );
    }

    const parsed = submitResultBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Invalid request data",
        {
          errors: parsed.error.flatten().fieldErrors,
        }
      );
    }

    const result = await PracticeServices.submitPracticeResult(
      parsed.data,
      userId
    );

    await redis.del(`user:stats:v2:${userId}`); 

    return returnResponse(res, true, StatusCodes.CREATED, "Result saved", result);
  } catch (error) {
    next(error);
  }
};

const practiceLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("leader board")

    const parsed = resultQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid query parameters", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { paragraphId, limit, cursor, offset, duration } = parsed.data;

    const where: Prisma.ResultWhereInput = {};
    if (paragraphId) {
      where.paragraphId = paragraphId;
    }
    if (duration) {
      // Time category. New runs store the length they picked; older rows only
      // have the elapsed time, so a run that used the whole clock still counts.
      where.OR = [{ duration }, { duration: null, timeTaken: duration }];
    }

    if (cursor) {
      const prev = await prisma.result.findFirst({ where: { id: cursor } });
      if (!prev) {
        return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid cursor");
      }
    }

    // sortOrder must now be a plain Prisma orderBy array, e.g.
    // [{ wpm: "desc" }, { accuracy: "desc" }, { timeTaken: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    const [total, rows] = await Promise.all([
      prisma.result.count({ where }),
      prisma.result.findMany({
        where,
        orderBy: [
          { wpm: "desc" },
          { accuracy: "desc" },
          { timeTaken: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          userId: true,
          wpm: true,
          accuracy: true,
          timeTaken: true,
          duration: true,
          createdAt: true,
        },
        take: limit + 1,
        // Cursor pages win; plain offset paging is the default for the UI.
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: offset }),
      }),
    ]);

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;

    const userIds = [...new Set(page.map((r) => r.userId).filter((id): id is string => !!id))];

    const users = userIds.length
      ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
      : [];

    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const data = page.map((r) => ({
      userName: r.userId ? (nameById.get(r.userId) ?? null) : null,
      wpm: r.wpm,
      accuracy: r.accuracy,
      timeTaken: r.timeTaken,
      /** Leaderboard category (run length in seconds). */
      duration: r.duration ?? r.timeTaken,
      createdAt: r.createdAt,
    }));

    const nextCursor = hasNextPage ? page[page.length - 1]!.id : null;
    const nextOffset = hasNextPage && !cursor ? offset + page.length : null;

    return returnResponse(res, true, StatusCodes.OK, "Leaderboard fetched", {
      data,
      nextCursor,
      pagination: {
        limit,
        offset,
        total,
        hasMore: hasNextPage,
        nextOffset,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deletePracticeContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: paragraphId } = req.params as { id: string };
    const userId = req.user?.userId;

    if (!userId) {
      return returnResponse(
        res,
        false,
        StatusCodes.UNAUTHORIZED,
        "User not authenticated"
      );
    }

    if (!paragraphId) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Paragraph ID is required"
      );
    }

    const deleted = await PracticeServices.deletePracticeContent(
      paragraphId
    );

    if (!deleted) {
      return returnResponse(
        res,
        false,
        StatusCodes.NOT_FOUND,
        "Practice content not found"
      );
    }

    return returnResponse(
      res,
      true,
      StatusCodes.OK,
      "Practice content deleted successfully",
      deleted
    );
  } catch (error) {
    next(error);
  }
};

const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorized");
    }

    const cacheKey = `user:stats:v2:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return returnResponse(res, true, StatusCodes.OK, "Stats fetched", JSON.parse(cached));
    }

    const stats = await PracticeServices.getUserStats(userId);
    if (!stats) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "No results found yet");
    }
  

    await redis.set(cacheKey, JSON.stringify(stats), "EX", 60 * 5); 

    return returnResponse(res, true, StatusCodes.OK, "Stats fetched", stats);
  } catch (error) {
    next(error);
  }
};

export const practiceController = {
  practiceAllTopic, addPracticeContent, getPracticeParagraph, submitPracticeResult, practiceLeaderboard, deletePracticeContent,getUserStats
}