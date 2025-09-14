-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "public"."Course" ALTER COLUMN "pinCode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ParticipantInvitation" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "courseId" UUID NOT NULL,
    "participantId" UUID,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ParticipantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantInvitation_email_idx" ON "public"."ParticipantInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantInvitation_email_courseId_key" ON "public"."ParticipantInvitation"("email", "courseId");

-- AddForeignKey
ALTER TABLE "public"."ParticipantInvitation" ADD CONSTRAINT "ParticipantInvitation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParticipantInvitation" ADD CONSTRAINT "ParticipantInvitation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
