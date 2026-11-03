-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "duration" INTEGER;

-- CreateIndex
CREATE INDEX "Result_duration_idx" ON "Result"("duration");
