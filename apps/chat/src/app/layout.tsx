import { routing } from '@klicker-uzh/i18n'
import {
  monoSpaceFont,
  sourceSansPro,
} from '@klicker-uzh/shared-components/src/font'
import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { RootIntlProvider } from './RootIntlProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'KlickerUZH Chat',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Chat has no `[locale]` route segment; resolve the active locale from the
  // NEXT_LOCALE cookie (set by the backend on login / locale change) and fall
  // back to the default. Reading cookies() opts this layout into dynamic
  // rendering, which is acceptable — chat is auth-gated and already dynamic.
  const requestedLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale
  setRequestLocale(locale)

  const messages = (await import(`@klicker-uzh/i18n/messages/${locale}`))
    .default

  return (
    <html lang={locale}>
      <head>
        <style>{`
          :root {
            --source-sans-pro: ${sourceSansPro.variable};
            --theme-font-primary: ${sourceSansPro.variable};
            --mono-space-font: ${monoSpaceFont.variable};
          }
        `}</style>
      </head>
      <body
        className={`${sourceSansPro.variable} ${monoSpaceFont.variable} font-sans antialiased`}
      >
        <RootIntlProvider locale={locale} messages={messages}>
          {children}
        </RootIntlProvider>
      </body>
    </html>
  )
}
