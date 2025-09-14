-- CreateEnum
CREATE TYPE "AwardType" AS ENUM ('PARTICIPANT', 'GROUP');

-- CreateTable
CREATE TABLE "AwardEntry" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "AwardType" NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "participantId" UUID,
    "participantGroupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AwardEntry_courseId_type_order_key" ON "AwardEntry"("courseId", "type", "order");

-- CreateIndex
CREATE UNIQUE INDEX "AwardEntry_courseId_type_name_key" ON "AwardEntry"("courseId", "type", "name");

-- AddForeignKey
ALTER TABLE "AwardEntry" ADD CONSTRAINT "AwardEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardEntry" ADD CONSTRAINT "AwardEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardEntry" ADD CONSTRAINT "AwardEntry_participantGroupId_fkey" FOREIGN KEY ("participantGroupId") REFERENCES "ParticipantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
