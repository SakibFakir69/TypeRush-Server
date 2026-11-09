-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'MATCHED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "PrivateInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT,
    "duration" INTEGER NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateInvite_code_key" ON "PrivateInvite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateInvite_matchId_key" ON "PrivateInvite"("matchId");

-- CreateIndex
CREATE INDEX "PrivateInvite_inviterId_idx" ON "PrivateInvite"("inviterId");

-- CreateIndex
CREATE INDEX "PrivateInvite_status_idx" ON "PrivateInvite"("status");

-- AddForeignKey
ALTER TABLE "PrivateInvite" ADD CONSTRAINT "PrivateInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateInvite" ADD CONSTRAINT "PrivateInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateInvite" ADD CONSTRAINT "PrivateInvite_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
