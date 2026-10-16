import { Router } from "express";
import { contestController } from "./contest.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";



const router = Router();

// Public reads — no req.user needed
router.get("/", contestController.getContests);
router.get("/:id", contestController.getContestById);

// Mutations — these read req.user?.userId (and req.user?.role for delete),
// so they 401 via the controller's own check if this middleware is missing.
router.post("/", verifyToken, contestController.createContest);
router.post("/:id/join", verifyToken, contestController.joinContest);
router.delete("/:id/leave", verifyToken, contestController.leaveContest);
router.delete("/:id", verifyToken, contestController.deleteContest);

export const contestRouter = router;