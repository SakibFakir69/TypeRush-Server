import { StatusCodes } from "http-status-codes";
import { returnResponse } from "./return-response.js";
import type { Response } from "express";





export const setCookies = (res: Response, name: string, value: string,time?:number) => {
    const isProd = process.env.NODE_ENV === "prod";

    if (!name || name === "") {
        return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide cookie name");

    }
    if (!value || value === "") {
        return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide cookie value");

    }

    res.cookie(name, value, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge:time
    })


}