// Server-only runtime switch for the dedicated exam deployment of the chat.
// It is read from a plain environment variable on purpose: a NEXT_PUBLIC_ name
// would be baked into the shared image, and the same image serves both modes.
export function isAssessmentMode(): boolean {
  return process.env.CHAT_ASSESSMENT_MODE === 'true'
}

export const REGULAR_ACCOUNT_COOKIE = 'participant_token'
// Session cookie written by the auth app for Edu-ID participants.
export const ASSESSMENT_ACCOUNT_COOKIE = 'next-auth.participant-session-token'

export interface AccountSessionConfig {
  cookieName: string
  /** Expected `iss` claim; undefined when the deployment does not configure it. */
  issuer: string | undefined
}

/**
 * Cookie name and issuer of the participant account session this deployment
 * accepts. The regular chat reads the backend-issued session; the assessment
 * chat reads the auth-app session instead. API guards, the chatbot layout and
 * the proxy all resolve it here so they reach the same decision.
 */
export function getAccountSessionConfig(): AccountSessionConfig {
  return isAssessmentMode()
    ? {
        cookieName: ASSESSMENT_ACCOUNT_COOKIE,
        issuer: process.env.APP_ORIGIN_AUTH,
      }
    : {
        cookieName: REGULAR_ACCOUNT_COOKIE,
        issuer: process.env.APP_ORIGIN_API,
      }
}

// Entry points that exist for other audiences (LMS launches, embedded PWA
// chat, lecturer tools). The assessment chat serves none of them.
const ASSESSMENT_BLOCKED_PREFIXES = [
  '/auth/lti',
  '/auth/elearning',
  '/auth/pwa-embed',
]
const ASSESSMENT_BLOCKED_TREES = ['/manage', '/preview', '/api/manage']

export function isAssessmentBlockedPath(pathname: string): boolean {
  return (
    ASSESSMENT_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    ASSESSMENT_BLOCKED_TREES.some(
      (tree) => pathname === tree || pathname.startsWith(`${tree}/`)
    )
  )
}
