import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapTokenFromUrl,
  createAuthedFetch,
  getStoredAuthToken,
} from '../src/clientAuth.js'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

describe('Client auth helpers', () => {
  const originalFetch = globalThis.fetch
  const originalSessionStorage = (
    globalThis as { sessionStorage?: StorageLike }
  ).sessionStorage

  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    })
    vi.restoreAllMocks()
  })

  describe('getStoredAuthToken', () => {
    it('reads the token from sessionStorage', () => {
      ;(globalThis as { sessionStorage: StorageLike }).sessionStorage.setItem(
        'participant_token',
        'token-1'
      )

      expect(getStoredAuthToken('participant_token')).toBe('token-1')
    })

    it('returns null when sessionStorage is missing or throws', () => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: undefined,
      })
      expect(getStoredAuthToken('participant_token')).toBeNull()

      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
          getItem: () => {
            throw new Error('blocked')
          },
        },
      })
      expect(getStoredAuthToken('participant_token')).toBeNull()
    })
  })

  describe('createAuthedFetch', () => {
    it('passes through unchanged when no stored token exists', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
      const authedFetch = createAuthedFetch('participant_token')
      const init: RequestInit = { method: 'POST' }

      await authedFetch('/api/test', init)

      expect(fetchMock).toHaveBeenCalledWith('/api/test', init)
    })

    it('attaches Authorization from storage without overwriting callers', async () => {
      ;(globalThis as { sessionStorage: StorageLike }).sessionStorage.setItem(
        'participant_token',
        'token-1'
      )
      const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
      const authedFetch = createAuthedFetch('participant_token')

      await authedFetch('/api/test')
      await authedFetch('/api/test', {
        headers: { Authorization: 'Bearer caller-token' },
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      const firstInit = fetchMock.mock.calls[0]![1] as RequestInit
      expect(new Headers(firstInit.headers).get('authorization')).toBe(
        'Bearer token-1'
      )

      const secondInit = fetchMock.mock.calls[1]![1] as RequestInit
      expect(new Headers(secondInit.headers).get('authorization')).toBe(
        'Bearer caller-token'
      )
    })

    it('accepts multiple storage keys and uses the first available token', async () => {
      ;(globalThis as { sessionStorage: StorageLike }).sessionStorage.setItem(
        'secondary_token',
        'token-2'
      )
      const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
      const authedFetch = createAuthedFetch([
        'primary_token',
        'secondary_token',
      ])

      await authedFetch('/api/test')

      const init = fetchMock.mock.calls[0]![1] as RequestInit
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer token-2'
      )
    })
  })

  describe('bootstrapTokenFromUrl', () => {
    it('stores a query token and returns stripped params', () => {
      const stripped = bootstrapTokenFromUrl(
        new URLSearchParams('participantToken=token-1&foo=bar'),
        {
          storageKey: 'participant_token',
          queryKey: 'participantToken',
        }
      )

      expect(getStoredAuthToken('participant_token')).toBe('token-1')
      expect(stripped?.toString()).toBe('foo=bar')
    })

    it('returns null when the query token is absent or cannot be stored', () => {
      expect(
        bootstrapTokenFromUrl(new URLSearchParams('foo=bar'), {
          storageKey: 'participant_token',
          queryKey: 'participantToken',
        })
      ).toBeNull()

      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
          setItem: () => {
            throw new Error('blocked')
          },
        },
      })

      expect(
        bootstrapTokenFromUrl(
          new URLSearchParams('participantToken=token-1&foo=bar'),
          {
            storageKey: 'participant_token',
            queryKey: 'participantToken',
          }
        )
      ).toBeNull()

      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: undefined,
      })

      expect(
        bootstrapTokenFromUrl(
          new URLSearchParams('participantToken=token-1&foo=bar'),
          {
            storageKey: 'participant_token',
            queryKey: 'participantToken',
          }
        )
      ).toBeNull()
    })
  })
})
