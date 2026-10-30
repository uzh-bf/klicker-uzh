// Persistent session cookie names. These are backend delivery contracts:
// apps/backend-docker selects and verifies them per request origin (see
// docs/auth-model.md). Do not rename without a coordinated backend release.
import { COOKIE_NAMES, cookieName } from '@klicker-uzh/util/auth'

export function managerCookieName(): string {
  return cookieName(COOKIE_NAMES.NEXT_AUTH_MANAGER_SESSION)
}

export function participantCookieName(): string {
  return cookieName(COOKIE_NAMES.NEXT_AUTH_PARTICIPANT_SESSION)
}

// Temporary OAuth cookies (state, PKCE verifier, nonce, callback URL) are
// namespaced per audience by lib/authCookies.ts.

export const DEFAULT_STUDENT_HOSTS = [
  'assessment.klicker.uzh.ch',
  'assessment.klicker-qa.bf-app.ch',
  'assessment.klicker.com',
  'localhost:3001',
  '127.0.0.1:3001',
]
export const DEFAULT_LECTURER_HOSTS = [
  'manage.klicker.uzh.ch',
  'manage.klicker-qa.bf-app.ch',
  'manage.klicker.com',
  'localhost:3002',
  '127.0.0.1:3002',
]
export const DEFAULT_PWA_HOSTS = [
  'pwa.klicker.uzh.ch',
  'pwa.klicker-qa.bf-app.ch',
  'pwa.klicker.com',
  'localhost:3000',
  '127.0.0.1:3000',
  'localhost',
]
