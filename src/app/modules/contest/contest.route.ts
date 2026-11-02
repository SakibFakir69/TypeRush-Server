import { Router } from "express";
import { contestController } from "./contest.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";

const router = Router();

// Static / collection routes — must come before "/:id" routes below
router.get("/", contestController.getContests);
router.get("/all", contestController.getAllContests);
router.get("/my", verifyToken, contestController.getMyContests);
router.get("/leaderboards", contestController.getAllContestLeaderboards);

router.post("/", verifyToken, verifyRole("ORG"), contestController.createContest);

// Param routes
router.get("/:id", contestController.getContestById);
router.get("/:id/leaderboard", contestController.getContestLeaderboard);

router.post("/:id/join", verifyToken, verifyRole("USER"), contestController.joinContest);
router.delete("/:id/leave", verifyToken, verifyRole("USER"), contestController.leaveContest);
router.post("/:id/submit", verifyToken, verifyRole("USER"), contestController.submitContestResult);

router.delete("/:id", verifyToken, contestController.deleteContest);

export const contestRouter = router;