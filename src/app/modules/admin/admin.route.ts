import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-token.js";
import { verifyRole } from "../../middleware/verify-role.js";
import { contestController } from "../contest/contest.controller.js";
import { practiceController } from "../practice/practice.controller.js";
import { userController } from "../users/user.controller.js";
import { invitedController } from "../battle/invited/invited.controller.js";
import { matchmakingStatController } from "../battle/matchmaking/stats.controller.js";
import { getRecentMatchesAdminHandler } from "../battle/match/match.controller.js";
import { achievementController } from "../achievements/achievement.controller.js";


const router = Router();

// CONTEST
router.post("/contests", verifyToken, verifyRole("ADMIN"), contestController.createContest);
router.get("/contests", verifyToken, verifyRole("ADMIN"), contestController.getAllContests);
router.delete("/contests/:id", verifyToken, verifyRole("ADMIN"), contestController.deleteContest);

// PRACTICE
router.post("/submit", verifyToken, verifyRole("ADMIN"), practiceController.addPracticeContent);
router.delete("/:id", verifyToken, verifyRole("ADMIN"), practiceController.deletePracticeContent);

// USERS
router.get("/users", verifyToken, verifyRole("ADMIN"), userController.getAllUsers);
router.get("/users/:id", verifyToken, verifyRole("ADMIN"), userController.getUserById);
router.patch("/users/:id/role", verifyToken, verifyRole("ADMIN"), userController.updateUserRole);
router.delete("/users/:id", verifyToken, verifyRole("ADMIN"), userController.deleteUser);
router.patch("/users/:id/restore", verifyToken, verifyRole("ADMIN"), userController.restoreUser);

// STATS / ANALYTICS (platform-wide)
router.get("/stats/overview", verifyToken, verifyRole("ADMIN"), invitedController.getPlatformOverview);
router.get("/stats/matches-timeseries", verifyToken, verifyRole("ADMIN"), invitedController.getMatchesTimeSeries);
router.get("/stats/performance-timeseries", verifyToken, verifyRole("ADMIN"), invitedController.getPerformanceTimeSeries);
router.get("/stats/invite-funnel", verifyToken, verifyRole("ADMIN"), invitedController.getInviteFunnel);
router.get("/stats/top-players", verifyToken, verifyRole("ADMIN"), invitedController.getTopPlayers);

// MATCHMAKING (self-stats, scoped to the signed-in admin's own account)
router.get("/stats/matchmaking/overview", verifyToken, verifyRole("ADMIN"), matchmakingStatController.overview);
router.get("/stats/matchmaking/timeseries", verifyToken, verifyRole("ADMIN"), matchmakingStatController.timeSeries);
router.get("/stats/matchmaking/deltas", verifyToken, verifyRole("ADMIN"), matchmakingStatController.deltas);
router.get("/stats/matchmaking/history", verifyToken, verifyRole("ADMIN"), matchmakingStatController.history);

// MATCH
router.get("/match/recent", verifyToken, verifyRole("ADMIN"), getRecentMatchesAdminHandler);

// ACHIEVEMENTS
router.post("/achievements", verifyToken, verifyRole("ADMIN"), achievementController.createAchievement);
router.get("/achievements", verifyToken, verifyRole("ADMIN"), achievementController.getAllAchievements);
router.get("/achievements/:id", verifyToken, verifyRole("ADMIN"), achievementController.getAchievementById);
router.patch("/achievements/:id", verifyToken, verifyRole("ADMIN"), achievementController.updateAchievement);
router.delete("/achievements/:id", verifyToken, verifyRole("ADMIN"), achievementController.deleteAchievement);
router.post("/achievements/:id/grant", verifyToken, verifyRole("ADMIN"), achievementController.grantUserAchievement);
router.delete("/achievements/:id/users/:userId", verifyToken, verifyRole("ADMIN"), achievementController.revokeUserAchievement);

export const adminRouter = router;