import type { NextRouter } from 'next/router'

export function isSuccessfulParticipantSessionResult(result: {
  data?: Record<string, unknown> | null
  errors?: readonly unknown[]
}) {
  if (result.errors?.length || !result.data) return false
  const data = result.data
  return (
    !!(
      data.createParticipantAccount &&
      typeof data.createParticipantAccount === 'object' &&
      'participantToken' in data.createParticipantAccount &&
      data.createParticipantAccount.participantToken
    ) ||
    data.deleteParticipantAccount === true ||
    data.logoutTemporaryParticipant === true ||
    [
      'logoutParticipant',
      'loginParticipant',
      'loginTemporaryParticipant',
      'loginParticipantMagicLink',
      'activateParticipantAccount',
    ].some((field) => typeof data[field] === 'string' && !!data[field])
  )
}

// Full navigation discards page state and SSR props after a cookie change.
// Preserve Next's locale prefix and the caller's push/replace semantics.
export function navigateParticipantSession(
  router: NextRouter,
  destination: string,
  replace = false
) {
  if (
    process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true' &&
    destination.startsWith('/')
  ) {
    return replace ? router.replace(destination) : router.push(destination)
  }
  const hasLocale = router.locales?.some(
    (locale) =>
      destination === `/${locale}` || destination.startsWith(`/${locale}/`)
  )
  const prefix =
    !hasLocale && router.locale && router.locale !== router.defaultLocale
      ? `/${router.locale}`
      : ''
  const href = destination.startsWith('/')
    ? `${router.basePath}${prefix}${destination}`
    : destination
  if (replace) window.location.replace(href)
  else window.location.assign(href)
}
