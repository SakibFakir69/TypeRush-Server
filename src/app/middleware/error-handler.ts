import type { Response, Request, NextFunction } from "express";

interface IError {
    statusCode?: number,
    message: string,
    success: boolean,
    name: string,
    stack?: string,
}

export const globalError = (err: IError, req: Request, res: Response, _next: NextFunction) => {
    const isProd = process.env.NODE_ENV === "production";
    const statusCode = err.statusCode ?? 500;

    return res.status(statusCode).json({
        success: false,
        message: err.message,
        name: err.name,
        ...(isProd ? {} : { stack: err.stack }),
    });
};