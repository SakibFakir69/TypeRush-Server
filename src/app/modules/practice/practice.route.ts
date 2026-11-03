
import { Router } from "express";
import { practiceController } from "./practice.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";
import { submitResultLimiter } from "../../middleware/rate-limit.middleware.js";

const router = Router();

 
router.get("/topics", practiceController.practiceAllTopic);
router.get("/results", practiceController.practiceLeaderboard);
router.post("/results", submitResultLimiter,verifyToken, practiceController.submitPracticeResult);
router.get("/stats/me", verifyToken, practiceController.getUserStats);
router.get("/:id", practiceController.getPracticeParagraph);



export const practiceRoutes = router;