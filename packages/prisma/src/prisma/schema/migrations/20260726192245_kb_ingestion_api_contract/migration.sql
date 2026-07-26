-- Preserve POC operation correlation while replacing the transport vocabulary.
ALTER TABLE "public"."KBResource"
RENAME COLUMN "externalWorkflowRunId" TO "externalOperationId";

ALTER TABLE "public"."KBResource"
RENAME COLUMN "externalWorkflowStartedAt" TO "externalOperationStartedAt";

ALTER TABLE "public"."KBResource"
ADD COLUMN "contentSha256" TEXT,
ADD COLUMN "resourceVersion" INTEGER NOT NULL DEFAULT 0;
