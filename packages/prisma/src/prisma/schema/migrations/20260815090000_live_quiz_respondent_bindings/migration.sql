-- Extend the existing respondent row without dropping compatibility columns.
-- Downstream admission and settlement slices remove those columns after all
-- old writers have been migrated to LiveQuizRespondentBinding.
ALTER TABLE "public"."LiveQuizRespondent"
ALTER COLUMN "type" DROP NOT NULL,
ADD COLUMN "publicationGeneration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "exportLabel" INTEGER,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD CONSTRAINT "LiveQuizRespondent_export_label_positive"
CHECK ("exportLabel" IS NULL OR "exportLabel" > 0);

DROP INDEX "public"."LiveQuizRespondent_liveQuizId_idx";

CREATE INDEX "LiveQuizRespondent_liveQuizId_publicationGeneration_idx"
ON "public"."LiveQuizRespondent"("liveQuizId", "publicationGeneration");

CREATE UNIQUE INDEX "LQRRespondent_quiz_generation_key"
ON "public"."LiveQuizRespondent"("id", "liveQuizId", "publicationGeneration");

CREATE UNIQUE INDEX "LQRRespondent_quiz_generation_export_label_key"
ON "public"."LiveQuizRespondent"("liveQuizId", "publicationGeneration", "exportLabel");

CREATE TABLE "public"."LiveQuizRespondentBinding" (
    "respondentId" UUID NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "publicationGeneration" INTEGER NOT NULL DEFAULT 0,
    "participantId" UUID,
    "verificationSecretHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveQuizRespondentBinding_pkey" PRIMARY KEY ("respondentId"),
    CONSTRAINT "LiveQuizRespondentBinding_owner_check"
      CHECK (num_nonnulls("participantId", "verificationSecretHash") = 1)
);

CREATE UNIQUE INDEX "LQRBinding_respondent_quiz_generation_key"
ON "public"."LiveQuizRespondentBinding"("respondentId", "liveQuizId", "publicationGeneration");

CREATE UNIQUE INDEX "LQRBinding_quiz_generation_participant_key"
ON "public"."LiveQuizRespondentBinding"("liveQuizId", "publicationGeneration", "participantId");

CREATE UNIQUE INDEX "LQRBinding_quiz_generation_secret_key"
ON "public"."LiveQuizRespondentBinding"("liveQuizId", "publicationGeneration", "verificationSecretHash");

CREATE INDEX "LiveQuizRespondentBinding_liveQuizId_publicationGeneration_idx"
ON "public"."LiveQuizRespondentBinding"("liveQuizId", "publicationGeneration");

ALTER TABLE "public"."LiveQuizRespondentBinding"
ADD CONSTRAINT "LiveQuizRespondentBinding_respondentId_fkey"
FOREIGN KEY ("respondentId", "liveQuizId", "publicationGeneration")
REFERENCES "public"."LiveQuizRespondent"("id", "liveQuizId", "publicationGeneration")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."LiveQuizRespondentBinding"
ADD CONSTRAINT "LiveQuizRespondentBinding_liveQuizId_fkey"
FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."LiveQuizRespondentBinding"
ADD CONSTRAINT "LiveQuizRespondentBinding_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
