import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  applyParticipantPageSession,
  getParticipantSessionRevision,
  getParticipantSessionToken,
  observeParticipantSessionResult,
  setParticipantSessionToken,
} from './participantSession'

it('never retains browser credentials in server state', () => {
  setParticipantSessionToken('server-token')
  assert.equal(getParticipantSessionToken(), null)
})

it('replaces stale state and preserves active identity across ambient navigation', () => {
  const values = new Map([['participant_token', 'participant-a']])
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
  assert.equal(getParticipantSessionToken(), 'participant-a')
  applyParticipantPageSession({
    participantToken: 'participant-b',
    tokenSource: 'explicit',
    sessionState: 'authenticated',
  })
  assert.equal(getParticipantSessionToken(), 'participant-b')
  assert.equal(values.get('participant_token'), 'participant-b')
  applyParticipantPageSession({
    participantToken: 'participant-a',
    tokenSource: 'ambient',
    sessionState: 'authenticated',
  })
  applyParticipantPageSession({ sessionState: 'no_launch' })
  assert.equal(getParticipantSessionToken(), 'participant-b')
  applyParticipantPageSession({ sessionState: 'rejected' })
  assert.equal(getParticipantSessionToken(), null)
  assert.equal(values.has('participant_token'), false)
})

it('retains memory when storage is denied and clears only successful mutation results', () => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('denied')
    },
  })
  const page = {
    participantToken: 'participant-b',
    tokenSource: 'explicit' as const,
    sessionState: 'authenticated' as const,
  }
  applyParticipantPageSession(page)
  assert.equal(getParticipantSessionToken(), 'participant-b')
  assert.equal(
    observeParticipantSessionResult({
      data: { deleteParticipantAccount: false },
    }),
    false
  )
  assert.equal(
    observeParticipantSessionResult({ data: { logoutParticipant: null } }),
    false
  )
  assert.equal(
    observeParticipantSessionResult({
      errors: [{}],
      data: { logoutParticipant: 'participant-b' },
    }),
    false
  )
  assert.equal(getParticipantSessionToken(), 'participant-b')
  assert.equal(
    observeParticipantSessionResult({
      data: { logoutParticipant: 'participant-b' },
    }),
    true
  )
  assert.equal(getParticipantSessionToken(), null)
  applyParticipantPageSession(page)
  assert.equal(getParticipantSessionToken(), null)
  for (const field of [
    'loginParticipant',
    'loginParticipantMagicLink',
    'activateParticipantAccount',
  ]) {
    const before = getParticipantSessionRevision()
    assert.equal(
      observeParticipantSessionResult({ data: { [field]: 'participant-c' } }),
      true
    )
    assert.ok(getParticipantSessionRevision() > before)
  }
  applyParticipantPageSession({
    participantToken: 'participant-c',
    tokenSource: 'explicit',
    sessionState: 'authenticated',
  })
  observeParticipantSessionResult({ data: { deleteParticipantAccount: true } })
  assert.equal(getParticipantSessionToken(), null)
  applyParticipantPageSession({
    participantToken: 'participant-c',
    tokenSource: 'explicit',
    sessionState: 'authenticated',
  })
  applyParticipantPageSession({ sessionState: 'registration_required' })
  assert.equal(getParticipantSessionToken(), null)
  delete (globalThis as { window?: unknown }).window
})

it('replaces the Apollo cache on identity changes and cannot rehydrate the former identity', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.invalid/api/graphql'
  const { initializeApollo } = await import('./apollo')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  })
  setParticipantSessionToken('participant-a')
  const first = initializeApollo({
    ROOT_QUERY: { __typename: 'Query', self: { __ref: 'Participant:a' } },
    'Participant:a': { __typename: 'Participant', id: 'a' },
  })
  assert.ok(first.extract()['Participant:a'])
  setParticipantSessionToken('participant-b')
  const second = initializeApollo(first.extract())
  assert.notEqual(second, first)
  assert.equal(second.extract()['Participant:a'], undefined)
  observeParticipantSessionResult({
    data: { logoutParticipant: 'participant-b' },
  })
  const anonymous = initializeApollo(second.extract())
  assert.notEqual(anonymous, second)
  assert.equal(getParticipantSessionToken(), null)
  first.stop()
  second.stop()
  anonymous.stop()
  delete (globalThis as { window?: unknown }).window
})
