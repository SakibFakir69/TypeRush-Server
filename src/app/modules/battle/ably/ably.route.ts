import { Router } from "express";
import { verifyToken } from "../../../middleware/jwt-token.js";
import { getMatchToken, getUserToken } from "./ably.controller.js";

const router = Router();

router.get("/token", verifyToken, getUserToken);
router.get("/token/:matchId", verifyToken, getMatchToken);

export const ablyRoutes = router;