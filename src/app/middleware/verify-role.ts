import type { NextFunction, Request, Response } from "express";
import { returnResponse } from "../../helpers/return-response.js";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Usage: router.delete("/:id", verifyRole("ADMIN"), handler)
 * Usage (multiple): router.post("/", verifyRole("ADMIN", "ORG"), handler)
 */
export const verifyRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const cookieToken = req.cookies?.accessToken as string | undefined;
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const token = cookieToken ?? headerToken;

    if (!token) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "Unauthorized user");
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET_FOR_ACCESS_TOKEN!) as AuthPayload;
      req.user = payload;

      if (!allowedRoles.includes(payload.role)) {
        return returnResponse(res, false, StatusCodes.FORBIDDEN, "Not authorized for this action");
      }

      return next();
    } catch {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "Invalid or expired token");
    }
  };
};