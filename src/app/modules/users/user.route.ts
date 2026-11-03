import { Router } from "express";
import { userController } from "./user.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import { registerLimiter } from "../../middleware/rate-limit.middleware.js";


const router = Router();

router.get('/', verifyToken, userController.getMe);
router.post('/',registerLimiter, userController.createUser);
router.put('/', verifyToken, userController.updateUser);
router.delete('/', verifyToken, userController.deleteUser);

export const userRouter  = router;