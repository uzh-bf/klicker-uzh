-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "dataUseAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "dataUseAcknowledgedVersion" TEXT,
ADD COLUMN     "dataUseRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "learningAnalyticsChoiceAt" TIMESTAMP(3),
ADD COLUMN     "learningAnalyticsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "learningAnalyticsDisclosureVersion" TEXT,
ADD COLUMN     "researchConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "researchConsentChoiceAt" TIMESTAMP(3),
ADD COLUMN     "researchConsentDisclosureVersion" TEXT;

-- CreateTable
CREATE TABLE "ParticipantDataUseEvent" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "researchConsent" BOOLEAN NOT NULL,
    "learningAnalyticsConsent" BOOLEAN NOT NULL,
    "acknowledged" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantDataUseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantDataUseEvent_participantId_revision_key" ON "ParticipantDataUseEvent"("participantId", "revision");

-- AddForeignKey
ALTER TABLE "ParticipantDataUseEvent" ADD CONSTRAINT "ParticipantDataUseEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot express immutable audit triggers. Keep account deletion's
-- foreign-key cascade while preventing independent history changes.
CREATE FUNCTION protect_participant_data_use_event() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM "Participant" WHERE "id" = OLD."participantId"
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Participant data-use history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER participant_data_use_event_immutable
BEFORE UPDATE OR DELETE ON "ParticipantDataUseEvent"
FOR EACH ROW EXECUTE FUNCTION protect_participant_data_use_event();

CREATE TRIGGER participant_data_use_event_no_truncate
BEFORE TRUNCATE ON "ParticipantDataUseEvent"
FOR EACH STATEMENT EXECUTE FUNCTION protect_participant_data_use_event();
