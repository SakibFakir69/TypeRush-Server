import type { Response } from "express";
import type { ZodError } from "zod";

export const handleZodError = (res: Response, error: ZodError): Response => {
  const formatted = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return res.status(400).json({
    success: false,
    errors: formatted,
  });
};