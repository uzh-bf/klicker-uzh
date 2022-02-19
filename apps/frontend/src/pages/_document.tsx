/* eslint-disable react/no-danger */

import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document'
import React from 'react'

interface Props {
  locale: string
  lang: string
  nonce: string
}

// The document (which is SSR-only) needs to be customized to expose the locale
// data for the user's locale for React Intl to work in the browser.
class IntlDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const { req } = ctx
    const initialProps = await Document.getInitialProps(ctx)
    const { locale, nonce } = req as any
    console.error(locale)
    return {
      ...initialProps,
      locale,
      lang: locale ? locale.split('-')[0] : undefined,
      nonce,
    }
  }

  render() {
    let scriptEl
    if (this.props.locale) {
      scriptEl = (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.LOCALE="${this.props.locale}"`,
          }}
          nonce={this.props.nonce}
        />
      )
    }

    return (
      <Html lang={this.props.lang}>
        <Head>
          <meta
            content="The KlickerUZH is an open-source instant-class-response system that supports the interaction between speakers and their audience."
            name="description"
          />
          <meta content="text/html; charset=utf-8" httpEquiv="Content-type" />
          <meta content="IE=Edge" httpEquiv="X-UA-Compatible" />
        </Head>
        <body>
          {scriptEl}
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default IntlDocument
