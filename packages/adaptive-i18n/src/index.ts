import de from './messages/de'
import en from './messages/en'

export type AdaptiveMessages = typeof en
export type AdaptiveLocale = 'de' | 'en'

export const adaptiveMessages: Record<AdaptiveLocale, AdaptiveMessages> = {
  de,
  en,
}

export function getAdaptiveMessages(locale: AdaptiveLocale): AdaptiveMessages {
  return adaptiveMessages[locale]
}
