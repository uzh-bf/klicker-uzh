import type * as DB from '@klicker-uzh/prisma/client'
/** The server-owned disclosure version submitted with participant choices. */
export const PARTICIPANT_DATA_USE_DISCLOSURE_VERSION = '2026-09-08'

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
    state.researchConsentDisclosureVersion !== null &&
    state.learningAnalyticsChoiceAt !== null &&
    state.learningAnalyticsDisclosureVersion !== null
  )
}

export const participantDataUseSelect = {
  researchConsent: true,
  researchConsentChoiceAt: true,
  researchConsentDisclosureVersion: true,
  learningAnalyticsConsent: true,
  learningAnalyticsChoiceAt: true,
  learningAnalyticsDisclosureVersion: true,
} satisfies DB.Prisma.ParticipantSelect

export type ParticipantDataUseFields = DB.Prisma.ParticipantGetPayload<{
  select: typeof participantDataUseSelect
}>
