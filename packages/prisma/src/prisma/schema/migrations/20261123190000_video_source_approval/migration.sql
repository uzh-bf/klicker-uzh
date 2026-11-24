-- CreateEnum
CREATE TYPE "KBVideoCutMode" AS ENUM ('CLIP', 'EDITED', 'AS_RECORDED');

-- CreateEnum
CREATE TYPE "KBVideoSourceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'AWAITING_ADMIN', 'APPROVED', 'PAUSED', 'REVOKED');

-- CreateEnum
CREATE TYPE "KBVideoApprovalRequestStatus" AS ENUM ('OPEN', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "KBVideoApprovalDecisionKind" AS ENUM ('APPROVE', 'REVOKE', 'ADMIN_APPROVE', 'ADMIN_REVOKE');

-- CreateEnum
CREATE TYPE "KBVideoApprovalRecipientOrigin" AS ENUM ('DIRECTORY', 'ADMIN_ADDED');

-- CreateTable
CREATE TABLE "KBVideoSource" (
    "id" UUID NOT NULL,
    "kbId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "externalRef" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "directoryUrl" TEXT NOT NULL,
    "kalturaCategoryId" TEXT NOT NULL,
    "categoryConfirmedAt" TIMESTAMP(3) NOT NULL,
    "categoryConfirmedById" UUID NOT NULL,
    "cutMode" "KBVideoCutMode" NOT NULL,
    "namePattern" TEXT,
    "captionLanguage" TEXT NOT NULL,
    "status" "KBVideoSourceStatus" NOT NULL DEFAULT 'DRAFT',
    "activeRequestId" UUID,
    "validUntil" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "lastSeenUpdatedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBVideoSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBVideoApprovalRequest" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "kalturaCategoryId" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "courseShortName" TEXT NOT NULL,
    "directoryCanonicalUrl" TEXT NOT NULL,
    "directorySnapshot" JSONB NOT NULL,
    "directorySnapshotSha256" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentTextSha256" TEXT NOT NULL,
    "status" "KBVideoApprovalRequestStatus" NOT NULL DEFAULT 'OPEN',
    "grantExpiresAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByRecipientId" UUID,
    "adminApprovedAt" TIMESTAMP(3),
    "adminApprovedById" UUID,
    "supersededAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBVideoApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBVideoApprovalRecipient" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roles" TEXT[],
    "origin" "KBVideoApprovalRecipientOrigin" NOT NULL DEFAULT 'DIRECTORY',
    "tokenSha256" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "firstOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBVideoApprovalRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBVideoApprovalDecision" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "recipientId" UUID,
    "kind" "KBVideoApprovalDecisionKind" NOT NULL,
    "userId" UUID NOT NULL,
    "userEmail" TEXT NOT NULL,
    "eduIdSubject" TEXT,
    "identityMatched" BOOLEAN NOT NULL,
    "consentVersion" TEXT,
    "consentTextSha256" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBVideoApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBVideoAuditEvent" (
    "seq" SERIAL NOT NULL,
    "sourceId" UUID,
    "requestId" UUID,
    "type" TEXT NOT NULL,
    "actorUserId" UUID,
    "actorEmail" TEXT,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBVideoAuditEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE UNIQUE INDEX "KBVideoSource_activeRequestId_key" ON "KBVideoSource"("activeRequestId");

-- CreateIndex
CREATE INDEX "KBVideoSource_kbId_idx" ON "KBVideoSource"("kbId");

-- CreateIndex
CREATE INDEX "KBVideoSource_status_idx" ON "KBVideoSource"("status");

-- CreateIndex
CREATE INDEX "KBVideoApprovalRequest_sourceId_status_idx" ON "KBVideoApprovalRequest"("sourceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KBVideoApprovalRecipient_tokenSha256_key" ON "KBVideoApprovalRecipient"("tokenSha256");

-- CreateIndex
CREATE INDEX "KBVideoApprovalRecipient_requestId_idx" ON "KBVideoApprovalRecipient"("requestId");

-- CreateIndex
CREATE INDEX "KBVideoApprovalDecision_requestId_idx" ON "KBVideoApprovalDecision"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "KBVideoAuditEvent_hash_key" ON "KBVideoAuditEvent"("hash");

-- CreateIndex
CREATE INDEX "KBVideoAuditEvent_sourceId_seq_idx" ON "KBVideoAuditEvent"("sourceId", "seq");

-- CreateIndex
CREATE INDEX "KBVideoAuditEvent_requestId_idx" ON "KBVideoAuditEvent"("requestId");

-- AddForeignKey
ALTER TABLE "KBVideoSource" ADD CONSTRAINT "KBVideoSource_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVideoApprovalRequest" ADD CONSTRAINT "KBVideoApprovalRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KBVideoSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVideoApprovalRecipient" ADD CONSTRAINT "KBVideoApprovalRecipient_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "KBVideoApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVideoApprovalDecision" ADD CONSTRAINT "KBVideoApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "KBVideoApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBVideoApprovalDecision" ADD CONSTRAINT "KBVideoApprovalDecision_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "KBVideoApprovalRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The audit log is append-only: the hash chain detects tampering, and this
-- trigger stops the application role from editing or deleting rows at all.
CREATE FUNCTION "kb_video_audit_event_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'KBVideoAuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "KBVideoAuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "KBVideoAuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "kb_video_audit_event_append_only"();
