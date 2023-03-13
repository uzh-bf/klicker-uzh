/*
  Warnings:

  - You are about to drop the column `level` on the `Participant` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_level_fkey";

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "level";
