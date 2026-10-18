import { DB } from "../../../../prisma/db/prisma.db.js";
import type { z } from "zod";
import type { createAnnouncementSchema, updateAnnouncementSchema } from "./announcements.validation.js";

const createData = async (
  data: z.infer<typeof createAnnouncementSchema>,
  userId: string
) => {

  return DB.Announcement.create({
    ...data,
    userId,
  });
};

const getAllAnnouncements = async () => {
  return DB.Announcement.where({ isActive: true })
    .orderBy((a) => a.createdAt.desc())
    .all();
};

const updateAnnouncement = async (
  id: string,
  data: z.infer<typeof updateAnnouncementSchema>
) => {
  const existing = await DB.Announcement.where({ id }).first();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.message !== undefined) updateData.message = data.message;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return DB.Announcement.where({ id }).update(updateData);
};

const deleteAnnouncement = async (id: string) => {
  const existing = await DB.Announcement.where({ id }).first();
  if (!existing) return null;

  return DB.Announcement.where({ id }).delete();
};

export const AnnouncementServices = {
  createData,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};