-- CreateEnum
CREATE TYPE "public"."CredentialType" AS ENUM ('COURSE_ASSESSMENT_INSIGHTS', 'COURSE_COMPLETION_CERTIFICATE');

-- CreateTable
CREATE TABLE "public"."VerifiableCredential" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "type" "public"."CredentialType" NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "metadata" JSONB NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "VerifiableCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiableCredential_token_key" ON "public"."VerifiableCredential"("token");

-- CreateIndex
CREATE INDEX "VerifiableCredential_token_idx" ON "public"."VerifiableCredential"("token");

-- AddForeignKey
ALTER TABLE "public"."VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
