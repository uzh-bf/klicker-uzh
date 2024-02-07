/*
  Warnings:

  - You are about to drop the `_ElementInstanceToParticipation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ElementInstanceToParticipation" DROP CONSTRAINT "_ElementInstanceToParticipation_A_fkey";

-- DropForeignKey
ALTER TABLE "_ElementInstanceToParticipation" DROP CONSTRAINT "_ElementInstanceToParticipation_B_fkey";

-- DropTable
DROP TABLE "_ElementInstanceToParticipation";
