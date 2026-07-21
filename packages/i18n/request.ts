import type { Locale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { getMessageFallback, onError } from './index'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // this typically corresponds to the `[locale]` segment
  const requested = (await requestLocale) as Locale

  // ensure that the incoming locale is valid
  let locale: Locale
  if (!requested || !routing.locales.includes(requested as any)) {
    locale = routing.defaultLocale
  } else {
    locale = requested
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}`)).default,
    onError,
    getMessageFallback,
  }
})
