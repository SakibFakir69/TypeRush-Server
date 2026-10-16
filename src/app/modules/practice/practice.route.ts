// src/app/modules/practice/practice.route.ts
import { Router } from "express";
import { practiceController } from "./practice.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";

const router = Router();

router.get("/topics", practiceController.practiceAllTopic);
router.get("/results", practiceController.practiceLeaderboard);

router.post("/results",verifyToken, practiceController.submitPracticeResult);
router.post("/submit", practiceController.addPracticeContent);
router.get("/:id", practiceController.getPracticeParagraph); 

export const practiceRoutes = router;