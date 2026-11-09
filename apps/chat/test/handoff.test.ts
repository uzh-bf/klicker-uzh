import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HANDOFF_SOURCE_STORAGE_KEY,
  readHandoffSource,
  rememberHandoffSource,
} from '@/src/lib/handoff'

const stubSessionStorage = () => {
  const store = new Map<string, string>()

  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  })

  return store
}

describe('handoff source attribution', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('remembers a known source for the tab', () => {
    const store = stubSessionStorage()

    rememberHandoffSource('askuzh')

    expect(store.get(HANDOFF_SOURCE_STORAGE_KEY)).toBe('askuzh')
    expect(readHandoffSource()).toBe('askuzh')
  })

  it('keeps an unknown source out of the tab', () => {
    const store = stubSessionStorage()

    rememberHandoffSource(undefined)

    expect(store.size).toBe(0)
    expect(readHandoffSource()).toBeUndefined()
  })

  it('reads nothing outside a browser', () => {
    vi.stubGlobal('window', undefined)

    expect(readHandoffSource()).toBeUndefined()
  })
})
