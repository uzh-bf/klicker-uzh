'use client'

import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { type Locale, NextIntlClientProvider } from 'next-intl'
import { type ComponentProps, type ReactNode } from 'react'

// Client wrapper for the app-wide next-intl provider. `onError` and
// `getMessageFallback` are functions and cannot be passed across the
// Server/Client boundary, so they are attached here; the server root layout
// resolves the (serializable) `locale` and `messages` and passes them in.
export function RootIntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: ComponentProps<typeof NextIntlClientProvider>['messages']
  children: ReactNode
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Europe/Zurich"
      onError={onError}
      getMessageFallback={getMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  )
}
