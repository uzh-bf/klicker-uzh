import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { useApollo } from '@lib/apollo'
import { init, push } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  type AbstractIntlMessages,
  type Locale,
  NextIntlClientProvider,
} from 'next-intl'
import { useEffect, useState } from 'react'

import 'katex/dist/katex.min.css'
import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

type AppLocale = (typeof routing.locales)[number]

// last complete message bundle per locale (browser only); a page whose props
// arrive without messages reuses it instead of rendering raw message keys
const messageCache: Partial<Record<AppLocale, AbstractIntlMessages>> = {}

function useAppMessages(
  locale: AppLocale,
  pageMessages: AbstractIntlMessages | undefined
) {
  // effects run only in the browser, so the server never fills the cache
  useEffect(() => {
    if (pageMessages) messageCache[locale] = pageMessages
  }, [locale, pageMessages])

  const [loaded, setLoaded] = useState<{
    locale: AppLocale
    messages: AbstractIntlMessages
  } | null>(null)

  const messages =
    pageMessages ??
    messageCache[locale] ??
    (loaded?.locale === locale ? loaded.messages : undefined)

  // nothing to reuse (e.g. the first page lacked messages): load the bundle
  useEffect(() => {
    if (messages) return
    let cancelled = false
    import(`@klicker-uzh/i18n/messages/${locale}`)
      .then((module) => {
        if (cancelled) return
        messageCache[locale] = module.default
        setLoaded({ locale, messages: module.default })
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [locale, messages])

  return messages
}

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()

  const apolloClient = useApollo(pageProps)

  useEffect(() => {
    if (MATOMO_URL && MATOMO_SITE_ID) {
      init({
        url: MATOMO_URL,
        siteId: MATOMO_SITE_ID,
        // track the path only: the initial page view would otherwise report
        // the full URL, including login tokens passed as query parameters
        onInitialization: () =>
          push(['setCustomUrl', window.location.pathname]),
      })
    }
  }, [])

  // ensure locale is one of the supported locales
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as AppLocale)
    : routing.defaultLocale

  const messages = useAppMessages(validLocale, pageProps.messages)

  return (
    <div
      id="__app"
      className={`flex h-full min-h-full flex-col bg-white ${sourceSansPro.variable} font-sans`}
    >
      <Head>
        {/* viewport-fit=cover exposes env(safe-area-inset-*) so redesigned
            headers can clear the iPhone status bar in the native app */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <NextIntlClientProvider
        timeZone="Europe/Zurich"
        messages={messages}
        locale={validLocale}
        getMessageFallback={getMessageFallback}
        onError={onError}
      >
        <ApolloProvider client={apolloClient}>
          <Toaster closeButton position="top-right" />
          <Component {...pageProps} />
        </ApolloProvider>
      </NextIntlClientProvider>
      <style>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }
      `}</style>
    </div>
  )
}

export default App
