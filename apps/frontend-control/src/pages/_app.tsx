import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import { Locale, NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

import '../globals.css'

config.autoAddCss = false

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()

  const apolloClient = useApollo(pageProps)

  useEffect(() => {
    if (MATOMO_URL && MATOMO_SITE_ID) {
      init({ url: MATOMO_URL, siteId: MATOMO_SITE_ID })
    }
  }, [])

  // ensure locale is one of the supported locales
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale

  return (
    <div
      id="__app"
      className={`flex h-full min-h-full flex-col bg-white ${sourceSansPro.variable} font-sans`}
    >
      <NextIntlClientProvider
        timeZone="Europe/Zurich"
        messages={pageProps.messages}
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
