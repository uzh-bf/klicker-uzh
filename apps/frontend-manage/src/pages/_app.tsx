import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { init } from '@socialgouv/matomo-next'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
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

  return (
    <div id="__app" className={`${sourceSansPro.variable} font-sans`}>
      <ApolloProvider client={apolloClient}>
        <NextIntlClientProvider
          timeZone="Europe/Zurich"
          messages={pageProps.messages}
          locale={locale}
          onError={onError}
          getMessageFallback={getMessageFallback}
        >
          <DndProvider backend={HTML5Backend}>
            <Component {...pageProps} />
          </DndProvider>
        </NextIntlClientProvider>
      </ApolloProvider>

      <style jsx global>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }

        #__app {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background-color: white;
        }
      `}</style>
    </div>
  )
}

export default App
