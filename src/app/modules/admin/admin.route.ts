import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { contestController } from "../contest/contest.controller.js";
import { practiceController } from "../practice/practice.controller.js";
import { userController } from "../users/user.controller.js";



const router = Router();

// CONTEST
router.post('/contests', verifyToken,verifyRole("ADMIN"), contestController.createContest)
router.get('/contests',verifyToken,verifyRole("ADMIN"), contestController.getAllContests);
router.delete("/contests/:id", verifyToken,verifyRole("ADMIN"), contestController.deleteContest);
// PRACTICE 
router.post("/submit",verifyToken,verifyRole("ADMIN"), practiceController.addPracticeContent); 
router.delete(
  "/:id",
  verifyToken,
  verifyRole("ADMIN"),
  practiceController.deletePracticeContent
);
// USERS
router.get("/users", verifyToken, verifyRole("ADMIN"), userController.getAllUsers);
router.get("/users/:id", verifyToken, verifyRole("ADMIN"),userController.getUserById);
router.patch("/users/:id/role", verifyToken, verifyRole("ADMIN"), userController.updateUserRole);
router.delete("/users/:id", verifyToken, verifyRole("ADMIN"), userController.deleteUser);
router.patch("/users/:id/restore", verifyToken, verifyRole("ADMIN"), userController.restoreUser);


// add perfomence and optimization
// then go admin_client - 100% fix
// then go client - fix 100%
// launch site



export const adminRouter = router;