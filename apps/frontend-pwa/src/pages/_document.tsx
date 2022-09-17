// @ts-nocheck

import Document, { Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render(): JSX.Element {
    return (
      <Html>
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/apple-icon-180.png" />
          <meta name="theme-color" content="#0028a5" />
          <link
            rel="preload"
            href="/woff/thesans-plain.woff2"
            as="font"
            type="font/woff2"
            crossorigin
          />
          <link
            rel="preload"
            href="/woff/thesans-bold.woff2"
            as="font"
            type="font/woff2"
            crossorigin
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
