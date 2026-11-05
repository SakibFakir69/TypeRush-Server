import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { StatusCodes } from "http-status-codes";
import multer from "multer";
import { verifyToken } from "../../middleware/jwt-token.js";
import { upload } from "../../middleware/upload.js";
import { prisma } from "../../../lib/prisma.db.js";
import { returnResponse } from "../../../helpers/return-response.js";

const router = Router();

/** Multer reports bad types/oversized files as errors — answer with 400/413. */
function receiveImage(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error: unknown) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const tooBig = error.code === "LIMIT_FILE_SIZE";
      return returnResponse(
        res,
        false,
        tooBig ? StatusCodes.REQUEST_TOO_LONG : StatusCodes.BAD_REQUEST,
        tooBig
          ? "Image is too large — 10 MB is the maximum."
          : `Upload failed: ${error.message}`
      );
    }

    const hostError = error as { http_code?: number; message?: string };
    if (hostError?.http_code === 403) {
      // Cloudinary restricted keys answer 403 for `create`; tell the operator
      // what to fix instead of leaking "UnexpectedResponse".
      return returnResponse(
        res,
        false,
        StatusCodes.BAD_GATEWAY,
        "The image host refused the upload — its API key needs upload (create) permission."
      );
    }

    return returnResponse(
      res,
      false,
      StatusCodes.BAD_REQUEST,
      hostError?.message || "Upload failed"
    );
  });
}

/**
 * Upload an image. Because avatars are the only upload in the product, the
 * signed-in user's `avatarUrl` is saved here as well — this is the endpoint the
 * client already calls, so no second request is needed. `data.user` is included
 * (and the root `url` kept) so older and newer callers both work.
 */
router.post(
  '/',
  verifyToken,
  receiveImage,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "No file uploaded" });
      }

      const file = req.file as Express.Multer.File & { filename: string };
      const userId = req.user?.userId;

      const user = userId
        ? await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: file.path },
            select: {
              id: true,
              name: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              xp: true,
              country: true,
              role: true,
            },
          })
        : null;

      return res.status(StatusCodes.CREATED).json({
        url: file.path,
        publicId: file.filename, // multer-storage-cloudinary sets public_id here
        user,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Avatar upload: sends the image to Cloudinary *and* saves the resulting
 * secure URL on the signed-in user, so the client needs one request instead of
 * upload-then-update. The old image is intentionally left in Cloudinary — users
 * can reuse it and nothing here should delete someone's asset.
 */
router.post(
  '/avatar',
  verifyToken,
  receiveImage,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId as string;

      if (!userId) {
        return returnResponse(
          res,
          false,
          StatusCodes.UNAUTHORIZED,
          "You are unauthorized"
        );
      }

      if (!req.file) {
        return returnResponse(
          res,
          false,
          StatusCodes.BAD_REQUEST,
          "No image uploaded — send it as the `image` field."
        );
      }

      const file = req.file as Express.Multer.File & { filename: string };

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: file.path },
        select: {
          id: true,
          name: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          xp: true,
          country: true,
          role: true,
        },
      });

      return returnResponse(res, true, StatusCodes.CREATED, "Avatar updated", {
        url: user.avatarUrl,
        publicId: file.filename,
        user,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const uploadRouter = router;
