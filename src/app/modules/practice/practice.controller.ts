/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Response, Request, NextFunction } from "express";
import { DB } from "../../../../prisma/db/prisma.db.js";
import { createParagraphSchema, resultQuerySchema, submitResultBodySchema } from "./pratice.validation.js";

import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import { sortOrder } from "../../../utils/practice/utils.practice.js";
import { PracticeServices } from "./practice.service.js";



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
    const sortField = String(orderBy || 'createdAt');
    const sortDir = sortBy === 'asc' ? 'asc' : 'desc';
    const searchValue = typeof search === 'string' ? search.trim() : '';

    let query = DB.Paragraph;

    if (searchValue) {
      query = query.where((p) => p.content.ilike(`%${searchValue}%`));
    }

    const rowData = await query
      .orderBy((p) => (sortDir === 'asc' ? p[sortField].asc() : p[sortField].desc()))
      .limit(take)
      .offset(skip)
      .all();

    const { total } = await (searchValue
      ? DB.Paragraph.where((p) => p.content.ilike(`%${searchValue}%`))
      : DB.Paragraph
    ).aggregate((a) => ({ total: a.count() }));

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

    if (!paragraphId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found paragraph id")
    }
    const result = await PracticeServices.getPracticeParagraph(paragraphId);
    if (!result) {
      return returnResponse(res, true, StatusCodes.NOT_FOUND, "Paragraph data not founded");
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

    return returnResponse(res, true, StatusCodes.CREATED, "Result saved", result);
  } catch (error) {
    next(error);
  }
};


const practiceLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resultQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid query parameters", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { paragraphId, limit, cursor } = parsed.data;

    let query = DB.Result.orderBy(sortOrder);

    if (paragraphId) {
      query = query.where({ paragraphId });
    }

    if (cursor) {
      const prev = await DB.Result.where({ id: cursor }).first();
      if (!prev) {
        return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid cursor");
      }

      query = query.cursor({
        wpm: prev.wpm,
        accuracy: prev.accuracy,
        timeTaken: prev.timeTaken,
        createdAt: prev.createdAt,
        id: prev.id,
      });
    }

    const rows = await query
      .select("id", "userId", "wpm", "accuracy", "timeTaken", "createdAt")
      .limit(limit + 1)
      .all();

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;

    const userIds = [...new Set(page.map((r) => r.userId).filter((id): id is string => !!id))];

    const users = userIds.length
      ? await DB.User.select("id", "name")
        .where((u) => u.id.in(userIds))
        .all()
      : [];

    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const data = page.map((r) => ({
      userName: r.userId ? (nameById.get(r.userId) ?? null) : null,
      wpm: r.wpm,
      accuracy: r.accuracy,
      timeTaken: r.timeTaken,
      createdAt: r.createdAt,
    }));

    const nextCursor = hasNextPage ? page[page.length - 1]!.id : null;

    return returnResponse(res, true, StatusCodes.OK, "Leaderboard fetched", {
      data,
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
};




export const practiceController = {
  practiceAllTopic, addPracticeContent, getPracticeParagraph, submitPracticeResult, practiceLeaderboard

}