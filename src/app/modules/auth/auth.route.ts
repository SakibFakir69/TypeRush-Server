import { Router } from "express";
import { authController } from "./auth.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";

const router = Router();

router.post('/login',authController.userLogin);
router.post('/logout', authController.userLogout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password');
router.post('/reset-password');

export const authRouter = router;