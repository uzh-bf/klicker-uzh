import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import {
  CONTROL_NATIVE_ORIGINS,
  type ControlNativeSource,
  nativePasswordDigest,
  signControlNativeToken,
  signJWT,
  verifyJWT,
} from '@klicker-uzh/util'
import cors from 'cors'
import express, { type Express } from 'express'
import prepareApp from '../src/app.js'
import { createControlNativeAuth } from '../src/controlNativeAuth.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222'
const LOGIN_ID = '33333333-3333-4333-8333-333333333333'
const PASSWORD_HASH = 'synthetic-only-password-hash'
const APP_SECRET = randomBytes(32).toString('hex')
const AUTH_ORIGIN = 'https://auth.example.invalid'
const NATIVE_ORIGIN = CONTROL_NATIVE_ORIGINS[0]
interface UserDouble {
  id: string
  role: string
  catalystInstitutional: boolean
  catalystIndividual: boolean
}
interface AccountDouble {
  id: string
  userId: string
  isVerified: boolean
  type: string
}
interface LoginDouble {
  id: string
  userId: string
  password: string
  scope: string
}
type PrismaDouble = Parameters<typeof createControlNativeAuth>[0]['prisma']
async function nativeToken({
  source = { kind: 'institutional', id: ACCOUNT_ID },
  scope = 'SESSION_EXEC',
  now = Date.now(),
}: {
  source?: ControlNativeSource
  scope?: 'SESSION_EXEC' | 'READ_ONLY'
  now?: number
} = {}) {
  return (
    await signControlNativeToken(
      { sub: USER_ID, source, scope },
      APP_SECRET,
      AUTH_ORIGIN,
      now
    )
  ).access_token
}

function createPrisma({
  user = {
    id: USER_ID,
    role: UserRole.USER,
    catalystInstitutional: true,
    catalystIndividual: false,
  },
  account = {
    id: ACCOUNT_ID,
    userId: USER_ID,
    isVerified: true,
    type: 'oauth',
  },
  login = {
    id: LOGIN_ID,
    userId: USER_ID,
    password: PASSWORD_HASH,
    scope: UserLoginScope.SESSION_EXEC,
  },
}: {
  user?: UserDouble | null
  account?: AccountDouble | null
  login?: LoginDouble | null
} = {}) {
  const queries = { user: 0, account: 0, userLogin: 0 }
  const prisma: PrismaDouble = {
    user: {
      async findUnique() {
        queries.user += 1
        return user
      },
    },
    account: {
      async findUnique() {
        queries.account += 1
        return account
      },
    },
    userLogin: {
      async findUnique() {
        queries.userLogin += 1
        return login
      },
    },
  }

  return { prisma, queries }
}

function createMiddlewareApp({
  prisma,
  appSecret = APP_SECRET,
}: {
  prisma: PrismaDouble
  appSecret?: string
}) {
  const app = express()
  const controlNative = createControlNativeAuth({
    prisma,
    appSecret,
    authOrigin: AUTH_ORIGIN,
  })
  let legacyCalls = 0
  app.use(controlNative.authenticateNative)
  app.use(
    controlNative.withCredentialedCors(
      cors({ origin: true, credentials: true })
    )
  )
  app.use(
    controlNative.withLegacyAuthentication((_req, _res, next) => {
      legacyCalls++
      next()
    })
  )
  app.all('/api/graphql', (req, res) => res.json({ user: req.locals.user }))
  app.get('/healthz', (_req, res) => res.send('OK'))
  return { app, getLegacyCalls: () => legacyCalls }
}

async function withServer(
  app: Express,
  run: (origin: string) => Promise<void>
) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function authorization(token: string) {
  return { Authorization: `Bearer ${token}`, Origin: NATIVE_ORIGIN }
}

