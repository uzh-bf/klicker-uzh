import type { CapacitorConfig } from '@capacitor/cli'

// The native shell loads the deployed controller instead of bundling it.
// CAP_SERVER_URL overrides the target, e.g. https://control.klicker.uzh.ch.
const serverUrl =
  process.env.CAP_SERVER_URL ?? 'https://control.klicker.localhost'
const { hostname } = new URL(serverUrl)
const baseDomain = hostname.split('.').slice(1).join('.')

const config: CapacitorConfig = {
  appId: 'ch.uzh.klicker.control',
  appName: 'KlickerUZH Control',
  webDir: 'www',
  server: {
    url: serverUrl,
    // Keep the auth app (auth.<domain>) inside the WebView so the login
    // cookie is shared with the controller.
    allowNavigation: [hostname, `*.${baseDomain}`],
  },
}

export default config
