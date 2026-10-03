import type * as DB from '@klicker-uzh/prisma/client'
/**
 * The server-owned disclosure version submitted with participant choices.
 *
 * The identifier names the disclosure text revision the participant
 * acknowledged, not the date the privacy policy was published. It covers the
 * normal account-creation and assessment-entry disclosure sections, including
 * their research and Learning Analytics wording. Publishing any change that
 * alters what a participant agrees to, or how a recorded choice is
 * interpreted, requires a new identifier so previously acknowledged accounts
 * must acknowledge again; timestamp-only edits that change no meaning do not.
 */
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
