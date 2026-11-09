import { Router } from "express";
import { verifyToken } from "../../../middleware/jwt-token.js";
import { getInviteToken, getMatchToken, getUserToken } from "./ably.controller.js";

const router = Router();

router.get("/token", verifyToken, getUserToken);
router.get("/token/:matchId", verifyToken, getMatchToken);
router.get("/invite-token/:code", verifyToken, getInviteToken);

export const ablyRoutes = router;