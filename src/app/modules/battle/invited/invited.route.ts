import { Router } from "express";
import { verifyToken } from "../../../middleware/jwt-token.js";
import { invitedController } from "./invited.controller.js";


const router = Router();


router.post("/invite", verifyToken, invitedController.inviteUser);
router.post("/invite/accept", verifyToken, invitedController.acceptInvite);
router.post("/invite/decline", verifyToken, invitedController.declineInvite);
router.post("/invite/cancel", verifyToken,invitedController.cancelInvite);
router.get("/invite/:code/status", verifyToken, invitedController.getInviteStatus);


export const invitedRouter = router;
