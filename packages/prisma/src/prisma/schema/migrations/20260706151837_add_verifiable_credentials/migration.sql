-- CreateEnum
CREATE TYPE "public"."CredentialType" AS ENUM ('COURSE_ASSESSMENT_INSIGHTS');

-- CreateEnum
CREATE TYPE "public"."CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "public"."VerifiableCredential" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "type" "public"."CredentialType" NOT NULL,
    "subjectEmail" TEXT NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshotHash" TEXT NOT NULL,
    "status" "public"."CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "supersededAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiableCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VerifiableCredential_lifecycle_check" CHECK (
        ("status" = 'ACTIVE' AND "revokedAt" IS NULL AND "revokedById" IS NULL AND "supersededAt" IS NULL) OR
        ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "supersededAt" IS NULL) OR
        ("status" = 'SUPERSEDED' AND "revokedAt" IS NULL AND "revokedById" IS NULL AND "supersededAt" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiableCredential_token_key" ON "public"."VerifiableCredential"("token");

-- CreateIndex
CREATE INDEX "VerifiableCredential_courseId_status_issuedAt_idx" ON "public"."VerifiableCredential"("courseId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "VerifiableCredential_snapshot_lookup_idx" ON "public"."VerifiableCredential"("participantId", "courseId", "type", "snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiableCredential_active_tuple_key" ON "public"."VerifiableCredential"("participantId", "courseId", "type") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "public"."VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
