import { createHash, createHmac, randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  CONTROL_NATIVE_ORIGINS,
  type ControlNativeSource,
  type JWTPayload,
  nativePasswordDigest,
  verifyControlNativeToken,
  verifyJWT,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import Redis from 'ioredis'
import type { GetServerSidePropsContext } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { audienceCookieNames } from '../src/lib/authCookies'
import { MANAGER_COOKIE_NAME } from '../src/lib/constants'
import { decode, encode } from '../src/lib/jwt'
import * as nativeHandoffModule from '../src/lib/nativeHandoff'
import {
  NativeHandoff,
  nativeClientAddress,
  nativeEndpoint,
  nativeHash,
} from '../src/lib/nativeHandoff'
import NativeComplete, {
  getServerSideProps,
} from '../src/pages/native/complete'
import {
  type AuthTestRequest,
  invokeApiHandler,
  invokeAuthHandler,
  prismaCalls,
  prismaOverrides,
  resetAuthTestState,
  startFakeIdentityProvider,
} from './helpers/auth'

vi.mock('@klicker-uzh/prisma', async () => {
  const { testPrisma } = await import('./helpers/auth')
  return { prisma: testPrisma, default: testPrisma }
})

const secret = randomBytes(32).toString('hex')
const random = () => randomBytes(32).toString('base64url')
const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASS || undefined,
  tls: process.env.REDIS_TLS ? {} : undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
})
const touched = new Set<string>()
const user = { id: 'synthetic-native-owner', role: 'USER' }
let currentUser: typeof user | null = user
let login = {
  id: 'synthetic-native-login',
  userId: user.id,
  password: 'example-bcrypt-verifier',
  scope: 'SESSION_EXEC',
}
let currentLogin: typeof login | null = login
let account = {
  id: 'synthetic-account',
  userId: user.id,
  type: 'oauth',
  isVerified: true,
}
let currentAccount: typeof account | null = account
const database = {
  user: { findUnique: vi.fn(async () => currentUser) },
  userLogin: { findUnique: vi.fn(async () => currentLogin) },
  account: {
    findUnique: vi.fn(async () => currentAccount),
  },
} as unknown as PrismaClient
const service = new NativeHandoff(
  redis,
  database,
  secret,
  'https://auth.example.invalid'
)
const evidence = (
  source: ControlNativeSource = {
    kind: 'delegated',
    id: login.id,
    passwordDigest: nativePasswordDigest(login.password, secret),
  }
): JWTPayload => ({
  sub: user.id,
  role: 'USER',
  scope: 'SESSION_EXEC',
  controlNativeSource: source,
})

async function attempt(bindBrowser = true) {
  const state = random(),
    verifier = random(),
    cancelSecret = random()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const address = random()
  touched.add(
    `control-native:v1:rate:${createHmac('sha256', secret).update(address).digest('hex')}`
  )
  const created = await service.start(
    {
      client_id: 'klicker-control-v1',
      state,
      challenge,
      cancel_digest: nativeHash(cancelSecret),
    },
    address
  )
  touched.add(`control-native:v1:attempt:${created.transaction}`)
  const browser = random()
  const csrf = bindBrowser
    ? await service.bind(created.transaction, browser)
    : ''
  return { ...created, state, verifier, cancelSecret, browser, csrf }
}
async function approve(
  a: Awaited<ReturnType<typeof attempt>>,
  principal: JWTPayload
) {
  const callback = new URL(
    await service.approve(a.transaction, a.browser, a.csrf, principal)
  )
  const body = {
    transaction: a.transaction,
    state: a.state,
    verifier: a.verifier,
    code: callback.searchParams.get('code'),
    client_id: 'klicker-control-v1',
  }
  return { ...a, callback, body }
}
async function approved(principal = evidence()) {
  return approve(await attempt(), principal)
}

const boundaries = ['approval', 'exchange'] as const
async function pendingHandoff(
  boundary: (typeof boundaries)[number],
  principal = evidence()
) {
  const a = await attempt()
  if (boundary === 'approval') {
    return { ...a, finish: () => approve(a, principal) }
  }
  const handoff = await approve(a, principal)
  return { ...a, finish: () => service.exchange(handoff.body) }
}

async function expectIdentityDenial(
  handoff: Awaited<ReturnType<typeof pendingHandoff>>,
  boundary: (typeof boundaries)[number]
) {
  await expect(handoff.finish()).rejects.toMatchObject({ status: 401 })
  const stored = JSON.parse(
    (await redis.get(`control-native:v1:attempt:${handoff.transaction}`))!
  )
  expect(stored.status).toBe(boundary === 'approval' ? 'bound' : 'approved')
}
const cancel = (a: Awaited<ReturnType<typeof attempt>>) =>
  service.cancel({
    client_id: 'klicker-control-v1',
    transaction: a.transaction,
    cancel_secret: a.cancelSecret,
  })

beforeAll(async () => {
  await redis.connect()
  await redis.ping()
})
beforeEach(() => {
  currentUser = { ...user }
  login = {
    id: 'synthetic-native-login',
    userId: user.id,
    password: 'example-bcrypt-verifier',
    scope: 'SESSION_EXEC',
  }
  currentLogin = login
  account = {
    id: 'synthetic-account',
    userId: user.id,
    type: 'oauth',
    isVerified: true,
  }
  currentAccount = account
})
afterAll(async () => {
  try {
    const attempts = [...touched].filter((key) =>
      key.startsWith('control-native:v1:attempt:')
    )
    if (attempts.length)
      await redis.zrem('control-native:v1:active', ...attempts)
    if (touched.size) await redis.del(...touched)
  } finally {
    await redis.quit()
  }
})

