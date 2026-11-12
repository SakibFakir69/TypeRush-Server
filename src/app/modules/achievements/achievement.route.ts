import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { achievementController } from "./achievement.controller.js";

const router = Router();


router.get("/", verifyToken, achievementController.getAchievementCatalog);
router.get("/me", verifyToken, achievementController.getMyAchievements);

export default router;