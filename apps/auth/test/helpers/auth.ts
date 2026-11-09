// Fixtures for the auth route-handler journeys.
//
// The audience-dispatch fixes can only be verified against the real next-auth
// handler: next-auth answers OAuth failures with its own returned redirects
// (core/routes/callback.js -> ${url}/error -> ${url}/signin) and resolves the
// destination of a successful callback from the callback-URL cookie before the
// application redirect callback is consulted. Unit tests of the helpers cannot
// show whether those two paths still reach the application configuration, so
// the regression journeys in auth-callback-journey.integration.test.ts and
// student-session.integration.test.ts import the actual route handlers and use
// the doubles below.
//
// A caller mocks exactly two modules with vi.mock: the Prisma client
// (`@klicker-uzh/prisma`, replaced by the recording double) and the
// account-handling helpers (`@/lib/helpers`, partially mocked onto the
// recording stubs while every other helper keeps its implementation). NextAuth
// itself, the local OpenID Connect provider and the JWT implementation all stay
// the real library code.
//
// The caller must set the environment before the handler module is imported:
// APP_ORIGIN_AUTH and APP_SECRET (validated by the handler module),
// NEXTAUTH_URL, NEXT_PUBLIC_EDUID_ID, EDUID_WELL_KNOWN, EDUID_CLIENT_ID and
// EDUID_CLIENT_SECRET (the provider is otherwise absent), plus
// NEXT_PUBLIC_ASSESSMENT_URL and the AUTH_*_ALLOWED_HOSTS lists for the
// redirect validation.

import crypto from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { NextApiRequest, NextApiResponse } from 'next'
import { vi } from 'vitest'

// --- fail-closed database and account-handling doubles ----------------------

export interface RecordedCall {
  path: string
  args: unknown[]
}

export const prismaCalls: RecordedCall[] = []
export const helperCalls: RecordedCall[] = []
export const prismaOverrides: Record<string, (...args: never[]) => unknown> = {}

function recordDatabaseCall(path: string, args: unknown[]): unknown {
  prismaCalls.push({ path, args })
  const override = prismaOverrides[path]
  if (override) return override(...(args as never[]))
  // Reaching the database from these journeys is always a defect: account
  // handling and session lookups are expected to run against the double.
  throw new Error(`auth test harness: unexpected database call "${path}"`)
}

// The recording double is a plain proxy rather than a tree of vi.fn() mocks:
// every unexpected property access has to stay callable and fail closed, and the
// journeys assert on the recorded call log below rather than on mock state.
function createPrismaRecorder(segments: string[]): unknown {
  const recorder = (...args: unknown[]) =>
    recordDatabaseCall(segments.join('.'), args)
  return new Proxy(recorder, {
    get: (_target, property) => {
      // "then" must stay undefined so the recorder is never awaited as a
      // thenable.
      if (typeof property !== 'string' || property === 'then') return undefined
      return createPrismaRecorder([...segments, property])
    },
  })
}

export const testPrisma = createPrismaRecorder([])

function unconfiguredCreateOrLinkParticipant(...args: unknown[]): never {
  helperCalls.push({ path: 'createOrLinkParticipant', args })
  throw new Error(
    'auth test harness: createOrLinkParticipant is not configured for this test'
  )
}

function unconfiguredCreateUserAffiliations(...args: unknown[]): never {
  helperCalls.push({ path: 'createUserAffiliations', args })
  throw new Error(
    'auth test harness: lecturer account handling must not run in this test'
  )
}

// The stubs are typed by their call signature rather than as mocks, because a
// journey replaces one with a plain function returning the value that test
// needs.
export interface AuthTestHelperStubs {
  createOrLinkParticipant: (...args: unknown[]) => unknown
  createUserAffiliations: (...args: unknown[]) => unknown
}

export const testHelpers: AuthTestHelperStubs = {
  createOrLinkParticipant: unconfiguredCreateOrLinkParticipant,
  createUserAffiliations: unconfiguredCreateUserAffiliations,
}

export function resetAuthTestState(): void {
  prismaCalls.length = 0
  helperCalls.length = 0
  for (const key of Object.keys(prismaOverrides)) delete prismaOverrides[key]
  testHelpers.createOrLinkParticipant = unconfiguredCreateOrLinkParticipant
  testHelpers.createUserAffiliations = unconfiguredCreateUserAffiliations
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

export type AuthHandlerUnderTest = (
  req: NextApiRequest,
  res: NextApiResponse
) => unknown

function createRequestDouble(request: AuthTestRequest): NextApiRequest {
  return {
    method: request.method ?? 'GET',
    query: request.query ?? {},
    cookies: request.cookies ?? {},
    headers: request.headers ?? {},
    body: request.body,
  } as unknown as NextApiRequest
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

  return {
    res: res as unknown as NextApiResponse,
    state,
    headers,
  }
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

let cachedHandler: AuthHandlerUnderTest | undefined

// Imports the catch-all NextAuth route handler. The import stays dynamic so a
// caller can complete its environment and provider setup first.
export async function loadAuthHandler(): Promise<AuthHandlerUnderTest> {
  if (!cachedHandler) {
    const handlerModule = await import('../../src/pages/api/auth/[...nextauth]')
    cachedHandler = handlerModule.default as unknown as AuthHandlerUnderTest
  }
  return cachedHandler
}

export async function invokeApiHandler(
  handler: AuthHandlerUnderTest,
  request: AuthTestRequest
): Promise<AuthTestResult> {
  const req = createRequestDouble(request)
  const { res, state, headers } = createResponseDouble()

  const telemetry: Record<string, unknown>[] = []
  const consoleErrors: string[] = []
  const captureError = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '))
  }
  // The route handler reports one JSON telemetry line per decision through
  // console.log, and next-auth logs its own failures through console.error.
  // Both are captured instead of printed so a failing journey stays readable.
  const logSpy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => {
      const [first] = args
      if (typeof first === 'string' && first.startsWith('{')) {
        try {
          telemetry.push(JSON.parse(first) as Record<string, unknown>)
          return
        } catch {
          // Not a telemetry line; keep the message with the captured errors.
        }
      }
      captureError(...args)
    })
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(captureError)
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(captureError)

  try {
    await handler(req, res)
  } finally {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    warnSpy.mockRestore()
  }

  const locationHeader = headers.location
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
