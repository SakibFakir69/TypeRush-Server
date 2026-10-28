/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Response, Request, NextFunction } from "express";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import type { Prisma } from "@prisma/client";
import { createUserSchema, updateUserRoleSchema, userQuerySchema, type User } from "./user.validation.js";
import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../../helpers/return-response.js";
import { generateOtp } from "../../../helpers/otp-code.js";
import { hashOtp } from "../../../utils/auth/has-otp.js";
import { OTP_TTL } from "../../../const/auth.const.js";
import { redis } from "../../../config/redis-config.js";
import sendOtpEmail from "../../../utils/otp/otp.js";
import { USER_SAFE_FIELDS } from "../../../const/user.const.js";
import { prisma } from "../../../lib/prisma.db.js";



const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);

    const isUserExits = await prisma.user.findFirst({ where: { email: data.email } });
    if (isUserExits) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide another email");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        fullName: data.fullName,
        email: data.email,
        country: data.country,
        password: hashedPassword,
        age: data.age ?? null,
        avatarUrl: data.avatarUrl ?? null,
        bio: data.bio ?? null,
        emailVerified: false,
        role: data?.role ?? "USER"
      }
    });

    const { password, ...userWithoutPassword } = user;

    const email = data.email.trim().toLowerCase();
    const otp = generateOtp();
    await redis.set(`otp:verify:${email}`, hashOtp(otp), 'EX', OTP_TTL);
    await redis.del(`otp:verify:attempts:${email}`);

    try {
      await sendOtpEmail(email, otp);
      console.log("[ EMAIL SENT ]")
    } catch (err) {
      console.error('verify-email OTP send failed:', err);
    }

    return returnResponse(res, true, StatusCodes.CREATED, "User created. Please verify your email.", userWithoutPassword);

  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: "Validation failed" });
      return;
    }
    next(error);
  }
};

const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;

    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
    }

    const userData = await prisma.user.findFirst({ where: { id: userId } });
    if (!userData) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "User data not found")
    }

    return returnResponse(res, true, StatusCodes.OK, "User data retrieve successfully", userData);

  } catch (error) {
    next(error);
  }
}

const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;
    const { bio, avatarUrl, country, fullName, name, age } = req.body;

    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (country !== undefined) data.country = country;
    if (fullName !== undefined) data.fullName = fullName;
    if (bio !== undefined) data.bio = bio;
    if (age !== undefined) data.age = age;

    if (Object.keys(data).length === 0) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "No fields provided to update");
    };

    const updatedUser = await prisma.user.update({ where: { id: userId }, data });

    return returnResponse(res, true, StatusCodes.OK, "Profile updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId as string;

    if (!userId) {
      return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
    }

    const deletedUser = await prisma.user.update({ where: { id: userId }, data: { isDelete: true } });

    if (!deletedUser) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "User not found");
    }

    return returnResponse(res, true, StatusCodes.OK, "User deleted successfully");
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = userQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Invalid query parameters",
        parsed.error.flatten()
      );
    }

    const { limit, page, orderBy, sortBy, search, role, includeDeleted } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (!includeDeleted) {
      where.isDelete = false;
    }
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ];
    }

    const selectFields = Object.fromEntries(USER_SAFE_FIELDS.map((field) => [field, true]));

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: selectFields,
        orderBy: { [orderBy]: sortBy },
        take: limit,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: userId } = req.params as { id: string };

    if (!userId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found user id");
    }

    const selectFields = Object.fromEntries(USER_SAFE_FIELDS.map((field) => [field, true]));

    const userData = await prisma.user.findFirst({ where: { id: userId }, select: selectFields });

    if (!userData) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "User not found");
    }

    return returnResponse(res, true, StatusCodes.OK, "User fetched successfully", userData);
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: userId } = req.params as { id: string };

    if (!userId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found user id");
    }

    const result = updateUserRoleSchema.safeParse(req.body);

    if (!result.success) {
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_REQUEST,
        "Please provide correct data",
        result.error.flatten()
      );
    }

    const existing = await prisma.user.findFirst({ where: { id: userId } });
    if (!existing) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "User not found");
    }

    const updatedUser = await prisma.user.update({ where: { id: userId }, data: { role: result.data.role } });

    return returnResponse(res, true, StatusCodes.OK, "User role updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};

const restoreUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: userId } = req.params as { id: string };

    if (!userId) {
      return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Not found user id");
    }

    const existing = await prisma.user.findFirst({ where: { id: userId } });
    if (!existing) {
      return returnResponse(res, false, StatusCodes.NOT_FOUND, "User not found");
    }

    const restoredUser = await prisma.user.update({ where: { id: userId }, data: { isDelete: false } });

    return returnResponse(res, true, StatusCodes.OK, "User restored successfully", restoredUser);
  } catch (error) {
    next(error);
  }
};

export const userController = {
  createUser, updateUser, getMe, deleteUser, restoreUser, getUserById, updateUserRole, getAllUsers
};