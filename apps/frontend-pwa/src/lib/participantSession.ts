import type { NextRouter } from 'next/router'

export function getSafeRedirectPath(
  value: string | string[] | undefined,
  pwaUrl: string,
  chatUrl: string | undefined
) {
  const redirectTo = Array.isArray(value) ? value[0] : value
  if (!redirectTo) return '/'

  try {
    const pwaOrigin = new URL(pwaUrl)
    const target = new URL(redirectTo, pwaOrigin)
    if (target.origin === pwaOrigin.origin) {
      return `${target.pathname}${target.search}${target.hash}`
    }

    if (chatUrl && target.origin === new URL(chatUrl).origin) {
      return target.toString()
    }

    return '/'
  } catch {
    return '/'
  }
}

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
// Preserve the local origin, Next's locale prefix and push/replace semantics.
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
  const pathname = destination.split(/[?#]/, 1)[0]
  const hasLocale = router.locales?.some(
    (locale) => pathname === `/${locale}` || pathname?.startsWith(`/${locale}/`)
  )
  const prefix =
    !hasLocale && router.locale && router.locale !== router.defaultLocale
      ? `/${router.locale}`
      : ''
  const href = destination.startsWith('/')
    ? `${window.location.origin}${router.basePath}${prefix}${destination}`
    : destination
  if (replace) window.location.replace(href)
  else window.location.assign(href)
}
