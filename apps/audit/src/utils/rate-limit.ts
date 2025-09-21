interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimiter = new Map<string, RateLimitRecord>()

export function checkRateLimit(
  key: string,
  limit = 100,
  windowMs = 60000
): boolean {
  const now = Date.now()
  const record = rateLimiter.get(key)

  if (rateLimiter.size > 1000) {
    for (const [k, v] of rateLimiter.entries()) {
      if (v.resetTime < now) {
        rateLimiter.delete(k)
      }
    }
  }

  if (!record || record.resetTime < now) {
    rateLimiter.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count += 1
  return true
}
