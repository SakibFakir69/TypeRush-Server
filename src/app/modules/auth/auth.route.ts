import { Router } from "express";
import { authController } from "./auth.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";

const router = Router();

router.post('/login',authController.userLogin);
router.post('/logout', authController.userLogout);

export const authRouter = router;