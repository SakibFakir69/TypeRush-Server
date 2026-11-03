-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_paragraphId_fkey";

-- AlterTable
ALTER TABLE "Result" ALTER COLUMN "paragraphId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;
