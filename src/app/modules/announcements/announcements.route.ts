import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { announcementController } from "./announcement.controller.js";


const router = Router();

router.get("/", verifyToken, verifyRole("ADMIN"), announcementController.getAllAnnouncements)
router.post("/", verifyToken, verifyRole("ADMIN"), announcementController.createAnnouncement);
router.patch("/:id", verifyToken, verifyRole("ADMIN"), announcementController.updateAnnouncement);
router.delete("/:id", verifyToken, verifyRole("ADMIN"), announcementController.deleteAnnouncement);


export const announcementRouter = router;