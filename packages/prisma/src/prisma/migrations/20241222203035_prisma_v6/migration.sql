-- AlterTable
ALTER TABLE "_AchievementToTitle" ADD CONSTRAINT "_AchievementToTitle_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AchievementToTitle_AB_unique";

-- AlterTable
ALTER TABLE "_ElementStackToParticipation" ADD CONSTRAINT "_ElementStackToParticipation_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ElementStackToParticipation_AB_unique";

-- AlterTable
ALTER TABLE "_ElementToTag" ADD CONSTRAINT "_ElementToTag_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ElementToTag_AB_unique";

-- AlterTable
ALTER TABLE "_ParticipantToParticipantGroup" ADD CONSTRAINT "_ParticipantToParticipantGroup_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ParticipantToParticipantGroup_AB_unique";

-- AlterTable
ALTER TABLE "_ParticipantToTitle" ADD CONSTRAINT "_ParticipantToTitle_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ParticipantToTitle_AB_unique";
