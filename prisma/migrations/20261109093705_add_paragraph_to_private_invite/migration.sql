/*
  Warnings:

  - Added the required column `paragraphId` to the `PrivateInvite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PrivateInvite" ADD COLUMN     "paragraphId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "PrivateInvite" ADD CONSTRAINT "PrivateInvite_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
