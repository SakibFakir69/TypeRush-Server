import type { Response, Request, NextFunction } from "express";
import { createAnnouncementSchema, updateAnnouncementSchema } from "./announcements.validation.js";
import { returnResponse } from "../../../helpers/return-response.js";
import { StatusCodes } from "http-status-codes";
import { AnnouncementServices } from "./announcements.services.js";

const createAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "User unauthorize");
    }

    const result = createAnnouncementSchema.safeParse(req.body);

    if (!result.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        result.error.flatten()
      );
    }

    const createData = await AnnouncementServices.createData(result.data, userId);

    return returnResponse(res, true, StatusCodes.CREATED, "Announcement created successfully", createData);
  } catch (error) {
    next(error);
  }
};

const getAllAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const data = await AnnouncementServices.getAllAnnouncements({
      page,
      limit,
    });

    return returnResponse(
      res,
      true,
      StatusCodes.OK,
      "All announcements fetched successfully",
      data
    );
  } catch (error) {
    next(error);
  }
};


const updateAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: announcementId } = req.params as { id: string };

    if (!announcementId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found announcement id");
    }

    const result = updateAnnouncementSchema.safeParse(req.body);

    if (!result.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        result.error.flatten()
      );
    }

    const updated = await AnnouncementServices.updateAnnouncement(announcementId, result.data);

    if (!updated) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Announcement not found");
    }

    return returnResponse(res, true, StatusCodes.OK, "Announcement updated successfully", updated);
  } catch (error) {
    next(error);
  }
};

const deleteAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: announcementId } = req.params as { id: string };

    if (!announcementId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found announcement id");
    }

    const deleted = await AnnouncementServices.deleteAnnouncement(announcementId);

    if (!deleted) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "Announcement not found");
    }

    return returnResponse(res, true, StatusCodes.OK, "Announcement deleted successfully", deleted);
  } catch (error) {
    next(error);
  }
};

export const announcementController = {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};