// src/app/modules/practice/practice.route.ts
import { Router } from "express";
import { practiceController } from "./practice.controller.js";

const router = Router();

// Paragraphs (practice content)
router.get("/topics", practiceController.practiceAllTopic);
router.get("/:id", practiceController.getPracticeParagraph);
router.post("/submit", practiceController.addPracticeContent); 

// Results (test submissions)
router.post("/results", practiceController.submitPracticeResult);
router.get("/results", practiceController.practiceLeaderboard);

export const practiceRoutes = router;