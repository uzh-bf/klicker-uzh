/*
  Warnings:

  - A unique constraint covering the columns `[userId,isPrimary]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantId,isPrimary]` on the table `ParticipantAccount` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ParticipantAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."ParticipantAccount" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'sso',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Account_providerAccountId_isVerified_idx" ON "public"."Account"("providerAccountId", "isVerified");

-- CreateIndex
CREATE INDEX "Account_type_isVerified_idx" ON "public"."Account"("type", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_isPrimary_key" ON "public"."Account"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "ParticipantAccount_ssoId_isVerified_idx" ON "public"."ParticipantAccount"("ssoId", "isVerified");

-- CreateIndex
CREATE INDEX "ParticipantAccount_type_isVerified_idx" ON "public"."ParticipantAccount"("type", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAccount_participantId_isPrimary_key" ON "public"."ParticipantAccount"("participantId", "isPrimary");
