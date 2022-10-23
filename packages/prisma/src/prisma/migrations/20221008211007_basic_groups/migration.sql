/*
  Warnings:

  - You are about to drop the `_ParticipantFollows` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ParticipantFollows" DROP CONSTRAINT "_ParticipantFollows_A_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipantFollows" DROP CONSTRAINT "_ParticipantFollows_B_fkey";

-- DropTable
DROP TABLE "_ParticipantFollows";

-- CreateTable
CREATE TABLE "ParticipantGroup" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipantToParticipantGroup" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantGroup_courseId_code_key" ON "ParticipantGroup"("courseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantToParticipantGroup_AB_unique" ON "_ParticipantToParticipantGroup"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantToParticipantGroup_B_index" ON "_ParticipantToParticipantGroup"("B");

-- AddForeignKey
ALTER TABLE "ParticipantGroup" ADD CONSTRAINT "ParticipantGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "_ParticipantToParticipantGroup" ADD CONSTRAINT "_ParticipantToParticipantGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToParticipantGroup" ADD CONSTRAINT "_ParticipantToParticipantGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "ParticipantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
