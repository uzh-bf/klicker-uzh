import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { SessionProvider } from 'next-auth/react'
import { NextIntlProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { Source_Sans_3 } from 'next/font/google'
import { useRouter } from 'next/router'

import '@/styles/globals.css'

const sourceSans3 = Source_Sans_3({ subsets: ['latin'] })

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const { locale } = useRouter()

  return (
    <div id="__app" className="font-sans">
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

      <style jsx global>{`
        :root {
          --theme-font-primary: ${sourceSans3.style.fontFamily};
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
