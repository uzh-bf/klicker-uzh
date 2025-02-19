-- CreateEnum
CREATE TYPE "TimelineEntryType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" SERIAL NOT NULL,
    "type" "TimelineEntryType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedXp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "courseId" UUID,
    "participationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineEntry_courseId_type_timestamp_idx" ON "TimelineEntry"("courseId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "TimelineEntry_participationId_type_timestamp_idx" ON "TimelineEntry"("participationId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "TimelineEntry_type_timestamp_idx" ON "TimelineEntry"("type", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEntry_participationId_courseId_timestamp_type_key" ON "TimelineEntry"("participationId", "courseId", "timestamp", "type");

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEntry" ADD CONSTRAINT "TimelineEntry_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
