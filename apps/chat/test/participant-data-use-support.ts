import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'

/**
 * A participant that has recorded both purposes with the current disclosure.
 *
 * Synthetic identities in chat tests have to satisfy the account-completion
 * gate, because an incomplete account is denied every attributed route and
 * every attributed chatbot render.
 */
export const acknowledgedParticipantDataUse = {
  dataUseAcknowledgedAt: new Date('2026-09-08T00:00:00.000Z'),
  dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  researchConsent: false,
  researchConsentChoiceAt: new Date('2026-09-08T00:00:00.000Z'),
  researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  learningAnalyticsConsent: false,
  learningAnalyticsChoiceAt: new Date('2026-09-08T00:00:00.000Z'),
  learningAnalyticsDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  dataUseRevision: 1,
}
