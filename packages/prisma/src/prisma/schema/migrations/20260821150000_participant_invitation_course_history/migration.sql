-- CreateIndex
-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ParticipantInvitation_courseId_invitedAt_id_idx" ON "public"."ParticipantInvitation"("courseId", "invitedAt", "id");
