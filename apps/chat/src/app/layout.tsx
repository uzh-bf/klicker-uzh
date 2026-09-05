import { messagesByLocale } from '@/src/types/i18n'
import { routing } from '@klicker-uzh/i18n'
import {
  monoSpaceFont,
  sourceSansPro,
} from '@klicker-uzh/shared-components/src/font'
import 'katex/dist/katex.min.css'
import type { Metadata, Viewport } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { RootIntlProvider } from './RootIntlProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'KlickerUZH Chat',
}

// `viewportFit: 'cover'` (viewport-fit=cover) lets content extend under the
// iOS notch/home-indicator so `env(safe-area-inset-*)` resolves to the real
// inset instead of 0 — required for the composer's safe-area bottom padding.
export const viewport: Viewport = {
  // Keep the layout viewport in sync with the Android keyboard so the
  // composer does not move the conversation viewport when it opens.
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
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

  // Same static map as `types/i18n.ts` — the dynamic bare-package-subpath
  // import it replaces does not resolve under Turbopack.
  const messages = messagesByLocale[locale]
  const t = await getTranslations()

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
        {/* First focusable element on every page: jumps keyboard/screen-reader
            users past the sidebar/header chrome straight to the `<main
            id="main-content">` each rendered chat state provides. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-base focus:font-semibold focus:text-white focus:shadow-lg"
        >
          {t('chat.a11y.skipToContent')}
        </a>
        <RootIntlProvider locale={locale} messages={messages}>
          {children}
        </RootIntlProvider>
      </body>
    </html>
  )
}
