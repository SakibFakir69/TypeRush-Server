
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