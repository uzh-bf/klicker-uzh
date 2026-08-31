-- CreateIndex
-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE UNIQUE INDEX CONCURRENTLY "Participation_id_participantId_key" ON "public"."Participation"("id", "participantId");
