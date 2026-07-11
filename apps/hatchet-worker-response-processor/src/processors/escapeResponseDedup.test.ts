import { describe, expect, it, vi } from 'vitest'
import {
  assertRedisHashKeysCompatible,
  withEscapeResponseDedup,
} from './escapeResponseDedup.js'

function redisMock(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(
      async (
        key: string,
        value: string,
        _ex: 'EX',
        _ttl: number,
        mode: 'NX'
      ) => {
        if (mode === 'NX' && values.has(key)) return null
        values.set(key, value)
        return 'OK' as const
      }
    ),
    eval: vi.fn(
      async (_script: string, _keys: number, key: string, token: string) => {
        if (values.get(key) !== token) return 0
        values.delete(key)
        return 1
      }
    ),
    del: vi.fn(async (key: string) => (values.delete(key) ? 1 : 0)),
  }
}

describe('escape response worker deduplication', () => {
  it('skips a response with a durable done marker', async () => {
    const messageId = 'escape:attempt-1:11'
    const redis = redisMock({ [`response-message:${messageId}:done`]: '1' })
    const process = vi.fn()

    await expect(
      withEscapeResponseDedup({ messageId, redis, process })
    ).resolves.toEqual({ status: 200 })
    expect(process).not.toHaveBeenCalled()
  })

  it('keeps lock contention retryable instead of acknowledging it', async () => {
    const messageId = 'escape:attempt-1:11'
    const redis = redisMock({ [`response-message:${messageId}:lock`]: 'owner' })

    await expect(
      withEscapeResponseDedup({
        messageId,
        redis,
        process: vi.fn(),
      })
    ).rejects.toThrow('already being processed')
  })

  it('throws on non-success and releases its own lock', async () => {
    const messageId = 'escape:attempt-1:11'
    const redis = redisMock()

    await expect(
      withEscapeResponseDedup({
        messageId,
        redis,
        process: vi.fn().mockResolvedValue({ status: 500 }),
      })
    ).rejects.toThrow('failed with status 500')
    expect(redis.values.has(`response-message:${messageId}:lock`)).toBe(false)
  })

  it('passes the done key into successful atomic processing', async () => {
    const messageId = 'escape:attempt-1:11'
    const redis = redisMock()
    const process = vi.fn(async (doneKey?: string) => {
      expect(doneKey).toBe(`response-message:${messageId}:done`)
      redis.values.set(doneKey!, '1')
      return { status: 200 }
    })

    await expect(
      withEscapeResponseDedup({ messageId, redis, process })
    ).resolves.toEqual({ status: 200 })
    expect(redis.values.get(`response-message:${messageId}:done`)).toBe('1')
  })

  it('does not delete a replacement lock owned by another worker', async () => {
    const messageId = 'escape:attempt-1:11'
    const lockKey = `response-message:${messageId}:lock`
    const redis = redisMock()

    await withEscapeResponseDedup({
      messageId,
      redis,
      process: vi.fn(async () => {
        redis.values.set(lockKey, 'replacement-owner')
        return { status: 200 }
      }),
    })

    expect(redis.values.get(lockKey)).toBe('replacement-owner')
  })
})

describe('escape response transaction preflight', () => {
  it('rejects an incompatible key before response mutations execute', async () => {
    const mutations: string[] = []
    const redis = {
      eval: vi.fn().mockResolvedValue('lq:quiz:i:1:results'),
    }

    await expect(
      assertRedisHashKeysCompatible({
        keys: ['lq:quiz:i:1:results'],
        increments: [],
        redis,
      })
    ).rejects.toThrow('is incompatible')
    expect(mutations).toEqual([])
  })

  it('rejects a non-integer increment field before response mutations execute', async () => {
    const mutations: string[] = []
    const redis = {
      eval: vi.fn().mockResolvedValue('lq:quiz:i:1:results:responses'),
    }

    await expect(
      assertRedisHashKeysCompatible({
        keys: ['lq:quiz:i:1:results'],
        increments: [{ key: 'lq:quiz:i:1:results', field: 'responses' }],
        redis,
      })
    ).rejects.toThrow('is incompatible')
    expect(mutations).toEqual([])
  })
})
