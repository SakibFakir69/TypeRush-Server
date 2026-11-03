
import rateLimit from "express-rate-limit";

import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../helpers/return-response.js";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 15,                  
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    returnResponse(res, false, StatusCodes.TOO_MANY_REQUESTS, "Too many login attempts, try again later");
  },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  limit: 30,                 
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    
    returnResponse(res, false, StatusCodes.TOO_MANY_REQUESTS, "Too many accounts created, try again later");
  },
});

export const submitResultLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: 5,             // max 5 submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    returnResponse(res, false, StatusCodes.TOO_MANY_REQUESTS, "Too many submissions, slow down");
  },
});