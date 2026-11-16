// Outside development the API executes only operation hashes from the build
// it was deployed with. A tab opened before a release keeps sending hashes the
// new API no longer knows, so Yoga answers PersistedQueryNotFound, and the
// full-query retry of the Apollo persisted-query link is refused with
// PersistedQueryOnly. Only a reload fetches the client that matches the API.
const STALE_PERSISTED_QUERY_MESSAGES = new Set([
  'PersistedQueryNotFound',
  'PersistedQueryOnly',
])

export const STALE_QUERY_RELOAD_STORAGE_KEY = 'klicker:stale-query-reload-at'

// A reload that still meets an unknown hash (for example a CDN serving the old
// bundle during a rollout) must not turn into a reload loop.
export const STALE_QUERY_RELOAD_COOLDOWN_MS = 5 * 60 * 1000

export function shouldReloadForStalePersistedQuery({
  messages,
  lastReloadAt,
  now,
}: {
  messages: readonly string[]
  lastReloadAt: string | null
  now: number
}): boolean {
  if (!messages.some((message) => STALE_PERSISTED_QUERY_MESSAGES.has(message)))
    return false

  const previous = Number(lastReloadAt)
  if (lastReloadAt === null || !Number.isFinite(previous)) return true

  return now - previous >= STALE_QUERY_RELOAD_COOLDOWN_MS
}
