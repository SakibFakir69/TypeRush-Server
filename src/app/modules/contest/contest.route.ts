import { Router } from "express";
import {
  createContest,
  getContests,
  getContestById,
  joinContest,
  leaveContest,
  deleteContest,
} from "./contest.controller.js"; 

const router = Router();

router.post("/", createContest);
router.get("/", getContests);
router.get("/:id", getContestById);
router.post("/:id/join", joinContest);
router.delete("/:id/leave", leaveContest);
router.delete("/:id", deleteContest);

export default router;