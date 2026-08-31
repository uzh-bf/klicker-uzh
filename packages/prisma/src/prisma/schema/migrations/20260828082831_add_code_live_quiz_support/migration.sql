-- AlterTable
ALTER TABLE "CodeSubmission" ADD COLUMN     "elementBlockExecution" INTEGER,
ADD COLUMN     "liveQuizId" UUID;

-- Keep every receipt attached to exactly one activity. Live Quiz receipts must
-- also identify the block execution in which they were accepted.
ALTER TABLE "CodeSubmission" DROP CONSTRAINT "CodeSubmission_activity_check";
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_activity_check" CHECK (
    ("practiceQuizId" IS NOT NULL AND "microLearningId" IS NULL AND "liveQuizId" IS NULL AND "elementBlockExecution" IS NULL) OR
    ("practiceQuizId" IS NULL AND "microLearningId" IS NOT NULL AND "liveQuizId" IS NULL AND "elementBlockExecution" IS NULL) OR
    ("practiceQuizId" IS NULL AND "microLearningId" IS NULL AND "liveQuizId" IS NOT NULL AND "elementBlockExecution" IS NOT NULL)
);

-- Async activities keep one active receipt per participant/instance. Live Quiz
-- reruns need the execution in that identity so an old receipt cannot block a
-- new run of the same block.
DROP INDEX "CodeSubmission_active_participant_instance_key";
CREATE UNIQUE INDEX "CodeSubmission_active_participant_instance_key"
ON "CodeSubmission"("participantId", "elementInstanceId")
WHERE "status" IN ('PENDING', 'RUNNING') AND "liveQuizId" IS NULL;
CREATE UNIQUE INDEX "CodeSubmission_active_participant_instance_execution_key"
ON "CodeSubmission"("participantId", "elementInstanceId", "elementBlockExecution")
WHERE "status" IN ('PENDING', 'RUNNING') AND "liveQuizId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "CodeSubmission_liveQuizId_elementBlockExecution_idx" ON "CodeSubmission"("liveQuizId", "elementBlockExecution");

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
