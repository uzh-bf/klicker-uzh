import { spawn } from 'node:child_process'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { pathToFileURL } from 'node:url'

export function isPrivateAddress(address) {
  if (isIP(address) !== 4) return false
  const [first, second] = address.split('.').map(Number)
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

/** @param {(host: string, options: {family: 4}) => Promise<{address: string}>} [resolve] */
export async function privateMcpEndpoint(env, resolve = lookup) {
  const host = env.KLICKER_PREVIEW_MCP_HOST
  if (!host || !/^[a-z0-9][a-z0-9.-]{0,252}$/.test(host)) {
    throw new Error('Preview MCP host is not configured')
  }
  const { address } = await resolve(host, { family: 4 })
  if (!isPrivateAddress(address)) {
    throw new Error('Preview MCP address is not private')
  }
  return new URL(`http://${address}:1417/mcp`)
}

export function decodeScopeKey(env, mode) {
  const source =
    mode === 'chat'
      ? 'KLICKER_PREVIEW_SCOPE_PRIVATE_KEY'
      : 'KLICKER_PREVIEW_SCOPE_PUBLIC_KEY'
  const destination =
    mode === 'chat' ? 'DOC_QUERY_SCOPE_PRIVATE_KEY' : 'LOCAL_MCP_PUBLIC_KEY'
  const value = env[source]
  if (!value || value.length > 4096 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Preview scope key is not configured')
  }
  const pem = Buffer.from(value, 'base64').toString('utf8')
  const kind = mode === 'chat' ? 'PRIVATE' : 'PUBLIC'
  if (
    !pem.startsWith(`-----BEGIN ${kind} KEY-----\n`) ||
    !pem.endsWith(`-----END ${kind} KEY-----\n`)
  ) {
    throw new Error('Preview scope key has an invalid format')
  }
  const key = mode === 'chat' ? createPrivateKey(pem) : createPublicKey(pem)
  if (key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('Preview scope key must use P-256')
  }
  delete env[source]
  env[destination] = pem
}

/** @param {(host: string, options: {family: 4}) => Promise<{address: string}>} [resolve] */
export async function runtimeEnvironment(mode, supplied, resolve = lookup) {
  if (!['chat', 'mcp', 'azurite'].includes(mode)) {
    throw new Error('Unsupported preview runtime')
  }
  const env = { ...supplied }
  if (mode === 'azurite') {
    if (
      env.AZURITE_ACCOUNT_NAME !== 'klickerdev' ||
      !/^[a-f0-9]{64}$/.test(env.AZURITE_ACCOUNT_KEY ?? '')
    ) {
      throw new Error('Preview Blob account is not configured')
    }
    env.AZURITE_ACCOUNTS = `${env.AZURITE_ACCOUNT_NAME}:${env.AZURITE_ACCOUNT_KEY}`
    delete env.AZURITE_ACCOUNT_NAME
    delete env.AZURITE_ACCOUNT_KEY
    return env
  }
  if (
    mode === 'mcp' &&
    (env.KLICKER_PREVIEW_SCOPE_PRIVATE_KEY || env.DOC_QUERY_SCOPE_PRIVATE_KEY)
  ) {
    throw new Error('Preview MCP must not receive the signing key')
  }
  decodeScopeKey(env, mode)
  if (mode === 'mcp') {
    const fixture = '/app/deploy/preview/mcp-fixture.json'
    if (env.LOCAL_MCP_FIXTURE_FILE && env.LOCAL_MCP_FIXTURE_FILE !== fixture) {
      throw new Error('Preview MCP fixture path does not match')
    }
    env.LOCAL_MCP_FIXTURE_FILE = fixture
    const url = await privateMcpEndpoint(env, resolve)
    env.LOCAL_MCP_BIND_HOST = '0.0.0.0'
    env.LOCAL_MCP_ALLOWED_HOSTS = `${env.KLICKER_PREVIEW_MCP_HOST}:1417,${url.host}`
  }
  return env
}

export function supervise(child, signals = process) {
  const forwardTerm = () => child.kill('SIGTERM')
  const forwardInt = () => child.kill('SIGINT')
  signals.on('SIGTERM', forwardTerm)
  signals.on('SIGINT', forwardInt)
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signals.removeListener('SIGTERM', forwardTerm)
      signals.removeListener('SIGINT', forwardInt)
    }
    child.once('error', () => {
      cleanup()
      reject(new Error('Preview runtime could not start'))
    })
    child.once('exit', (code, signal) => {
      cleanup()
      resolve(code ?? (signal === 'SIGINT' ? 130 : 143))
    })
  })
}

async function main() {
  const [mode, ...extra] = process.argv.slice(2)
  if (extra.length) throw new Error('Unexpected preview runtime arguments')
  const env = await runtimeEnvironment(mode, process.env)
  // Limit later parent reads; this does not scrub the process's initial environ.
  for (const name of [
    'KLICKER_PREVIEW_SCOPE_PRIVATE_KEY',
    'KLICKER_PREVIEW_SCOPE_PUBLIC_KEY',
    'AZURITE_ACCOUNT_KEY',
  ])
    delete process.env[name]
  const commands = {
    chat: [process.execPath, ['apps/chat/server.js']],
    mcp: [process.execPath, ['/app/apps/chat/scripts/local-mcp-server.mjs']],
    azurite: [
      'azurite-blob',
      [
        '--blobHost',
        '0.0.0.0',
        '--blobPort',
        '10000',
        '--location',
        '/tmp/azurite',
        '--disableProductStyleUrl',
        '--disableTelemetry',
      ],
    ],
  }
  const [command, args] = commands[mode]
  const child = spawn(command, args, { env, stdio: 'inherit', shell: false })
  process.exitCode = await supervise(child)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error('Preview runtime initialization failed')
    process.exitCode = 1
  })
}
