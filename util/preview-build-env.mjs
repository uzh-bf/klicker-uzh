import { spawn } from 'node:child_process'
import { isIP } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const INPUT_KEY = 'KLICKER_PREVIEW_BUILD_ENV_JSON'
const CONTROL_CHARACTERS = /\p{Cc}/u
const ENVIRONMENT_NAME = /^[A-Z][A-Z0-9_]*$/

const ORIGIN_KEYS = Object.freeze([
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_ASSESSMENT_URL',
  'NEXT_PUBLIC_AUTH_URL',
  'NEXT_PUBLIC_CHAT_URL',
  'NEXT_PUBLIC_CONTROL_URL',
  'NEXT_PUBLIC_LTI_URL',
  'NEXT_PUBLIC_MANAGE_URL',
  'NEXT_PUBLIC_PWA_URL',
])

const ENDPOINT_KEYS = Object.freeze([
  'BLOB_STORAGE_ACCOUNT_URL',
  'NEXT_PUBLIC_ADD_RESPONSE_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_ASSESSMENT_API_URL',
  'NEXT_PUBLIC_AVATAR_BASE_PATH',
])
const INTERNAL_HTTP_KEYS = Object.freeze([
  'API_URL_SSR',
  'NEXT_PUBLIC_API_URL_SSR',
])
const DOMAIN_KEYS = Object.freeze(['API_DOMAIN', 'COOKIE_DOMAIN'])
const TELEMETRY_URL_KEYS = Object.freeze([
  'NEXT_PUBLIC_GROWTHBOOK_API_HOST',
  'NEXT_PUBLIC_MATOMO_URL',
])
const TELEMETRY_ID_KEYS = Object.freeze([
  'NEXT_PUBLIC_MATOMO_ID',
  'NEXT_PUBLIC_MATOMO_SITE_ID',
])

const APP_REQUIRED_KEYS = Object.freeze({
  auth: Object.freeze([
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_ASSESSMENT_URL',
    'NEXT_PUBLIC_MANAGE_URL',
    'NEXT_PUBLIC_PWA_URL',
  ]),
  chat: Object.freeze(['NEXT_PUBLIC_CHAT_URL', 'NEXT_PUBLIC_PWA_URL']),
  'frontend-control': Object.freeze([
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_API_URL_SSR',
    'NEXT_PUBLIC_AUTH_URL',
    'NEXT_PUBLIC_CONTROL_URL',
    'NEXT_PUBLIC_MANAGE_URL',
  ]),
  'frontend-manage': Object.freeze([
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_API_URL_SSR',
    'NEXT_PUBLIC_AUTH_URL',
    'NEXT_PUBLIC_MANAGE_URL',
    'NEXT_PUBLIC_PWA_URL',
  ]),
  'frontend-pwa': Object.freeze([
    'NEXT_PUBLIC_ADD_RESPONSE_URL',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_API_URL_SSR',
    'NEXT_PUBLIC_AUTH_URL',
    'NEXT_PUBLIC_PWA_URL',
  ]),
})

const PREVIEW_BUILD_ENV_KEYS = Object.freeze([
  ...ORIGIN_KEYS,
  ...ENDPOINT_KEYS,
  ...INTERNAL_HTTP_KEYS,
  ...DOMAIN_KEYS,
  ...TELEMETRY_URL_KEYS,
  ...TELEMETRY_ID_KEYS,
  'NEXT_PUBLIC_ENV',
  'NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY',
  'NEXT_TELEMETRY_DISABLED',
])

const ALLOWED_KEYS = new Set(PREVIEW_BUILD_ENV_KEYS)

export class PreviewBuildEnvError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PreviewBuildEnvError'
  }
}

export { APP_REQUIRED_KEYS, PREVIEW_BUILD_ENV_KEYS }

