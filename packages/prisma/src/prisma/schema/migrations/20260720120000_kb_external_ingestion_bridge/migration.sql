ALTER TABLE "public"."KBResource"
ADD COLUMN "ingestionAttemptId" UUID,
ADD COLUMN "externalWorkflowRunId" TEXT,
ADD COLUMN "externalWorkflowStartedAt" TIMESTAMP(3);

CREATE INDEX "KBResource_status_idx" ON "public"."KBResource"("status");
