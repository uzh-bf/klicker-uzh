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

it('rejects competing, repeated, expired and wrong-role handoffs instead of using an ambient account', async () => {
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
  for (const query of [
    { participantToken: wrongRole },
    { participantToken: otp },
    { participantToken: activation },
    { participantToken: expired },
    { participantToken: noExpiry },
    { participantToken: '' },
    { participantToken: [ambient, ambient] },
    { participantToken: ambient, jwt: lti },
    { jwt: ['', lti] },
    { jwt: '' },
  ]) {
    const { ctx, headers } = context(query, `participant_token=${ambient}`)
    const result = await getParticipantToken({ apolloClient: client, ctx })
    assert.equal(result.sessionState, 'rejected')
    assert.equal(result.participantToken, null)
    assert.match(
      String(headers.get('Set-Cookie')),
      /participant_token=; Max-Age=0/
    )
  }
})

it('verifies a participant handoff before replacing a different ambient participant and retains legacy expiration', async () => {
  const ambient = await signJWT(
    { sub: 'participant-a', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  const fresh = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '14d' }
  )
  const client = {
    mutate: async () => {
      throw new Error('Must not exchange participant handoff')
    },
  } as unknown as ApolloClient<NormalizedCacheObject>
  const { ctx, headers } = context(
    { participantToken: fresh },
    `participant_token=${ambient}`
  )
  const result = await getParticipantToken({ apolloClient: client, ctx })
  assert.equal(result.participantToken, fresh)
  assert.equal(result.tokenSource, 'explicit')
  const values = headers.get('Set-Cookie') as string[]
  assert.ok(
    values.findIndex((value) => value.includes('; Partitioned')) <
      values.findIndex((value) =>
        value.startsWith(`participant_token=${fresh}`)
      )
  )
  assert.match(String(values), /Partitioned/)
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

it('never retains a handoff cookie beyond the signed session expiry', async () => {
  const fresh = await signJWT(
    { sub: 'participant-b', role: 'PARTICIPANT' },
    secret,
    { expiresIn: '10m' }
  )
  const { ctx, headers } = context({ participantToken: fresh })
  await getParticipantToken({
    apolloClient: {} as ApolloClient<NormalizedCacheObject>,
    ctx,
  })
  const values = headers.get('Set-Cookie') as string[]
  const cookie = values.find((value) =>
    value.startsWith(`participant_token=${fresh}`)
  )
  assert.ok(cookie)
  const seconds = Number(cookie.match(/Max-Age=(\d+)/)?.[1])
  assert.ok(seconds > 0 && seconds <= 600)
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
