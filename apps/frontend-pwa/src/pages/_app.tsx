import { ApolloProvider } from '@apollo/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { useApollo } from '@lib/apollo'
import { init } from '@socialgouv/matomo-next'
import { ThemeProvider } from '@uzh-bf/design-system'
import { NextIntlProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { sourceSansPro } from 'shared-components/src/font'
import ErrorBoundary from '../components/ErrorBoundary'

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

  return (
    <div id="__app" className={`${sourceSansPro.variable} font-sans`}>
      <NextIntlProvider messages={pageProps.messages} locale={locale}>
        <ErrorBoundary>
          <ApolloProvider client={apolloClient}>
            <ThemeProvider
              theme={{
                primaryBg: 'bg-uzh-blue-20',
                primaryBgMedium: 'bg-uzh-blue-60',
                primaryBgDark: 'bg-uzh-blue-80',
                primaryBgHover: 'sm:hover:bg-uzh-blue-20',
                primaryBgMediumHover: 'sm:hover:bg-uzh-blue-60',
                primaryBgDarkHover: 'sm:hover:bg-uzh-blue-80',
                primaryBorder: 'border-uzh-blue-40',
                primaryBorderDark: 'border-uzh-blue-80',
                primaryBorderHover: 'sm:hover:border-uzh-blue-40',
                primaryBorderDarkHover: 'sm:hover:border-uzh-blue-80',
                primaryBorderFocus: 'focus:border-uzh-blue-40',
                primaryBorderDarkFocus: 'focus:border-uzh-blue-80',
                primaryText: 'text-uzh-blue-100',
                primaryTextHover: 'sm:hover:text-uzh-blue-100',
                primaryFill: 'fill-uzh-blue-80',
                primaryFillHover: 'sm:hover:fill-uzh-blue-100',
                primaryProseHover: 'sm:hover:text-uzh-blue-100',
              }}
            >
              <Component {...pageProps} />
            </ThemeProvider>
          </ApolloProvider>
        </ErrorBoundary>
      </NextIntlProvider>
      <style jsx global>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
        }

        #__app {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  )
}

export default App
