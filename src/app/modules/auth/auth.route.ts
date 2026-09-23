
import { Router } from "express";
import { authController } from "./auth.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import jwt from "jsonwebtoken";
import passport from "./../../../config/passport.js"

const router = Router();

router.post('/login',authController.userLogin);
router.post('/logout', authController.userLogout);
router.post('/refresh', authController.refreshToken);
router.post('/verify',authController.verifyOtp);
router.post('/forgot-password',authController.forgotPassword);
router.post('/reset-password',verifyToken,authController.resetPassword);


router.get(
  "/google",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  passport.authenticate("google", { session: false, failureRedirect: "/login/failed" }),
  (req, res) => {
    const user = req.user as { userId: string };
    const token = jwt.sign({ sub: user.userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

export const authRouter = router;