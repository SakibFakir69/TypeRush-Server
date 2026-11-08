import { Router } from "express";
import { verifyToken } from "../../../middleware/jwt-token.js";
import { forfeit, getMatch, submitResult } from "./match.controller.js";

const router = Router();

router.get("/:id", verifyToken, getMatch);
router.post("/:id/result", verifyToken, submitResult);
router.post("/:id/forfeit", verifyToken, forfeit);

export const matchRoutes = router;
