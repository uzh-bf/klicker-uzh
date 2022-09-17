// @ts-nocheck

import Document, { Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render(): JSX.Element {
    return (
      <Html>
        <Head>
          <meta name="application-name" content="KlickerUZH" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="default"
          />
          <meta name="apple-mobile-web-app-title" content="KlickerUZH" />
          <meta name="description" content="KlickerUZH Audience Interaction" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta
            name="msapplication-config"
            content="/icons/browserconfig.xml"
          />
          <meta name="msapplication-TileColor" content="#0028a5" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="theme-color" content="#0028a5" />

          <link rel="apple-touch-icon" href="/touch-icon-iphone.png" />
          <link
            rel="apple-touch-icon"
            sizes="152x152"
            href="/apple-touch-icon.png"
          />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="apple-touch-icon"
            sizes="167x167"
            href="/apple-touch-icon.png"
          />

          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/manifest.json" />
          <link rel="shortcut icon" href="/favicon.ico" />

          <meta property="og:type" content="website" />
          <meta property="og:title" content="KlickerUZH" />
          <meta
            property="og:description"
            content="KlickerUZH Audience Interaction"
          />
          <meta property="og:site_name" content="KlickerUZH" />
          <meta property="og:url" content="https://pwa.klicker.uzh.ch" />
          <meta
            property="og:image"
            content="https://pwa.klicker.uzh.ch/apple-touch-icon.png"
          />

          {/* <link
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
          /> */}
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
