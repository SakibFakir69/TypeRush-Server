import { Router } from "express";
import { userController } from "./user.controller.js";



const router = Router();


router.post('/', userController.createUser);


export const userRouter  = router;