import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // supported locales and default locale
  locales: ['en', 'de'],
  defaultLocale: 'en',
})
