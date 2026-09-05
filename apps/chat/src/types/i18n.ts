import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import de from '@klicker-uzh/i18n/messages/de'
import en from '@klicker-uzh/i18n/messages/en'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// Statically import both catalogs and select by locale instead of re-exporting
// the shared `@klicker-uzh/i18n/request`. That shared config resolves messages
// via a dynamic `import('@klicker-uzh/i18n/messages/' + locale)`, but Turbopack
// (this App Router app) cannot build a dynamic-import context for a bare
// package-subpath specifier, so the dynamic form fails to resolve here. With
// only two locales a static map is cheap and robust. Exported so the root
// layout resolves its messages from the same map instead of re-introducing
// the dynamic-import pattern this file exists to avoid.
export const messagesByLocale = { en, de }

export default getRequestConfig(async () => {
  // Chat has no `[locale]` route segment, so `requestLocale` is not populated
  // by routing. The active locale lives in the `NEXT_LOCALE` cookie (the same
  // cookie the root layout reads for `<html lang>` and the client provider).
  // Read it directly here so server-side `getTranslations`/`getMessages` agree
  // with the layout instead of relying on a `setRequestLocale` back-fill, which
  // does not propagate to this config in a cookie-based (non-segment) setup.
  const requested = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    messages: messagesByLocale[locale],
    onError,
    getMessageFallback,
  }
})
