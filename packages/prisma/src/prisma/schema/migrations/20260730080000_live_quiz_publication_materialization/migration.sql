ALTER TABLE "LiveQuiz"
ADD COLUMN "publicationMetadataMaterializedAt" TIMESTAMP(3);

CREATE INDEX "LiveQuiz_status_publicationMetadataMaterializedAt_idx"
ON "LiveQuiz"("status", "publicationMetadataMaterializedAt");
