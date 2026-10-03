import type { Response, Request, NextFunction } from "express";
import { DB } from "../../../../prisma/db/prisma.db.js";
import { createParagraphSchema } from "./pratice.validation.js";

import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";



const addPracticeContent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.userId;
        const data = createParagraphSchema.safeParse(req.body);

        if (!data.success) {
            return returnResponse(
                res,
                false,
                StatusCodes.BAD_REQUEST,
                "Please provide correct data",
                data.error.flatten()
            );
        }
        const createData = await DB.Paragraph.create({
            content: data.data.content,
            wordCount: data.data.wordCount,
            category: data.data.category ?? null,
            difficulty: data.data.difficulty ?? null,
            results: (results) =>
                results.create({
                    userId: userId ?? null,
                    wpm: 0,
                    accuracy: 0,
                    errors: 0,
                    timeTaken: 0,
                }),
        });



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

// const getPracticeParagraph = async (req: Request, res: Response, next: NextFunction) => {
//     try {


//     } catch (error) {
//         next(error);
//     }
// }

// const submitPracticeResult = async (req: Request, res: Response, next: NextFunction) => {
//     try {

//     } catch (error) {
//         next(error);
//     }
// }


// const practiceLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         // by lastest submit

//     } catch (error) {
//         next(error);

//     }
// }




export const practiceController = {
    practiceAllTopic, addPracticeContent

}