test('uses fresh institutional authority and caps administrator permissions', async () => {
  const token = await nativeToken({ scope: 'READ_ONLY' })
  const { prisma, queries } = createPrisma({
    user: {
      id: USER_ID,
      role: UserRole.ADMIN,
      catalystInstitutional: true,
      catalystIndividual: true,
    },
  })
  const { app, getLegacyCalls } = createMiddlewareApp({ prisma })
  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/graphql`, {
      method: 'POST',
      headers: authorization(token),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      user: {
        sub: USER_ID,
        role: 'USER',
        scope: 'READ_ONLY',
        catalystInstitutional: true,
        catalystIndividual: true,
      },
    })
    assert.deepEqual(queries, { user: 1, account: 1, userLogin: 0 })
    assert.equal(getLegacyCalls(), 0)
  })
  await assert.rejects(verifyJWT(token, APP_SECRET))
})

test('rechecks delegated password, scope and ownership', async (t) => {
  const token = await nativeToken({
    source: {
      kind: 'delegated',
      id: LOGIN_ID,
      passwordDigest: nativePasswordDigest(PASSWORD_HASH, APP_SECRET),
    },
  })
  for (const [name, login, status] of [
    [
      'reduced scope',
      {
        id: LOGIN_ID,
        userId: USER_ID,
        password: PASSWORD_HASH,
        scope: 'READ_ONLY',
      },
      200,
    ],
    [
      'changed password',
      {
        id: LOGIN_ID,
        userId: USER_ID,
        password: 'changed',
        scope: 'SESSION_EXEC',
      },
      401,
    ],
    ['deleted login', null, 401],
    [
      'wrong owner',
      {
        id: LOGIN_ID,
        userId: ACCOUNT_ID,
        password: PASSWORD_HASH,
        scope: 'SESSION_EXEC',
      },
      401,
    ],
  ] as const)
    await t.test(name, async () => {
      const { prisma } = createPrisma({ login })
      const { app } = createMiddlewareApp({ prisma })
      await withServer(app, async (origin) => {
        const response = await fetch(`${origin}/api/graphql`, {
          headers: authorization(token),
        })
        assert.equal(response.status, status)
        if (status === 200)
          assert.equal(
            ((await response.json()) as { user: { scope: string } }).user.scope,
            'READ_ONLY'
          )
      })
    })
})

test('denies expired, forged, broad web and stale-account credentials without fallback', async (t) => {
  const token = await nativeToken()
  const expired = await nativeToken({ now: Date.now() - 31 * 86400_000 })
  const webToken = await signJWT(
    { sub: USER_ID, role: 'ADMIN', scope: 'ACCOUNT_OWNER' },
    APP_SECRET
  )
  for (const [name, credential, fixture] of [
    ['expired', expired, {}],
    ['forged', token.slice(0, -5) + 'wrong', {}],
    ['web credential', webToken, {}],
    [
      'unverified account',
      token,
      {
        account: {
          id: ACCOUNT_ID,
          userId: USER_ID,
          isVerified: false,
          type: 'oauth',
        },
      },
    ],
    ['deleted account', token, { account: null }],
    [
      'non-identity account',
      token,
      {
        account: {
          id: ACCOUNT_ID,
          userId: USER_ID,
          isVerified: true,
          type: 'affiliation',
        },
      },
    ],
    [
      'wrong current role',
      token,
      {
        user: {
          id: USER_ID,
          role: 'PARTICIPANT',
          catalystInstitutional: false,
          catalystIndividual: false,
        },
      },
    ],
  ] as const)
    await t.test(name, async () => {
      const { prisma } = createPrisma(fixture)
      const { app, getLegacyCalls } = createMiddlewareApp({ prisma })
      await withServer(app, async (origin) => {
        const response = await fetch(`${origin}/api/graphql`, {
          headers: {
            ...authorization(credential),
            Cookie: 'next-auth.session-token=valid-browser-cookie',
          },
        })
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), { error: 'Unauthorized' })
        assert.equal(getLegacyCalls(), 0)
      })
    })
})

test('denies wrong native transport and assessment, and retains cookie-free CORS', async () => {
  const token = await nativeToken()
  const { prisma } = createPrisma()
  const { app, getLegacyCalls } = createMiddlewareApp({ prisma })
  await withServer(app, async (origin) => {
    assert.equal(
      (await fetch(`${origin}/healthz`, { headers: authorization(token) }))
        .status,
      401
    )
    assert.equal(
      (
        await fetch(`${origin}/api/graphql`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: 'https://other.invalid',
          },
        })
      ).status,
      401
    )
    const prev = process.env.ASSESSMENT_MODE
    process.env.ASSESSMENT_MODE = 'true'
    try {
      assert.equal(
        (
          await fetch(`${origin}/api/graphql`, {
            headers: authorization(token),
          })
        ).status,
        401
      )
    } finally {
      if (prev === undefined) delete process.env.ASSESSMENT_MODE
      else process.env.ASSESSMENT_MODE = prev
    }
    const preflight = await fetch(`${origin}/api/graphql`, {
      method: 'OPTIONS',
      headers: {
        Origin: NATIVE_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    })
    assert.equal(preflight.status, 204)
    assert.equal(
      preflight.headers.get('access-control-allow-credentials'),
      null
    )
    const response = await fetch(`${origin}/api/graphql`, {
      headers: authorization(token),
    })
    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      NATIVE_ORIGIN
    )
    assert.equal(response.headers.get('access-control-allow-credentials'), null)
    assert.equal(getLegacyCalls(), 0)
  })
})

test('database unavailability fails closed without exposing details', async () => {
  const token = await nativeToken()
  const { prisma } = createPrisma()
  prisma.user.findUnique = async () => {
    throw new Error('synthetic database failure')
  }
  const { app, getLegacyCalls } = createMiddlewareApp({ prisma })
  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/graphql`, {
      headers: authorization(token),
    })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Service unavailable' })
    assert.equal(getLegacyCalls(), 0)
  })
})

