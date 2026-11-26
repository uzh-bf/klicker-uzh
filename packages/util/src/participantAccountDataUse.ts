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

/**
 * The notice of a deployment with learner memory. It describes the practice
 * results and the stored learning notes. Notes are used only for a yes
 * recorded under this version.
 */
export const TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION =
  '2026-11-26-results-notes'

/**
 * Notice versions under which a recorded yes lets the Tutor use the student's
 * course results. Every version covers them, so a student who agreed under an
 * earlier notice keeps what they agreed to when a later one widens the purpose.
 */
export const TUTOR_PERSONALIZATION_RESULTS_VERSIONS: readonly string[] = [
  TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
  TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
]

/**
 * The notice a deployment shows and records new answers under. The caller
 * says whether the deployment has learner memory, so this module stays free of
 * server-only code.
 */
export function currentTutorPersonalizationDisclosureVersion(
  learnerMemoryAvailable: boolean
): string {
  return learnerMemoryAvailable
    ? TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION
    : TUTOR_PERSONALIZATION_DISCLOSURE_VERSION
}

/** Whether a recorded choice lets the Tutor keep and use learning notes. */
export function coversLearnerMemory(choice: {
  tutorPersonalizationConsent: boolean | null
  tutorPersonalizationDisclosureVersion: string | null
}): boolean {
  return (
    choice.tutorPersonalizationConsent === true &&
    choice.tutorPersonalizationDisclosureVersion ===
      TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION
  )
}

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
