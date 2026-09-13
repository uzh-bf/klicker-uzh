import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  __resetMemoryClientId,
  getClientSubmissionId,
} from './clientSubmissionId'

type MemoryStorage = {
  data: Map<string, string>
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function installStorage(overrides: Partial<MemoryStorage> = {}): MemoryStorage {
  const storage: MemoryStorage = {
    data: new Map(),
    getItem(key) {
      return this.data.get(key) ?? null
    },
    setItem(key, value) {
      this.data.set(key, value)
    },
    removeItem(key) {
      this.data.delete(key)
    },
    ...overrides,
  }
  ;(globalThis as Record<string, unknown>).window = { localStorage: storage }
  return storage
}

function installThrowingStorage(): void {
  const throwing = {
    getItem() {
      throw new Error('SecurityError')
    },
    setItem() {
      throw new Error('QuotaExceededError')
    },
    removeItem() {
      throw new Error('SecurityError')
    },
  }
  ;(globalThis as Record<string, unknown>).window = {
    localStorage: throwing,
  }
}

function clearWindow() {
  delete (globalThis as Record<string, unknown>).window
}

afterEach(() => {
  clearWindow()
  __resetMemoryClientId()
})

describe('getClientSubmissionId', () => {
  it('persists a stable client id across storage and instances', () => {
    const storage = installStorage()
    const first = getClientSubmissionId('lq-quiz-ex-0-i-1')
    const second = getClientSubmissionId('lq-quiz-ex-0-i-2')
    const repeat = getClientSubmissionId('lq-quiz-ex-0-i-1')

    const persisted = storage.data.get('klicker-live-quiz-client-id')
    assert.ok(persisted)
    assert.ok(first.startsWith(`${persisted}:`))
    assert.notEqual(first, second)
    assert.equal(first, repeat)
  })

  it('keeps a stable identity when storage operations throw', () => {
    installThrowingStorage()
    const first = getClientSubmissionId('lq-quiz-ex-0-i-1')
    const retry = getClientSubmissionId('lq-quiz-ex-0-i-1')
    const other = getClientSubmissionId('lq-quiz-ex-0-i-2')

    assert.equal(first, retry, 'retries must not mint a new identity')
    assert.equal(
      first.split(':')[0],
      other.split(':')[0],
      'the fallback identity stays shared within the page'
    )
  })

  it('reuses a previously persisted identity after an in-memory reset', () => {
    const storage = installStorage()
    const original = getClientSubmissionId('lq-quiz-ex-0-i-1')
    const persisted = storage.data.get('klicker-live-quiz-client-id')

    __resetMemoryClientId()
    const reload = getClientSubmissionId('lq-quiz-ex-0-i-1')

    assert.equal(reload, original)
    assert.equal(storage.data.get('klicker-live-quiz-client-id'), persisted)
  })

  it('falls back to an in-memory identity when no window exists', () => {
    clearWindow()
    const first = getClientSubmissionId('lq-quiz-ex-0-i-1')
    const retry = getClientSubmissionId('lq-quiz-ex-0-i-1')
    assert.equal(first, retry)
  })
})
