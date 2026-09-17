import { Router } from "express";
import { userController } from "./user.controller.js";



const router = Router();

router.get('/', userController.getMe)
router.post('/', userController.createUser);
router.put('/', userController.updateUser)
router.delete('/', userController.deleteUser);


export const userRouter  = router;