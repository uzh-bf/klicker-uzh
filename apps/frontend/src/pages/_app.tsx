import { ApolloProvider } from '@apollo/client'
import { init, push } from '@socialgouv/matomo-next'
import { ThemeProvider } from '@uzh-bf/design-system'
import App, { AppContext, NextWebVitalsMetric } from 'next/app'
import getConfig from 'next/config'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { StrictMode, useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { IntlProvider } from 'react-intl'
import { ToastProvider } from 'react-toast-notifications'

import AccountSummaryQuery from '../graphql/queries/AccountSummaryQuery.graphql'
import { useApollo } from '../lib/apollo'
import Chatwoot from '../lib/Chatwoot'
import GoogleAnalytics from '../lib/GoogleAnalytics'
import HappyKitAnalytics from '../lib/HappyKitAnalytics'
import { UserContext } from '../lib/userContext'
import { polyfill } from '../polyfills.mjs'

import 'fomantic-ui-css/semantic.min.css'
import '../globals.css'

const { publicRuntimeConfig } = getConfig()

if (publicRuntimeConfig.happyKitFlagEnvKey) {
  const { configure } = require('@happykit/flags/config')
  configure({ envKey: publicRuntimeConfig.happyKitFlagEnvKey })
}

const UNAUTHENTICATED_PAGES = [
  '/',
  '/login',
  '/404',
  '/entrypoint',
  '/user/login',
  '/user/activateAccount',
  '/user/deleteAccount',
  '/user/registration',
  '/user/requestPassword',
  '/user/resetPassword',
  '/join/[shortname]',
  '/qr/[shortname]',
  '/sessions/evaluation',
]

function Klicker({ Component, pageProps, locale, messages }) {
  const router = useRouter()

  const [user, setUser] = useState(null)

  const apolloClient = useApollo(pageProps)

  useEffect(() => {
    init({
      url: publicRuntimeConfig.matomoSiteUrl,
      siteId: publicRuntimeConfig.matomoSiteId,
    })
  }, [])

  useEffect(() => {
    const fetch = async () => {
      const result = await apolloClient.query({
        query: AccountSummaryQuery,
        networkPolicy: 'cache-first',
      })

      if (result?.data?.user?.id) {
        setUser(result.data.user)
      }
    }

    if (!UNAUTHENTICATED_PAGES.includes(router.pathname)) {
      fetch()
    }
  }, [apolloClient, router.pathname])

  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </Head>

      {publicRuntimeConfig.chatwootToken && <Chatwoot />}

      {publicRuntimeConfig.googleAnalyticsTrackingId && <GoogleAnalytics />}
      {publicRuntimeConfig.happyKitAnalyticsKey && <HappyKitAnalytics />}

      <ThemeProvider
        theme={{
          primaryBg: 'bg-uzh-blue-20',
          primaryBgHover: 'hover:bg-uzh-blue-20',
          primaryBorder: 'border-uzh-blue-40',
          primaryBorderHover: 'hover:border-uzh-blue-40',
          primaryText: 'text-uzh-blue-100',
          primaryTextHover: 'hover:text-uzh-blue-100',
          primaryFill: 'fill-uzh-blue-80',
          primaryFillHover: 'hover:fill-uzh-blue-100',
        }}
      >
        <DndProvider backend={HTML5Backend}>
          <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
            <ApolloProvider client={apolloClient}>
              <ToastProvider autoDismiss>
                <UserContext.Provider value={user}>
                  <StrictMode>
                    <Component {...pageProps} />
                  </StrictMode>
                </UserContext.Provider>
              </ToastProvider>
            </ApolloProvider>
          </IntlProvider>
        </DndProvider>
      </ThemeProvider>
    </>
  )
}

Klicker.getInitialProps = async (appContext: AppContext): Promise<any> => {
  const {
    ctx: { req },
  } = appContext

  const requestedLocales: string | string[] =
    // use the locale as returned in SSR
    (req as any)?.locale ||
    // use the locale as stored in the window when switching pages on the client
    (typeof window !== 'undefined' && (window as any).LOCALE) ||
    // use the language of the browser as a sane default
    (typeof navigator !== 'undefined' && navigator.languages) ||
    // IE11
    (typeof navigator !== 'undefined' && (navigator as any).userLanguage) ||
    'en'

  const [supportedLocale, messagePromise] = getMessages(requestedLocales)

  const [, messages, appProps] = await Promise.all([
    polyfill(supportedLocale),
    messagePromise,
    App.getInitialProps(appContext),
  ])

  return {
    ...(appProps as any),
    locale: supportedLocale,
    messages: messages.default,
  }
}

/**
 * Get the messages and also do locale negotiation. A multi-lingual user
 * can specify locale prefs like ['ja', 'en-GB', 'en'] which is interpreted as
 * Japanese, then British English, then English
 * @param locales list of requested locales
 * @returns {[string, Promise]} A tuple containing the negotiated locale
 * and the promise of fetching the translated messages
 */
function getMessages(locales: string | string[] = ['en']) {
  if (!Array.isArray(locales)) {
    // eslint-disable-next-line no-param-reassign
    locales = [locales]
  }
  let langBundle
  let locale
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < locales.length && !locale; i++) {
    locale = locales[i]
    switch (locale) {
      case 'de':
        langBundle = import('../../compiled-lang/de.json')
        break
      default:
        break
      // Add more languages
    }
  }
  if (!langBundle) {
    return ['en', import('../../compiled-lang/en.json')]
  }
  return [locale, langBundle]
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
  push([
    'trackEvent',
    'Web Vitals',
    Router.pathname,
    metric.name,
    Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
  ])
}

export default Klicker
