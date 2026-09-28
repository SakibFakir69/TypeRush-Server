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



    } catch (error) {
        next(error);

    }

}
const getPracticeParagraph = async (req: Request, res: Response, next: NextFunction) => {
    try {

    } catch (error) {
        next(error);
    }
}

const submitPracticeResult = async (req: Request, res: Response, next: NextFunction) => {
    try {

    } catch (error) {
        next(error);
    }
}
const practiceLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {

    } catch (error) {
        next(error);

    }
}




export const practiceController = {
    practiceAllTopic, addPracticeContent, practiceLeaderboard,
    getPracticeParagraph, submitPracticeResult
}