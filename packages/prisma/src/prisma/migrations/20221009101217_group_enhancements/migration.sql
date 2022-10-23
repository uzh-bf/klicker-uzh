/*
  Warnings:

  - You are about to drop the column `score` on the `ParticipantGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ParticipantGroup" DROP COLUMN "score",
ADD COLUMN     "averageMemberScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "groupActivityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
