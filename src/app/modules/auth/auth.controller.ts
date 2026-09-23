import {  timingSafeEqual } from 'crypto';
import type { Response, Request, NextFunction } from "express";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcrypt"
import {  DB } from "../../../../prisma/db/prisma.db.js";
import jwt from "jsonwebtoken"
import { setCookies } from "../../../helpers/set-cookies.js";
import { redis } from "../../../config/redis-config.js";
import { generateOtp } from "../../../helpers/otp-code.js";
import { COOLDOWN, OTP_TTL } from "../../../const/auth.const.js";
import { hashOtp } from "../../../utils/auth/has-otp.js";
import sendOtpEmail from '../../../utils/otp/otp.js';


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
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_REFRESH_TOKEN as string, {
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

const userLogout = (req: Request, res: Response, next: NextFunction) => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const token = req.cookies?.refreshToken as string | undefined;
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // match setCookies
            sameSite: "lax" as const,
            path: "/",
        };
        res.clearCookie("accessToken", options);
        res.clearCookie("refreshToken", options);

        return returnResponse(res, true, StatusCodes.OK, "User logout successfully");
    } catch (error) {
        next(error);
    }
};

const refreshToken = async (req: Request, res: Response, next: NextFunction) => {

    try {
        const { refreshToken } = req.body as {
            refreshToken: string;
        }

        if (!refreshToken) {
            return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide refresh token");
        }
        const email = req.user?.email;
        const hashPassword = await DB.User.first({ email: email });

        const payload = {
            userId: hashPassword?.id,
            email: hashPassword?.email,
            name: hashPassword?.name
        }

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_ACCESS_TOKEN as string, {
            expiresIn: "15m"
        })

        const data ={
            accessToken: accessToken
        }

        return returnResponse(res,true,StatusCodes.CREATED, "Access token created",data);

    } catch (error) {
        next(error);

    }
}



const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail } = req.body as { email?: unknown };

    if (typeof rawEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(rawEmail.trim())) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Please provide a valid email');
    }

    const email = rawEmail.trim().toLowerCase();
    const otpKey = `otp:reset:${email}`;
    const cooldownKey = `otp:cooldown:${email}`;

    // atomic cooldown lock (no race between check and set)
    const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN, 'NX');

    if (!acquired) {
      return returnResponse(res, false, StatusCodes.TOO_MANY_REQUESTS, 'Please wait before requesting another OTP');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = await  DB.User.first({email:email})
    
    if (user) {
      const otp = generateOtp();
      await redis.set(otpKey, hashOtp(otp), 'EX', OTP_TTL);
      await redis.del(`otp:attempts:${email}`);

      try {
        console.log('brevo key prefix:', process.env.BREVO_API_KEY?.slice(0, 20));
     
    
        await sendOtpEmail(email, otp);
           console.log("send email")
      } catch (err) {
        await redis.del(otpKey, cooldownKey); 
        throw err;
      }
    }
    

    
    return returnResponse(res, true, StatusCodes.OK, 'If this email is registered, an OTP has been sent');
  } catch (error) {
    next(error);
  }
};




const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resetToken, password } = req.body as { resetToken?: unknown; password?: unknown };

    if (typeof resetToken !== 'string' || typeof password !== 'string') {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Reset token and new password required');
    }
    if (password.length < 8 || password.length > 128) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Password must be 8-128 characters');
    }

    // atomic get + delete: token works exactly once
    const email = await redis.getdel(`reset:token:${hashOtp(resetToken)}`);
    if (!email) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Invalid or expired reset token');
    }

    const user = await DB.User.first({email:email});

    if (!user) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(password, 12);

   
    await DB.User.where({ id: user.id }).update({ password: passwordHash });

   
    await redis.del(`refresh:${user.id}`);
  

    return returnResponse(res, true, StatusCodes.OK, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};


const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail, otp } = req.body as { email?: string; otp?: string };
    if (typeof rawEmail !== 'string' || typeof otp !== 'string') {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Email and OTP required');
    }

    const email = rawEmail.trim().toLowerCase();
    const attemptsKey = `otp:attempts:${email}`;
    const otpKey = `otp:reset:${email}`;

    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL);
    if (attempts > 5) {
      await redis.del(otpKey); 
      return returnResponse(res, false, StatusCodes.TOO_MANY_REQUESTS, 'Too many attempts. Request a new OTP');
    }

    const stored = await redis.get(otpKey);
    const a = Buffer.from(stored ?? '');
    const b = Buffer.from(hashOtp(otp));
    if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Invalid or expired OTP');
    }

    await redis.del(otpKey, attemptsKey); 
   
    return returnResponse(res, true, StatusCodes.OK, 'OTP verified');
  } catch (error) {
    next(error);
  }
};







export const authController = {
    userLogin, userLogout, refreshToken,forgotPassword,resetPassword,verifyOtp,
}