import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  acceptParticipantSession,
  adoptFrameSession,
  checkParticipantSession,
  completeParticipantSessionCommand,
  endFrameSession,
  frameSessionToken,
  hasLocalParticipantSessionChange,
  hasSharedParticipantCookies,
  isParticipantSessionStale,
  participantFetch,
  participantReloadUrl,
  participantSessionHeaders,
  subscribeParticipantSession,
} from '@klicker-uzh/shared-components/src/utils/participantSession'
import {
  getSafeRedirectPath,
  isSuccessfulParticipantSessionResult,
  navigateParticipantSession,
} from './participantSession'

function installDocument(cookie: string) {
  const doc = { cookie }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: doc,
  })
  return doc
}

function removeDocument() {
  delete (globalThis as { document?: unknown }).document
}

function installWindow(value: Record<string, unknown> = {}) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  })
}

function removeWindow() {
  delete (globalThis as { window?: unknown }).window
}

function restoreEnvironment(previousEnvironment: string | undefined) {
  if (previousEnvironment === undefined)
    Reflect.deleteProperty(process.env, 'NODE_ENV')
  else Object.assign(process.env, { NODE_ENV: previousEnvironment })
}

it('requires unpartitioned cookie access before an embedded login is usable', async () => {
  const frame = {}
  installWindow({ self: frame, top: frame })
  installDocument('')
  assert.equal(await hasSharedParticipantCookies(), true)
  installWindow({ self: frame, top: {} })
  assert.equal(await hasSharedParticipantCookies(), false)
  for (const granted of [false, true]) {
    Object.assign(document, { hasStorageAccess: async () => granted })
    assert.equal(await hasSharedParticipantCookies(), granted)
  }
  Object.assign(document, {
    hasStorageAccess: async () => {
      throw new Error('denied')
    },
  })
  assert.equal(await hasSharedParticipantCookies(), false)
  removeDocument()
  removeWindow()
})

it('authenticates a cookie-less frame with its own token and ignores the shared revision', async () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const frame = {}
  installWindow({ self: frame, top: {} })
  installDocument('')
  assert.equal(await hasSharedParticipantCookies(), false)
  installWindow({ self: frame, top: frame })
  installDocument('participant_session=shared')
  acceptParticipantSession()
  adoptFrameSession('ignored-top-level')
  assert.equal(frameSessionToken(), undefined)
  assert.equal(storage.size, 0)

  installWindow({ self: frame, top: {} })
  adoptFrameSession('frame-token')
  installDocument('participant_session=replaced')
  assert.deepEqual(participantSessionHeaders(), {
    authorization: 'Bearer frame-token',
  })
  assert.equal(checkParticipantSession(), true)

  // A later document in the same tab resumes the stored session.
  endFrameSession()
  storage.set('participant_token', 'frame-token')
  adoptFrameSession()
  assert.equal(frameSessionToken(), 'frame-token')
  endFrameSession()
  assert.equal(storage.size, 0)
  assert.equal(checkParticipantSession(), false)
  // A re-render with the same launch props does not revive the session.
  adoptFrameSession('frame-token')
  assert.equal(frameSessionToken(), undefined)

  delete (globalThis as { sessionStorage?: unknown }).sessionStorage
  removeDocument()
  removeWindow()
})

it('sends the bound revision, or the none marker without one', () => {
  const doc = installDocument('participant_session=rev-1')
  acceptParticipantSession()
  assert.deepEqual(participantSessionHeaders(), {
    'x-participant-session': 'rev-1',
  })
  doc.cookie = ''
  acceptParticipantSession()
  assert.deepEqual(participantSessionHeaders(), {
    'x-participant-session': 'none',
  })
  removeDocument()
})

it('marks and notifies a document whose revision another tab replaced', () => {
  const doc = installDocument('participant_session=rev-1')
  acceptParticipantSession()
  let notified = 0
  const unsubscribe = subscribeParticipantSession(() => {
    notified += 1
  })
  doc.cookie = 'participant_session=rev-2'
  assert.equal(checkParticipantSession(), false)
  assert.equal(notified, 1)
  assert.equal(isParticipantSessionStale(), true)
  assert.throws(
    () => participantSessionHeaders(),
    /Participant session changed/
  )
  unsubscribe()
  acceptParticipantSession()
  assert.equal(isParticipantSessionStale(), false)
  assert.deepEqual(participantSessionHeaders(), {
    'x-participant-session': 'rev-2',
  })
  removeDocument()
})

