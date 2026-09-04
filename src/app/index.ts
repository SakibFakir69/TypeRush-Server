import dotenv from "dotenv"
dotenv.config();
import express, { type Request, type Response } from "express"
import cors from "cors";
import {

    StatusCodes,

} from 'http-status-codes';


const app = express();



// EXTRACT JSON
app.use(express.json());

// CORS CONFIG
app.use(cors(
    {
        origin: "*"
    }
))


// API 

app.get('/', (res: Response, req: Request) => {

    return res.status(StatusCodes.OK).json({
        "message": "Your Server now running",
        "uptime": process.uptime(),
        "workingDir": process.cwd(),
        "reqMethod":req.method

    })

})


// ERROR HANDLING
// ERROR
// NOT FOUNDED

// EXPORT APP
export const mainServerApp = app;





