const MANAGE_ORIGIN = 'https://manage.klicker.uzh.ch'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HMAC_PATTERN = /^[0-9a-f]{64}$/i
const ALLOWED_LOCALES = new Set(['de', 'en'])

export function getSafeEvaluationUrl(value: string): string | undefined {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return undefined
  }

  if (
    url.origin !== MANAGE_ORIGIN ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return undefined
  }

  const segments = url.pathname.split('/')
  const locale =
    segments.length === 5 && ALLOWED_LOCALES.has(segments[1] ?? '')
      ? segments[1]
      : undefined
  const routeSegments = locale
    ? segments.slice(2)
    : segments.length === 4
      ? segments.slice(1)
      : []

  if (routeSegments.length !== 3) {
    return undefined
  }

  const [activityType, activityId, page] = routeSegments
  const safeActivityType =
    activityType === 'quizzes'
      ? 'quizzes'
      : activityType === 'sessions'
        ? 'sessions'
        : undefined
  if (
    !safeActivityType ||
    !activityId ||
    !UUID_PATTERN.test(activityId) ||
    page !== 'evaluation'
  ) {
    return undefined
  }

  const hmacValues = url.searchParams.getAll('hmac')
  if (hmacValues.length !== 1 || !HMAC_PATTERN.test(hmacValues[0] ?? '')) {
    return undefined
  }

  const safeLocale = locale === 'de' ? '/de' : locale === 'en' ? '/en' : ''
  const safeSearch = Array.from(
    url.searchParams.entries(),
    ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  ).join('&')

  return `${MANAGE_ORIGIN}${safeLocale}/${safeActivityType}/${encodeURIComponent(activityId)}/evaluation?${safeSearch}`
}

export function isValidEvaluationUrl(value: string): boolean {
  return getSafeEvaluationUrl(value) !== undefined
}