describe('native handoff against real Redis', () => {
  test('issues a bounded JWT once without a persistent session record or callback credential', async () => {
    const a = await approved()
    expect(a.callback.protocol).toBe('ch.uzh.klicker.control:')
    expect(a.callback.searchParams.has('access_token')).toBe(false)
    const result = await service.exchange(a.body)
    const claims = await verifyControlNativeToken(
      result.access_token,
      secret,
      service.authOrigin
    )
    expect(claims.scope).toBe('SESSION_EXEC')
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60)
    expect(result.expires_at).toBe(claims.exp * 1000)
    await expect(verifyJWT(result.access_token, secret)).rejects.toThrow()
    const stored = JSON.parse(
      (await redis.get(`control-native:v1:attempt:${a.transaction}`))!
    )
    expect(stored.status).toBe('exchanged')
    expect(stored.principal).toBeUndefined()
    await expect(service.exchange(a.body)).rejects.toThrow()
  })
  test('wrong proof does not consume a valid handoff', async () => {
    const a = await approved()
    await expect(
      service.exchange({ ...a.body, verifier: random() })
    ).rejects.toThrow()
    await service.exchange(a.body)
  })
  test('concurrent exchanges issue at most one session', async () => {
    const a = await approved()
    const results = await Promise.allSettled([
      service.exchange(a.body),
      service.exchange(a.body),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })
  test('cancellation before exchange blocks issuance', async () => {
    const a = await approved()
    await cancel(a)
    await expect(service.exchange(a.body)).rejects.toThrow()
  })
  test('cancellation after exchange prevents replay but cannot revoke an issued JWT', async () => {
    const a = await approved()
    const result = await service.exchange(a.body)
    await cancel(a)
    await expect(
      verifyControlNativeToken(result.access_token, secret, service.authOrigin)
    ).resolves.toMatchObject({ sub: user.id })
    await expect(service.exchange(a.body)).rejects.toThrow()
  })
  test('cancel/exchange race never allows a second exchange', async () => {
    const a = await approved()
    const [issued] = await Promise.allSettled([
      service.exchange(a.body),
      cancel(a),
    ])
    if (issued.status === 'fulfilled')
      await expect(
        verifyControlNativeToken(
          issued.value.access_token,
          secret,
          service.authOrigin
        )
      ).resolves.toMatchObject({ sub: user.id })
    await expect(service.exchange(a.body)).rejects.toThrow()
  })
  test('rejects wrong browser, CSRF, state and cancelled late callbacks', async () => {
    const a = await attempt()
    await expect(
      service.approve(a.transaction, random(), a.csrf, evidence())
    ).rejects.toThrow()
    await expect(
      service.approve(a.transaction, a.browser, random(), evidence())
    ).rejects.toThrow()
    await cancel(a)
    await expect(
      service.approve(a.transaction, a.browser, a.csrf, evidence())
    ).rejects.toThrow()
    const b = await approved()
    await expect(
      service.exchange({ ...b.body, state: random() })
    ).rejects.toThrow()
  })
  test('rejects expired codes and attempts even while a Redis record exists', async () => {
    const a = await approved()
    const key = `control-native:v1:attempt:${a.transaction}`
    const stored = JSON.parse((await redis.get(key))!)
    await redis.set(
      key,
      JSON.stringify({ ...stored, codeDeadline: Date.now() - 1 }),
      'PX',
      10000
    )
    await expect(service.exchange(a.body)).rejects.toThrow()
    await redis.set(
      key,
      JSON.stringify({ ...stored, deadline: Date.now() - 1 }),
      'PX',
      10000
    )
    await expect(service.bind(a.transaction, a.browser)).rejects.toThrow()
  })
  test('rejects old browser evidence and reduced/changed delegated identities', async () => {
    await expect(
      service.principal({ sub: user.id, role: 'USER', scope: 'ACCOUNT_OWNER' })
    ).rejects.toThrow()
    const a = await approved()
    login.password = random()
    await expect(service.exchange(a.body)).rejects.toThrow()
    const b = await approved()
    login.scope = 'READ_ONLY'
    const result = await service.exchange(b.body)
    expect(
      (
        await verifyControlNativeToken(
          result.access_token,
          secret,
          service.authOrigin
        )
      ).scope
    ).toBe('READ_ONLY')
  })
  test('rejects participant, activation and unknown login scopes', async () => {
    for (const role of ['PARTICIPANT', 'TEMPORARY_PARTICIPANT']) {
      await expect(service.principal({ ...evidence(), role })).rejects.toThrow()
    }
    for (const scope of ['OTP', 'ACTIVATION', 'EDUID', 'unknown']) {
      await expect(
        service.principal({ ...evidence(), scope })
      ).rejects.toThrow()
    }
  })

  describe.each(boundaries)('current identity checks at %s', (boundary) => {
    test('a password change revokes authentication-time delegated evidence', async () => {
      const handoff = await pendingHandoff(boundary)
      login.password = random()
      await expectIdentityDenial(handoff, boundary)
    })

    test('a deleted delegated login cannot issue a session', async () => {
      const handoff = await pendingHandoff(boundary)
      currentLogin = null
      await expectIdentityDenial(handoff, boundary)
    })

    test.each([
      'unverified',
      'deleted',
      'affiliation',
    ] as const)('an %s institutional account cannot issue a session', async (state) => {
      const handoff = await pendingHandoff(
        boundary,
        evidence({ kind: 'institutional', id: account.id })
      )
      if (state === 'unverified') account.isVerified = false
      else if (state === 'deleted') currentAccount = null
      else account.type = 'affiliation'
      await expectIdentityDenial(handoff, boundary)
    })

    test.each([
      'PARTICIPANT',
      'TEMPORARY_PARTICIPANT',
    ])('a current %s user cannot issue a lecturer session', async (role) => {
      const handoff = await pendingHandoff(boundary)
      currentUser = { ...user, role }
      await expectIdentityDenial(handoff, boundary)
    })

    test.each([
      'OTP',
      'ACTIVATION',
      'EDUID',
    ])('a current %s delegated scope cannot issue a session', async (scope) => {
      const handoff = await pendingHandoff(boundary)
      login.scope = scope
      await expectIdentityDenial(handoff, boundary)
    })
  })

  test.each([
    'oauth',
    'oidc',
  ])('a verified %s identity can issue a session with the original scope ceiling', async (type) => {
    account.type = type
    const principal = {
      ...evidence({ kind: 'institutional', id: account.id }),
      scope: 'READ_ONLY',
    }
    const handoff = await approved(principal)
    const result = await service.exchange(handoff.body)
    expect(
      await verifyControlNativeToken(
        result.access_token,
        secret,
        service.authOrigin
      )
    ).toMatchObject({
      sub: user.id,
      source: { kind: 'institutional', id: account.id },
      scope: 'READ_ONLY',
    })
  })

  test.each([
    'PARTICIPANT',
    'TEMPORARY_PARTICIPANT',
    'OTP',
    'ACTIVATION',
  ])('%s browser evidence cannot approve a lecturer handoff', async (role) => {
    const handoff = await pendingHandoff('approval', { ...evidence(), role })
    await expectIdentityDenial(handoff, 'approval')
  })
})

async function invokeBroker(
  transaction: string,
  request: AuthTestRequest,
  form = ''
) {
  let props: Parameters<typeof NativeComplete>[0] | undefined
  let redirect: unknown
  const result = await invokeApiHandler(async (req, res) => {
    Object.defineProperty(res, 'statusCode', {
      set: (status: number) => res.status(status),
    })
    const outcome = await getServerSideProps({
      req: Object.assign(Readable.from([Buffer.from(form)]), req),
      res,
      query: { transaction },
      resolvedUrl: `/native/complete?transaction=${transaction}`,
    } as unknown as GetServerSidePropsContext)
    if ('redirect' in outcome) redirect = outcome.redirect
    else if ('props' in outcome) props = await outcome.props
  }, request)
  return { ...result, redirect, props: props! }
}

describe('native browser broker', () => {
  let restoreService: () => void
  beforeAll(() => {
    vi.stubEnv('APP_SECRET', secret)
    vi.stubEnv('APP_ORIGIN_AUTH', service.authOrigin)
    const factory = vi
      .spyOn(nativeHandoffModule, 'nativeHandoff')
      .mockResolvedValue(service)
    restoreService = () => factory.mockRestore()
  })
  afterAll(() => {
    restoreService()
    vi.unstubAllEnvs()
  })

  async function lecturerCookie() {
    return encode({
      token: { ...evidence(), email: 'lecturer@example.invalid' },
      secret,
    })
  }

  test('an unsigned browser goes directly to login while an ineligible session retains account recovery', async () => {
    const a = await attempt(false)
    const anonymous = await invokeBroker(a.transaction, { method: 'GET' })
    expect(anonymous.redirect).toMatchObject({
      destination: `/?nativeTransaction=${a.transaction}`,
      permanent: false,
    })
    const token = await encode({
      token: { sub: user.id, role: 'PARTICIPANT' },
      secret,
      maxAge: 300,
    })
    const stale = await invokeBroker(a.transaction, {
      method: 'GET',
      cookies: { [MANAGER_COOKIE_NAME]: token, ...anonymous.sessionCookies },
    })
    expect(stale.statusCode).toBe(200)
    expect(stale.props.failed).toBe(false)
    expect(stale.props.account).toBeNull()
  })

  test('preserves same-origin form approval with a host-only browser binding', async () => {
    const a = await attempt(false)
    const cookies = { [MANAGER_COOKIE_NAME]: await lecturerCookie() }
    const page = await invokeBroker(a.transaction, { method: 'GET', cookies })
    expect(page.statusCode).toBe(200)
    expect(page.props.failed).toBe(false)
    expect(page.props.autoContinue).toBe(false)
    expect(page.headers['referrer-policy']).toBe('same-origin')
    const formAction = (page.headers['content-security-policy'] as string)
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .find(([name]) => name === 'form-action')
    expect(new Set(formAction?.slice(1))).toEqual(
      new Set(["'self'", 'ch.uzh.klicker.control:'])
    )
    const providerProps = {
      locale: 'en' as const,
      timeZone: 'Europe/Zurich',
      messages: page.props.messages,
      onError: (error: Error) => {
        throw error
      },
      children: undefined,
    }
    const rendered = renderToStaticMarkup(
      React.createElement(
        NextIntlClientProvider,
        providerProps,
        React.createElement(NativeComplete, page.props)
      )
    )

    for (const locale of ['en', 'de'] as const) {
      const messages = (await import(`@klicker-uzh/i18n/messages/${locale}`))
        .default
      for (const branch of [
        { account: page.props.account, failed: false },
        { account: null, failed: false },
        { account: null, failed: true },
      ]) {
        renderToStaticMarkup(
          React.createElement(
            NextIntlClientProvider,
            { ...providerProps, locale, messages },
            React.createElement(NativeComplete, { ...page.props, ...branch })
          )
        )
      }
    }

    const cookieName = `__Host-control-native-${a.transaction}`
    const browser = page.sessionCookies[cookieName]!
    expect(browser).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const attributes = Object.fromEntries(
      (page.headers['set-cookie'] as string)
        .split(';')
        .slice(1)
        .map((attribute) => {
          const [name, ...value] = attribute.trim().split('=')
          return [name!.toLowerCase(), value.join('=') || true]
        })
    )
    expect(attributes).toMatchObject({
      path: '/',
      httponly: true,
      secure: true,
      samesite: 'Lax',
    })
    expect(attributes).not.toHaveProperty('domain')
    const key = `control-native:v1:attempt:${a.transaction}`
    expect(JSON.parse((await redis.get(key))!)).toMatchObject({
      status: 'bound',
      browserDigest: nativeHash(browser),
    })

    expect(rendered).toContain('method="post"')
    expect(rendered).toContain(`name="csrf" value="${page.props.csrf}"`)
    const approved = await invokeBroker(
      a.transaction,
      {
        method: 'POST',
        cookies: { ...cookies, [cookieName]: browser },
        headers: {
          origin: service.authOrigin,
          'content-type': 'application/x-www-form-urlencoded',
        },
      },
      new URLSearchParams({ csrf: page.props.csrf }).toString()
    )
    expect(approved.statusCode).toBe(303)
    expect(approved.props.failed).toBe(false)
    const callback = new URL(approved.location!)
    expect(callback.protocol).toBe('ch.uzh.klicker.control:')
    expect(callback.searchParams.get('state')).toBe(a.state)
    expect(callback.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(JSON.parse((await redis.get(key))!)).toMatchObject({
      status: 'approved',
      codeDigest: nativeHash(callback.searchParams.get('code')!),
    })
    expect(approved.sessionCookies[cookieName]).toBe('')
  })

  test.each([
    'wrong origin',
    'invalid CSRF',
  ] as const)('denies %s without approving the bound attempt', async (failure) => {
    const a = await attempt()
    const response = await invokeBroker(
      a.transaction,
      {
        method: 'POST',
        cookies: {
          [MANAGER_COOKIE_NAME]: await lecturerCookie(),
          [`__Host-control-native-${a.transaction}`]: a.browser,
        },
        headers: {
          origin:
            failure === 'wrong origin'
              ? 'https://other.example.invalid'
              : service.authOrigin,
          'content-type': 'application/x-www-form-urlencoded',
        },
      },
      new URLSearchParams({
        csrf: failure === 'invalid CSRF' ? random() : a.csrf,
      }).toString()
    )
    expect(response.statusCode).toBe(400)
    expect(response.props.failed).toBe(true)
    expect(response.location).toBeUndefined()
    const stored = JSON.parse(
      (await redis.get(`control-native:v1:attempt:${a.transaction}`))!
    )
    expect(stored.status).toBe('bound')
    expect(stored.codeDigest).toBeUndefined()
  })
})

describe('native start client-address quotas', () => {
  let endpointService: NativeHandoff
  beforeAll(async () => {
    vi.stubEnv('APP_SECRET', secret)
    vi.stubEnv('APP_ORIGIN_AUTH', service.authOrigin)
    endpointService = await nativeHandoffModule.nativeHandoff()
  })
  afterAll(async () => {
    await endpointService.redis.quit()
    vi.unstubAllEnvs()
  })
  beforeEach(() => {
    vi.stubEnv('CONTROL_NATIVE_TRUSTED_PROXY_CIDRS', '10.0.0.0/8')
    resetAuthTestState()
    prismaOverrides['user.findUnique'] = async () => currentUser
    prismaOverrides['userLogin.findUnique'] = async () => currentLogin
    prismaOverrides['account.findUnique'] = async () => currentAccount
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  const body = () => ({
    client_id: 'klicker-control-v1',
    state: random(),
    challenge: random(),
    cancel_digest: nativeHash(random()),
  })
  async function start(address: string) {
    touched.add(
      `control-native:v1:rate:${createHmac('sha256', secret).update(address).digest('hex')}`
    )
    const result = await invokeApiHandler(
      (req, res) => nativeEndpoint(req, res, 'start'),
      {
        method: 'POST',
        remoteAddress: '10.0.0.1',
        body: body(),
        headers: {
          origin: CONTROL_NATIVE_ORIGINS[0],
          'content-type': 'application/json',
          'x-forwarded-for': address,
        },
      }
    )
    if (result.statusCode === 200) {
      touched.add(
        `control-native:v1:attempt:${(result.jsonBody as { transaction: string }).transaction}`
      )
    }
    return result
  }

  const resolve = (
    remoteAddress: string | undefined,
    forwarded?: string,
    rawHeaders?: string[]
  ) =>
    nativeClientAddress({
      socket: { remoteAddress },
      headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
      rawHeaders:
        rawHeaders ??
        (forwarded === undefined ? [] : ['X-Forwarded-For', forwarded]),
    } as never)

  test('ignores spoofed forwarding from untrusted peers and direct mode', () => {
    expect(resolve('192.0.2.10', 'forged')).toBe('192.0.2.10')
    vi.stubEnv('CONTROL_NATIVE_TRUSTED_PROXY_CIDRS', '')
    expect(resolve('10.0.0.1', '192.0.2.10')).toBe('10.0.0.1')
  })
  test('walks trusted hops from the right and ignores claims beyond the first untrusted hop', () => {
    expect(resolve('10.0.0.1', 'forged, 192.0.2.10, 10.0.0.2')).toBe(
      '192.0.2.10'
    )
    expect(resolve('::ffff:10.0.0.1', '::ffff:192.0.2.10')).toBe('192.0.2.10')
    vi.stubEnv(
      'CONTROL_NATIVE_TRUSTED_PROXY_CIDRS',
      '::ffff:10.0.0.0/104,2001:db8:1::/48'
    )
    expect(resolve('2001:0db8:0001::1', '2001:0db8:2:0::1')).toBe(
      '2001:db8:2::1'
    )
    expect(resolve('::ffff:10.0.0.1', '192.0.2.10')).toBe('192.0.2.10')
  })
  test.each([
    undefined,
    '',
    ' ',
    ',',
    '192.0.2.10,',
    '10.0.0.2',
    '192.0.2.10:443',
    '[2001:db8::1]',
    'fe80::1%en0',
    '127.1',
    '0177.0.0.1',
    '0x7f000001',
    `192.0.2.10, ${'x'.repeat(4096)}`,
    Array.from({ length: 33 }, () => '10.0.0.2').join(','),
  ])('rejects unusable trusted forwarding %s', (forwarded) => {
    expect(() => resolve('10.0.0.1', forwarded)).toThrowError(
      expect.objectContaining({ status: 400 })
    )
  })
  test('rejects duplicate header occurrences even when Node joins them', () => {
    expect(() =>
      resolve('10.0.0.1', '192.0.2.1, 192.0.2.2', [
        'X-Forwarded-For',
        '192.0.2.1',
        'x-forwarded-for',
        '192.0.2.2',
      ])
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })
  test.each([
    '10.0.0.0',
    '0.0.0.0/0',
    '::/0',
    '::ffff:0.0.0.0/96',
    '10.0.0.0/33',
    '10.0.0.0/08',
    '127.1/8',
    '10.0.0.0/8,',
    '::ffff:10.0.0.0/95',
    '2001:db8::/129',
    'fe80::1%en0/64',
    '10.0.0.0/8/1',
    Array.from({ length: 65 }, () => '10.0.0.0/8').join(','),
    'x'.repeat(8193),
  ])('invalid trust configuration fails closed', (configured) => {
    vi.stubEnv('CONTROL_NATIVE_TRUSTED_PROXY_CIDRS', configured)
    expect(() => resolve('192.0.2.1')).toThrowError(
      expect.objectContaining({ status: 503 })
    )
  })
  test.each([
    undefined,
    'unknown',
    '127.1',
    'fe80::1%en0',
  ])('rejects unusable peer %s', (peer) => {
    expect(() => resolve(peer)).toThrowError(
      expect.objectContaining({ status: 503 })
    )
  })
  test('invalid trust blocks start while exchange and cancel still dispatch', async () => {
    vi.stubEnv('CONTROL_NATIVE_TRUSTED_PROXY_CIDRS', 'invalid')
    expect((await start('192.0.2.200')).statusCode).toBe(503)
    const a = await approved()
    const issued = await invokeApiHandler(
      (req, res) => nativeEndpoint(req, res, 'exchange'),
      {
        method: 'POST',
        headers: {
          origin: CONTROL_NATIVE_ORIGINS[0],
          'content-type': 'application/json',
        },
        body: a.body,
      }
    )
    expect(issued.statusCode).toBe(200)
    const result = await invokeApiHandler(
      (req, res) => nativeEndpoint(req, res, 'cancel'),
      {
        method: 'POST',
        headers: {
          origin: CONTROL_NATIVE_ORIGINS[0],
          'content-type': 'application/json',
        },
        body: {
          client_id: 'klicker-control-v1',
          transaction: a.transaction,
          cancel_secret: a.cancelSecret,
        },
      }
    )
    expect(result.statusCode).toBe(204)
  })

  test('clients behind a trusted proxy have independent twenty-start quotas', async () => {
    for (const address of ['192.0.2.101', '192.0.2.102']) {
      for (let i = 0; i < 20; i++) {
        expect((await start(address)).statusCode).toBe(200)
      }
      expect((await start(address)).statusCode).toBe(429)
    }
    for (const address of ['192.0.2.101', '192.0.2.102']) {
      const key = `control-native:v1:rate:${createHmac('sha256', secret).update(address).digest('hex')}`
      expect(await redis.pttl(key)).toBeGreaterThan(0)
      expect(await redis.pttl(key)).toBeLessThanOrEqual(5 * 60 * 1000)
    }
  })
})

describe('native endpoint HTTP guards', () => {
  beforeAll(() => {
    vi.stubEnv('APP_SECRET', '')
    vi.stubEnv('APP_ORIGIN_AUTH', 'https://auth.example.invalid')
  })
  afterAll(() => vi.unstubAllEnvs())

  const invoke = (request: AuthTestRequest) =>
    invokeApiHandler((req, res) => nativeEndpoint(req, res, 'start'), request)

  test.each([
    undefined,
    'null',
    '*',
    'https://example.invalid',
    'http://localhost',
    'https://localhost/',
    'capacitor://localhost.example.invalid',
  ])('rejects the non-allowlisted Origin %s before dispatch', async (origin) => {
    const result = await invoke({
      method: 'POST',
      headers: {
        ...(origin === undefined ? {} : { origin }),
        'content-type': 'application/json',
      },
      body: {},
    })
    expect(result.statusCode).toBe(403)
    expect(result.headers['access-control-allow-origin']).toBeUndefined()
    expect(result.headers['access-control-allow-credentials']).toBeUndefined()
    expect(result.headers['cache-control']).toBe('no-store')
    expect(result.headers.vary).toBe('Origin')
  })

  test.each(
    CONTROL_NATIVE_ORIGINS
  )('answers credential-free preflight for exactly %s', async (origin) => {
    const result = await invoke({
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, AUTHORIZATION',
      },
    })
    expect(result.statusCode).toBe(204)
    expect(result.headers['access-control-allow-origin']).toBe(origin)
    expect(result.headers['access-control-allow-methods']).toBe('POST')
    expect(result.headers['access-control-allow-headers']).toBe(
      'Content-Type, Authorization'
    )
    expect(result.headers['access-control-allow-credentials']).toBeUndefined()
    expect(result.headers['set-cookie']).toBeUndefined()
    expect(result.headers.vary).toBe('Origin')
  })

  test.each([
    { method: 'GET', headers: 'authorization' },
    { method: 'DELETE', headers: 'content-type' },
    { method: 'POST', headers: 'content-type,x-unapproved-header' },
    { method: 'POST', headers: 'x-graphql-yoga-csrf' },
  ])('rejects unapproved preflight $method / $headers', async (preflight) => {
    const result = await invoke({
      method: 'OPTIONS',
      headers: {
        origin: CONTROL_NATIVE_ORIGINS[0],
        'access-control-request-method': preflight.method,
        'access-control-request-headers': preflight.headers,
      },
    })
    expect(result.statusCode).toBe(403)
    expect(result.headers['access-control-allow-methods']).toBeUndefined()
    expect(result.headers['access-control-allow-headers']).toBeUndefined()
    expect(result.headers['access-control-allow-credentials']).toBeUndefined()
  })

  test.each([
    'GET',
    'PUT',
    'DELETE',
  ])('rejects the actual method %s', async (method) => {
    const result = await invoke({
      method,
      headers: { origin: CONTROL_NATIVE_ORIGINS[0] },
    })
    expect(result.statusCode).toBe(405)
    expect(result.headers.allow).toBe('POST, OPTIONS')
    expect(result.headers['access-control-allow-credentials']).toBeUndefined()
  })

  test.each([
    { name: 'missing', body: undefined },
    { name: 'null', body: null },
    { name: 'array', body: [] },
    { name: 'string', body: '{}' },
    { name: 'number', body: 1 },
    { name: 'boolean', body: true },
  ])('rejects a $name JSON body before dispatch', async ({ body }) => {
    const result = await invoke({
      method: 'POST',
      headers: {
        origin: CONTROL_NATIVE_ORIGINS[0],
        'content-type': 'application/json',
      },
      body,
    })
    expect(result.statusCode).toBe(400)
    expect(result.headers['cache-control']).toBe('no-store')
    expect(result.headers['access-control-allow-credentials']).toBeUndefined()
  })

  test.each([
    undefined,
    'text/plain',
    'application/x-www-form-urlencoded',
  ])('rejects an object body with content type %s', async (contentType) => {
    const result = await invoke({
      method: 'POST',
      headers: {
        origin: CONTROL_NATIVE_ORIGINS[0],
        ...(contentType === undefined ? {} : { 'content-type': contentType }),
      },
      body: {},
    })
    expect(result.statusCode).toBe(400)
  })
})

describe('lecturer credentials provenance through NextAuth', () => {
  const authOrigin = 'https://auth.example.invalid'
  beforeAll(() => {
    vi.stubEnv('APP_SECRET', secret)
    vi.stubEnv('APP_ORIGIN_AUTH', authOrigin)
    vi.stubEnv('NEXTAUTH_URL', authOrigin)
    vi.stubEnv('AUTH_SECURE_COOKIES', 'true')
    vi.stubEnv('EDUID_CLIENT_SECRET', undefined)
  })
  beforeEach(() => resetAuthTestState())
  afterAll(() => {
    resetAuthTestState()
    vi.unstubAllEnvs()
  })

  test('binds browser and native credentials to the login whose password matched', async () => {
    const password = random()
    login.password = await bcrypt.hash(password, 4)
    const otherLogin = {
      ...login,
      id: 'synthetic-other-login',
      password: await bcrypt.hash(random(), 4),
    }
    prismaOverrides['user.findUnique'] = async () => ({
      ...user,
      email: 'lecturer@example.invalid',
      shortname: 'native-test',
      logins: [otherLogin, login],
    })
    prismaOverrides['userLogin.update'] = async () => login
    const csrf = random()
    const csrfHash = createHash('sha256')
      .update(`${csrf}${secret}`)
      .digest('hex')
    const result = await invokeAuthHandler({
      method: 'POST',
      query: { nextauth: ['callback', 'credentials'] },
      headers: { host: 'auth.example.invalid' },
      cookies: { '__Host-next-auth.csrf-token': `${csrf}|${csrfHash}` },
      body: {
        csrfToken: csrf,
        identifier: 'native-test',
        password,
        callbackUrl: authOrigin,
        controlNativeSource: { kind: 'institutional', id: 'client-supplied' },
      },
    })

    expect(result.statusCode).toBe(302)
    expect(result.consoleErrors).toEqual([])
    const token = result.sessionCookies[MANAGER_COOKIE_NAME]
    expect(token).toBeTruthy()
    const principal = (await decode({ token, secret })) as JWTPayload
    const expectedSource = {
      kind: 'delegated',
      id: login.id,
      passwordDigest: nativePasswordDigest(login.password, secret),
    }
    expect(principal).toMatchObject({
      sub: user.id,
      role: 'USER',
      scope: login.scope,
      controlNativeSource: expectedSource,
    })
    expect(principal).not.toHaveProperty('password')
    expect(
      prismaCalls.find((call) => call.path === 'userLogin.update')?.args
    ).toEqual([
      { where: { id: login.id }, data: { lastLoginAt: expect.any(Date) } },
    ])

    const handoff = await approved(principal)
    const issued = await service.exchange(handoff.body)
    expect(
      (
        await verifyControlNativeToken(
          issued.access_token,
          secret,
          service.authOrigin
        )
      ).source
    ).toEqual(expectedSource)
  })

  async function signInFor(
    a: Awaited<ReturnType<typeof attempt>>,
    target: string,
    fromCookie = false,
    browser = a.browser
  ) {
    const password = random()
    login.password = await bcrypt.hash(password, 4)
    prismaOverrides['user.findUnique'] = async () => ({
      ...user,
      shortname: 'native-test',
      logins: [login],
    })
    prismaOverrides['userLogin.update'] = async () => login
    const csrf = random()
    const csrfHash = createHash('sha256')
      .update(`${csrf}${secret}`)
      .digest('hex')
    return invokeAuthHandler({
      method: 'POST',
      query: {
        nextauth: ['callback', 'credentials'],
        ...(!fromCookie ? { callbackUrl: `${authOrigin}/` } : {}),
      },
      headers: { host: 'auth.example.invalid' },
      cookies: {
        '__Host-next-auth.csrf-token': `${csrf}|${csrfHash}`,
        [`__Host-control-native-${a.transaction}`]: browser,
        [audienceCookieNames('lecturer', true).callbackUrl]: target,
      },
      body: {
        csrfToken: csrf,
        identifier: 'native-test',
        password,
        ...(!fromCookie ? { callbackUrl: target } : {}),
        controlNativeLogin: 'client-supplied',
      },
    })
  }

  test.each([
    false,
    true,
  ])('only fresh sign-in enables automatic return (callback cookie: %s)', async (fromCookie) => {
    const restore = vi
      .spyOn(nativeHandoffModule, 'nativeHandoff')
      .mockResolvedValue(service)
    try {
      const a = await attempt()
      // A conflicting query cannot override the credentials POST body.
      const result = await signInFor(
        a,
        `${authOrigin}/native/complete?transaction=${a.transaction}`,
        fromCookie
      )
      expect(result.consoleErrors).toEqual([])
      const token = result.sessionCookies[MANAGER_COOKIE_NAME]!
      const signed = (await decode({ token, secret }))!
      expect(signed.controlNativeLogin).toEqual(
        expect.stringMatching(/^[a-f0-9]{64}$/)
      )
      const cookies = {
        [MANAGER_COOKIE_NAME]: token,
        [`__Host-control-native-${a.transaction}`]: a.browser,
      }
      const page = await invokeBroker(a.transaction, { method: 'GET', cookies })
      expect(page.props.autoContinue).toBe(true)
      const renewed = await invokeAuthHandler({
        query: { nextauth: ['session'] },
        cookies,
      })
      const renewedToken = renewed.sessionCookies[MANAGER_COOKIE_NAME]!
      expect(
        (await decode({ token: renewedToken, secret }))?.controlNativeLogin
      ).toBe(signed.controlNativeLogin)
      const post = await invokeBroker(
        a.transaction,
        {
          method: 'POST',
          cookies,
          headers: {
            origin: authOrigin,
            'content-type': 'application/x-www-form-urlencoded',
          },
        },
        new URLSearchParams({ csrf: page.props.csrf }).toString()
      )
      expect(post.statusCode).toBe(303)
      const callback = new URL(post.location!)
      const issued = await service.exchange({
        client_id: 'klicker-control-v1',
        transaction: a.transaction,
        verifier: a.verifier,
        state: a.state,
        code: callback.searchParams.get('code'),
      })
      expect(
        (
          await verifyControlNativeToken(
            issued.access_token,
            secret,
            authOrigin
          )
        ).sub
      ).toBe(user.id)
      const b = await attempt()
      const reused = await invokeBroker(b.transaction, {
        method: 'GET',
        cookies: {
          [MANAGER_COOKIE_NAME]: renewedToken,
          [`__Host-control-native-${b.transaction}`]: b.browser,
        },
      })
      expect(reused.props.autoContinue).toBe(false)
      await expect(
        service.exchange({
          client_id: 'klicker-control-v1',
          transaction: a.transaction,
          verifier: a.verifier,
          state: a.state,
          code: callback.searchParams.get('code'),
        })
      ).rejects.toThrow()
    } finally {
      restore.mockRestore()
    }
  })

  test.each([
    (id: string) => `${authOrigin}/native/complete?transaction=${id}&extra=1`,
    (id: string) =>
      `${authOrigin}/native/complete?transaction=${id}&transaction=${id}`,
    (id: string) => `${authOrigin}/native/complete?transaction=${id}#fragment`,
    (id: string) =>
      `https://other.example.invalid/native/complete?transaction=${id}`,
    (id: string) => `${authOrigin}/?transaction=${id}`,
    (id: string) =>
      `https://user@auth.example.invalid/native/complete?transaction=${id}`,
  ])('does not authorize automatic completion for another callback target %#', async (target) => {
    const a = await attempt()
    const result = await signInFor(a, target(a.transaction))
    const signed = await decode({
      token: result.sessionCookies[MANAGER_COOKIE_NAME],
      secret,
    })
    expect(signed).toBeTruthy()
    expect(signed?.controlNativeLogin).toBeUndefined()
  })

  test('session renewal cannot mint fresh-login proof and changing accounts cannot reuse it', async () => {
    const a = await attempt()
    const cookieName = `__Host-control-native-${a.transaction}`
    const target = `${authOrigin}/native/complete?transaction=${a.transaction}`
    const unmarked = await encode({ secret, token: evidence() })
    const session = await invokeAuthHandler({
      query: { nextauth: ['session'], callbackUrl: target },
      cookies: { [MANAGER_COOKIE_NAME]: unmarked, [cookieName]: a.browser },
    })
    expect(
      (
        await decode({
          secret,
          token: session.sessionCookies[MANAGER_COOKIE_NAME],
        })
      )?.controlNativeLogin
    ).toBeUndefined()
    const fresh = await signInFor(a, target)
    const signed = (await decode({
      secret,
      token: fresh.sessionCookies[MANAGER_COOKIE_NAME],
    }))!
    expect(
      nativeHandoffModule.nativeLoginBinding(
        target,
        { [cookieName]: random() },
        user.id
      )
    ).not.toBe(signed.controlNativeLogin)
    expect(
      nativeHandoffModule.nativeLoginBinding(
        target,
        { [cookieName]: a.browser },
        'another-account'
      )
    ).not.toBe(signed.controlNativeLogin)
    const ordinary = await signInFor(a, authOrigin)
    expect(
      (
        await decode({
          secret,
          token: ordinary.sessionCookies[MANAGER_COOKIE_NAME],
        })
      )?.controlNativeLogin
    ).toBeUndefined()
  })

  test('missing browser binding cannot create fresh proof; completion rejects changed identity and expired attempts', async () => {
    const restore = vi
      .spyOn(nativeHandoffModule, 'nativeHandoff')
      .mockResolvedValue(service)
    try {
      const a = await attempt()
      const target = `${authOrigin}/native/complete?transaction=${a.transaction}`
      const absent = await signInFor(a, target, false, '')
      expect(
        (
          await decode({
            secret,
            token: absent.sessionCookies[MANAGER_COOKIE_NAME],
          })
        )?.controlNativeLogin
      ).toBeUndefined()
      const fresh = await signInFor(a, target)
      const signed = (await decode({
        secret,
        token: fresh.sessionCookies[MANAGER_COOKIE_NAME],
      }))!
      const cookieName = `__Host-control-native-${a.transaction}`
      const changed = await encode({
        secret,
        token: { ...signed, sub: 'other-account' },
      })
      const changedPage = await invokeBroker(a.transaction, {
        cookies: { [cookieName]: a.browser, [MANAGER_COOKIE_NAME]: changed },
      })
      expect(changedPage.props.autoContinue).toBe(false)
      const wrongBrowser = await invokeBroker(a.transaction, {
        cookies: {
          [cookieName]: random(),
          [MANAGER_COOKIE_NAME]: fresh.sessionCookies[MANAGER_COOKIE_NAME]!,
        },
      })
      expect(wrongBrowser.props.failed).toBe(true)
      const { raw, attempt: stored } = await service.read(a.transaction)
      await service.replace(a.transaction, raw, {
        ...stored,
        deadline: Date.now() - 1,
      })
      const expired = await invokeBroker(a.transaction, {
        cookies: {
          [cookieName]: a.browser,
          [MANAGER_COOKIE_NAME]: fresh.sessionCookies[MANAGER_COOKIE_NAME]!,
        },
      })
      expect(expired.props.failed).toBe(true)
      expect(expired.props.autoContinue).toBe(false)
    } finally {
      restore.mockRestore()
    }
  })

  test('OAuth uses its verified audience callback cookie despite conflicting query input', async () => {
    const provider = await startFakeIdentityProvider({
      clientId: 'native-oidc-test',
    })
    const fixture = {
      ...user,
      email: 'lecturer@example.invalid',
      shortname: 'native-test',
      firstLogin: false,
    }
    try {
      vi.stubEnv('NEXT_PUBLIC_EDUID_ID', 'eduid')
      vi.stubEnv('EDUID_CLIENT_ID', provider.clientId)
      vi.stubEnv('EDUID_CLIENT_SECRET', random())
      vi.stubEnv('EDUID_WELL_KNOWN', provider.wellKnownUrl)
      provider.setTokenOutcome('success')
      provider.setIdentity({
        sub: 'synthetic-provider-lecturer',
        email: fixture.email,
      })
      prismaOverrides['account.findUnique'] = async () => ({
        ...account,
        user: fixture,
      })
      prismaOverrides['user.update'] = async () => fixture
      prismaOverrides['user.findUnique'] = async () => fixture
      const a = await attempt()
      const names = audienceCookieNames('lecturer', true)
      const state = random()
      const cookieName = `__Host-control-native-${a.transaction}`
      const target = `${authOrigin}/native/complete?transaction=${a.transaction}`
      const temporary = (name: string, value: string) =>
        encode({
          secret,
          salt: name,
          token: { value, provider: 'eduid' },
          maxAge: 900,
        })
      const result = await invokeAuthHandler({
        query: {
          nextauth: ['callback', 'eduid'],
          code: 'synthetic-code',
          state,
          callbackUrl: `${authOrigin}/`,
        },
        cookies: {
          [cookieName]: a.browser,
          [names.callbackUrl]: target,
          [names.state]: await temporary(names.state, state),
          [names.pkceCodeVerifier]: await temporary(
            names.pkceCodeVerifier,
            random()
          ),
        },
      })
      expect(result.consoleErrors).toEqual([])
      expect(result.location).toBe(target)
      const signed = await decode({
        secret,
        token: result.sessionCookies[MANAGER_COOKIE_NAME],
      })
      expect(signed?.controlNativeLogin).toEqual(
        expect.stringMatching(/^[a-f0-9]{64}$/)
      )
      expect(signed?.controlNativeSource).toMatchObject({
        kind: 'institutional',
        id: account.id,
      })
    } finally {
      await provider.close()
      vi.stubEnv('EDUID_CLIENT_SECRET', undefined)
    }
  })
})
