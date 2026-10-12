import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  applyParticipantPageSession,
  getParticipantSessionGeneration,
  getParticipantSessionToken,
  invalidateParticipantSession,
  isSuccessfulParticipantSessionResult,
  resolveParticipantPageToken,
  setParticipantSessionToken,
} from './participantSession'

function installWindow(values = new Map<string, string>()) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  })
  return values
}

function removeWindow() {
  delete (globalThis as { window?: unknown }).window
}

it('never retains browser credentials in server state', () => {
  setParticipantSessionToken('server-token')
  assert.equal(getParticipantSessionToken(), null)
})

it('keeps only explicit credentials, ahead of any cookie session', () => {
  const values = installWindow()
  const explicit = {
    participantToken: 'participant-b',
    tokenSource: 'explicit' as const,
    sessionState: 'authenticated' as const,
  }
  const ambient = {
    participantToken: 'participant-a',
    tokenSource: 'ambient' as const,
    sessionState: 'authenticated' as const,
  }

  assert.equal(resolveParticipantPageToken(ambient), null)
  applyParticipantPageSession(ambient)
  assert.equal(values.has('participant_token'), false)

  assert.equal(resolveParticipantPageToken(explicit), 'participant-b')
  applyParticipantPageSession(explicit)
  assert.equal(values.get('participant_token'), 'participant-b')

  // A page without a launch, such as one inside a cookie-blocking frame,
  // keeps the credential this tab received.
  assert.equal(
    resolveParticipantPageToken({ sessionState: 'no_launch' }),
    'participant-b'
  )

  // A cookie session for another participant cannot replace the launch.
  assert.equal(resolveParticipantPageToken(ambient), 'participant-b')
  applyParticipantPageSession(ambient)
  assert.equal(values.get('participant_token'), 'participant-b')
  removeWindow()
})

it('ends the identity for rejected, unregistered, failed and reset launches', () => {
  installWindow()
  for (const page of [
    { sessionState: 'rejected' as const },
    { sessionState: 'registration_required' as const },
    { sessionState: 'exchange_unavailable' as const },
    { resetParticipantSession: true },
  ]) {
    setParticipantSessionToken('participant-b')
    const before = getParticipantSessionGeneration()
    assert.equal(resolveParticipantPageToken(page), null)
    applyParticipantPageSession(page)
    assert.equal(getParticipantSessionToken(), null)
    assert.ok(getParticipantSessionGeneration() > before)
  }
  removeWindow()
})

it('retains the credential in memory when session storage is denied', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get sessionStorage() {
        throw new Error('denied')
      },
    },
  })
  setParticipantSessionToken('participant-c')
  assert.equal(getParticipantSessionToken(), 'participant-c')
  invalidateParticipantSession()
  assert.equal(getParticipantSessionToken(), null)
  removeWindow()
})

it('recognizes only successful session-changing mutation results', () => {
  for (const result of [
    { data: { deleteParticipantAccount: false } },
    { data: { logoutParticipant: null } },
    { errors: [{}], data: { logoutParticipant: 'participant-b' } },
    { data: null },
  ]) {
    assert.equal(isSuccessfulParticipantSessionResult(result), false)
  }
  for (const data of [
    { deleteParticipantAccount: true },
    { logoutTemporaryParticipant: true },
    { logoutParticipant: 'participant-b' },
    { loginParticipant: 'participant-c' },
    { loginParticipantMagicLink: 'participant-c' },
    { activateParticipantAccount: 'participant-c' },
  ]) {
    assert.equal(isSuccessfulParticipantSessionResult({ data }), true)
  }
})

it('gives each participant binding its own Apollo cache', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const { initializeApollo } = await import('./apollo')
  installWindow()
  const state = {
    ROOT_QUERY: { __typename: 'Query', self: { __ref: 'Participant:a' } },
    'Participant:a': { __typename: 'Participant', id: 'a' },
  }
  const first = initializeApollo(state, undefined, {
    token: 'participant-a',
    key: '0:participant-a',
  })
  assert.equal(
    initializeApollo(undefined, undefined, {
      token: 'participant-a',
      key: '0:participant-a',
    }),
    first
  )
  const second = initializeApollo(undefined, undefined, {
    token: null,
    key: '1:',
  })
  assert.notEqual(second, first)
  assert.equal(second.extract()['Participant:a'], undefined)
  first.stop()
  second.stop()
  removeWindow()
})

