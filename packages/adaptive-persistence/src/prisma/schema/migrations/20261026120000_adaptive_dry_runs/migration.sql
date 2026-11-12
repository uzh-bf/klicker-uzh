-- Adaptive dry runs (testing environments only): simulated students run
-- through the engine against the current publication of a quiz. Additive.

-- CreateTable
CREATE TABLE "AdaptivePracticeQuizDryRun" (
    "id" UUID NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "publicationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "engineRevision" TEXT,
    "durationMs" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "effectiveSettings" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "students" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePracticeQuizDryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apqdr_quiz_number_key" ON "AdaptivePracticeQuizDryRun"("practiceQuizId", "number");

-- AddForeignKey
ALTER TABLE "AdaptivePracticeQuizDryRun" ADD CONSTRAINT "AdaptivePracticeQuizDryRun_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
