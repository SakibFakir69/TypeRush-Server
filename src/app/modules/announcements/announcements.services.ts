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


const getAllAnnouncements = async ({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
} = {}) => {
  const offset = (page - 1) * limit;

  const query = DB.Announcement.where({ isActive: true });

  const [announcements, countResult] = await Promise.all([
    query
      .orderBy((a) => a.createdAt.desc())
      .limit(limit)
      .offset(offset)
      .all(),

    query.aggregate((a) => ({
      total: a.count(),
    })),
  ]);

  const total = countResult.total;
  const totalPages = Math.ceil(total / limit);

  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
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