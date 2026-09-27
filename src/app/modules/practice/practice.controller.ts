import type { Response, Request, NextFunction } from "express";
import { DB } from "../../../../prisma/db/prisma.db.js";



const addPracticeContent =  async (req: Request, res: Response, next: NextFunction) => {

    try {
        

        
    } catch (error) {
        next(error);
        
    }
}

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
const practiceLeaderboard =  async (req: Request, res: Response, next: NextFunction) => { 
    try {
        
    } catch (error) {
        next(error);
        
    }
}




export const practiceController = {
    practiceAllTopic, addPracticeContent, practiceLeaderboard,
    getPracticeParagraph, submitPracticeResult
}