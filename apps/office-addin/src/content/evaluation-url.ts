const MANAGE_ORIGIN = 'https://manage.klicker.uzh.ch'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HMAC_PATTERN = /^[0-9a-f]{64}$/i
const LOCALE_PATTERN = /^[a-z]{2}$/

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

  const segments = url.pathname.split('/').filter(Boolean)
  const hasLocale =
    segments.length === 4 && LOCALE_PATTERN.test(segments[0] ?? '')
  const routeSegments = hasLocale ? segments.slice(1) : segments

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
