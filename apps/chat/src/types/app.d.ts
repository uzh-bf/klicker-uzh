import { routing } from '@klicker-uzh/i18n'
import type { ChatbotStandardModeConfig } from '@klicker-uzh/types'

declare global {
  namespace PrismaJson {
    type PrismaChatbotStandardModeConfig = ChatbotStandardModeConfig
  }
}

type EnglishMessages = typeof import('@klicker-uzh/i18n/messages/en').default
type GermanMessages = typeof import('@klicker-uzh/i18n/messages/de').default

// utility type to get the intersection of two object types
// ensures that only keys present in BOTH language files are valid
type DeepIntersection<T, U> = {
  [K in keyof T & keyof U]: T[K] extends object
    ? U[K] extends object
      ? DeepIntersection<T[K], U[K]>
      : never
    : T[K] extends U[K]
      ? T[K]
      : never
}

// messages type that only includes keys present in both EN and DE files
type Messages = DeepIntersection<EnglishMessages, GermanMessages>

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number]
    Messages: Messages
  }
}
