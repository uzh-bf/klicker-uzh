-- CreateEnum
CREATE TYPE "public"."LiveQuizResponseCollectionMode" AS ENUM ('AGGREGATED_ANONYMOUS', 'CORRELATED_EXPORT');

-- CreateEnum
CREATE TYPE "public"."LiveQuizRespondentType" AS ENUM ('TEMPORARY_PSEUDONYM', 'ANONYMOUS_CORRELATED');

-- AlterTable
ALTER TABLE "public"."LiveQuiz"
ADD COLUMN "exportSalt" TEXT,
ADD COLUMN "responseCollectionMode" "public"."LiveQuizResponseCollectionMode" NOT NULL DEFAULT 'AGGREGATED_ANONYMOUS';

-- CreateTable
CREATE TABLE "public"."LiveQuizRespondent" (
    "id" UUID NOT NULL,
    "type" "public"."LiveQuizRespondentType" NOT NULL,
    "verificationSecretHash" TEXT,
    "liveQuizId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveQuizRespondent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveQuizRespondent_secret_check" CHECK ("type" <> 'ANONYMOUS_CORRELATED' OR "verificationSecretHash" IS NOT NULL)
);

-- AlterTable
ALTER TABLE "public"."LiveQuizResponse"
ADD COLUMN "respondentId" UUID,
ALTER COLUMN "participantId" DROP NOT NULL,
ADD CONSTRAINT "LiveQuizResponse_identity_check" CHECK (num_nonnulls("participantId", "respondentId") = 1) NOT VALID;

-- ValidateConstraint
ALTER TABLE "public"."LiveQuizResponse" VALIDATE CONSTRAINT "LiveQuizResponse_identity_check";

-- CreateIndex
CREATE INDEX "LiveQuizRespondent_liveQuizId_idx" ON "public"."LiveQuizRespondent"("liveQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizResponse_instanceId_elementBlockExecution_responden_key" ON "public"."LiveQuizResponse"("instanceId", "elementBlockExecution", "respondentId");

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRespondent" ADD CONSTRAINT "LiveQuizRespondent_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizResponse" ADD CONSTRAINT "LiveQuizResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "public"."LiveQuizRespondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