it('rejects an in-flight request and its response once the revision is replaced', async (t) => {
  const doc = installDocument('participant_session=rev-1')
  acceptParticipantSession()
  const requests: Headers[] = []
  let releaseResponse!: (response: Response) => void
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: unknown, init?: RequestInit) => {
      requests.push(new Headers(init?.headers))
      if (requests.length === 1) {
        return new Promise<Response>((resolve) => {
          releaseResponse = resolve
        })
      }
      return new Response('{}')
    }
  )
  const pending = participantFetch('/graphql', {
    headers: { 'x-synthetic': 'kept' },
  })
  doc.cookie = 'participant_session=rev-2'
  releaseResponse(new Response('{}'))
  await assert.rejects(pending, /Participant session changed/)
  assert.equal(requests[0]?.get('x-participant-session'), 'rev-1')
  assert.equal(requests[0]?.get('x-synthetic'), 'kept')

  // A stale document refuses new work before it reaches the network.
  await assert.rejects(
    participantFetch('/graphql'),
    /Participant session changed/
  )
  assert.equal(requests.length, 1)

  // Only accepting the replacement resumes work under the new revision.
  acceptParticipantSession()
  const response = await participantFetch('/graphql')
  assert.equal(response.status, 200)
  assert.equal(requests.length, 2)
  assert.equal(requests[1]?.get('x-participant-session'), 'rev-2')
  removeDocument()
})

it('drops launch parameters when a replaced document reloads', () => {
  installWindow({
    location: {
      href: 'https://pwa.klicker.localhost/course/1?jwt=launch&participantToken=old&token=legacy&keep=1',
    },
  })
  const url = new URL(participantReloadUrl())
  assert.equal(url.searchParams.has('jwt'), false)
  assert.equal(url.searchParams.has('participantToken'), false)
  assert.equal(url.searchParams.has('token'), false)
  assert.equal(url.searchParams.get('keep'), '1')
  assert.equal(url.pathname, '/course/1')
  removeWindow()
})

it('recognizes only successful session-changing mutation results', () => {
  for (const result of [
    { data: { deleteParticipantAccount: false } },
    { data: { logoutParticipant: null } },
    { data: { createParticipantAccount: { participantToken: null } } },
    { errors: [{}], data: { logoutParticipant: 'participant-b' } },
    { data: null },
  ]) {
    assert.equal(isSuccessfulParticipantSessionResult(result), false)
  }
  for (const data of [
    { createParticipantAccount: { participantToken: 'participant-d' } },
    { deleteParticipantAccount: true },
    { logoutTemporaryParticipant: true },
    { logoutParticipant: 'participant-b' },
    { loginParticipant: 'participant-c' },
    { loginTemporaryParticipant: 'participant-c' },
    { loginParticipantMagicLink: 'participant-c' },
    { activateParticipantAccount: 'participant-c' },
  ]) {
    assert.equal(isSuccessfulParticipantSessionResult({ data }), true)
  }
})

