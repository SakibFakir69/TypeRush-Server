/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Router } from "express";
import { authController } from "./auth.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import jwt from "jsonwebtoken";
import passport from "./../../../config/passport.js"

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
  (req, res) => {
    const user = req.user;

    if (!user || !("id" in user) || typeof user.id !== "string") {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=invalid_google_user`
      );
    }
// CARE
    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`
    );
  }
);



export const authRouter = router;