for (const outcome of [
  'success',
  'unauthorized',
  'data-use',
  'login',
] as const) {
  it(`rejects retained-client work and delayed ${outcome} after logout`, {
    timeout: 5000,
  }, async (t) => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
    const previousEnvironment = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: 'development' })
    const { gql } = await import('@apollo/client')
    const { initializeApollo, hasExplicitParticipantSession } = await import(
      './apollo'
    )
    const { default: Router } = await import('next/router')
    const redirects = t.mock.method(Router, 'push', async () => true)
    const replacements = t.mock.method(Router, 'replace', async () => true)
    const values = installWindow()
    setParticipantSessionToken('participant-b')
    const requests: string[] = []
    let releaseOldResult!: (response: Response) => void
    let requestStarted!: () => void
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve
    })
    t.mock.method(
      globalThis,
      'fetch',
      async (_input: unknown, init?: RequestInit) => {
        const { operationName } = JSON.parse(String(init?.body))
        requests.push(operationName)
        if (
          operationName === 'QDelayedSelf' ||
          operationName === 'MDelayedLogin'
        ) {
          requestStarted()
          return new Promise<Response>((resolve) => {
            releaseOldResult = resolve
          })
        }
        return new Response(
          JSON.stringify({
            data:
              operationName === 'MLogoutParticipant'
                ? { logoutParticipant: 'participant-b' }
                : { self: { __typename: 'Participant', id: 'participant-a' } },
          }),
          {
            headers: { 'content-type': 'application/json' },
          }
        )
      }
    )
    const old = initializeApollo(undefined, undefined, {
      token: 'participant-b',
      key: `retirement:${outcome}:participant-b`,
    })
    let current: typeof old | undefined
    t.after(() => {
      old.stop()
      current?.stop()
      removeWindow()
      if (previousEnvironment === undefined)
        Reflect.deleteProperty(process.env, 'NODE_ENV')
      else Object.assign(process.env, { NODE_ENV: previousEnvironment })
    })
    assert.equal(hasExplicitParticipantSession(old), true)
    const delayed =
      outcome === 'login'
        ? old.mutate({
            mutation: gql`mutation MDelayedLogin { loginParticipant(usernameOrEmail: "synthetic", password: "synthetic") }`,
          })
        : old.query({
            query: gql`query QDelayedSelf { self { id __typename } }`,
            fetchPolicy: 'network-only',
          })
    const rejectedDelayed = assert.rejects(
      delayed,
      /Participant session changed/
    )
    await started
    await old.mutate({
      mutation: gql`mutation MLogoutParticipant { logoutParticipant }`,
    })
    assert.equal(getParticipantSessionToken(), null)
    assert.equal(values.has('participant_token'), false)
    const generation = getParticipantSessionGeneration()
    current = initializeApollo(undefined, undefined, {
      token: null,
      key: `retirement:${outcome}:cookie`,
    })
    assert.equal(hasExplicitParticipantSession(current), false)
    const self = gql`query QCurrentSelf { self { id __typename } }`
    assert.equal(
      (await current.query({ query: self, fetchPolicy: 'network-only' })).data
        .self.id,
      'participant-a'
    )
    releaseOldResult(
      new Response(
        JSON.stringify(
          outcome === 'login'
            ? { data: { loginParticipant: 'participant-b' } }
            : outcome === 'success'
              ? {
                  data: {
                    self: { __typename: 'Participant', id: 'participant-b' },
                  },
                }
              : {
                  errors: [
                    {
                      message:
                        outcome === 'unauthorized'
                          ? 'Unauthorized'
                          : 'Data use required',
                      extensions:
                        outcome === 'data-use'
                          ? { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' }
                          : { code: 'UNAUTHENTICATED' },
                    },
                  ],
                }
        ),
        {
          headers: { 'content-type': 'application/json' },
        }
      )
    )
    await rejectedDelayed
    old.stop()
    await assert.rejects(
      old.query({ query: self, fetchPolicy: 'network-only' }),
      /Participant session changed/
    )
    assert.deepEqual(requests, [
      outcome === 'login' ? 'MDelayedLogin' : 'QDelayedSelf',
      'MLogoutParticipant',
      'QCurrentSelf',
    ])
    assert.equal(
      current.readQuery<{ self: { id: string } }>({ query: self })?.self.id,
      'participant-a'
    )
    assert.equal(old.extract()['Participant:participant-b'], undefined)
    assert.equal(getParticipantSessionGeneration(), generation)
    assert.equal(redirects.mock.callCount(), 0)
    assert.equal(replacements.mock.callCount(), 0)
  })
}

it('does not retry a failed request after its participant binding retires', {
  timeout: 5000,
}, async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const previousEnvironment = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'development' })
  const { gql } = await import('@apollo/client')
  const { initializeApollo } = await import('./apollo')
  installWindow()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let attempts = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: unknown, init?: RequestInit) => {
      const { operationName } = JSON.parse(String(init?.body))
      if (operationName === 'QRetrySelf') {
        attempts += 1
        throw new Error('Synthetic transport failure')
      }
      return new Response(
        JSON.stringify({ data: { logoutParticipant: 'participant-b' } }),
        {
          headers: { 'content-type': 'application/json' },
        }
      )
    }
  )
  const client = initializeApollo(undefined, undefined, {
    token: 'participant-b',
    key: 'retry:participant-b',
  })
  t.after(() => {
    client.stop()
    removeWindow()
    if (previousEnvironment === undefined)
      Reflect.deleteProperty(process.env, 'NODE_ENV')
    else Object.assign(process.env, { NODE_ENV: previousEnvironment })
  })
  const pending = client.query({
    query: gql`query QRetrySelf { self { id } }`,
    fetchPolicy: 'network-only',
  })
  const rejected = assert.rejects(pending, /Participant session changed/)
  // Let the failed request schedule its retry, then retire before that timer.
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(attempts, 1)
  await client.mutate({
    mutation: gql`mutation MLogoutParticipant { logoutParticipant }`,
  })
  t.mock.timers.tick(3000)
  await rejected
  assert.equal(attempts, 1)
})
