-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "randomAssignmentFinalized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ParticipantGroup" ADD COLUMN     "randomlyAssigned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GroupAssignmentPoolEntry" (
    "id" SERIAL NOT NULL,
    "courseId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAssignmentPoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupAssignmentPoolEntry_courseId_participantId_key" ON "GroupAssignmentPoolEntry"("courseId", "participantId");

-- AddForeignKey
ALTER TABLE "GroupAssignmentPoolEntry" ADD CONSTRAINT "GroupAssignmentPoolEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAssignmentPoolEntry" ADD CONSTRAINT "GroupAssignmentPoolEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
