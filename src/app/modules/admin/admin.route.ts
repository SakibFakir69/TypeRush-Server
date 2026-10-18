import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { contestController } from "../contest/contest.controller.js";
import { practiceController } from "../practice/practice.controller.js";



const router = Router();

// CONTEST
router.post('/contests', verifyToken,verifyRole("ADMIN"), contestController.createContest)
router.delete("/contests/:id", verifyToken,verifyRole("ADMIN"), contestController.deleteContest);
// PRACTICE 
router.post("/submit",verifyToken,verifyRole("ADMIN"), practiceController.addPracticeContent); 
router.delete(
  "/:id",
  verifyToken,
  verifyRole("ADMIN"),
  practiceController.deletePracticeContent
);

// add perfomence and optimization
// then go admin_client - 100% fix
// then go client - fix 100%
// launch site



export const adminRouter = router;