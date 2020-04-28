/* eslint-disable react/no-danger */

import Document, { Head, Main, NextScript } from 'next/document'
import React from 'react'
import { GetServerSideProps } from 'next'

if (typeof global.Intl !== 'object') {
  global.Intl = require('intl')
}

interface Props {
  locale: string
  localeDataScript: any
}

export const getServerSideProps: GetServerSideProps = async (ctx: any) => {
  const {
    req: { locale, localeDataScript },
  } = ctx

  return {
    props: {},
    locale,
    localeDataScript,
  }
}

// The document (which is SSR-only) needs to be customized to expose the locale
// data for the user's locale for React Intl to work in the browser.
class IntlDocument extends Document<Props> {
  render(): React.ReactElement {
    return (
      <html lang={this.props.locale}>
        <Head>
          <meta content="text/html; charset=utf-8" httpEquiv="Content-type" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
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
