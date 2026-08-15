ALTER TABLE "public"."LiveQuizPendingResponse"
ADD COLUMN "publicationGeneration" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "LiveQuizPendingResponse_liveQuizId_publicationGeneration_settledAt_idx"
ON "public"."LiveQuizPendingResponse"("liveQuizId", "publicationGeneration", "settledAt");
