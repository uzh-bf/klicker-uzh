-- CreateTable
CREATE TABLE "LecturerRatingSession" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LecturerRatingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturerRatingItem" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "elementId" INTEGER NOT NULL,
    "elementVersion" INTEGER NOT NULL,
    "familyKey" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "difficulty" INTEGER,
    "bloom" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LecturerRatingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LecturerRatingSession_reviewerId_idx" ON "LecturerRatingSession"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerRatingSession_courseId_reviewerId_key" ON "LecturerRatingSession"("courseId", "reviewerId");

-- CreateIndex
CREATE INDEX "LecturerRatingItem_elementId_idx" ON "LecturerRatingItem"("elementId");

-- CreateIndex
CREATE INDEX "LecturerRatingItem_sessionId_reviewedAt_idx" ON "LecturerRatingItem"("sessionId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerRatingItem_sessionId_elementId_key" ON "LecturerRatingItem"("sessionId", "elementId");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerRatingItem_sessionId_familyKey_key" ON "LecturerRatingItem"("sessionId", "familyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerRatingItem_sessionId_position_key" ON "LecturerRatingItem"("sessionId", "position");

-- AddForeignKey
ALTER TABLE "LecturerRatingSession" ADD CONSTRAINT "LecturerRatingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerRatingSession" ADD CONSTRAINT "LecturerRatingSession_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerRatingItem" ADD CONSTRAINT "LecturerRatingItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LecturerRatingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerRatingItem" ADD CONSTRAINT "LecturerRatingItem_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
