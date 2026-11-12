'use client'

import { getMessageFallback, onError } from '@klicker-uzh/i18n'
import { type Locale, NextIntlClientProvider } from 'next-intl'
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from 'react'

// Public student PWA URL, resolved on the server per request. Error boundaries
// are client components that cannot receive props, so they read it here.
const PwaUrlContext = createContext('')

export function usePwaUrl() {
  return useContext(PwaUrlContext)
}

// Client wrapper for the app-wide next-intl provider. `onError` and
// `getMessageFallback` are functions and cannot be passed across the
// Server/Client boundary, so they are attached here; the server root layout
// resolves the (serializable) `locale` and `messages` and passes them in.
export function RootIntlProvider({
  locale,
  messages,
  pwaUrl,
  children,
}: {
  locale: Locale
  messages: ComponentProps<typeof NextIntlClientProvider>['messages']
  pwaUrl: string
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
      <PwaUrlContext.Provider value={pwaUrl}>{children}</PwaUrlContext.Provider>
    </NextIntlClientProvider>
  )
}
