import { Router, type Request, type Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyToken } from "../../middleware/jwt-token.js";
import { upload } from "../../middleware/upload.js";

const router = Router();

router.post(
  '/',
  verifyToken,
  upload.single("image"),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "No file uploaded" });
    }

    const file = req.file as Express.Multer.File & { filename: string };

    return res.status(StatusCodes.CREATED).json({
      url: file.path,
      publicId: file.filename, // multer-storage-cloudinary sets public_id here
    });
  }
);

export const uploadRouter = router;