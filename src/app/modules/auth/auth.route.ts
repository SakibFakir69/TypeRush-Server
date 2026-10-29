/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Router } from "express";
import { authController } from "./auth.controller.js";
import {  type AuthPayload } from "../../middleware/jwt-token.js";
import jwt from "jsonwebtoken";
import passport from "./../../../config/passport.js"
import { setCookies } from "../../../helpers/set-cookies.js";


const router = Router();

router.post('/login', authController.userLogin);
router.post('/logout', authController.userLogout);
router.post('/refresh', authController.refreshToken);
router.post('/verify', authController.verifyOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verify-otp', authController.resendVerifyOtp);

router.get(
  "/google",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);


router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
  }),
   (req, res, next) => {
  try {
    const user = req.user as AuthPayload;

    if (!user?.userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_google_user`);
    }

    const accessToken = jwt.sign(user, process.env.JWT_SECRET_FOR_ACCESS_TOKEN as string, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign(user, process.env.JWT_SECRET_FOR_REFRESH_TOKEN as string, {
      expiresIn: "15d",
    });

    setCookies(res, "accessToken", accessToken, 15 * 60 * 1000);
    setCookies(res, "refreshToken", refreshToken, 15 * 24 * 60 * 60 * 1000);

    return res.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
  } catch (error) {
    next(error);
  }
}
);


export const authRouter = router;