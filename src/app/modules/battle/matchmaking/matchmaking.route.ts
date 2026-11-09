import { Router } from "express";
import { join, cancel, status,history } from "./matchmaking.controller.js";

import { verifyToken } from "../../../middleware/jwt-token.js";

const router = Router();

router.post("/join", verifyToken, join);
router.post("/cancel", verifyToken, cancel);
router.get("/status", verifyToken, status);
router.get("/history", verifyToken, history);


export default router;