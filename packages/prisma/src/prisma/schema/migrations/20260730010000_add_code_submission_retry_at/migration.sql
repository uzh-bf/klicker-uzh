-- AlterTable
ALTER TABLE "public"."CodeSubmission" ADD COLUMN "retryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CodeSubmission_status_retryAt_createdAt_idx" ON "public"."CodeSubmission"("status", "retryAt", "createdAt");
