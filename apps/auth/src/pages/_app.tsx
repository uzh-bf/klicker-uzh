import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { sourceSansPro } from '@klicker-uzh/shared-components/src/font'
import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'

import '@/styles/globals.css'
import { Toaster } from '@uzh-bf/design-system'
import '@uzh-bf/design-system/dist/style.css'

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const { locale } = useRouter()

  return (
    <div
      id="__app"
      className={`flex h-full min-h-full flex-col ${sourceSansPro.variable} font-sans`}
    >
      <NextIntlClientProvider
        timeZone="Europe/Zurich"
        messages={pageProps.messages}
        locale={locale}
        onError={onError}
        getMessageFallback={getMessageFallback}
      >
        <SessionProvider session={session}>
          <Toaster closeButton position="top-right" />
          <Component {...pageProps} />
        </SessionProvider>
      </NextIntlClientProvider>
      <style jsx global>{`
        :root {
          --source-sans-pro: ${sourceSansPro.variable};
          --theme-font-primary: ${sourceSansPro.variable};
        }
      `}</style>
    </div>
  )
}
