
import { Router } from "express";
import { practiceController } from "./practice.controller.js";
import { verifyToken } from "../../middleware/jwt-token.js";

const router = Router();

router.get("/:id", practiceController.getPracticeParagraph); 
router.get("/topics", practiceController.practiceAllTopic);
router.get("/results", practiceController.practiceLeaderboard);
router.post("/results",verifyToken, practiceController.submitPracticeResult);



export const practiceRoutes = router;