import type { Response, Request, NextFunction } from "express";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import { setCookies } from "../../../helpers/set-cookies.js";
import { AuthServices } from "./auth.service.js";

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
      secure: process.env.NODE_ENV === "prod", 
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
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide refresh token");
    }

    const email = req.user?.email as string;
    const accessToken = await AuthServices.issueAccessToken(email);

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
  userLogin, userLogout, refreshToken, forgotPassword, resetPassword, verifyEmail, resendVerifyOtp, verifyOtp
};