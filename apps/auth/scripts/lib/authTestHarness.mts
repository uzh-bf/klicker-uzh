// Harness for journeys that must run through the real NextAuth handler.
//
// The audience-dispatch fixes can only be verified against the library itself:
// next-auth answers OAuth failures with its own returned redirects
// (core/routes/callback.js -> ${url}/error -> ${url}/signin) and resolves the
// destination of a successful callback from the callback-URL cookie before the
// application redirect callback is consulted. Unit tests of the helpers cannot
// show whether those two paths still reach the application configuration, so
// the regression tests in scripts/testAuthCallbackJourney.mts and
// scripts/testStudentSession.mts import the actual route handler through this
// harness.
//
// It provides three things:
//   1. module hooks that resolve the app's "@/" alias and replace the Prisma
//      client and the account-handling helpers with recording stubs, so no
//      database and no network are involved;
//   2. a local OpenID Connect provider whose token endpoint can be made to
//      fail, so callbacks run through the real openid-client exchange;
//   3. request/response doubles good enough for next-auth's API handler,
//      including the Set-Cookie handling it performs.
//
// The caller must set the environment before the first invocation:
// APP_ORIGIN_AUTH and APP_SECRET (validated by the handler module), NEXTAUTH_URL,
// NEXT_PUBLIC_EDUID_ID, EDUID_WELL_KNOWN, EDUID_CLIENT_ID and
// EDUID_CLIENT_SECRET (the provider is otherwise absent), plus
// NEXT_PUBLIC_ASSESSMENT_URL and the AUTH_*_ALLOWED_HOSTS lists for the
// redirect validation.

import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import http from 'node:http'
import { registerHooks } from 'node:module'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HARNESS_URL = import.meta.url
const SCRIPTS_DIR = path.dirname(fileURLToPath(HARNESS_URL))
const SRC_DIR = path.resolve(SCRIPTS_DIR, '..', '..', 'src')
const HELPERS_URL = pathToFileURL(path.join(SRC_DIR, 'lib', 'helpers.ts')).href
const AUTH_HANDLER_URL = pathToFileURL(
  path.join(SRC_DIR, 'pages', 'api', 'auth', '[...nextauth].ts')
).href

const STUB_SCHEME = 'auth-test-stub'

// The application sources use the bundler's extension-less relative imports,
// which plain Node does not resolve.
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs']
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js']

function resolveSourceModule(basePath: string): string | undefined {
  for (const extension of SOURCE_EXTENSIONS) {
    if (existsSync(`${basePath}${extension}`)) return `${basePath}${extension}`
  }
  for (const indexFile of INDEX_FILES) {
    const candidate = path.join(basePath, indexFile)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

let hooksInstalled = false

export function installAuthTestModuleHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true

  // Synthesized modules are collected per stub URL, because the interop
  // wrappers below need the resolved location of the module they wrap.
  const stubSources = new Map<string, string>()
  const stubUrl = (id: string) => `${STUB_SCHEME}:${id}`

  const stubs: Record<string, string> = {
    prisma: [
      `import { testPrisma } from ${JSON.stringify(HARNESS_URL)}`,
      'export const prisma = testPrisma',
      'export default testPrisma',
    ].join('\n'),
    // Only the helpers the route handler imports are replaced; every other
    // helper keeps its implementation. Extend this list when the handler starts
    // importing more of the module.
    helpers: [
      `import { testHelpers } from ${JSON.stringify(HARNESS_URL)}`,
      `import * as real from ${JSON.stringify(HELPERS_URL)}`,
      'export const createOrLinkParticipant = (...args) =>',
      '  testHelpers.createOrLinkParticipant(...args)',
      'export const createUserAffiliations = (...args) =>',
      '  testHelpers.createUserAffiliations(...args)',
      'export const getStudentHosts = () => real.getStudentHosts()',
      'export const getLecturerHosts = () => real.getLecturerHosts()',
    ].join('\n'),
  }

  const stubIds = new Map([
    ['@klicker-uzh/prisma', 'prisma'],
    ['@/lib/helpers', 'helpers'],
  ])

  // next-auth is CommonJS, so its default import resolves to the module object
  // under plain Node instead of the exported function that bundlers hand to the
  // application. The wrapper restores that interop for the two default-only
  // imports of the route handler.
  const defaultInteropSpecifiers = [
    'next-auth',
    'next-auth/providers/credentials',
  ]

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (defaultInteropSpecifiers.includes(specifier)) {
        const resolved = nextResolve(specifier, context)
        const url = stubUrl(
          `default-${specifier.replace(/[^a-zA-Z0-9]+/g, '-')}`
        )
        stubSources.set(
          url,
          [
            `import target from ${JSON.stringify(resolved.url)}`,
            'const exported = target instanceof Function ? target : target.default',
            'export default exported',
          ].join('\n')
        )
        return { url, format: 'module', shortCircuit: true }
      }
      const stubId = stubIds.get(specifier)
      if (stubId) {
        const url = stubUrl(stubId)
        stubSources.set(url, stubs[stubId]!)
        return {
          url,
          format: 'module',
          shortCircuit: true,
        }
      }
      const base = specifier.startsWith('@/')
        ? path.join(SRC_DIR, specifier.slice(2))
        : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
          ? path.resolve(
              path.dirname(fileURLToPath(context.parentURL)),
              specifier
            )
          : undefined
      if (
        base &&
        (specifier.startsWith('@/') ||
          path.dirname(base).startsWith(SRC_DIR) ||
          path.dirname(base).startsWith(SCRIPTS_DIR))
      ) {
        const resolved = resolveSourceModule(base)
        if (resolved) {
          return { url: pathToFileURL(resolved).href, shortCircuit: true }
        }
      }
      return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
      const source = stubSources.get(url)
      if (source !== undefined) {
        return {
          format: 'module',
          source,
          shortCircuit: true,
        }
      }
      return nextLoad(url, context)
    },
  })
}

