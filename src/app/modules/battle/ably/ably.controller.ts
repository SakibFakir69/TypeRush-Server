/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response } from "express";
import { ablyClient } from "../../../../config/ably-config.js";
import { prisma } from "../../../../lib/prisma.db.js";




export const getMatchToken = async (req: Request, res: Response) => {
  const { matchId } = req.params as { matchId: string };
  const userId = req.user?.id as string;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const participant = await prisma.matchParticipant.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  
  if (!participant) {
    return res.status(403).json({ success: false, message: "Not a participant in this match" });
  }

  const tokenRequest = await ablyClient.auth.createTokenRequest({
    clientId: userId,
    capability: {
      [`match:${matchId}`]: ["subscribe", "publish", "presence"],
    },
    ttl: 60 * 60 * 1000,
  });

  return res.json(tokenRequest);
};