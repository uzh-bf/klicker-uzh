-- CreateEnum
CREATE TYPE "public"."PointCorrectionType" AS ENUM ('ALL_COURSE', 'PARTICIPATING', 'SINGLE');

-- AlterTable
ALTER TABLE "public"."LiveQuizResponse" ADD COLUMN     "correctionOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."LiveQuizResponse" ADD CONSTRAINT "LiveQuizResponse_correction_response_check" CHECK ((("correctionOnly" = true) AND ("response" IS NULL)) OR (("correctionOnly" = false) AND ("response" IS NOT NULL)));

-- CreateTable
CREATE TABLE "public"."PointCorrection" (
    "id" SERIAL NOT NULL,
    "basePoints" BOOLEAN,
    "correctnessPoints" BOOLEAN,
    "bonusPoints" BOOLEAN,
    "reason" TEXT NOT NULL,
    "studentReason" TEXT NOT NULL,
    "type" "public"."PointCorrectionType" NOT NULL,
    "participantId" UUID,
    "correctedById" UUID,
    "liveQuizId" UUID,
    "instanceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointCorrection_target_required_check" CHECK (("liveQuizId" IS NOT NULL) OR ("instanceId" IS NOT NULL)),
    CONSTRAINT "PointCorrection_participant_single_check" CHECK ((("type" = 'SINGLE') AND ("participantId" IS NOT NULL)) OR (("type" <> 'SINGLE') AND ("participantId" IS NULL))),
    CONSTRAINT "PointCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppliedPointCorrection" (
    "id" SERIAL NOT NULL,
    "awardedBasePoints" REAL NOT NULL,
    "awardedCorrectnessPoints" REAL NOT NULL,
    "awardedBonusPoints" REAL NOT NULL,
    "deducedBasePoints" REAL NOT NULL,
    "deducedCorrectnessPoints" REAL NOT NULL,
    "deducedBonusPoints" REAL NOT NULL,
    "pointCorrectionId" INTEGER NOT NULL,
    "responseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppliedPointCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppliedPointCorrection_responseId_idx" ON "public"."AppliedPointCorrection"("responseId");

-- AddForeignKey
ALTER TABLE "public"."PointCorrection" ADD CONSTRAINT "PointCorrection_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointCorrection" ADD CONSTRAINT "PointCorrection_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointCorrection" ADD CONSTRAINT "PointCorrection_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppliedPointCorrection" ADD CONSTRAINT "AppliedPointCorrection_pointCorrectionId_fkey" FOREIGN KEY ("pointCorrectionId") REFERENCES "public"."PointCorrection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppliedPointCorrection" ADD CONSTRAINT "AppliedPointCorrection_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."LiveQuizResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