it('drops a delayed result and refuses new work on a replaced binding', {
  timeout: 5000,
}, async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const previousEnvironment = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'development' })
  const { gql } = await import('@apollo/client')
  const { initializeApollo } = await import('./apollo')
  const doc = installDocument('participant_session=rev-1')
  installWindow()
  t.after(() => {
    removeDocument()
    removeWindow()
    restoreEnvironment(previousEnvironment)
  })
  acceptParticipantSession()
  const requests: string[] = []
  let releaseDelayed!: (response: Response) => void
  let delayedStarted!: () => void
  const started = new Promise<void>((resolve) => {
    delayedStarted = resolve
  })
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: unknown, init?: RequestInit) => {
      const { operationName } = JSON.parse(String(init?.body))
      requests.push(operationName)
      if (operationName === 'QDelayedSelf') {
        delayedStarted()
        return new Promise<Response>((resolve) => {
          releaseDelayed = resolve
        })
      }
      if (operationName === 'MLogoutParticipant') {
        // The completed command replaces the shared revision.
        doc.cookie = 'participant_session=rev-2'
      }
      return new Response(
        JSON.stringify({
          data:
            operationName === 'MLogoutParticipant'
              ? { logoutParticipant: 'participant-b' }
              : { self: { __typename: 'Participant', id: 'participant-b' } },
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    }
  )
  const old = initializeApollo(undefined, undefined, { revision: 'rev-1' })
  const delayed = old.query({
    query: gql`query QDelayedSelf { self { id __typename } }`,
    fetchPolicy: 'network-only',
  })
  const rejectedDelayed = assert.rejects(delayed, /Participant session changed/)
  await started
  await old.mutate({
    mutation: gql`mutation MLogoutParticipant { logoutParticipant }`,
  })
  releaseDelayed(
    new Response(
      JSON.stringify({
        data: { self: { __typename: 'Participant', id: 'participant-a' } },
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  )
  await rejectedDelayed
  await assert.rejects(
    old.query({
      query: gql`query QNotSentSelf { self { id } }`,
      fetchPolicy: 'network-only',
    }),
    /Participant session changed/
  )
  assert.deepEqual(requests, ['QDelayedSelf', 'MLogoutParticipant'])
  // A new document initializes against the replacement cookie.
  acceptParticipantSession()
  const current = initializeApollo(undefined, undefined, { revision: 'rev-2' })
  assert.notEqual(current, old)
  const result = await current.query({
    query: gql`query QCurrentSelf { self { id } }`,
    fetchPolicy: 'network-only',
  })
  assert.equal(result.data?.self.id, 'participant-b')
  assert.deepEqual(requests, [
    'QDelayedSelf',
    'MLogoutParticipant',
    'QCurrentSelf',
  ])
  old.stop()
  current.stop()
})

it('does not retry a failed request once the shared revision is replaced', {
  timeout: 5000,
}, async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const previousEnvironment = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'development' })
  const { gql } = await import('@apollo/client')
  const { initializeApollo } = await import('./apollo')
  const doc = installDocument('participant_session=rev-1')
  installWindow()
  t.after(() => {
    removeDocument()
    removeWindow()
    restoreEnvironment(previousEnvironment)
  })
  acceptParticipantSession()
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
      doc.cookie = 'participant_session=rev-2'
      return new Response(
        JSON.stringify({ data: { logoutParticipant: 'participant-b' } }),
        { headers: { 'content-type': 'application/json' } }
      )
    }
  )
  const client = initializeApollo(undefined, undefined, { revision: 'rev-1' })
  const pending = client.query({
    query: gql`query QRetrySelf { self { id } }`,
    fetchPolicy: 'network-only',
  })
  const rejected = assert.rejects(pending, /Participant session changed/)
  // Let the failed request schedule its retry, then retire the binding.
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(attempts, 1)
  await client.mutate({
    mutation: gql`mutation MLogoutParticipant { logoutParticipant }`,
  })
  t.mock.timers.tick(3000)
  await rejected
  assert.equal(attempts, 1)
  client.stop()
})

it('sends a login once when the browser refuses its replacement cookie', {
  timeout: 5000,
}, async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const previousEnvironment = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'development' })
  const { gql } = await import('@apollo/client')
  const { initializeApollo } = await import('./apollo')
  installDocument('participant_session=rev-login')
  installWindow()
  t.after(() => {
    removeDocument()
    removeWindow()
    restoreEnvironment(previousEnvironment)
  })
  acceptParticipantSession()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let attempts = 0
  t.mock.method(globalThis, 'fetch', async () => {
    attempts += 1
    // The response succeeds, but the browser kept the old revision cookie.
    return new Response(
      JSON.stringify({ data: { loginParticipant: 'participant-b' } }),
      { headers: { 'content-type': 'application/json' } }
    )
  })
  const client = initializeApollo(undefined, undefined, {
    revision: 'rev-login',
  })
  const pending = assert.rejects(
    client.mutate({
      mutation: gql`mutation MLoginParticipant { loginParticipant }`,
    })
  )
  await new Promise<void>((resolve) => setImmediate(resolve))
  t.mock.timers.tick(10_000)
  await pending
  assert.equal(attempts, 1)
  client.stop()
})

