import { Router } from "express";
import { userController } from "./user.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";


const router = Router();

router.get('/',verifyToken, userController.getMe)
router.post('/', userController.createUser);
router.put('/', userController.updateUser)
router.delete('/', userController.deleteUser);


export const userRouter  = router;