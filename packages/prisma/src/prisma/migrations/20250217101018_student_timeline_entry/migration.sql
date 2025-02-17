-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" SERIAL NOT NULL,
    "type" "TimelineEntryType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "computedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedXp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "courseId" UUID,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEntry_participantId_courseId_timestamp_type_key" ON "TimelineEntry"("participantId", "courseId", "timestamp", "type");

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
