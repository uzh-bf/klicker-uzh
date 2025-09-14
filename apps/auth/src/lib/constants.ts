export const MANAGER_COOKIE_NAME = 'next-auth.session-token'
export const PARTICIPANT_COOKIE_NAME = 'next-auth.participant-session-token'

export const STUDENT_REDIRECT_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-klicker_student_redirect_to'
    : 'klicker_student_redirect_to'
export const LECTURER_REDIRECT_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-klicker_lecturer_redirect_to'
    : 'klicker_lecturer_redirect_to'

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
