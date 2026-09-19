
import type { Response, Request, NextFunction } from "express";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt"
import { DB } from "../../../../prisma/db/prisma.db.js";
import jwt from "jsonwebtoken"
import { setCookies } from "../../../helpers/set-cookies.js";

const userLogin = async (req: Request, res: Response, next: NextFunction) => {

    try {
        const { email, password } = req.body as {
            email: string,
            password: string
        };

        if (!email) {
            return returnResponse(res, true, StatusCodes.BAD_REQUEST, "Please provide email")
        }
        if (!password) {
            return returnResponse(res, true, StatusCodes.BAD_REQUEST, "Please provide password")
        }
        const hashPassword = await DB.User.first({ email: email });

        const isCorrectPassword = await bcrypt.compare(password, hashPassword?.password as string);
        if (!isCorrectPassword) {
            return returnResponse(res, true, StatusCodes.BAD_REQUEST, "Please provide correct password");
        }

        const payload = {
            userId: hashPassword?.id,
            email: hashPassword?.email,
            name: hashPassword?.name

        }
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_ACCESS_TOKEN as string, {
            expiresIn: "15m"
        })
        const refreshToken = jwt.sign(payload,process.env.JWT_SECRET_FOR_REFRESH_TOKEN as string , {
            expiresIn: "15d",
        
        })
        const data = {
            accessToken: accessToken,
            refreshToken: refreshToken
        }

        setCookies(res, "accessToken", accessToken, 15 * 60 * 1000);
        setCookies(res, "refreshToken", refreshToken, 15 * 24 * 60 * 60 * 1000);
        return returnResponse(res, true, StatusCodes.OK, "User Login successfully", data);

    } catch (error) {
        next(error);

    }

}


export const authController = {
    userLogin
}