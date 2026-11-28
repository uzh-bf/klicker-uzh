import { afterEach, describe, expect, test, vi } from 'vitest'
import { getChatBaseUrl, getPwaBaseUrl } from '../src/lib/server/publicUrls'

afterEach(() => vi.unstubAllEnvs())

describe('public base URLs', () => {
  test('prefer the runtime setting over the build-time value', () => {
    vi.stubEnv('CHAT_PUBLIC_PWA_URL', 'https://runtime.test/')
    vi.stubEnv('NEXT_PUBLIC_PWA_URL', 'https://build.test')
    expect(getPwaBaseUrl()).toBe('https://runtime.test')
  })

  test('fall back to the build-time value, then the default', () => {
    vi.stubEnv('CHAT_PUBLIC_URL', '')
    vi.stubEnv('NEXT_PUBLIC_CHAT_URL', 'https://build.test/')
    expect(getChatBaseUrl()).toBe('https://build.test')

    vi.stubEnv('NEXT_PUBLIC_CHAT_URL', '')
    expect(getChatBaseUrl()).toBe('https://chat.klicker.uzh.ch')
  })
})
