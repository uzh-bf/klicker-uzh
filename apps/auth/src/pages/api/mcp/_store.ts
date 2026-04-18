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
const store = new Map<string, CodeRecord>()

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
