
import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { getOverview, getCharts, getHistory } from "./progress.controller.js";

const router = Router();

router.use(verifyToken);

router.get("/overview", getOverview);
router.get("/charts", getCharts);
router.get("/history", getHistory);

export const progressRouter = router;