function normalizeApp(app) {
  const candidate = String(app ?? '')
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
    .split('/')
    .at(-1)

  if (!Object.hasOwn(APP_REQUIRED_KEYS, candidate)) {
    throw new PreviewBuildEnvError(
      `Unsupported preview app. Expected one of: ${Object.keys(
        APP_REQUIRED_KEYS
      ).join(', ')}`
    )
  }

  return candidate
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertHostname(hostname, { allowSingleLabel }) {
  if (!hostname || CONTROL_CHARACTERS.test(hostname)) return false

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return isIP(hostname.slice(1, -1)) === 6
  }

  if (isIP(hostname)) return true
  if (hostname.length > 253 || hostname.endsWith('.')) return false

  const labels = hostname.split('.')
  if (!allowSingleLabel && labels.length < 2) return false

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  )
}

function assertUrl(key, value, { allowHttp, originOnly }) {
  let parsed

  try {
    if (!/^https?:\/\//.test(value) || /[\s\\]/.test(value)) {
      throw new Error()
    }
    parsed = new URL(value)
  } catch {
    throw new PreviewBuildEnvError(`${key} must be a valid URL`)
  }

  const allowedProtocols = allowHttp ? ['http:', 'https:'] : ['https:']
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new PreviewBuildEnvError(
      `${key} must use ${allowHttp ? 'HTTP or HTTPS' : 'HTTPS'}`
    )
  }

  if (/^https?:\/\/[^/?#]*@/.test(value)) {
    throw new PreviewBuildEnvError(`${key} must not contain URL credentials`)
  }

  if (
    !assertHostname(parsed.hostname, {
      allowSingleLabel: allowHttp,
    })
  ) {
    throw new PreviewBuildEnvError(`${key} must contain a valid hostname`)
  }

  if (originOnly && parsed.pathname !== '/') {
    throw new PreviewBuildEnvError(`${key} must contain only a URL origin`)
  }

  if (value.includes('?') || value.includes('#')) {
    throw new PreviewBuildEnvError(
      `${key} must not contain a query or fragment`
    )
  }
}

function assertDomain(key, value) {
  const domain = value.startsWith('.') ? value.slice(1) : value

  if (!assertHostname(domain.toLowerCase(), { allowSingleLabel: false })) {
    throw new PreviewBuildEnvError(`${key} must contain a valid domain`)
  }
}

function validateValue(key, value) {
  if (value.length === 0) {
    if (
      TELEMETRY_URL_KEYS.includes(key) ||
      TELEMETRY_ID_KEYS.includes(key) ||
      key === 'NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY'
    ) {
      return
    }
    throw new PreviewBuildEnvError(`${key} must not be empty`)
  }

  if (value.length > 2048) {
    throw new PreviewBuildEnvError(`${key} is too long`)
  }

  if (CONTROL_CHARACTERS.test(value)) {
    throw new PreviewBuildEnvError(`${key} must not contain control characters`)
  }

  if (ORIGIN_KEYS.includes(key)) {
    assertUrl(key, value, { allowHttp: false, originOnly: true })
    return
  }

  if (INTERNAL_HTTP_KEYS.includes(key)) {
    assertUrl(key, value, { allowHttp: true, originOnly: false })
    return
  }

  if (ENDPOINT_KEYS.includes(key) || TELEMETRY_URL_KEYS.includes(key)) {
    assertUrl(key, value, { allowHttp: false, originOnly: false })
    return
  }

  if (DOMAIN_KEYS.includes(key)) {
    assertDomain(key, value)
    return
  }

  if (TELEMETRY_ID_KEYS.includes(key)) {
    if (!/^[0-9]{1,32}$/.test(value)) {
      throw new PreviewBuildEnvError(`${key} must be a numeric identifier`)
    }
    return
  }

  if (key === 'NEXT_PUBLIC_ENV') {
    if (!/^(staging|production|test)$/.test(value)) {
      throw new PreviewBuildEnvError(
        'NEXT_PUBLIC_ENV must be staging, production, or test'
      )
    }
    return
  }

  if (key === 'NEXT_TELEMETRY_DISABLED' && value !== '1') {
    throw new PreviewBuildEnvError(
      'NEXT_TELEMETRY_DISABLED only supports explicit disabling with value 1'
    )
  }
}

