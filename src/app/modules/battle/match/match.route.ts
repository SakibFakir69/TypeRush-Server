import { Router } from "express";
import { verifyToken } from "../../../middleware/jwt-token.js";
import {
  forfeit,
  getLatestMatches,
  getMatch,
  getRecentMatches,
  submitResult,
} from "./match.controller.js";

const router = Router();

router.get("/recent", verifyToken, getRecentMatches);
router.get("/latest", verifyToken, getLatestMatches);
router.get("/:id", verifyToken, getMatch);
router.post("/:id/result", verifyToken, submitResult);
router.post("/:id/forfeit", verifyToken, forfeit);

export const matchRoutes = router;