test('prepareApp applies native authentication before legacy JWT selection', async () => {
  const previous = {
    assessmentMode: process.env.ASSESSMENT_MODE,
    appSecret: process.env.APP_SECRET,
    nodeEnv: process.env.NODE_ENV,
    authOrigin: process.env.APP_ORIGIN_AUTH,
  }
  process.env.NODE_ENV = 'test'
  process.env.ASSESSMENT_MODE = 'false'
  process.env.APP_SECRET = APP_SECRET
  process.env.APP_ORIGIN_AUTH = AUTH_ORIGIN

  const token = await nativeToken()
  const { prisma } = createPrisma()
  const { app } = prepareApp({
    prisma,
    redisExec: {},
    redisAssessmentExec: {},
  })

  try {
    await withServer(app, async (origin) => {
      const legacyCookie = await signJWT(
        {
          sub: USER_ID,
          role: UserRole.USER,
          scope: UserLoginScope.SESSION_EXEC,
          catalystInstitutional: true,
          catalystIndividual: false,
        },
        APP_SECRET
      )
      const legacyHeaders = {
        Cookie: `next-auth.session-token=${legacyCookie}`,
        Origin: 'https://control.example',
        'x-graphql-yoga-csrf': '1',
      }

      const legacyResponse = await fetch(
        `${origin}/api/graphql?query=%7B__typename%7D`,
        { headers: legacyHeaders }
      )
      assert.equal(legacyResponse.status, 200)

      const nativeWins = await fetch(
        `${origin}/api/graphql?query=%7B__typename%7D`,
        {
          headers: {
            ...legacyHeaders,
            Authorization: `Bearer ${token.slice(0, -5)}wrong`,
          },
        }
      )
      assert.equal(nativeWins.status, 401)

      const preflight = await fetch(`${origin}/api/graphql`, {
        method: 'OPTIONS',
        headers: {
          Origin: NATIVE_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers':
            'content-type,authorization,x-graphql-yoga-csrf',
        },
      })
      assert.equal(preflight.status, 204)
      assert.equal(
        preflight.headers.get('access-control-allow-credentials'),
        null
      )

      const nativeResponse = await fetch(
        `${origin}/api/graphql?query=%7B__typename%7D`,
        {
          headers: {
            ...authorization(token),
            'x-graphql-yoga-csrf': '1',
          },
        }
      )
      assert.equal(nativeResponse.status, 200)
      assert.deepEqual(await nativeResponse.json(), {
        data: { __typename: 'Query' },
      })
      assert.equal(
        nativeResponse.headers.get('access-control-allow-origin'),
        NATIVE_ORIGIN
      )
      assert.equal(
        nativeResponse.headers.get('access-control-allow-credentials'),
        null
      )

      const wrongEndpoint = await fetch(`${origin}/healthz`, {
        headers: authorization(token),
      })
      assert.equal(wrongEndpoint.status, 401)
      assert.deepEqual(await wrongEndpoint.json(), { error: 'Unauthorized' })
    })
  } finally {
    if (previous.assessmentMode === undefined)
      delete process.env.ASSESSMENT_MODE
    else process.env.ASSESSMENT_MODE = previous.assessmentMode
    if (previous.appSecret === undefined) delete process.env.APP_SECRET
    else process.env.APP_SECRET = previous.appSecret
    if (previous.authOrigin === undefined) delete process.env.APP_ORIGIN_AUTH
    else process.env.APP_ORIGIN_AUTH = previous.authOrigin
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous.nodeEnv
  }
})
