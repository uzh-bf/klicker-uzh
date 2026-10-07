import assert from 'node:assert/strict'
import { it } from 'node:test'
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { signJWT } from '@klicker-uzh/util'
import type { GetServerSidePropsContext } from 'next'
import getParticipantToken from './getParticipantToken'

const secret = 'synthetic-participant-session-test-secret'
process.env.APP_SECRET = secret
process.env.COOKIE_DOMAIN = '127.0.0.1'

function context(query: GetServerSidePropsContext['query'], cookie = '') {
  const headers = new Map<string, string | string[] | number>()
  return {
    ctx: {
      query,
      req: { headers: { cookie } },
      res: {
        getHeader: (name: string) => headers.get(name),
        setHeader: (name: string, value: string | string[]) =>
          headers.set(name, value),
      },
    } as unknown as GetServerSidePropsContext,
    headers,
  }
}

it('exchanges a fresh explicit launch instead of an expired retained launch', async () => {
  const stale = await signJWT(
    {
      sub: 'synthetic-student',
      email: 'student@example.invalid',
      scope: 'LTI1.3',
    },
    secret,
    { expiresIn: -60 }
  )
  const fresh = await signJWT(
    {
      sub: 'synthetic-student',
      email: 'student@example.invalid',
      scope: 'LTI1.3',
    },
    secret,
    { expiresIn: '5m' }
  )
  const participantToken = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  let exchanged: string | undefined
  const client = {
    mutate: async ({ variables }: { variables: { signedLtiData: string } }) => {
      exchanged = variables.signedLtiData
      return { data: { loginParticipantWithLti: { participantToken } } }
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  const { ctx, headers } = context({ jwt: fresh }, `lti-token=${stale}`)
  const result = await getParticipantToken({ apolloClient: client, ctx })
  assert.equal(result.participantToken, participantToken)
  assert.equal(exchanged, fresh)
  assert.match(String(headers.get('Set-Cookie')), /Max-Age=1123200(?:;|,)/)
})

it('rejects malformed launches and unusable participant cookies instead of using an ambient account', async () => {
  const ambient = await signJWT(
    { sub: 'participant-a', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  const wrongRole = await signJWT(
    { sub: 'lecturer-a', role: 'LECTURER' },
    secret,
    { expiresIn: '14d' }
  )
  const otp = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT', scope: 'OTP' },
    secret,
    { expiresIn: '15m' }
  )
  const activation = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT', scope: 'ACTIVATION' },
    secret,
    { expiresIn: '60m' }
  )
  const expired = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: 1 }
  )
  const noExpiry = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret
  )
  const lti = await signJWT(
    { sub: 'student-b', email: 'b@example.invalid', scope: 'LTI1.3' },
    secret,
    { expiresIn: '5m' }
  )
  const client = {
    mutate: async () => {
      throw new Error('Must not exchange rejected handoff')
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  for (const [query, cookie] of [
    [{ jwt: ['', lti] }, ambient],
    [{ jwt: '' }, ambient],
    [{}, wrongRole],
    [{}, otp],
    [{}, activation],
    [{}, expired],
    [{}, noExpiry],
  ] as [GetServerSidePropsContext['query'], string][]) {
    const { ctx, headers } = context(query, `participant_token=${cookie}`)
    const result = await getParticipantToken({ apolloClient: client, ctx })
    assert.equal(result.sessionState, 'rejected')
    assert.equal(result.participantToken, null)
    assert.match(
      String(headers.get('Set-Cookie')),
      /participant_token=; Max-Age=0/
    )
  }
})

it('ignores participant tokens in the URL and keeps the ambient account', async () => {
  const ambient = await signJWT(
    { sub: 'participant-a', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  const other = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  const client = {
    mutate: async () => {
      throw new Error('Must not exchange a URL participant token')
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  for (const participantToken of [other, 'not-a-jwt', '', [other, other]]) {
    const { ctx, headers } = context(
      { participantToken },
      `participant_token=${ambient}`
    )
    const result = await getParticipantToken({ apolloClient: client, ctx })
    assert.equal(result.sessionState, 'authenticated')
    assert.equal(result.tokenSource, 'ambient')
    assert.equal(result.participantToken, ambient)
    assert.equal(headers.get('Set-Cookie'), undefined)
  }
  const { ctx } = context({ participantToken: other })
  const anonymous = await getParticipantToken({ apolloClient: client, ctx })
  assert.equal(anonymous.sessionState, 'no_launch')
  assert.equal(anonymous.participantToken, null)
})

it('returns one verified registration context and classifies exchange failure without exposing ambient identity', async () => {
  const fresh = await signJWT(
    { sub: 'student-b', email: 'b@example.invalid', scope: 'LTI1.3' },
    secret,
    { expiresIn: '5m' }
  )
  const missing = {
    mutate: async () => ({ data: { loginParticipantWithLti: null } }),
  } as unknown as ApolloClient<NormalizedCacheObject>
  const { ctx } = context({ jwt: fresh })
  const registration = await getParticipantToken({ apolloClient: missing, ctx })
  assert.equal(registration.sessionState, 'registration_required')
  assert.deepEqual(registration.signedLtiData, {
    token: fresh,
    ssoId: 'student-b',
    email: 'b@example.invalid',
  })
  const unavailable = {
    mutate: async () => {
      throw new Error('Synthetic network failure')
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  const result = await getParticipantToken({ apolloClient: unavailable, ctx })
  assert.equal(result.sessionState, 'exchange_unavailable')
  assert.equal(result.participantToken, null)
})

it('authenticates a linked LTI subject without email but refuses registration without email', async () => {
  const fresh = await signJWT(
    { sub: 'linked-student-b', scope: 'LTI1.3' },
    secret,
    { expiresIn: '5m' }
  )
  const participantToken = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  let exchanged: string | undefined
  const client = {
    mutate: async ({ variables }: { variables: { signedLtiData: string } }) => {
      exchanged = variables.signedLtiData
      return { data: { loginParticipantWithLti: { participantToken } } }
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  const { ctx } = context({ jwt: fresh })
  const result = await getParticipantToken({ apolloClient: client, ctx })
  assert.equal(result.sessionState, 'authenticated')
  assert.equal(result.participantToken, participantToken)
  assert.equal(exchanged, fresh)
  const missing = {
    mutate: async () => ({ data: { loginParticipantWithLti: null } }),
  } as unknown as ApolloClient<NormalizedCacheObject>
  const unlinked = await getParticipantToken({ apolloClient: missing, ctx })
  assert.equal(unlinked.sessionState, 'rejected')
  assert.equal(unlinked.participantToken, null)
  assert.equal(unlinked.signedLtiData, undefined)
})

it('never retains an exchanged session cookie beyond the signed session expiry', async () => {
  const launch = await signJWT(
    { sub: 'student-b', email: 'b@example.invalid', scope: 'LTI1.3' },
    secret,
    { expiresIn: '5m' }
  )
  const fresh = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '10m' }
  )
  const client = {
    mutate: async () => ({
      data: { loginParticipantWithLti: { participantToken: fresh } },
    }),
  } as unknown as ApolloClient<NormalizedCacheObject>
  const { ctx, headers } = context({ jwt: launch })
  await getParticipantToken({ apolloClient: client, ctx })
  const values = headers.get('Set-Cookie') as string[]
  const cookie = values.find((value) =>
    value.startsWith(`participant_token=${fresh}`)
  )
  assert.ok(cookie)
  const seconds = Number(cookie.match(/Max-Age=(\d+)/)?.[1])
  assert.ok(seconds > 0 && seconds <= 600)
  // The partitioned expiration precedes the new cookie so it cannot erase it.
  assert.ok(
    values.findIndex((value) => value.includes('; Partitioned')) <
      values.indexOf(cookie)
  )
})

it('retains assessment credential selection without applying regular participant verification', async () => {
  const previous = process.env.ASSESSMENT_MODE
  process.env.ASSESSMENT_MODE = 'true'
  try {
    const { ctx } = context(
      { participantToken: 'query-assessment-session' },
      'next-auth.participant-session-token=cookie-assessment-session'
    )
    const result = await getParticipantToken({
      apolloClient: {} as ApolloClient<NormalizedCacheObject>,
      ctx,
    })
    assert.equal(result.participantToken, 'cookie-assessment-session')
    assert.equal(result.cookiesAvailable, true)
  } finally {
    if (previous === undefined) delete process.env.ASSESSMENT_MODE
    else process.env.ASSESSMENT_MODE = previous
  }
})

it('rejects and expires a retained invalid participant cookie without a launch', async () => {
  const expired = await signJWT(
    { sub: 'participant-a', role: 'PARTICIPANT' },
    secret,
    { expiresIn: Math.floor(Date.now() / 1000) - 120 }
  )
  const { ctx, headers } = context({}, `participant_token=${expired}`)
  const result = await getParticipantToken({
    apolloClient: {} as ApolloClient<NormalizedCacheObject>,
    ctx,
  })
  assert.equal(result.sessionState, 'rejected')
  assert.equal(result.participantToken, null)
  const canonical = (headers.get('Set-Cookie') as string[]).find(
    (value) =>
      value.startsWith('participant_token=;') &&
      !value.includes('; Partitioned')
  )
  assert.ok(canonical)
  assert.ok(Number(canonical.match(/Max-Age=(-?\d+)/)?.[1]) <= 0)
})
