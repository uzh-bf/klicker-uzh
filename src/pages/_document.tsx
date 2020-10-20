/* eslint-disable react/no-danger */

import Document, { Head, Main, NextScript } from 'next/document'
import React from 'react'

if (typeof global.Intl !== 'object') {
  global.Intl = require('intl')
}

interface Props {
  locale: string
  localeDataScript: any
}

// The document (which is SSR-only) needs to be customized to expose the locale
// data for the user's locale for React Intl to work in the browser.
class IntlDocument extends Document<Props> {
  static async getInitialProps(context): Promise<any> {
    const props = await super.getInitialProps(context)
    const {
      req: { locale, localeDataScript },
    } = context
    return {
      ...props,
      locale,
      localeDataScript,
    }
  }

  render(): React.ReactElement {
    return (
      <html lang={this.props.locale}>
        <Head>
          <meta content="text/html; charset=utf-8" httpEquiv="Content-type" />
          <meta content="IE=Edge" httpEquiv="X-UA-Compatible" />
          <script
            crossOrigin="anonymous"
            src="https://polyfill.io/v3/polyfill.min.js?flags=gated&features=default%2CIntl%2CArray.prototype.includes%2CString.prototype.repeat%2CSymbol%2CSymbol.iterator"
          />
          {/* <script async="true" crossOrigin="anonymous" src="https://cdn.slaask.com/chat.js" /> */}
        </Head>
        <body>
          <Main />
          <script
            dangerouslySetInnerHTML={{
              __html: this.props.localeDataScript,
            }}
          />
          <NextScript />
        </body>
      </html>
    )
  }
}

export default IntlDocument
