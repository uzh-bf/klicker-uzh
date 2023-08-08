/*
  Warnings:

  - You are about to drop the column `isAAI` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ssoId]` on the table `ParticipantAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserLoginScope" AS ENUM ('FULL_ACCESS', 'SESSION_EXEC', 'READ_ONLY');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAAI",
DROP COLUMN "isActive",
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UserLogin" (
    "id" UUID NOT NULL,
    "password" TEXT NOT NULL,
    "scope" "UserLoginScope" NOT NULL DEFAULT 'READ_ONLY',
    "lastLoginAt" TIMESTAMP(3),
    "userId" UUID NOT NULL,

    CONSTRAINT "UserLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAccount_ssoId_key" ON "ParticipantAccount"("ssoId");

-- AddForeignKey
ALTER TABLE "UserLogin" ADD CONSTRAINT "UserLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
