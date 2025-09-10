-- AlterTable
ALTER TABLE "public"."ElementBlock" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."LiveQuizResponse" (
    "id" SERIAL NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "response" JSONB NOT NULL,
    "timeSpent" REAL NOT NULL,
    "correctness" "public"."ResponseCorrectness" NOT NULL,
    "basePoints" FLOAT(2) NOT NULL,
    "correctnessPoints" FLOAT(2) NOT NULL,
    "bonusPoints" FLOAT(2) NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "elementBlockExecution" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveQuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveQuizResponse_instanceId_elementBlockExecution_idx" ON "public"."LiveQuizResponse"("instanceId", "elementBlockExecution");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizResponse_instanceId_elementBlockExecution_participa_key" ON "public"."LiveQuizResponse"("instanceId", "elementBlockExecution", "participantId");

-- AddForeignKey
ALTER TABLE "public"."LiveQuizResponse" ADD CONSTRAINT "LiveQuizResponse_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizResponse" ADD CONSTRAINT "LiveQuizResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
