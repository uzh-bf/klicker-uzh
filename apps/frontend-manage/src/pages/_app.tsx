import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { init } from '@socialgouv/matomo-next'
import { Toaster } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { type Locale, NextIntlClientProvider } from 'next-intl'
import { useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { CourseDuplicationProvider } from '../components/courses/CourseDuplicationStatusProvider'
import '../globals.css'
import { useApollo } from '../lib/apollo'

dayjs.extend(utc)
dayjs.extend(timezone)

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
      <ApolloProvider client={apolloClient}>
        <NextIntlClientProvider
          timeZone="Europe/Zurich"
          messages={pageProps.messages}
          locale={validLocale}
          onError={onError}
          getMessageFallback={getMessageFallback}
        >
          <DndProvider backend={HTML5Backend}>
            <CourseDuplicationProvider>
              <Toaster closeButton position="top-right" />
              <Component {...pageProps} />
            </CourseDuplicationProvider>
          </DndProvider>
        </NextIntlClientProvider>
      </ApolloProvider>

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
