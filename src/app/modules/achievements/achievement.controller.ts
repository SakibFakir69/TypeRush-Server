import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import {
  createAchievementSchema,
  updateAchievementSchema,
  getAchievementsQuerySchema,
} from "./achivement.validation.js";
import { AchievementServices } from "./achievement.service.js";
import { returnResponse } from "../../../helpers/return-response.js";

// ---------- admin ----------

async function createAchievement(req: Request, res: Response) {
  const parsed = createAchievementSchema.safeParse(req.body);
  if (!parsed.success) {
    return returnResponse(
      res,
      false,
      StatusCodes.BAD_REQUEST,
      parsed.error.issues[0]?.message ?? "Invalid achievement data"
    );
  }

  const achievement = await AchievementServices.createAchievement(parsed.data);
  return res.status(StatusCodes.CREATED).json({ success: true, data: achievement });
}

async function getAllAchievements(req: Request, res: Response) {
  const parsed = getAchievementsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Invalid query params");
  }

  const result = await AchievementServices.getAllAchievementsAdmin(parsed.data);
  return res.status(StatusCodes.OK).json({ success: true, ...result });
}

async function getAchievementById(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const achievement = await AchievementServices.getAchievementById(id);
  if (!achievement) {
    return returnResponse(res, false, StatusCodes.NOT_FOUND, "Achievement not found");
  }
  return res.status(StatusCodes.OK).json({ success: true, data: achievement });
}

async function updateAchievement(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const parsed = updateAchievementSchema.safeParse(req.body);
  if (!parsed.success) {
    return returnResponse(
      res,
      false,
      StatusCodes.BAD_REQUEST,
      parsed.error.issues[0]?.message ?? "Invalid achievement data"
    );
  }

  const achievement = await AchievementServices.updateAchievement(id, parsed.data);
  return res.status(StatusCodes.OK).json({ success: true, data: achievement });
}

async function deleteAchievement(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  await AchievementServices.deleteAchievement(id);
  return res.status(StatusCodes.OK).json({ success: true });
}

async function grantUserAchievement(req: Request, res: Response) {
  const { id } = req.params as { id: string }; // achievement id
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    return returnResponse(res, false, StatusCodes.BAD_REQUEST, "userId is required");
  }

  const unlocked = await AchievementServices.grantUserAchievement(userId, id);
  return res.status(StatusCodes.OK).json({ success: true, data: unlocked });
}

async function revokeUserAchievement(req: Request, res: Response) {
  const { id, userId } = req.params as { id: string; userId: string };
  await AchievementServices.revokeUserAchievement(userId, id);
  return res.status(StatusCodes.OK).json({ success: true });
}

// ---------- user-facing ----------

/**
 * The full catalogue for the signed-in user: every achievement plus the
 * date this user unlocked it (null = still locked).
 */
async function getAchievementCatalog(req: Request, res: Response) {
  const userId = req.user!.userId;
  const achievements = await AchievementServices.getAchievementCatalog(userId);
  return res.status(StatusCodes.OK).json({ success: true, data: achievements });
}

async function getMyAchievements(req: Request, res: Response) {
  const userId = req.user!.userId;
  const achievements = await AchievementServices.getUserAchievements(userId);
  return res.status(StatusCodes.OK).json({ success: true, data: achievements });
}

export const achievementController = {
  createAchievement,
  getAllAchievements,
  getAchievementById,
  updateAchievement,
  deleteAchievement,
  grantUserAchievement,
  revokeUserAchievement,
  getAchievementCatalog,
  getMyAchievements,
};