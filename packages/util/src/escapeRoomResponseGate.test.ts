import { describe, expect, it } from 'vitest'
import {
  acquireEscapeRoomResponseSlot,
  closeEscapeRoomResponseGate,
  completeEscapeRoomResponseEvent,
  releaseEscapeRoomResponseSlot,
  reopenEscapeRoomResponseGate,
  trackEscapeRoomResponseEvent,
} from './escapeRoomResponseGate.js'

class GateRedisMock {
  gateToken: string | null = null
  inFlight = new Set<string>()
  pending = new Set<string>()

  get gateClosed() {
    return this.gateToken !== null
  }

  async eval(script: string, _numberOfKeys: number, ...args: string[]) {
    if (script.includes('escape-room-response-acquire')) {
      const token = args[4]!
      if (this.gateClosed) return 0
      this.inFlight.add(token)
      return 1
    }
    if (script.includes('escape-room-response-close')) {
      const ownsGate = this.gateToken === null
      if (ownsGate) this.gateToken = args[4]!
      return [ownsGate ? 1 : 0, this.inFlight.size, this.pending.size]
    }
    if (script.includes('escape-room-response-status')) {
      return [this.inFlight.size, this.pending.size]
    }
    if (script.includes('escape-room-response-reopen')) {
      if (this.gateToken !== args[1]) return 0
      this.gateToken = null
      return 1
    }
    throw new Error('Unexpected Redis script')
  }

  async zadd(_key: string, _score: number, value: string) {
    this.pending.add(value)
    return 1
  }

  multi() {
    const transaction = {
      zadd: (_key: string, _score: number, value: string) => {
        this.pending.add(value)
        return transaction
      },
      expire: () => transaction,
      exec: async () => [],
    }
    return transaction
  }

  async expire() {
    return 1
  }

  async zrem(key: string, value: string) {
    const values = key.endsWith(':in-flight') ? this.inFlight : this.pending
    return values.delete(value) ? 1 : 0
  }
}

describe('Live Quiz Escape Room response closure gate', () => {
  it('drains an accepted response and its worker event before closure continues', async () => {
    const redis = new GateRedisMock()
    const blockId = 7
    const slotToken = 'slot-1'
    const messageId = 'escape:attempt-1:11'

    await expect(
      acquireEscapeRoomResponseSlot({
        redis: redis as any,
        blockId,
        token: slotToken,
      })
    ).resolves.toBe(true)
    await trackEscapeRoomResponseEvent({
      redis: redis as any,
      blockId,
      messageId,
    })

    let closureSettled = false
    const closure = closeEscapeRoomResponseGate({
      redis: redis as any,
      blockId,
      pollIntervalMs: 1,
      timeoutMs: 100,
    }).then(() => {
      closureSettled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(redis.gateClosed).toBe(true)
    expect(closureSettled).toBe(false)

    await releaseEscapeRoomResponseSlot({
      redis: redis as any,
      blockId,
      token: slotToken,
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(closureSettled).toBe(false)

    await completeEscapeRoomResponseEvent({
      redis: redis as any,
      blockId,
      messageId,
    })
    await closure
    expect(closureSettled).toBe(true)
  })

  it('rejects a new response slot after closure starts', async () => {
    const redis = new GateRedisMock()
    const blockId = 7

    await closeEscapeRoomResponseGate({
      redis: redis as any,
      blockId,
      pollIntervalMs: 1,
      timeoutMs: 100,
    })

    await expect(
      acquireEscapeRoomResponseSlot({
        redis: redis as any,
        blockId,
        token: 'late-slot',
      })
    ).resolves.toBe(false)
  })

  it('lets only the owning closure reopen a failed gate', async () => {
    const redis = new GateRedisMock()
    const blockId = 7
    const ownerToken = await closeEscapeRoomResponseGate({
      redis: redis as any,
      blockId,
    })
    expect(ownerToken).toEqual(expect.any(String))
    await expect(
      closeEscapeRoomResponseGate({
        redis: redis as any,
        blockId,
      })
    ).rejects.toThrow('already closing')
    expect(redis.gateClosed).toBe(true)

    await reopenEscapeRoomResponseGate({
      redis: redis as any,
      blockId,
      token: ownerToken,
    })
    expect(redis.gateClosed).toBe(false)
  })

  it('reopens an owned gate when draining times out', async () => {
    const redis = new GateRedisMock()
    redis.pending.add('escape:attempt-1:11')

    await expect(
      closeEscapeRoomResponseGate({
        redis: redis as any,
        blockId: 7,
        timeoutMs: 0,
      })
    ).rejects.toThrow('Timed out draining Escape Room responses')
    expect(redis.gateClosed).toBe(false)
  })
})
