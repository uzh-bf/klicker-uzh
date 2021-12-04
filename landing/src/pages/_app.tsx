import { useEffect } from 'react'
import Head from 'next/head'

import { init } from '@socialgouv/matomo-next'

import '../styles/globals.css'
import 'fomantic-ui-css/semantic.css'

import Header from '../components/common/Header'
import Footer from '../components/common/Footer'

const MATOMO_URL = process.env.NEXT_PUBLIC_MATOMO_URL
const MATOMO_SITE_ID = process.env.NEXT_PUBLIC_MATOMO_SITE_ID

function App({ Component, pageProps }) {
  useEffect(() => {
    init({ url: MATOMO_URL, siteId: MATOMO_SITE_ID })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Head>
        <title>KlickerUZH</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Head>

      <div className="top-0 z-10 flex-initial lg:sticky">
        <Header />
      </div>

      <main className="flex-1">
        <Component {...pageProps} />
      </main>

      <div className="flex-initial">
        <Footer />
      </div>
    </div>
  )
}

export default App