export interface RecordedCall {
  path: string
  args: unknown[]
}

export const prismaCalls: RecordedCall[] = []
export const helperCalls: RecordedCall[] = []
export const prismaOverrides: Record<string, (...args: never[]) => unknown> = {}

function createPrismaRecorder(segments: string[]): unknown {
  const call = (...args: unknown[]) => {
    const callPath = segments.join('.')
    prismaCalls.push({ path: callPath, args })
    const override = prismaOverrides[callPath]
    if (override) return override(...(args as never[]))
    // Reaching the database from these journeys is always a defect: account
    // handling and session lookups are expected to run against the stubs.
    throw new Error(`auth test harness: unexpected database call "${callPath}"`)
  }
  return new Proxy(call, {
    apply: (_target, _thisArg, args: unknown[]) => call(...args),
    get: (_target, property) => {
      // "then" must stay undefined so the recorder is never awaited as a
      // thenable.
      if (typeof property !== 'string' || property === 'then') return undefined
      return createPrismaRecorder([...segments, property])
    },
  })
}

export const testPrisma = createPrismaRecorder([])

export const testHelpers = {
  createOrLinkParticipant: (...args: unknown[]) => {
    helperCalls.push({ path: 'createOrLinkParticipant', args })
    throw new Error(
      'auth test harness: createOrLinkParticipant is not configured for this test'
    )
  },
  createUserAffiliations: (...args: unknown[]) => {
    helperCalls.push({ path: 'createUserAffiliations', args })
    throw new Error(
      'auth test harness: lecturer account handling must not run in this test'
    )
  },
}

export function resetAuthTestState(): void {
  prismaCalls.length = 0
  helperCalls.length = 0
  for (const key of Object.keys(prismaOverrides)) delete prismaOverrides[key]
}

// --- request and response doubles ------------------------------------------

export interface AuthTestRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  cookies?: Record<string, string>
  headers?: Record<string, string>
  body?: unknown
}

export interface AuthTestResult {
  statusCode: number
  location: string | undefined
  headers: Record<string, string | string[]>
  body: string
  jsonBody: unknown
  sessionCookies: Record<string, string>
  telemetry: Record<string, unknown>[]
  consoleErrors: string[]
}

function createResponseDouble() {
  const headers: Record<string, string | string[]> = {}
  const state = {
    statusCode: 200,
    body: '',
    jsonBody: undefined as unknown,
  }

  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    setHeader(name: string, value: string | string[] | number) {
      headers[name.toLowerCase()] = value as string | string[]
      return res
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()]
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()]
    },
    writeHead(code: number, extra?: Record<string, string>) {
      state.statusCode = code
      for (const [name, value] of Object.entries(extra ?? {})) {
        res.setHeader(name, value)
      }
      return res
    },
    end(chunk?: string) {
      if (typeof chunk === 'string') state.body = chunk
      return res
    },
    json(body: unknown) {
      state.jsonBody = body
      state.body = JSON.stringify(body)
      return res
    },
    send(body?: unknown) {
      if (body !== undefined) {
        state.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      return res
    },
  }

  return { res, state, headers }
}

function parseCookieHeaders(
  setCookieHeader: string | string[] | undefined
): Record<string, string> {
  const raw = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : []
  const cookies: Record<string, string> = {}
  for (const entry of raw) {
    const [pair] = entry.split(';')
    const separator = pair?.indexOf('=') ?? -1
    if (!pair || separator < 1) continue
    cookies[pair.slice(0, separator).trim()] = pair.slice(separator + 1)
  }
  return cookies
}

let cachedHandler:
  | ((req: unknown, res: unknown) => Promise<unknown>)
  | undefined

