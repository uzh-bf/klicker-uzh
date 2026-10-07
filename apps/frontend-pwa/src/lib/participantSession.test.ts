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
