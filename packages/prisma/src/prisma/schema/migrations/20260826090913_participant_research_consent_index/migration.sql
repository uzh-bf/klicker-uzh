-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "Participant_researchConsent_id_idx" ON "public"."Participant"("researchConsent", "id");
