import type { Response, Request, NextFunction } from "express";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import { setCookies } from "../../../helpers/set-cookies.js";
import { AuthServices } from "./auth.service.js";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "../../middleware/jwt-token.js";
import { redis } from "../../../config/redis-config.js";

const userLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide email");
    }
    if (!password) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide password");
    }

    const { accessToken, refreshToken } = await AuthServices.login(email, password);

    setCookies(res, "accessToken", accessToken, 15 * 60 * 1000);
    setCookies(res, "refreshToken", refreshToken, 15 * 24 * 60 * 60 * 1000);

    return returnResponse(res, true, StatusCodes.OK, "User Login successfully", {
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
    next(error);
  }
};

const userLogout = (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
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



/**
 * Redeem the single-use code created by the Google OAuth callback.
 *
 * The app calls this through its same-origin `/backend` proxy, so the
 * Set-Cookie headers below are stored against the app origin — the origin the
 * app actually reads its session from.
 */
const exchangeGoogleCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body as { code?: unknown };

    if (typeof code !== "string" || !code) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Sign-in code required");
    }

    const key = `oauth:handoff:${code}`;
    const raw = await redis.get(key);
    // Single use — burn it even if the payload turns out to be malformed.
    if (raw) await redis.del(key);

    if (!raw) {
      return returnResponse(
        res,
        false,
        StatusCodes.UNAUTHORIZED,
        "Invalid or expired sign-in code"
      );
    }

    let tokens: { accessToken?: unknown; refreshToken?: unknown };
    try {
      tokens = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    } catch {
      return returnResponse(
        res,
        false,
        StatusCodes.UNAUTHORIZED,
        "Invalid or expired sign-in code"
      );
    }

    if (typeof tokens.accessToken !== "string" || typeof tokens.refreshToken !== "string") {
      return returnResponse(
        res,
        false,
        StatusCodes.UNAUTHORIZED,
        "Invalid or expired sign-in code"
      );
    }

    setCookies(res, "accessToken", tokens.accessToken, 15 * 60 * 1000);
    setCookies(res, "refreshToken", tokens.refreshToken, 15 * 24 * 60 * 60 * 1000);

    return returnResponse(res, true, StatusCodes.OK, "Google sign-in complete");
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;

    if (!token) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "No refresh token provided");
    }

    let payload: AuthPayload;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      payload = jwt.verify(
        token,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        process.env.JWT_SECRET_FOR_REFRESH_TOKEN as string
      ) as AuthPayload;
    } catch {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "Invalid or expired refresh token");
    }

    const accessToken = await AuthServices.issueAccessToken(payload.email);

    setCookies(res, "accessToken", accessToken, 15 * 60 * 1000);

    return returnResponse(res, true, StatusCodes.CREATED, "Access token created", { accessToken });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail } = req.body as { email?: unknown };

    if (typeof rawEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(rawEmail.trim())) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Please provide a valid email');
    }

    await AuthServices.requestPasswordReset(rawEmail);

    return returnResponse(res, true, StatusCodes.OK, 'If this email is registered, an OTP has been sent');
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
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

    await AuthServices.resetPasswordWithToken(resetToken, password);

    return returnResponse(res, true, StatusCodes.OK, 'Password reset successful');
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
    next(error);
  }
};

const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail, otp } = req.body as { email?: string; otp?: string };
    if (typeof rawEmail !== 'string' || typeof otp !== 'string') {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Email and OTP required');
    }

    await AuthServices.verifyEmailOtp(rawEmail, otp);

    return returnResponse(res, true, StatusCodes.OK, 'Email verified successfully');
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
    next(error);
  }
};

const resendVerifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail } = req.body as { email?: unknown };
    if (typeof rawEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(rawEmail.trim())) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Please provide a valid email');
    }

    await AuthServices.resendVerificationOtp(rawEmail);

    return returnResponse(res, true, StatusCodes.OK, 'If this email needs verification, a code has been sent');
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
    next(error);
  }
};

const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email: rawEmail, otp } = req.body as { email?: string; otp?: string };
    if (typeof rawEmail !== 'string' || typeof otp !== 'string') {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, 'Email and OTP required');
    }

    const resetToken = await AuthServices.verifyResetOtp(rawEmail, otp);

    return returnResponse(res, true, StatusCodes.OK, 'OTP verified', { resetToken });
  } catch (error) {
    if (error instanceof AuthServices.AuthError) {
      return returnResponse(res, false, error.statusCode, error.message);
    }
    next(error);
  }
};

export const authController = {
  userLogin, userLogout, refreshToken, exchangeGoogleCode, forgotPassword, resetPassword, verifyEmail, resendVerifyOtp, verifyOtp
};