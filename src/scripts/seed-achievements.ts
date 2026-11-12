/**
 * Seeds the default badge catalogue.
 *
 * The admin panel can create and edit achievements by hand — this script only
 * makes sure the platform ships with a sane starter set (speed, accuracy,
 * volume, streak, contest and social badges) so members have something to
 * unlock on their first run.
 *
 * It is idempotent: rows are matched by `key`, so running it again only
 * refreshes the names and thresholds, it never duplicates a badge.
 *
 *   npm run seed:achievements
 */
import "dotenv/config";
import { prisma } from "../lib/prisma.db.js";

type SeedAchievement = {
  key: string;
  name: string;
  description: string;
  category: "speed" | "accuracy" | "volume" | "streak" | "contest" | "social";
  tier: number;
  threshold: number;
};

const ACHIEVEMENTS: SeedAchievement[] = [
  // speed — best WPM in a single run
  {
    key: "speed_40",
    name: "Getting Started",
    description: "Hit 40 WPM in a run.",
    category: "speed",
    tier: 1,
    threshold: 40,
  },
  {
    key: "speed_70",
    name: "Swift Fingers",
    description: "Hit 70 WPM in a run.",
    category: "speed",
    tier: 2,
    threshold: 70,
  },
  {
    key: "speed_100",
    name: "Speed Demon",
    description: "Hit 100 WPM in a run.",
    category: "speed",
    tier: 3,
    threshold: 100,
  },
  // accuracy — best accuracy in a single run
  {
    key: "accuracy_90",
    name: "Steady Hands",
    description: "Finish a run with 90% accuracy.",
    category: "accuracy",
    tier: 1,
    threshold: 90,
  },
  {
    key: "accuracy_95",
    name: "Accuracy Master",
    description: "Finish a run with 95% accuracy.",
    category: "accuracy",
    tier: 2,
    threshold: 95,
  },
  {
    key: "accuracy_98",
    name: "Surgical Typist",
    description: "Finish a run with 98% accuracy.",
    category: "accuracy",
    tier: 3,
    threshold: 98,
  },
  // volume — number of finished runs
  {
    key: "volume_10",
    name: "Ten Down",
    description: "Finish 10 runs.",
    category: "volume",
    tier: 1,
    threshold: 10,
  },
  {
    key: "volume_50",
    name: "Half Century",
    description: "Finish 50 runs.",
    category: "volume",
    tier: 2,
    threshold: 50,
  },
  {
    key: "volume_100",
    name: "Century Club",
    description: "Finish 100 runs.",
    category: "volume",
    tier: 3,
    threshold: 100,
  },
  // streak — consecutive days with a run
  {
    key: "streak_3",
    name: "Consistent Typist",
    description: "Type 3 days in a row.",
    category: "streak",
    tier: 1,
    threshold: 3,
  },
  {
    key: "streak_7",
    name: "Week Warrior",
    description: "Type 7 days in a row.",
    category: "streak",
    tier: 2,
    threshold: 7,
  },
  {
    key: "streak_30",
    name: "Month of Focus",
    description: "Type 30 days in a row.",
    category: "streak",
    tier: 3,
    threshold: 30,
  },
  // contest — contests joined
  {
    key: "contest_1",
    name: "First Blood",
    description: "Join your first contest.",
    category: "contest",
    tier: 1,
    threshold: 1,
  },
  {
    key: "contest_5",
    name: "Show Regular",
    description: "Join 5 contests.",
    category: "contest",
    tier: 2,
    threshold: 5,
  },
  {
    key: "contest_10",
    name: "Contest Veteran",
    description: "Join 10 contests.",
    category: "contest",
    tier: 3,
    threshold: 10,
  },
  // social — 1v1 battles finished
  {
    key: "social_1",
    name: "First Duel",
    description: "Finish your first 1v1 battle.",
    category: "social",
    tier: 1,
    threshold: 1,
  },
  {
    key: "social_10",
    name: "Duelist",
    description: "Finish 10 1v1 battles.",
    category: "social",
    tier: 2,
    threshold: 10,
  },
  {
    key: "social_25",
    name: "Rival",
    description: "Finish 25 1v1 battles.",
    category: "social",
    tier: 3,
    threshold: 25,
  },
];

async function main() {
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        threshold: achievement.threshold,
      },
      create: achievement,
    });
  }

  const total = await prisma.achievement.count();
  console.warn(`Seeded ${ACHIEVEMENTS.length} achievements (${total} in total).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
