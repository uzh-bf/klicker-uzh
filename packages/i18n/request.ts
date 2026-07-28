import type { Locale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { getMessageFallback, onError } from './index'
import { routing } from './routing'

type SupportedLocale = (typeof routing.locales)[number]

const messageLoaders: Record<
  SupportedLocale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  de: () => import('./messages/de'),
  en: () => import('./messages/en'),
}

function isSupportedLocale(locale: Locale): locale is SupportedLocale {
  return routing.locales.some((supportedLocale) => supportedLocale === locale)
}

export default getRequestConfig(async ({ requestLocale }) => {
  // this typically corresponds to the `[locale]` segment
  const requested = (await requestLocale) as Locale

  // ensure that the incoming locale is valid
  let locale: SupportedLocale
  if (!requested || !isSupportedLocale(requested)) {
    locale = routing.defaultLocale
  } else {
    locale = requested
  }

  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
    onError,
    getMessageFallback,
  }
})
