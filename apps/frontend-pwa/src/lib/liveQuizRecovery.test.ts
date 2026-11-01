import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLiveQuizRecovery } from './liveQuizRecovery'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('authoritative live quiz recovery', () => {
  it('discards a snapshot racing a newer event and reads current state again', async () => {
    const stale = deferred<number>()
    const fresh = deferred<number>()
    const reads = [stale, fresh]
    const applied: number[] = []
    const recovery = createLiveQuizRecovery({
      read: () => reads.shift()!.promise,
      apply: (value) => applied.push(value),
      onState: () => {},
    })
    const pending = recovery.refresh()
    recovery.invalidate()
    stale.resolve(1)
    await Promise.resolve()
    assert.deepEqual(applied, [])
    fresh.resolve(2)
    await pending
    assert.deepEqual(applied, [2])
  })

  it('bounds catch-up requests when events keep changing during each read', async () => {
    let reads = 0
    const states: string[] = []
    const applied: number[] = []
    const recovery = createLiveQuizRecovery({
      read: async () => {
        reads++
        recovery.invalidate()
        return reads
      },
      apply: (value: number) => applied.push(value),
      onState: (state) => states.push(state),
    })
    await recovery.refresh()
    assert.equal(reads, 3)
    assert.deepEqual(applied, [])
    assert.equal(states.at(-1), 'failed')
  })

  it('retries a failed stale request when connection recovery arrives in flight', async () => {
    const offline = deferred<number>()
    let reads = 0
    const applied: number[] = []
    const recovery = createLiveQuizRecovery({
      read: () => (++reads === 1 ? offline.promise : Promise.resolve(2)),
      apply: (value) => applied.push(value),
      onState: () => {},
    })
    const pending = recovery.refresh()
    recovery.invalidate()
    void recovery.refresh()
    offline.reject(new Error('offline'))
    await pending
    assert.deepEqual(applied, [2])
  })

  it('coalesces simultaneous recovery triggers without concurrent requests', async () => {
    const response = deferred<number>()
    let reads = 0
    const recovery = createLiveQuizRecovery({
      read: () => {
        reads++
        return response.promise
      },
      apply: () => {},
      onState: () => {},
    })
    const first = recovery.refresh()
    const second = recovery.refresh()
    assert.equal(first, second)
    assert.equal(reads, 1)
    response.resolve(1)
    await first
  })

  it('does not apply responses or publish status after leaving the quiz', async () => {
    const response = deferred<number>()
    const applied: number[] = []
    const states: string[] = []
    const recovery = createLiveQuizRecovery({
      read: () => response.promise,
      apply: (value) => applied.push(value),
      onState: (state) => states.push(state),
    })
    const pending = recovery.refresh()
    recovery.dispose()
    response.resolve(1)
    await pending
    assert.deepEqual(applied, [])
    assert.deepEqual(states, ['synchronizing'])
  })

  it('exposes failed recovery and allows a subsequent successful retry', async () => {
    let attempts = 0
    const states: string[] = []
    const applied: number[] = []
    const recovery = createLiveQuizRecovery({
      read: async () => {
        if (++attempts === 1) throw new Error('offline')
        return 2
      },
      apply: (value) => applied.push(value),
      onState: (state) => states.push(state),
    })
    await recovery.refresh()
    await recovery.refresh()
    assert.deepEqual(applied, [2])
    assert.deepEqual(states, [
      'synchronizing',
      'failed',
      'synchronizing',
      'ready',
    ])
  })
})
