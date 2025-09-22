-- Enforce that a ParticipantInvitation must be linked to a participantId if the status is ACCEPTED
ALTER TABLE "ParticipantInvitation"
ADD CONSTRAINT "ParticipantInvitation_participantId_not_null_if_accepted"
CHECK (("status" = 'ACCEPTED' AND "participantId" IS NOT NULL) OR ("status" <> 'ACCEPTED'));

-- Enforce that a ParticipantInvitation must not be linked to a participantId if the status is PENDING
ALTER TABLE "ParticipantInvitation"
ADD CONSTRAINT "ParticipantInvitation_participantId_null_if_pending"
CHECK (("status" = 'PENDING' AND "participantId" IS NULL) OR ("status" <> 'PENDING'));
