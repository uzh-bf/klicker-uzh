import { CHAT_GUEST_SESSION_STORAGE_KEY } from '@/src/hooks/useChatGuestTokenBootstrap'
import { authedFetch } from '@/src/lib/client/authedFetch'
import { PWA_CHAT_EMBED_SESSION_STORAGE_KEY } from '@/src/lib/pwaEmbedAuth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('authedFetch', () => {
  let originalFetch: typeof globalThis.fetch
  const originalSessionStorage = globalThis.sessionStorage

  beforeEach(() => {
    originalFetch = globalThis.fetch
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        length: 0,
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

  it('passes through to fetch unchanged when sessionStorage has no token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    await authedFetch('/api/test', { method: 'GET' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init?.headers)
    expect(headers.has('authorization')).toBe(false)
  })

  it('attaches Authorization: Bearer when sessionStorage has a token', async () => {
    sessionStorage.setItem(CHAT_GUEST_SESSION_STORAGE_KEY, 'tkn-1')
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    await authedFetch('/api/test')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer tkn-1')
  })

  it('prefers the scoped PWA embed token over stale guest fallback storage', async () => {
    sessionStorage.setItem(CHAT_GUEST_SESSION_STORAGE_KEY, 'guest-token')
    sessionStorage.setItem(PWA_CHAT_EMBED_SESSION_STORAGE_KEY, 'pwa-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    await authedFetch('/api/test')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer pwa-token')
  })

  it.each([
    '',
    'https://chat-api.synthetic.localhost',
  ])('preserves scoped transport for the selected origin %s', async (origin) => {
    const { fetchChatApi } = await import('../src/lib/api/types')
    vi.stubGlobal('document', {
      documentElement: { dataset: { chatApiUrl: origin } },
    })
    sessionStorage.setItem(
      PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
      'synthetic-embed-token'
    )
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    globalThis.fetch = fetchMock
    await fetchChatApi('/api/chatbots/synthetic/threads')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${origin}/api/chatbots/synthetic/threads`
    )
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(options.headers).get('authorization')).toBe(
      'Bearer synthetic-embed-token'
    )
    expect(options.credentials).toBe(origin ? 'include' : undefined)
  })

  it.each([
    'https://chat-api.synthetic.localhost/path',
    'data:text/plain,synthetic',
    'https://chat-api.synthetic.localhost/?unexpected=1',
  ])('rejects invalid deployment origin %s before forwarding credentials', async (origin) => {
    const { fetchChatApi } = await import('../src/lib/api/types')
    vi.stubGlobal('document', {
      documentElement: { dataset: { chatApiUrl: origin } },
    })
    sessionStorage.setItem(
      CHAT_GUEST_SESSION_STORAGE_KEY,
      'synthetic-guest-token'
    )
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    expect(() => fetchChatApi('/api/chatbots/synthetic/threads')).toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not overwrite a caller-provided Authorization header', async () => {
    sessionStorage.setItem(CHAT_GUEST_SESSION_STORAGE_KEY, 'tkn-1')
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    await authedFetch('/api/test', {
      headers: { Authorization: 'Bearer caller-supplied' },
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer caller-supplied')
  })
})
