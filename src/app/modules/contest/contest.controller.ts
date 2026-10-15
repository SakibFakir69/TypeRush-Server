

import type { Request, Response } from "express";
import { DB as prisma } from "../../../../prisma/db/prisma.db.js";

export const createContest = async (req: Request, res: Response) => {
  try {
    const { name, content, time, userId } = req.body;

    const contest = await prisma.contest.create({
      data: { name, content, time, userId },
    });

    return res.status(201).json({ success: true, data: contest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to create contest" });
  }
};

export const getContests = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    const contests = await prisma.contest.findMany({
      where: userId ? { userId: String(userId) } : undefined,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: contests });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch contests" });
  }
};


export const getContestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        user: true,
        participants: { include: { user: true } },
      },
    });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    return res.status(200).json({ success: true, data: contest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to fetch contest" });
  }
};

export const joinContest = async (req: Request, res: Response) => {
  try {
    const { id: contestId } = req.params;
    const userId = req.body.userId; // swap for req.user.id once auth middleware is wired up

    const participant = await prisma.contestParticipant.create({
      data: { contestId, userId },
    });

    return res.status(201).json({ success: true, data: participant });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "Already joined this contest" });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to join contest" });
  }
};

export const leaveContest = async (req: Request, res: Response) => {
  try {
    const { id: contestId } = req.params;
    const userId = req.body.userId; // swap for req.user.id once auth middleware is wired up

    await prisma.contestParticipant.delete({
      where: { userId_contestId: { userId, contestId } },
    });

    return res.status(200).json({ success: true, message: "Left contest" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Not a participant" });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to leave contest" });
  }
};

export const deleteContest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requesterId = req.body.userId; // swap for req.user.id once auth middleware is wired up
    const requesterRole = req.body.role;  // swap for req.user.role

    const contest = await prisma.contest.findUnique({ where: { id } });

    if (!contest) {
      return res.status(404).json({ success: false, message: "Contest not found" });
    }

    if (contest.userId !== requesterId && requesterRole !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await prisma.contest.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Contest deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to delete contest" });
  }
};
