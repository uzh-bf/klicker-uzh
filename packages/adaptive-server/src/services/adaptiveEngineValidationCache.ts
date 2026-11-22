import { createHash } from 'node:crypto'

// Runtime validation is a pure function of the published bank snapshot and
// the engine build, but it used to run on every start and submit, doubling
// engine load. Successful validations are remembered per API process.
//
// The key covers everything that can change the outcome:
// - the engine URL and its deployed revision (ADAPTIVE_ENGINE_REVISION, the
//   engine image tag set by the chart), so an engine upgrade revalidates;
// - the publication id and a SHA-256 fingerprint of the exact validation
//   request, so a republish or any change to the sent snapshot revalidates.
// The TTL bounds staleness where no revision is configured (local, CI), and
// failures are never cached.
export const ADAPTIVE_VALIDATION_CACHE_MAX_ENTRIES = 256
export const ADAPTIVE_VALIDATION_CACHE_TTL_MS = 10 * 60_000

type CacheEntry = { expiresAt: number }

const validated = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<void>>()

export function adaptiveValidationCacheKey({
  engineUrl,
  engineRevision,
  publicationId,
  request,
}: {
  engineUrl: string
  engineRevision: string | undefined
  publicationId: string | undefined
  request: unknown
}): string {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(request))
    .digest('hex')
  return JSON.stringify([
    engineUrl,
    engineRevision ?? null,
    publicationId ?? null,
    fingerprint,
  ])
}

/**
 * Runs `validate` unless the same key validated successfully within the TTL.
 * Concurrent callers with a cold key share one engine request, so a class
 * starting together sends one validation instead of one per student.
 */
export async function validateAdaptiveRuntimeOnce(
  key: string,
  validate: () => Promise<unknown>,
  now: () => number = Date.now
): Promise<void> {
  const cached = validated.get(key)
  if (cached && cached.expiresAt > now()) {
    // Refresh recency: Map iteration order is the LRU order.
    validated.delete(key)
    validated.set(key, cached)
    return
  }
  if (cached) validated.delete(key)

  const pending = inFlight.get(key)
  if (pending) return pending

  const run = (async () => {
    await validate()
    validated.set(key, {
      expiresAt: now() + ADAPTIVE_VALIDATION_CACHE_TTL_MS,
    })
    while (validated.size > ADAPTIVE_VALIDATION_CACHE_MAX_ENTRIES) {
      const oldest = validated.keys().next().value
      if (oldest === undefined) break
      validated.delete(oldest)
    }
  })()
  inFlight.set(key, run)
  try {
    await run
  } finally {
    inFlight.delete(key)
  }
}

export function clearAdaptiveValidationCache(): void {
  validated.clear()
  inFlight.clear()
}

export function adaptiveValidationCacheSize(): number {
  return validated.size
}
