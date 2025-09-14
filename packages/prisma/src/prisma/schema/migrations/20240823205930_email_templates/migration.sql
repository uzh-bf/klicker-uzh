/*
  Warnings:

  - You are about to drop the column `magicLinkExpiresAt` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `magicLinkToken` on the `Participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "magicLinkExpiresAt",
DROP COLUMN "magicLinkToken";

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "name" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("name")
);
