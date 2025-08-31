/*
  Warnings:

  - You are about to drop the column `loginToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `loginTokenExpiresAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "loginToken",
DROP COLUMN "loginTokenExpiresAt";
