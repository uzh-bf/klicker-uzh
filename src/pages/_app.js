/* eslint-disable no-underscore-dangle */
import React, { StrictMode } from 'react'
import Router from 'next/router'
import getConfig from 'next/config'
import App from 'next/app'
import HTML5Backend from 'react-dnd-html5-backend'
import { ApolloProvider } from '@apollo/react-hooks'
import { IntlProvider } from 'react-intl'
import { DndProvider } from 'react-dnd'
import { ToastProvider } from 'react-toast-notifications'

import withApolloClient from '../lib/withApolloClient'

// HACK: import an empty css file such that pages with css files loaded don't become unroutable (e.g., pages with Countdown.js)
import './app.css'

const { publicRuntimeConfig } = getConfig()

const isProd = process.env.NODE_ENV === 'production'

const Raven = publicRuntimeConfig.sentryDSN && require('raven-js')
const LogRocket = publicRuntimeConfig.logrocketAppID && require('logrocket')

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

class Klicker extends App {
  state = { error: null }

  static async getInitialProps({ Component, ctx }) {
    let pageProps = {}

    // Get the `locale` and `messages` from the request object on the server.
    // In the browser, use the same values that the server serialized.
    const { req } = ctx
    const { locale, messages } = req || window.__NEXT_DATA__.props

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx)
    }

    return { locale, messages, pageProps }
  }

  componentDidMount() {
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

      if (Raven && !window.INIT_RAVEN) {
        Raven.config(publicRuntimeConfig.sentryDSN, {
          environment: process.env.NODE_ENV,
          release: process.env.VERSION,
        }).install()

        if (LogRocket && window.INIT_LR) {
          Raven.setDataCallback((data) => ({
            ...data,
            extra: {
              sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
            },
          }))
        }

        window.INIT_RAVEN = true
      }
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error })

    if (isProd) {
      if (Raven) {
        Raven.captureException(error, { extra: errorInfo })
        Raven.showReportDialog()
      }

      if (publicRuntimeConfig.analyticsTrackingID) {
        const { logException } = require('../lib/utils/analytics')
        logException(error)
      }
    }

    // needed for correct error handling in development
    super.componentDidCatch(error, errorInfo)
  }

  render() {
    const { Component, pageProps, apolloClient, locale, messages } = this.props
    const now = Date.now()

    return (
      <DndProvider backend={HTML5Backend}>
        <IntlProvider initialNow={now} locale={locale} messages={messages}>
          <ApolloProvider client={apolloClient}>
            <ToastProvider autoDismiss>
              <StrictMode>
                <Component {...pageProps} error={this.state.error} />
              </StrictMode>
            </ToastProvider>
          </ApolloProvider>
        </IntlProvider>
      </DndProvider>
    )
  }
}

export default withApolloClient(Klicker)
