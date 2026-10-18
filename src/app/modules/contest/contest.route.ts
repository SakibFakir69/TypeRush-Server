import { Router } from "express";
import { contestController } from "./contest.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";

const router = Router();


router.get("/", contestController.getContests);
router.get("/my", verifyToken, contestController.getMyContests);
router.get("/:id", contestController.getContestById);

router.post("/:id/join", verifyToken,verifyRole("USER"), contestController.joinContest);
router.delete("/:id/leave", verifyToken,verifyRole("USER"), contestController.leaveContest);


export const contestRouter = router;