-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" SERIAL NOT NULL,
    "timestamp" DATE NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "totalXp" DOUBLE PRECISION NOT NULL,
    "collectedAchievements" TEXT[],
    "participantId" UUID NOT NULL,
    "courseId" UUID,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
