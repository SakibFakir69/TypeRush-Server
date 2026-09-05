import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";






export const notFound = (req: Request, res: Response) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    statusCode: StatusCodes.NOT_FOUND,
    message: "Route not found",
    path: req.originalUrl,
  });
};