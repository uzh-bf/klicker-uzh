import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { SessionProvider } from 'next-auth/react'
import { NextIntlProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'

import '@/styles/globals.css'

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const { locale } = useRouter()

  return (
    <div id="__app" className={`${sourceSansPro.variable} font-sans`}>
      <NextIntlProvider
        messages={pageProps.messages}
        locale={locale}
        onError={onError}
        getMessageFallback={getMessageFallback}
      >
        <SessionProvider session={session}>
          <Component {...pageProps} />
        </SessionProvider>
      </NextIntlProvider>

      <style>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }

        #__app {
          min-height: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  )
}
