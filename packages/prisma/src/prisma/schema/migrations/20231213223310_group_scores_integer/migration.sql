/*
  Warnings:

  - You are about to alter the column `averageMemberScore` on the `ParticipantGroup` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `groupActivityScore` on the `ParticipantGroup` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "ParticipantGroup" ALTER COLUMN "averageMemberScore" SET DEFAULT 0,
ALTER COLUMN "averageMemberScore" SET DATA TYPE INTEGER,
ALTER COLUMN "groupActivityScore" SET DEFAULT 0,
ALTER COLUMN "groupActivityScore" SET DATA TYPE INTEGER;
