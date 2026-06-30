import type { Locale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { getMessageFallback, onError } from './index'
import { routing } from './routing'

async function loadMessages(locale: Locale) {
  switch (locale) {
    case 'de':
      return (await import('./messages/de')).default
    default:
      return (await import('./messages/en')).default
  }
}

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
    messages: await loadMessages(locale),
    onError,
    getMessageFallback,
  }
})
