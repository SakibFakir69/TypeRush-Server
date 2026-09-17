/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Response, Request, NextFunction } from "express";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { createUserSchema, type User } from "./user.validation.js";
import { DB } from "../../../../prisma/db/prisma.db.js";
import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../../helpers/return-response.js";


const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createUserSchema.parse(req.body);

        const isUserExits = await DB.User.first({
            email: data.email
        })
        if (isUserExits) {

            return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please  provide another email")
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const user = await DB.User.create({
            name: data.name,
            fullName: data.fullName,
            email: data.email,
            country: data.country,
            password: hashedPassword,
            age: data.age ?? null,
            avatarUrl: data.avatarUrl ?? null,
            bio: data.bio ?? null,
        });
        console.log(user, "CREATED")

        const { password, ...userWithoutPassword } = user;


        return returnResponse(res, true, StatusCodes.CREATED, "User created successfully", userWithoutPassword)

    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ message: "Validation failed" });
            return;
        }

        next(error);
    }
};




const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId as string;
        const { bio, avatarUrl, country, fullName, name } = req.body;

        if (!userId) {
            return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
        }

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
        if (country !== undefined) data.country = country;
        if (fullName !== undefined) data.fullName = fullName;
        if (bio !== undefined) data.bio = bio;

        if (Object.keys(data).length === 0) {
            return returnResponse(res, false, StatusCodes.BAD_REQUEST, "No fields provided to update");
        };

        const updatedUser = await DB.User.where({ id: userId }).update(data);

        return returnResponse(res, true, StatusCodes.OK, "Profile updated successfully", updatedUser);
    } catch (error) {
        next(error);
    }
};

export const userController = {
    createUser,updateUser

};