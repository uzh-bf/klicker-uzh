import type { ParticipantAccountDataUseFields } from '@klicker-uzh/graphql/dist/participant-data-use'
import {
  coversLearnerMemory,
  isParticipantDataUseComplete,
  TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
} from '@klicker-uzh/util/participant-account-data-use'

/**
 * Client-safe contract for the participant data-use state. The loader lives in
 * the server-only guard module; components only need the shape and the shared
 * error code.
 */
export const PARTICIPANT_DATA_USE_COMPLETION_REQUIRED =
  'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'

export interface ChatDataUseState {
  complete: boolean
  dataUseRevision: number
  researchConsent: boolean
  researchChoiceRecorded: boolean
  learningAnalyticsConsent: boolean
  learningAnalyticsChoiceRecorded: boolean
  tutorPersonalizationConsent: boolean | null
  /** The personalization notice this deployment shows; answers carry it. */
  tutorPersonalizationCurrentVersion: string
  /** Whether that notice also covers learning notes. */
  tutorPersonalizationNotesOffered: boolean
  /** Whether the recorded yes covers learning notes. */
  tutorPersonalizationNotesAgreed: boolean
}
/**
 * Project the committed decisions without a second database read. The server
 * passes the notice version it currently shows, which depends on whether the
 * deployment has learner memory.
 */
export function toChatDataUseState(
  participant: Omit<
    ParticipantAccountDataUseFields,
    'id' | 'learnerMemoryEpoch'
  >,
  tutorPersonalizationCurrentVersion: string
): ChatDataUseState {
  return {
    complete: isParticipantDataUseComplete(participant),
    dataUseRevision: participant.dataUseRevision,
    researchConsent: participant.researchConsent,
    researchChoiceRecorded: participant.researchConsentChoiceAt !== null,
    learningAnalyticsConsent: participant.learningAnalyticsConsent,
    learningAnalyticsChoiceRecorded:
      participant.learningAnalyticsChoiceAt !== null,
    tutorPersonalizationConsent: participant.tutorPersonalizationConsent,
    tutorPersonalizationCurrentVersion,
    tutorPersonalizationNotesOffered:
      tutorPersonalizationCurrentVersion ===
      TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
    tutorPersonalizationNotesAgreed: coversLearnerMemory(participant),
  }
}
