/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Request, Response } from "express";
import { ablyClient } from "../../../../config/ably-config.js";
import { redis } from "../../../../config/redis-config.js";
import { prisma } from "../../../../lib/prisma.db.js";
import { returnResponse } from "../../../../helpers/return-response.js";
import crypto from "crypto";

const INVITE_TTL_SECONDS = 5 * 60; // invite dies if not accepted in 5 min
const MATCHED_GRACE_SECONDS = 60; // short cleanup window after match starts
const MAX_CODE_RETRY = 3;

// --- helpers ---

const generateUniqueCode = async (): Promise<string | null> => {
  for (let i = 0; i < MAX_CODE_RETRY; i++) {
    const code = crypto.randomBytes(3).toString("hex");
    const exists = await redis.exists(`private-match:${code}`);
    if (!exists) return code;
  }
  return null; // astronomically unlikely with 16.7M combos, but handle it
};

const ACCEPT_LUA = `
local key = KEYS[1]
local userId = ARGV[1]

local status = redis.call("HGET", key, "status")
if status == false then
  return "NOT_FOUND"
end
if status ~= "pending" then
  return "ALREADY_USED"
end

local playerA = redis.call("HGET", key, "playerA")
if playerA == userId then
  return "SELF_ACCEPT"
end

redis.call("HSET", key, "status", "matched", "playerB", userId)
return "OK:" .. playerA
`;

// --- invite ---

const inviteUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { time } = req.body as { time?: number };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!time || typeof time !== "number" || time <= 0) {
      return returnResponse(res, false, 400, "invalid time");
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existingUser) {
      return returnResponse(res, false, 404, "user not found");
    }

    const code = await generateUniqueCode();
    if (!code) {
      return returnResponse(res, false, 500, "could not generate invite code, try again");
    }

    const redisKey = `private-match:${code}`;

    const pipeline = redis.pipeline();
    pipeline.hset(redisKey, {
      playerA: userId,
      status: "pending",
      time: String(time),
      createdAt: Date.now().toString(),
    });
    pipeline.expire(redisKey, INVITE_TTL_SECONDS);
    await pipeline.exec();

    return returnResponse(res, true, 200, "invite created", {
      code,
      expiresIn: INVITE_TTL_SECONDS,
    });
  } catch (err) {
    console.error("inviteUser error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- accept ---

const acceptInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const redisKey = `private-match:${code}`;

    // atomic compare-and-set so two concurrent accepts can't both win
    const result = (await redis.eval(ACCEPT_LUA, 1, redisKey, userId)) as string;

    if (result === "NOT_FOUND") {
      return returnResponse(res, false, 404, "invite not found or expired");
    }
    if (result === "ALREADY_USED") {
      return returnResponse(res, false, 409, "invite already used");
    }
    if (result === "SELF_ACCEPT") {
      return returnResponse(res, false, 400, "cannot accept your own invite");
    }

    const playerAId = result.split(":")[1];
    const timeField = await redis.hget(redisKey, "time");
    const time = Number(timeField ?? 30);

    let match;
    try {
      match = await prisma.match.create({
        data: {
          status: "ACTIVE",
          time,
          participants: {
            create: [{ userId: playerAId }, { userId }],
          },
        },
      });
    } catch (dbErr) {
      // roll back redis state so the invite doesn't get stuck "matched" with no match row
      await redis.hset(redisKey, { status: "pending" });
      await redis.hdel(redisKey, "playerB");
      throw dbErr;
    }

    await redis.hset(redisKey, { matchId: match.id });
    await redis.expire(redisKey, MATCHED_GRACE_SECONDS);

    const inviteChannel = ablyClient.channels.get(redisKey);
    await inviteChannel.publish("match_found", { matchId: match.id });

    // TODO: grant match:{id} channel capability to playerAId and userId only,
    // same as random-matchmaking ACTIVE-match capability grant

    return returnResponse(res, true, 200, "match started", { matchId: match.id });
  } catch (err) {
    console.error("acceptInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- decline (invitee rejects, without becoming playerB) ---

const declineInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const redisKey = `private-match:${code}`;
    const invite = await redis.hgetall(redisKey);

    if (!invite?.playerA) {
      return returnResponse(res, false, 404, "invite not found or already expired");
    }
    if (invite.playerA === userId) {
      return returnResponse(res, false, 400, "cannot decline your own invite, use cancel");
    }
    if (invite.status !== "pending") {
      return returnResponse(res, false, 409, "invite already used");
    }

    await redis.del(redisKey);

    const inviteChannel = ablyClient.channels.get(redisKey);
    await inviteChannel.publish("invite_declined", { code });

    return returnResponse(res, true, 200, "invite declined");
  } catch (err) {
    console.error("declineInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- cancel (inviter revokes their own invite) ---

const cancelInvite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.body as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code || typeof code !== "string") {
      return returnResponse(res, false, 400, "code required");
    }

    const redisKey = `private-match:${code}`;
    const invite = await redis.hgetall(redisKey);

    if (!invite?.playerA) {
      return returnResponse(res, false, 404, "invite not found or already expired");
    }
    if (invite.playerA !== userId) {
      return returnResponse(res, false, 403, "not your invite");
    }
    if (invite.status !== "pending") {
      return returnResponse(res, false, 409, "invite already accepted, cannot cancel");
    }

    await redis.del(redisKey);

    const inviteChannel = ablyClient.channels.get(redisKey);
    await inviteChannel.publish("invite_cancelled", { code });

    return returnResponse(res, true, 200, "invite cancelled");
  } catch (err) {
    console.error("cancelInvite error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};

// --- status (polling fallback if an Ably event is missed) ---

const getInviteStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId as string;
    const { code } = req.params as { code?: string };

    if (!userId) {
      return returnResponse(res, false, 401, "unauthorized");
    }
    if (!code) {
      return returnResponse(res, false, 400, "code required");
    }

    const redisKey = `private-match:${code}`;
    const invite = await redis.hgetall(redisKey);

    if (!invite?.playerA) {
      return returnResponse(res, false, 404, "invite not found or expired");
    }
    if (invite.playerA !== userId && invite.playerB !== userId) {
      return returnResponse(res, false, 403, "not part of this invite");
    }

    return returnResponse(res, true, 200, "invite status", {
      status: invite.status,
      matchId: invite.matchId ?? null,
    });
  } catch (err) {
    console.error("getInviteStatus error:", err);
    return returnResponse(res, false, 500, "something went wrong");
  }
};


export const  invitedController = {
     inviteUser, acceptInvite, declineInvite, cancelInvite, getInviteStatus

}