

import { Router } from "express";


import {
  createAchievement,
  getAllAchievementsAdmin,
  getAchievementById,
  updateAchievement,
  deleteAchievement,
  grantUserAchievement,
  revokeUserAchievement,
  getMyAchievements,
} from "./achievement.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";


const router = Router();

// user-facing
router.get("/me", requireAuth, getMyAchievements);

// admin-only — definitions
router.post("/", requireAuth, requireAdmin, createAchievement);
router.get("/", requireAuth, requireAdmin, getAllAchievementsAdmin);
router.get("/:id", requireAuth, requireAdmin, getAchievementById);
router.patch("/:id", requireAuth, requireAdmin, updateAchievement);
router.delete("/:id", requireAuth, requireAdmin, deleteAchievement);

// admin-only — per-user overrides
router.post("/:id/grant", requireAuth, requireAdmin, grantUserAchievement);
router.delete("/:id/users/:userId", requireAuth, requireAdmin, revokeUserAchievement);

export default router;