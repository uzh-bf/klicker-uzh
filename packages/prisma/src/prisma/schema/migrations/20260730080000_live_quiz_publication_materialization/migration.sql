ALTER TABLE "LiveQuiz"
ADD COLUMN "publicationMetadataMaterializedAt" TIMESTAMP(3),
ADD COLUMN "publicationMetadataRetryAt" TIMESTAMP(3);

CREATE INDEX "LiveQuiz_status_publicationMetadataRetryAt_publicationMetadataMaterializedAt_idx"
ON "LiveQuiz"("status", "publicationMetadataRetryAt", "publicationMetadataMaterializedAt");
