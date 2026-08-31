-- AlterTable
ALTER TABLE "FreeTextAttempt"
ADD COLUMN "evaluationAuthorizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ParticipantSemanticEvaluationConsent" (
    "id" SERIAL NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "decision" "SemanticEvaluationConsentDecision" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantId" UUID NOT NULL,

    CONSTRAINT "ParticipantSemanticEvaluationConsent_pkey" PRIMARY KEY ("id")
);

-- Preserve the latest decision from the contract-layer consent ledger for
-- participants that still exist. The old ledger remains available while the
-- previous application version can still be serving during deployment.
INSERT INTO "ParticipantSemanticEvaluationConsent" (
    "disclosureVersion",
    "decision",
    "decidedAt",
    "participantId"
)
SELECT DISTINCT ON (event."participantId", event."disclosureVersion")
    event."disclosureVersion",
    event."decision",
    event."decidedAt",
    event."participantId"
FROM "FreeTextConsentEvent" AS event
INNER JOIN "Participant" AS participant
    ON participant."id" = event."participantId"
ORDER BY
    event."participantId",
    event."disclosureVersion",
    event."decidedAt" DESC,
    event."id" DESC;

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantSemanticConsent_participant_version_key"
ON "ParticipantSemanticEvaluationConsent"("participantId", "disclosureVersion");

-- AddForeignKey
ALTER TABLE "ParticipantSemanticEvaluationConsent"
ADD CONSTRAINT "ParticipantSemanticEvaluationConsent_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
