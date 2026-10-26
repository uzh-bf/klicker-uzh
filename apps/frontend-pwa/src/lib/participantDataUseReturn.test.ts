import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clearDataUseReturnTarget,
  participantDataUseReturn,
  readDataUseReturnTarget,
  storeDataUseReturnTarget,
} from './participantDataUseReturn'

const origin = 'https://pwa.example.invalid'

describe('participant data-use return destination', () => {
  it('preserves the local course destination without authentication material', () => {
    assert.equal(
      participantDataUseReturn(
        '/de/course/synthetic?tab=practice&participantToken=synthetic&signedLtiData=synthetic&jwt=synthetic&token=synthetic#secret',
        origin
      ),
      '/de/course/synthetic?tab=practice'
    )
  })

  it('rejects external, malformed, and completion-loop destinations', () => {
    for (const value of [
      'https://other.example.invalid/course',
      '//other.example.invalid/course',
      'https://[invalid',
      '/de/account/data-use',
    ]) {
      assert.equal(participantDataUseReturn(value, origin), '/')
    }
  })
})

function createStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  } as unknown as Storage
}

describe('optional session storage for the return target', () => {
  it('stores, reads, and clears the target when storage is available', () => {
    const storage = createStorage()
    storeDataUseReturnTarget('/de/course/synthetic', storage)
    assert.equal(readDataUseReturnTarget(storage), '/de/course/synthetic')
    clearDataUseReturnTarget(storage)
    assert.equal(readDataUseReturnTarget(storage), null)
  })

  it('survives storage that throws on every operation', () => {
    const throwing = {
      getItem() {
        throw new Error('storage unavailable')
      },
      setItem() {
        throw new Error('storage unavailable')
      },
      removeItem() {
        throw new Error('storage unavailable')
      },
    } as unknown as Storage

    assert.doesNotThrow(() => storeDataUseReturnTarget('/x', throwing))
    assert.equal(readDataUseReturnTarget(throwing), null)
    assert.doesNotThrow(() => clearDataUseReturnTarget(throwing))
  })
})