it('gives a replacement revision its own client and cache', async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const previousEnvironment = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: 'development' })
  const { initializeApollo } = await import('./apollo')
  const doc = installDocument('participant_session=rev-1')
  installWindow()
  t.after(() => {
    removeDocument()
    removeWindow()
    restoreEnvironment(previousEnvironment)
  })
  acceptParticipantSession()
  const state = {
    ROOT_QUERY: { __typename: 'Query', self: { __ref: 'Participant:a' } },
    'Participant:a': { __typename: 'Participant', id: 'a' },
  }
  const first = initializeApollo(state, undefined, { revision: 'rev-1' })
  assert.equal(
    initializeApollo(undefined, undefined, { revision: 'rev-1' }),
    first
  )
  doc.cookie = 'participant_session=rev-2'
  acceptParticipantSession()
  const second = initializeApollo(undefined, undefined, { revision: 'rev-2' })
  assert.notEqual(second, first)
  assert.equal(second.extract()['Participant:a'], undefined)
  first.stop()
  second.stop()
})

it('keeps a completed command stale until a new document initializes', () => {
  const doc = installDocument('participant_session=before')
  acceptParticipantSession()
  let notified = 0
  const unsubscribe = subscribeParticipantSession(() => {
    notified += 1
  })
  doc.cookie = 'participant_session=after'
  completeParticipantSessionCommand()
  assert.equal(notified, 1)
  assert.equal(isParticipantSessionStale(), true)
  assert.equal(hasLocalParticipantSessionChange(), true)
  assert.throws(
    () => participantSessionHeaders(),
    /Participant session changed/
  )
  unsubscribe()
  acceptParticipantSession()
  assert.equal(hasLocalParticipantSessionChange(), false)
  assert.deepEqual(participantSessionHeaders(), {
    'x-participant-session': 'after',
  })
  removeDocument()
})

it('keeps locale, external destinations and history semantics on full navigation', () => {
  const calls: string[] = []
  installWindow({
    location: {
      origin: 'https://pwa.example.invalid',
      assign: (url: string) => calls.push(`push:${url}`),
      replace: (url: string) => calls.push(`replace:${url}`),
    },
  })
  const router = {
    locale: 'de',
    defaultLocale: 'en',
    locales: ['en', 'de'],
    basePath: '',
  } as unknown as Parameters<typeof navigateParticipantSession>[0]
  navigateParticipantSession(router, '/editProfile?newAccount=true', true)
  navigateParticipantSession(router, '/de/course/course-id')
  navigateParticipantSession(router, '/de?course=example#overview')
  navigateParticipantSession(router, 'https://chat.example.invalid/bot')
  assert.deepEqual(calls, [
    'replace:https://pwa.example.invalid/de/editProfile?newAccount=true',
    'push:https://pwa.example.invalid/de/course/course-id',
    'push:https://pwa.example.invalid/de?course=example#overview',
    'push:https://chat.example.invalid/bot',
  ])
  removeWindow()
})

it('keeps validated return paths on the PWA origin through native navigation', () => {
  const origin = 'https://pwa.example.invalid'
  const chat = 'https://chat.example.invalid'
  let destination = ''
  installWindow({
    location: {
      origin,
      assign: (url: string) => {
        destination = url
      },
    },
  })
  for (const locale of ['en', 'de']) {
    for (const basePath of ['', '/app']) {
      const router = {
        locale,
        defaultLocale: 'en',
        locales: ['en', 'de'],
        basePath,
      } as unknown as Parameters<typeof navigateParticipantSession>[0]
      const prefix = `${basePath}${locale === 'de' ? '/de' : ''}`
      for (const path of [
        '/editProfile?keep=1#overview',
        '//outside.example.invalid/phish?keep=1#overview',
        '///outside.example.invalid/phish?keep=1#overview',
      ]) {
        const validated = getSafeRedirectPath(`${origin}${path}`, origin, chat)
        navigateParticipantSession(router, validated)
        const target = new URL(destination, origin)
        assert.equal(target.origin, origin)
        assert.equal(target.pathname, `${prefix}${path.split('?')[0]}`)
        assert.equal(target.search, '?keep=1')
        assert.equal(target.hash, '#overview')
      }
      for (const rejected of [
        'https://outside.example.invalid/phish',
        '//outside.example.invalid/phish',
      ]) {
        navigateParticipantSession(
          router,
          getSafeRedirectPath(rejected, origin, chat)
        )
        assert.equal(destination, `${origin}${prefix}/`)
      }
      const chatDestination = `${chat}/bot?keep=1#overview`
      navigateParticipantSession(
        router,
        getSafeRedirectPath(chatDestination, origin, chat)
      )
      assert.equal(destination, chatDestination)
    }
  }
  removeWindow()
})
