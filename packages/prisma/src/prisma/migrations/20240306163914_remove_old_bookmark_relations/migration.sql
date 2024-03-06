/*
  Warnings:

  - You are about to drop the `_ParticipationToQuestionInstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ParticipationToQuestionStack` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" DROP CONSTRAINT "_ParticipationToQuestionInstance_A_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" DROP CONSTRAINT "_ParticipationToQuestionInstance_B_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionStack" DROP CONSTRAINT "_ParticipationToQuestionStack_A_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionStack" DROP CONSTRAINT "_ParticipationToQuestionStack_B_fkey";

-- DropTable
DROP TABLE "_ParticipationToQuestionInstance";

-- DropTable
DROP TABLE "_ParticipationToQuestionStack";
