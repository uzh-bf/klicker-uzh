/* eslint-disable no-underscore-dangle */
import React, { StrictMode } from 'react'
import Router from 'next/router'
import getConfig from 'next/config'
import App from 'next/app'
import HTML5Backend from 'react-dnd-html5-backend'
import { DndProvider } from 'react-dnd'
import { ToastProvider } from 'react-toast-notifications'
import { createIntl, createIntlCache, RawIntlProvider } from 'react-intl'
import * as Sentry from '@sentry/node'
import { RewriteFrames } from '@sentry/integrations'
import { Integrations } from '@sentry/tracing'
import Head from 'next/head'

// HACK: import an empty css file such that pages with css files loaded don't become unroutable (e.g., pages with Countdown.js)
import './app.css'

// This is optional but highly recommended
// since it prevents memory leak
const cache = createIntlCache()

const { publicRuntimeConfig } = getConfig()

const isProd = process.env.NODE_ENV === 'production'

if (publicRuntimeConfig.sentryDSN) {
  const config = getConfig()
  const distDir = `${config.serverRuntimeConfig.rootDir}/.next`
  Sentry.init({
    enabled: isProd,
    integrations: [
      new RewriteFrames({
        iteratee: (frame: any): any => {
          // eslint-disable-next-line
          frame.filename = frame.filename.replace(distDir, 'app:///_next')
          return frame
        },
      }),
      new Integrations.BrowserTracing(),
    ],
    dsn: publicRuntimeConfig.sentryDSN,
    release: process.env.npm_package_version,
    tracesSampleRate: 1.0, // Be sure to lower this in production
  })
}

// Register React Intl's locale data for the user's locale in the browser. This
// locale data was added to the page by `pages/_document.js`. This only happens
// once, on initial page load in the browser.
if (typeof window !== 'undefined' && window.ReactIntlLocaleData) {
  import('intl-pluralrules')
  import('@formatjs/intl-relativetimeformat/polyfill')

  Object.keys(window.ReactIntlLocaleData).forEach((lang) => {
    import(`@formatjs/intl-relativetimeformat/dist/locale-data/${lang}`)
  })
}

interface Props {
  apolloClient: any
  locale: string
  messages: any
}

class Klicker extends App<Props> {
  state = { error: null }

  static async getInitialProps({ Component, ctx }): Promise<any> {
    let pageProps = {}

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx)
    }

    // Get the `locale` and `messages` from the request object on the server.
    // In the browser, use the same values that the server serialized.
    const { req } = ctx
    const { locale, messages } = req || window.__NEXT_DATA__.props

    return { pageProps, locale, messages }
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

  render(): React.ReactElement {
    const { Component, pageProps, locale, messages } = this.props

    const intl = createIntl({ locale, messages }, cache)

    return (
      <>
        <Head>
          <meta content="width=device-width, initial-scale=1" name="viewport" />
        </Head>
        <DndProvider backend={HTML5Backend}>
          <RawIntlProvider value={intl}>
            <ToastProvider autoDismiss>
              <StrictMode>
                <Component {...pageProps} err={this.state.error} />
              </StrictMode>
            </ToastProvider>
          </RawIntlProvider>
        </DndProvider>
      </>
    )
  }
}

export default Klicker
