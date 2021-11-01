import React, { StrictMode } from 'react'
import App, { AppContext } from 'next/app'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DndProvider } from 'react-dnd'
import { ToastProvider } from 'react-toast-notifications'
import { IntlProvider } from 'react-intl'
import Head from 'next/head'
import { configure } from '@happykit/flags/config'

import { polyfill } from '../polyfills'
import HappyKitAnalytics from '../lib/HappyKitAnalytics'
import GoogleAnalytics from '../lib/GoogleAnalytics'

import '../lib/semantic/dist/semantic.css'
import '../globals.css'

configure({ envKey: process.env.NEXT_PUBLIC_HAPPYKIT_FLAGS_ENV_KEY })

function Klicker(props) {
  const { Component, pageProps, locale, messages } = props

  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </Head>

      {process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_TRACKING_ID && <GoogleAnalytics />}
      {process.env.NEXT_PUBLIC_HAPPYKIT_ANALYTICS_KEY && <HappyKitAnalytics />}

      <DndProvider backend={HTML5Backend}>
        <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
          <ToastProvider autoDismiss>
            <StrictMode>
              <Component {...pageProps} />
            </StrictMode>
          </ToastProvider>
        </IntlProvider>
      </DndProvider>
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

export default Klicker
