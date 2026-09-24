import type { Response } from "express";



export const returnResponse = <T>(
  res: Response,
  isSuccess: boolean,
  httpStatus: number = isSuccess ? 200 : 500,
  message?: string,
  data?: T,
  errorCode?: string
) => {
  return res.status(httpStatus).json({
    success: isSuccess,
    message,
    errorCode,
    data,
  });
};