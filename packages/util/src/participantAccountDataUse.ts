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

/**
 * The notice revision a participant answers when choosing Tutor
 * personalization. It is separate from the account disclosure version: the
 * choice is optional, is offered inside a chatbot, and never blocks account or
 * chat use. A text change that alters what the participant agrees to requires
 * a new identifier, and a recorded yes then counts only for the version it was
 * given under.
 */
export const TUTOR_PERSONALIZATION_DISCLOSURE_VERSION = '2026-11-26-results'

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
