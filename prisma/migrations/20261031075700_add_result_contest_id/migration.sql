-- AlterTable
ALTER TABLE "Result" ADD COLUMN "contestId" TEXT;

-- CreateIndex
CREATE INDEX "Result_contestId_idx" ON "Result"("contestId");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
