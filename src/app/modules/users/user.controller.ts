/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Response, Request, NextFunction } from "express";
import bcrypt from "bcrypt";
import { ZodError } from "zod";
import { createUserSchema, type User } from "./user.validation.js";
import { DB } from "../../../../prisma/db/prisma.db.js";
import { StatusCodes } from "http-status-codes";
import { returnResponse } from "../../../helpers/return-response.js";
import { generateOtp } from "../../../helpers/otp-code.js";
import { hashOtp } from "../../../utils/auth/has-otp.js";
import { OTP_TTL } from "../../../const/auth.const.js";
import { redis } from "../../../config/redis-config.js";
import sendOtpEmail from "../../../utils/otp/otp.js";



const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createUserSchema.parse(req.body);

        const isUserExits = await DB.User.first({ email: data.email });
        if (isUserExits) {
            return returnResponse(res, false, StatusCodes.BAD_REQUEST, "Please provide another email");
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
            emailVerified: false,
        });

        const { password, ...userWithoutPassword } = user;

        // fire-and-forget OTP send — don't fail signup if email fails
    
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
    
    console.log(req.user ,'[ CALL GETME ] ')
    try {
        const userId = req.user?.userId as string;

        if (!userId) {
            return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
        }

        const userData = await DB.User.first({id:userId});
        if(!userData){
           return returnResponse (res,false, StatusCodes.BAD_REQUEST, "User data not found")
        }
        console.log(userData ,"[ USER DATA ]")
        
        return returnResponse(res,true , StatusCodes.OK, "User data retrieve successfully",userData);


    } catch (error) {
        next(error);
    }
}



const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId as string;
        const { bio, avatarUrl, country, fullName, name ,age } = req.body;

        if (!userId) {
            return returnResponse(res, false, StatusCodes.UNAUTHORIZED, "You are unauthorized");
        }

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
        if (country !== undefined) data.country = country;
        if (fullName !== undefined) data.fullName = fullName;
        if (bio !== undefined) data.bio = bio;
        if(age!==undefined) data.age=age;

        if (Object.keys(data).length === 0) {
            return returnResponse(res, false, StatusCodes.BAD_REQUEST, "No fields provided to update");
        };

        const updatedUser = await DB.User.where({ id: userId }).update(data);

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

        const deletedUser = await DB.User.where({ id: userId }).update({isDelete:true});

        if (!deletedUser) {
            return returnResponse(res, false, StatusCodes.NOT_FOUND, "User not found");
        }

        return returnResponse(res, true, StatusCodes.OK, "User deleted successfully");
    } catch (error) {
        next(error);
    }
};

 

export const userController = {
    createUser, updateUser,getMe,deleteUser

};
