/*
  Warnings:

  - A unique constraint covering the columns `[participantId,ssoType]` on the table `ParticipantAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ParticipantAccount" ADD COLUMN     "ssoType" TEXT NOT NULL DEFAULT 'LTI1.1';

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAccount_participantId_ssoType_key" ON "ParticipantAccount"("participantId", "ssoType");
