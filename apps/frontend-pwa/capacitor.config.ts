import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ch.uzh.klicker.pwa',
  appName: 'KlickerUZH',
  // webDir: '.next',
  server: {
    // url: 'https://pwa.klicker.uzh.ch',
    url: 'http://pwa.klicker.local',
  },
}

export default config
