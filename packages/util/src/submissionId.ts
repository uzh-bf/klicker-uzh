/**
 * Bounded, opaque client submission identifiers. The student PWA generates
 * one per browser, quiz execution, and question instance
 * (`<clientId>:lq-<quizId>-ex-<execution>-i-<instanceId>`); the response API
 * and the response processor use this validator to reject malformed or
 * oversized identifiers instead of silently treating them as absent.
 */
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9:_-]{1,256}$/

export function isValidSubmissionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    SUBMISSION_ID_PATTERN.test(value)
  )
}
