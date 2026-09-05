// Minimal in-memory sliding-window rate limiter.
//
// Best-effort, per-pod only: hits live in process memory, so state resets on
// restart/redeploy and is NOT shared across replicas. Under horizontal
// scaling the effective limit is roughly (configured limit) x (pod count).
// This is a first line of defense against runaway clients or bugs, not a
// substitute for a shared limiter (e.g. Redis) if a hard guarantee is ever
// needed.

export type RateLimitResult = {
  allowed: boolean
  /** Milliseconds until the caller may retry; 0 when allowed. */
  retryAfterMs: number
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>()
  private checksSinceSweep = 0

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Records a hit for `key` and reports whether it is within the limit. */
  check(key: string, now = Date.now()): RateLimitResult {
    const timestamps = (this.hits.get(key) ?? []).filter(
      (hitAt) => now - hitAt < this.windowMs
    )

    if (timestamps.length >= this.limit) {
      this.hits.set(key, timestamps)
      const oldest = timestamps[0] ?? now
      return {
        allowed: false,
        retryAfterMs: Math.max(this.windowMs - (now - oldest), 0),
      }
    }

    timestamps.push(now)
    this.hits.set(key, timestamps)

    // Opportunistically prune keys with no hits left in the window so
    // inactive callers don't accumulate in memory forever. Sweeping on
    // every check would be O(keys) per request; do it periodically instead.
    this.checksSinceSweep += 1
    if (this.checksSinceSweep >= 200) {
      this.checksSinceSweep = 0
      this.prune(now)
    }

    return { allowed: true, retryAfterMs: 0 }
  }

  private prune(now: number) {
    for (const [key, timestamps] of this.hits) {
      const fresh = timestamps.filter((hitAt) => now - hitAt < this.windowMs)
      if (fresh.length === 0) {
        this.hits.delete(key)
      } else {
        this.hits.set(key, fresh)
      }
    }
  }
}

export function createRateLimiter(
  limit: number,
  windowMs: number
): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(limit, windowMs)
}
