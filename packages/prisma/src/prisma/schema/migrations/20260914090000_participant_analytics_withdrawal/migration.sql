-- CreateTable
CREATE TABLE "ParticipantAnalyticsWithdrawal" (
    "participantId" UUID NOT NULL,
    "withdrawalRevision" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ParticipantAnalyticsWithdrawal_pkey" PRIMARY KEY ("participantId","withdrawalRevision")
);

-- CreateIndex
CREATE INDEX "ParticipantAnalyticsWithdrawal_completedAt_requestedAt_part_idx" ON "ParticipantAnalyticsWithdrawal"("completedAt", "requestedAt", "participantId");

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsWithdrawal" ADD CONSTRAINT "ParticipantAnalyticsWithdrawal_participantId_withdrawalRev_fkey" FOREIGN KEY ("participantId", "withdrawalRevision") REFERENCES "ParticipantDataUseEvent"("participantId", "revision") ON DELETE CASCADE ON UPDATE CASCADE;
