/* eslint-disable no-underscore-dangle */
import React, { StrictMode } from 'react'
import Router from 'next/router'
import getConfig from 'next/config'
import App, { AppContext } from 'next/app'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DndProvider } from 'react-dnd'
import { ToastProvider } from 'react-toast-notifications'
import { IntlProvider } from 'react-intl'
import Head from 'next/head'
import { polyfill } from '../polyfills'

import '../lib/semantic/dist/semantic.css'
import '../globals.css'

const { publicRuntimeConfig } = getConfig()

const isProd = process.env.NODE_ENV === 'production'

interface Props {
  locale: string
  messages: any
}

class Klicker extends App<Props> {
  state = { error: null }

  static async getInitialProps(appContext: AppContext): Promise<any> {
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

  componentDidMount(): any {
    if (isProd) {
      if (publicRuntimeConfig.analyticsTrackingID) {
        const { initGA, logPageView } = require('../lib/utils/analytics')

        if (!window.INIT_GA) {
          initGA(publicRuntimeConfig.analyticsTrackingID)

          // log subsequent route changes as page views
          Router.router.events.on('routeChangeComplete', logPageView)

          window.INIT_GA = true
        }

        // log the initial page load as a page view
        logPageView()
      }
    }
  }

  componentDidCatch(error): any {
    this.setState({ error })

    if (isProd) {
      if (publicRuntimeConfig.analyticsTrackingID) {
        const { logException } = require('../lib/utils/analytics')
        logException(error)
      }
    }
  }

  render() {
    const { Component, pageProps, locale, messages } = this.props

    return (
      <>
        <Head>
          <meta content="width=device-width, initial-scale=1" name="viewport" />
        </Head>
        <DndProvider backend={HTML5Backend}>
          <IntlProvider defaultLocale="en" locale={locale} messages={messages}>
            <ToastProvider autoDismiss>
              <StrictMode>
                <Component {...pageProps} err={this.state.error} />
              </StrictMode>
            </ToastProvider>
          </IntlProvider>
        </DndProvider>
      </>
    )
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
    locales = [locales]
  }
  let langBundle
  let locale
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
