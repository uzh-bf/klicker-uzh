import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { NextIntlClientProvider } from 'next-intl'
import { sourceSansPro } from './font'

export default function DpoDraftApp({ Component, pageProps }: AppProps) {
  const { locale } = useRouter()

  return (
    <div
      id="__app"
      className={`flex min-h-full flex-col bg-white ${sourceSansPro.variable} font-sans`}
    >
      <NextIntlClientProvider
        locale={locale === 'de' ? 'de' : 'en'}
        messages={pageProps.messages}
        timeZone="Europe/Zurich"
      >
        <Component {...pageProps} />
      </NextIntlClientProvider>
      <style>{`:root { --theme-font-primary: ${sourceSansPro.style.fontFamily}; }`}</style>
    </div>
  )
}
