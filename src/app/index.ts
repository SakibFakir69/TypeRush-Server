import dotenv from "dotenv"
dotenv.config();
import express, { type Request, type Response } from "express"
import cors from "cors";
import {

	StatusCodes,
	
} from 'http-status-codes';

import swaggerJSDoc from "swagger-jsdoc";
const app=express();



// EXTRACT JSON
app.use(express.json());

// CORS CONFIG
app.use(cors(
{
    origin:"*"
}
))
// SETUP SWAGGER UI
swaggerJSDoc(app);

// API 

app.get('/',(res:Response,req:Request)=>{

    return res.status(StatusCodes.OK).json({
        "message":"Your Server now running",
        "uptime":process.uptime(),
        "workingDir":process.cwd()

    })
    
})


// ERROR HANDLING
// ERROR
// NOT FOUNDED

// EXPORT APP
export const mainServerApp= app;





