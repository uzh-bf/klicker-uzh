import {
  monoSpaceFont,
  sourceSansPro,
} from '@klicker-uzh/shared-components/src/font'
import 'katex/dist/katex.min.css'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'KlickerUZH Chat',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

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
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
