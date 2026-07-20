const MANAGE_ORIGIN = 'https://manage.klicker.uzh.ch'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HMAC_PATTERN = /^[0-9a-f]{64}$/i
const ALLOWED_LOCALES = new Set(['de', 'en'])

export function isValidEvaluationUrl(value: string): boolean {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (
    url.origin !== MANAGE_ORIGIN ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return false
  }

  const segments = url.pathname.split('/')
  const routeSegments =
    segments.length === 5 && ALLOWED_LOCALES.has(segments[1] ?? '')
      ? segments.slice(2)
      : segments.length === 4
        ? segments.slice(1)
        : []

  if (routeSegments.length !== 3) {
    return false
  }

  const [activityType, activityId, page] = routeSegments
  if (
    (activityType !== 'quizzes' && activityType !== 'sessions') ||
    !activityId ||
    !UUID_PATTERN.test(activityId) ||
    page !== 'evaluation'
  ) {
    return false
  }

  const hmacValues = url.searchParams.getAll('hmac')
  return hmacValues.length === 1 && HMAC_PATTERN.test(hmacValues[0] ?? '')
}
