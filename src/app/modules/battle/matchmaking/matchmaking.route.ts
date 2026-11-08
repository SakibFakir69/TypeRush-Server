import { Router } from "express";
import { join, cancel, status } from "./matchmaking.controller.js";

import { verifyToken } from "../../../middleware/jwt-token.js";

const router = Router();

router.post("/join", verifyToken, join);
router.post("/cancel", verifyToken, cancel);
router.get("/status", verifyToken, status);

export default router;