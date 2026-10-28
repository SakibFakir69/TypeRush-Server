import { prisma } from "../../../lib/prisma.db.js";
import type { z } from "zod";
import type { createAnnouncementSchema, updateAnnouncementSchema } from "./announcements.validation.js";

const createData = async (
  data: z.infer<typeof createAnnouncementSchema>,
  userId: string
) => {
  return prisma.announcement.create({
    data: {
      ...data,
      userId,
    },
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

  const where = { isActive: true };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),

    prisma.announcement.count({ where }),
  ]);

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
  const existing = await prisma.announcement.findFirst({ where: { id } });
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.message !== undefined) updateData.message = data.message;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.announcement.update({ where: { id }, data: updateData });
};

const deleteAnnouncement = async (id: string) => {
  const existing = await prisma.announcement.findFirst({ where: { id } });
  if (!existing) return null;

  return prisma.announcement.delete({ where: { id } });
};

export const AnnouncementServices = {
  createData,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};