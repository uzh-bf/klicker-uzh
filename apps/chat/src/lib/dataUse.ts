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
