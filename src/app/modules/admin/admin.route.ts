import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { contestController } from "../contest/contest.controller.js";
import { practiceController } from "../practice/practice.controller.js";
import { userController } from "../users/user.controller.js";
import { invitedController } from "../battle/invited/invited.controller.js";
import { matchmakingStatController } from "../battle/matchmaking/stats.controller.js";
import { getRecentMatchesAdminHandler } from "../battle/match/match.controller.js";



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




// STATS / ANALYTICS
router.get("/stats/overview", verifyToken, verifyRole("ADMIN"), invitedController.getPlatformOverview);
router.get("/stats/matches-timeseries", verifyToken, verifyRole("ADMIN"), invitedController.getMatchesTimeSeries);
router.get("/stats/performance-timeseries", verifyToken, verifyRole("ADMIN"), invitedController.getPerformanceTimeSeries);
router.get("/stats/invite-funnel", verifyToken, verifyRole("ADMIN"), invitedController.getInviteFunnel);
router.get("/stats/top-players", verifyToken, verifyRole("ADMIN"), invitedController.getTopPlayers);

// matchmaking
router.get("/stats/overview", verifyToken,verifyRole("ADMIN"), matchmakingStatController.overview);
router.get("/stats/timeseries", verifyToken,verifyRole("ADMIN"), matchmakingStatController.timeSeries);
router.get("/stats/deltas", verifyToken, verifyRole("ADMIN"),matchmakingStatController.deltas);
router.get("/stats/history", verifyToken,verifyRole("ADMIN"), matchmakingStatController.history);

// match
router.get("/match/recent", verifyToken,verifyRole("ADMIN"), getRecentMatchesAdminHandler);




// add perfomence and optimization
// then go admin_client - 100% fix
// then go client - fix 100%
// launch site



export const adminRouter = router;
