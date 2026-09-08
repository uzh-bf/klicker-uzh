import type * as DB from '@klicker-uzh/prisma/client'
/** The server-owned disclosure version submitted with participant choices. */
export const PARTICIPANT_DATA_USE_DISCLOSURE_VERSION = 'v1'

export const participantAccountDataUseSelect = {
  dataUseAcknowledgedAt: true,
  dataUseAcknowledgedVersion: true,
  researchConsentChoiceAt: true,
  researchConsentDisclosureVersion: true,
  learningAnalyticsChoiceAt: true,
  learningAnalyticsDisclosureVersion: true,
} satisfies DB.Prisma.ParticipantSelect

type CompletionState = DB.Prisma.ParticipantGetPayload<{
  select: typeof participantAccountDataUseSelect
}>

export function isParticipantDataUseComplete(state: CompletionState | null) {
  return (
    state !== null &&
    state.dataUseAcknowledgedAt !== null &&
    state.dataUseAcknowledgedVersion ===
      PARTICIPANT_DATA_USE_DISCLOSURE_VERSION &&
    state.researchConsentChoiceAt !== null &&
    state.researchConsentDisclosureVersion ===
      PARTICIPANT_DATA_USE_DISCLOSURE_VERSION &&
    state.learningAnalyticsChoiceAt !== null &&
    state.learningAnalyticsDisclosureVersion ===
      PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
  )
}
