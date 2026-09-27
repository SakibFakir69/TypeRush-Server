// src/app/modules/practice/practice.route.ts
import { Router } from "express";
import { practiceController } from "./practice.controller.js";

const router = Router();


router.get("/topics", practiceController.practiceAllTopic);
router.get("/paragraph", practiceController.getPracticeParagraph);
router.post("/result", practiceController.submitPracticeResult);
router.get("/leaderboard", practiceController.practiceLeaderboard);

// ADMIN 
router.post("/admin/content", practiceController.addPracticeContent);

export const practiceRoutes = router;