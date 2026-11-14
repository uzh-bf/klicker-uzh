import type { ParticipantAccountDataUseFields } from '@klicker-uzh/graphql/dist/participant-data-use'
import { isParticipantDataUseComplete } from '@klicker-uzh/util/participant-account-data-use'

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
}
/** Project the committed decisions without a second database read. */
export function toChatDataUseState(
  participant: Omit<ParticipantAccountDataUseFields, 'id'>
): ChatDataUseState {
  return {
    complete: isParticipantDataUseComplete(participant),
    dataUseRevision: participant.dataUseRevision,
    researchConsent: participant.researchConsent,
    researchChoiceRecorded: participant.researchConsentChoiceAt !== null,
    learningAnalyticsConsent: participant.learningAnalyticsConsent,
    learningAnalyticsChoiceRecorded:
      participant.learningAnalyticsChoiceAt !== null,
  }
}
