import { describe, expect, it } from 'vitest'
import {
  isHatchetWorkerRegistered,
  waitForHatchetWorkerRegistration,
} from '../readiness.js'

function runtime(actions: string[], workerId?: string) {
  return {
    action_registry: Object.fromEntries(actions.map((action) => [action, {}])),
    workerId,
  }
}

describe('response processor readiness', () => {
  it('requires every active runtime to register', () => {
    expect(
      isHatchetWorkerRegistered({
        nonDurable: runtime(['regular'], 'regular-worker'),
        durable: runtime(['durable']),
      })
    ).toBe(false)

    expect(
      isHatchetWorkerRegistered({
        nonDurable: runtime(['regular'], 'regular-worker'),
        durable: runtime(['durable'], 'durable-worker'),
      })
    ).toBe(true)
  })

  it('ignores inactive runtimes', () => {
    expect(
      isHatchetWorkerRegistered({
        nonDurable: runtime([]),
        durable: runtime(['durable'], 'durable-worker'),
      })
    ).toBe(true)
  })

  it('waits for registration and propagates startup failure', async () => {
    const worker = {
      nonDurable: runtime(['regular']),
    }
    const running = new Promise<never>(() => {})
    const registration = waitForHatchetWorkerRegistration(worker, running, 1)

    worker.nonDurable.workerId = 'regular-worker'
    await expect(registration).resolves.toBeUndefined()

    await expect(
      waitForHatchetWorkerRegistration(
        { nonDurable: runtime(['regular']) },
        Promise.reject(new Error('registration failed')),
        1
      )
    ).rejects.toThrow('registration failed')
  })
})
