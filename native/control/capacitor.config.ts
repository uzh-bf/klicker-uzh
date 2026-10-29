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

// local development hosts, the only ones that may be loaded over plain http
const isLocalDevHost = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(host) ||
  host.endsWith('.localhost') ||
  host.endsWith('.test')

// only https URLs (or http for local development hosts) may be loaded as
// the controller; anything else (file:, javascript:, plain http to a real
// host, malformed values) fails the native build
let parsed: URL | undefined
try {
  parsed = new URL(serverUrl)
} catch {
  parsed = undefined
}
if (
  !parsed ||
  !parsed.hostname ||
  !(
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && isLocalDevHost(parsed.hostname))
  )
) {
  throw new Error(
    `Invalid CAP_SERVER_URL "${serverUrl}"; expected an https URL such as https://control.klicker.uzh.ch (http only for local development hosts)`
  )
}
const { hostname } = parsed

// auth.<base domain> hosts the login; it must stay inside the WebView so the
// session cookie is shared with the controller. Other hosts (manage, pwa, …)
// open in the system browser. The auth host is only derived from a subdomain
// host (control.<domain>, at least three labels): for a two-label host such as
// klicker.ch the derived auth.ch would be a third-party site, and a single-label
// host (localhost) shares cookies across ports.
const labels = hostname.split('.')
const baseDomain = labels.length > 2 ? labels.slice(1).join('.') : null

// The lecturer login continues from the auth app to the identity provider
// (SWITCH edu-ID); it has to stay inside the WebView too, otherwise it opens
// in Safari, whose cookies the app cannot see. Local development uses the
// OIDC mock of the devcontainer. CAP_EXTRA_NAVIGATION (comma-separated host
// names) adds further hosts without code changes.
const IDENTITY_PROVIDER_HOSTS = ['login.eduid.ch', 'login.test.eduid.ch']
const extraHosts = (process.env.CAP_EXTRA_NAVIGATION ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)
for (const host of extraHosts) {
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    throw new Error(
      `Invalid host "${host}" in CAP_EXTRA_NAVIGATION; expected plain host names`
    )
  }
}

const allowNavigation = [
  hostname,
  ...(baseDomain ? [`auth.${baseDomain}`] : []),
  ...IDENTITY_PROVIDER_HOSTS,
  ...(baseDomain && isLocalDevHost(hostname) ? [`oidc.${baseDomain}`] : []),
  ...extraHosts,
]

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
