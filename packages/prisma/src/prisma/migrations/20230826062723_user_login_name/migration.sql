/*
  Warnings:

  - Added the required column `name` to the `UserLogin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserLogin" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '-';
