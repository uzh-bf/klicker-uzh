/* eslint-disable no-underscore-dangle */

import App, { Container } from 'next/app'
import { ApolloProvider } from 'react-apollo'
import { IntlProvider, addLocaleData } from 'react-intl'
import React from 'react'

import { withApolloClient } from '../lib'

// Register React Intl's locale data for the user's locale in the browser. This
// locale data was added to the page by `pages/_document.js`. This only happens
// once, on initial page load in the browser.
if (typeof window !== 'undefined' && window.ReactIntlLocaleData) {
  Object.keys(window.ReactIntlLocaleData).forEach(lang => {
    addLocaleData(window.ReactIntlLocaleData[lang])
  })
}

class Klicker extends App {
  static async getInitialProps({ Component, ctx }) {
    let pageProps = {}

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx)
    }

    // Get the `locale` and `messages` from the request object on the server.
    // In the browser, use the same values that the server serialized.
    const { req } = ctx
    const { locale, messages } = req || window.__NEXT_DATA__.props

    return { locale, messages, pageProps }
  }

  render() {
    const { Component, pageProps, apolloClient, locale, messages } = this.props
    const now = Date.now()

    return (
      <Container>
        <IntlProvider initialNow={now} locale={locale} messages={messages}>
          <ApolloProvider client={apolloClient}>
            <Component {...pageProps} />
          </ApolloProvider>
        </IntlProvider>
      </Container>
    )
  }
}

export default withApolloClient(Klicker)
