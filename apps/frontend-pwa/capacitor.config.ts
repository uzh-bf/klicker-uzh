import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ch.uzh.bf.klicker.pwa',
  appName: 'KlickerUZH',
  //needed, otherwise there is no capacity.settings.gradle created, and hence, the build in android studio fails
  webDir: '.next',
  server: {
    url: 'https://pwa.klicker.uzh.ch',
    // url: 'http://pwa.klicker.com',
    cleartext: true,
  },
}

export default config
