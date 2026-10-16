import type { CapacitorConfig } from '@capacitor/cli'

const DEV_SERVER_URL = 'https://control.klicker.localhost'

// The native shell loads the deployed controller instead of bundling it.
// CAP_SERVER_URL overrides the target, e.g. https://control.klicker.uzh.ch.
const serverUrl = process.env.CAP_SERVER_URL || DEV_SERVER_URL
if (!process.env.CAP_SERVER_URL) {
  console.warn(
    `CAP_SERVER_URL is not set; using the local dev host ${DEV_SERVER_URL}. Release builds must set CAP_SERVER_URL.`
  )
}

let hostname: string
try {
  ;({ hostname } = new URL(serverUrl))
} catch {
  throw new Error(
    `Invalid CAP_SERVER_URL "${serverUrl}"; expected an absolute URL such as https://control.klicker.uzh.ch`
  )
}

// auth.<base domain> hosts the login; it must stay inside the WebView so the
// session cookie is shared with the controller. Other hosts (manage, pwa, …)
// open in the system browser. A host without a base domain (e.g. localhost)
// shares cookies across ports, so only the controller host is allowed.
const labels = hostname.split('.')
const allowNavigation =
  labels.length > 1
    ? [hostname, `auth.${labels.slice(1).join('.')}`]
    : [hostname]

const config: CapacitorConfig = {
  appId: 'ch.uzh.klicker.control',
  appName: 'KlickerUZH Control',
  webDir: 'www',
  server: {
    url: serverUrl,
    allowNavigation,
  },
}

export default config
