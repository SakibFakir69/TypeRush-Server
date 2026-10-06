/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DB } from "../../../../prisma/db/prisma.db.js";
import type { CreateParagraphInput } from "./pratice.validation.js";



const createData =async (data:CreateParagraphInput , userId:string) => {

    const create_paragraph_data= await DB.Paragraph.create({

        content: data.content,
        wordCount: data.wordCount,
        category: data.category ?? null,
        difficulty: data.difficulty ?? null,
        
        results: (results) =>
            results.create({
                userId: userId ?? null,
                wpm: 0,
                accuracy: 0,
                errors: 0,
                timeTaken: 0,
            }),
    });
    return create_paragraph_data; 


}

export const PracticeServices= {
    createData
}