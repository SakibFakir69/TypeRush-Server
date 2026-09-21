import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../helpers/return-response.js";

export interface AuthPayload {
    userId: string;
    email: string,
    name: string

}

declare module "express-serve-static-core" {
    interface Request {
        user?: AuthPayload;
    }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const cookieToken = req.cookies?.accessToken as string | undefined;
    
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const token = cookieToken ?? headerToken;
    

    if (!token) {
        return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "Unauthorized user");
    }

    try {
        req.user = jwt.verify(
            token,
            process.env.JWT_SECRET_FOR_ACCESS_TOKEN!,
        ) as AuthPayload;
        next();
    } catch {
        return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "Invalid or expired token");
    }
};