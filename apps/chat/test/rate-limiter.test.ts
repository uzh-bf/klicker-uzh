import { createRateLimiter } from '@/src/services/rateLimiter'
import { describe, expect, test } from 'vitest'

describe('SlidingWindowRateLimiter', () => {
  test('allows requests up to the limit within the window', () => {
    const limiter = createRateLimiter(3, 1000)
    const now = 1_000_000

    expect(limiter.check('user-a', now).allowed).toBe(true)
    expect(limiter.check('user-a', now + 10).allowed).toBe(true)
    expect(limiter.check('user-a', now + 20).allowed).toBe(true)
  })

  test('denies once the limit is exceeded inside the window', () => {
    const limiter = createRateLimiter(2, 1000)
    const now = 1_000_000

    expect(limiter.check('user-a', now).allowed).toBe(true)
    expect(limiter.check('user-a', now + 10).allowed).toBe(true)

    const denied = limiter.check('user-a', now + 20)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
    expect(denied.retryAfterMs).toBeLessThanOrEqual(1000)
  })

  test('allows again once the oldest hit falls out of the window', () => {
    const limiter = createRateLimiter(2, 1000)
    const now = 1_000_000

    expect(limiter.check('user-a', now).allowed).toBe(true)
    expect(limiter.check('user-a', now + 100).allowed).toBe(true)
    expect(limiter.check('user-a', now + 200).allowed).toBe(false)

    // The first hit (at `now`) has aged out of the 1000ms window by now+1001.
    expect(limiter.check('user-a', now + 1001).allowed).toBe(true)
  })

  test('tracks separate keys independently', () => {
    const limiter = createRateLimiter(1, 1000)
    const now = 1_000_000

    expect(limiter.check('user-a', now).allowed).toBe(true)
    expect(limiter.check('user-a', now + 1).allowed).toBe(false)
    expect(limiter.check('user-b', now + 1).allowed).toBe(true)
  })
})
