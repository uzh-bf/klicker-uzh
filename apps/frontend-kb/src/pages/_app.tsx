import { ApolloProvider } from '@apollo/client'
import { getMessageFallback, onError, routing } from '@klicker-uzh/i18n'
import { Toaster } from '@uzh-bf/design-system'
import { NextIntlClientProvider } from 'next-intl'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import '../globals.css'
import { useApollo } from '../lib/apollo'

function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()
  const apolloClient = useApollo()

  const validLocale = (routing.locales as readonly string[]).includes(
    locale ?? ''
  )
    ? (locale as (typeof routing.locales)[number])
    : routing.defaultLocale

  return (
    <div
      id="__app"
      className="flex h-full min-h-full flex-col bg-slate-50 font-sans"
    >
      <ApolloProvider client={apolloClient}>
        <NextIntlClientProvider
          timeZone="Europe/Zurich"
          messages={pageProps.messages}
          locale={validLocale}
          onError={onError}
          getMessageFallback={getMessageFallback}
        >
          <Toaster closeButton position="top-right" />
          <Component {...pageProps} />
        </NextIntlClientProvider>
      </ApolloProvider>

      <style jsx global>{`
        :root {
          --source-sans-pro: 'Source Sans 3';
          --theme-font-primary: 'Source Sans 3';
          --kb-font-family: 'Source Sans 3';
        }
      `}</style>
    </div>
  )
}

export default App
