/* eslint-disable react/no-danger */

import Document, { Html, Head, Main, NextScript } from 'next/document'
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
      <Html lang={this.props.locale}>
        <Head>
          <meta
            content="The KlickerUZH is an open-source instant-class-response system that supports the interaction between speakers and their audience."
            name="description"
          />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content="text/html; charset=utf-8" httpEquiv="Content-type" />
          <meta content="IE=Edge" httpEquiv="X-UA-Compatible" />
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
      </Html>
    )
  }
}

export default IntlDocument