async function loadAuthHandler() {
  if (!cachedHandler) {
    const handlerModule = await import(AUTH_HANDLER_URL)
    cachedHandler = handlerModule.default
  }
  return cachedHandler!
}

export async function invokeApiHandler(
  handler: (req: unknown, res: unknown) => Promise<unknown>,
  request: AuthTestRequest
): Promise<AuthTestResult> {
  const req = {
    method: request.method ?? 'GET',
    query: request.query ?? {},
    cookies: request.cookies ?? {},
    headers: request.headers ?? {},
    body: request.body,
  }
  const { res, state, headers } = createResponseDouble()

  const telemetry: Record<string, unknown>[] = []
  const consoleErrors: string[] = []
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  // The route handler reports one JSON telemetry line per decision through
  // console.log, and next-auth logs its own failures through console.error.
  // Both are captured instead of printed so a failing journey stays readable.
  console.log = (...args: unknown[]) => {
    const [first] = args
    if (typeof first === 'string' && first.startsWith('{')) {
      try {
        telemetry.push(JSON.parse(first) as Record<string, unknown>)
        return
      } catch {
        // Not a telemetry line; keep the message with the captured errors.
      }
    }
    consoleErrors.push(args.map(String).join(' '))
  }
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '))
  }
  console.warn = console.error

  try {
    await handler(req, res)
  } finally {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
  }

  const locationHeader = headers['location']
  return {
    statusCode: state.statusCode,
    location: Array.isArray(locationHeader)
      ? locationHeader[0]
      : locationHeader,
    headers,
    body: state.body,
    jsonBody: state.jsonBody,
    sessionCookies: parseCookieHeaders(headers['set-cookie']),
    telemetry,
    consoleErrors,
  }
}

export async function invokeAuthHandler(
  request: AuthTestRequest
): Promise<AuthTestResult> {
  installAuthTestModuleHooks()
  const handler = await loadAuthHandler()
  return invokeApiHandler(handler, request)
}

// --- local OpenID Connect provider -----------------------------------------

export interface FakeIdentityProvider {
  issuer: string
  wellKnownUrl: string
  clientId: string
  tokenRequests: string[]
  clearTokenRequests(): void
  setTokenOutcome(outcome: 'invalid_grant' | 'success'): void
  setIdentity(identity: { sub: string; email: string }): void
  close(): Promise<void>
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export async function startFakeIdentityProvider(options: {
  clientId: string
}): Promise<FakeIdentityProvider> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  const keyId = 'auth-test-key'
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: keyId,
    alg: 'RS256',
    use: 'sig',
  }

  const state = {
    outcome: 'invalid_grant' as 'invalid_grant' | 'success',
    identity: { sub: 'test-participant', email: 'participant@example.edu' },
    tokenRequests: [] as string[],
  }
  let issuer = ''

  const signIdToken = () => {
    const now = Math.floor(Date.now() / 1000)
    const signed = [
      base64UrlJson({ alg: 'RS256', typ: 'JWT', kid: keyId }),
      base64UrlJson({
        iss: issuer,
        aud: options.clientId,
        sub: state.identity.sub,
        email: state.identity.email,
        iat: now,
        exp: now + 600,
      }),
    ].join('.')
    const signature = crypto
      .sign('RSA-SHA256', Buffer.from(signed), privateKey)
      .toString('base64url')
    return `${signed}.${signature}`
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const send = (status: number, body: unknown) => {
      const payload = JSON.stringify(body)
      response.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      })
      response.end(payload)
    }

    if (url.pathname === '/.well-known/openid-configuration') {
      return send(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
        ],
        code_challenge_methods_supported: ['S256'],
      })
    }
    if (url.pathname === '/jwks') {
      return send(200, { keys: [jwk] })
    }
    if (url.pathname === '/token' && request.method === 'POST') {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        state.tokenRequests.push(Buffer.concat(chunks).toString())
        if (state.outcome === 'invalid_grant') {
          return send(400, {
            error: 'invalid_grant',
            error_description: 'authorization code is invalid',
          })
        }
        send(200, {
          // Placeholder credential of the local provider; no caller reads it.
          access_token: 'placeholder-access-token',
          token_type: 'Bearer',
          expires_in: 300,
          id_token: signIdToken(),
        })
      })
      return
    }
    send(404, { error: 'not_found' })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  issuer = `http://127.0.0.1:${port}`

  return {
    issuer,
    wellKnownUrl: `${issuer}/.well-known/openid-configuration`,
    clientId: options.clientId,
    tokenRequests: state.tokenRequests,
    clearTokenRequests() {
      state.tokenRequests.length = 0
    },
    setTokenOutcome(outcome) {
      state.outcome = outcome
    },
    setIdentity(identity) {
      state.identity = identity
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    },
  }
}