export function parsePreviewBuildEnv(rawValue, app) {
  const normalizedApp = normalizeApp(app)

  if (rawValue === undefined || rawValue === null || rawValue.trim() === '') {
    return null
  }

  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new PreviewBuildEnvError(`${INPUT_KEY} must contain valid JSON`)
  }

  if (!isPlainObject(parsed)) {
    throw new PreviewBuildEnvError(`${INPUT_KEY} must contain a JSON object`)
  }

  const keys = Object.keys(parsed)
  const prototypeKeys = keys.filter((key) =>
    ['__proto__', 'constructor', 'prototype'].includes(key)
  )
  if (prototypeKeys.length > 0) {
    throw new PreviewBuildEnvError(
      'Preview build config must not contain prototype keys'
    )
  }

  if (keys.some((key) => !ENVIRONMENT_NAME.test(key))) {
    throw new PreviewBuildEnvError(
      'Preview build config contains an invalid key'
    )
  }

  const unknownKeys = keys.filter((key) => !ALLOWED_KEYS.has(key))
  if (unknownKeys.length > 0) {
    throw new PreviewBuildEnvError(
      `Unknown preview build key: ${unknownKeys.join(', ')}`
    )
  }

  const config = Object.create(null)
  for (const key of keys) {
    const value = parsed[key]
    if (typeof value !== 'string') {
      throw new PreviewBuildEnvError(`${key} must be a string`)
    }
    validateValue(key, value)
    config[key] = value
  }

  const missingKeys = APP_REQUIRED_KEYS[normalizedApp].filter(
    (key) => !Object.hasOwn(config, key)
  )
  if (missingKeys.length > 0) {
    throw new PreviewBuildEnvError(
      `Missing required preview config for ${normalizedApp}: ${missingKeys.join(
        ', '
      )}`
    )
  }

  return config
}

export function prepareChildEnvironment(baseEnv, app) {
  const previewConfig = parsePreviewBuildEnv(baseEnv[INPUT_KEY], app)
  const childEnv = { ...baseEnv }
  delete childEnv[INPUT_KEY]

  if (previewConfig) {
    Object.assign(childEnv, previewConfig)
    // New public bindings are not all inputs to the shared Turbo cache. A
    // preview build must not reuse output compiled for another origin.
    childEnv.TURBO_FORCE = 'true'
  }

  return childEnv
}

function parseCliArguments(args) {
  const separator = args.indexOf('--')
  const options = separator < 0 ? args : args.slice(0, separator)

  if (options.includes('--help') || options.includes('-h')) {
    return { help: true }
  }

  if (separator < 0) {
    throw new PreviewBuildEnvError('Expected -- before the build command')
  }

  const command = args.slice(separator + 1)
  if (options.length !== 2 || options[0] !== '--app' || !options[1]) {
    throw new PreviewBuildEnvError('Expected --app <folder> before --')
  }

  if (command.length === 0) {
    throw new PreviewBuildEnvError('Expected a build command after --')
  }

  return { app: options[1], command, help: false }
}

function usage() {
  return `Usage: node util/preview-build-env.mjs --app <folder> -- <build command>

Reads optional non-secret build bindings from ${INPUT_KEY}.
An absent or empty value runs the supplied build command unchanged.
Supported app folders: ${Object.keys(APP_REQUIRED_KEYS).join(', ')}
`
}

function runChild(command, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command[0], command.slice(1), {
      env,
      stdio: 'inherit',
    })

    child.once('error', rejectPromise)
    child.once('exit', (code) => {
      resolvePromise(code ?? 1)
    })
  })
}

export async function main(args, baseEnv = process.env) {
  const parsedArgs = parseCliArguments(args)
  if (parsedArgs.help) {
    process.stdout.write(usage())
    return 0
  }

  const childEnv = prepareChildEnvironment(baseEnv, parsedArgs.app)
  return runChild(parsedArgs.command, childEnv)
}

const modulePath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null

if (invokedPath === modulePath) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    const message =
      error instanceof PreviewBuildEnvError
        ? error.message
        : 'Unable to start the preview build command'
    process.stderr.write(`preview-build-env: ${message}\n`)
    process.exitCode = 1
  }
}
