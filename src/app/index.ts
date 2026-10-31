import dotenv from "dotenv"
dotenv.config();
import 'temporal-polyfill/full/global';
import express, { type Request, type Response } from "express"
import cors from "cors";
import {
    StatusCodes,
} from 'http-status-codes';
import { notFound } from "./middleware/not-found.js";
import { globalError } from "./middleware/error-handler.js";
import { userRouter } from "./modules/users/user.route.js";
import { authRouter } from "./modules/auth/auth.route.js";
import { practiceRoutes } from "./modules/practice/practice.route.js";
import cookieParser from "cookie-parser";
import { contestRouter } from "./modules/contest/contest.route.js";
import { adminRouter } from "./modules/admin/admin.route.js";
import { announcementRouter } from "./modules/announcements/announcements.route.js";
import { analyticsRouter } from "./modules/analytics/analytics.route.js";

const app = express();





// CORS CONFIG


app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://typerush-client.vercel.app",
      "https://typerush-admin.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// EXTRACT JSON
app.use(express.json());
// COOKIE PARSER
app.use(cookieParser());

// API 
app.use('/api/v1/users', userRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/practices', practiceRoutes)
app.use('/api/v1/contests', contestRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/announcements', announcementRouter)
app.use('/api/v1/analytics', analyticsRouter) 


app.get('/', (res: Response, req: Request) => {

    return res.status(StatusCodes.OK).json({
        "message": "Your Server now running",
        "uptime": process.uptime(),
        "workingDir": process.cwd(),
        "reqMethod":req.method

    })

})


// NOT FOUNDED
app.use(notFound)
// ERROR
app.use(globalError)

// EXPORT APP
export const mainServerApp = app;





