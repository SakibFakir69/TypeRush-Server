import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { announcementController } from "./announcement.controller.js";


const router = Router();


router.post("/announcements", verifyToken, verifyRole("ADMIN"), announcementController.createAnnouncement);
router.patch("/announcements/:id", verifyToken, verifyRole("ADMIN"), announcementController.updateAnnouncement);
router.delete("/announcements/:id", verifyToken, verifyRole("ADMIN"), announcementController.deleteAnnouncement);


export const announcementRouter = router;