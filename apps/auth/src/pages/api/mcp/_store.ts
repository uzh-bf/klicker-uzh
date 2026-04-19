// In-process store for short-lived OAuth authorization codes issued to the
// MCP proxy. A POC-grade implementation: one-minute TTL, non-distributed.
// Production will swap this for a Redis-backed adapter keyed the same way.
//
// Each code binds the PKCE challenge the MCP client sent on /authorize to
// the KlickerUZH JWT we'll return from /token. The JWT itself is never
// persisted beyond the single exchange.

type CodeRecord = {
  jwt: string
  codeChallenge: string
  codeChallengeMethod: string
  redirectUri: string
  clientId: string
  createdAt: number
}

const CODE_TTL_MS = 60_000
const SWEEP_INTERVAL_MS = 60_000
const store = new Map<string, CodeRecord>()

// Periodically drop expired codes so abandoned flows don't accumulate in
// memory. `popCode` already checks TTL at redemption, but codes that are
// never redeemed would otherwise live forever.
if (typeof setInterval !== 'undefined') {
  const handle = setInterval(() => {
    const cutoff = Date.now() - CODE_TTL_MS
    for (const [code, record] of store) {
      if (record.createdAt < cutoff) store.delete(code)
    }
  }, SWEEP_INTERVAL_MS)
  // Don't keep the Node process alive for this.
  if (typeof handle.unref === 'function') handle.unref()
}

export function putCode(code: string, record: Omit<CodeRecord, 'createdAt'>) {
  store.set(code, { ...record, createdAt: Date.now() })
}

export function popCode(code: string): CodeRecord | null {
  const record = store.get(code)
  if (!record) return null
  store.delete(code)
  if (Date.now() - record.createdAt > CODE_TTL_MS) return null
  return record
}
