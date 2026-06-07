import { CapacitorConfig } from '@capacitor/cli'

const DEFAULT_DEV_SERVER_URL = 'https://pwa.klicker.com'
const DEFAULT_PROD_SERVER_URL = 'https://pwa.klicker.uzh.ch'

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ??
  (process.env.CAPACITOR_APP_ENV === 'production'
    ? DEFAULT_PROD_SERVER_URL
    : DEFAULT_DEV_SERVER_URL)

const config: CapacitorConfig = {
  appId: 'ch.uzh.bf.klicker.pwa',
  appName: 'KlickerUZH',
  // needed, otherwise there is no capacitor.settings.gradle created, and hence, the build in android studio fails
  webDir: '.next',
  server: {
    url: serverUrl,
    cleartext: process.env.CAPACITOR_CLEAR_TEXT === 'true',
  },
}

export default config
