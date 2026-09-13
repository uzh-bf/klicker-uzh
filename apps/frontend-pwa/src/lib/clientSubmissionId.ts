/**
 * Client-side submission identity for live quiz responses.
 *
 * One identifier is derived per browser profile, quiz execution and question
 * instance so that duplicate submissions of the same answer (double submit,
 * timeout racing a manual submit, retries) reach the response processor with
 * the same dedupe identity. The server only ever sees a SHA-256 hash of it.
 *
 * Persistence uses localStorage when available. When storage access throws
 * (browser policy, disabled storage, quota), a stable in-memory identity is
 * kept for the lifetime of the page instead: submissions then remain
 * deduplicated within the page session, but a reload generates a new
 * identity and cannot be deduplicated against submissions sent before it.
 * This is a degraded fallback, not an equivalent guarantee.
 *
 * The identity represents a browser profile, not a person: two tabs share it
 * (first writer wins initialization), and two people sharing a browser
 * profile during the same quiz execution share one anonymous identity. It is
 * duplicate-submission protection, not anti-abuse protection — a client can
 * always forge fresh identifiers.
 */
const CLIENT_ID_STORAGE_KEY = 'klicker-live-quiz-client-id'

let memoryClientId: string | null = null
let resolvedStorage: SubmissionIdStorage | null | undefined

interface SubmissionIdStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getLocalStorage(): SubmissionIdStorage | null {
  if (resolvedStorage !== undefined) return resolvedStorage
  try {
    const storage = globalThis.window?.localStorage
    if (!storage) {
      resolvedStorage = null
      return resolvedStorage
    }
    // probe both operations; either can throw under browser policy
    const probeKey = `${CLIENT_ID_STORAGE_KEY}:probe`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    resolvedStorage = storage
  } catch {
    resolvedStorage = null
  }
  return resolvedStorage
}

function generateClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

export function getClientSubmissionId(storageKey: string): string {
  let clientId = memoryClientId

  if (!clientId) {
    const storage = getLocalStorage()
    if (storage) {
      try {
        clientId = storage.getItem(CLIENT_ID_STORAGE_KEY)
      } catch {
        clientId = null
      }
    }
  }

  if (!clientId) {
    clientId = generateClientId()
  }

  // keep the in-memory copy authoritative for this page regardless of
  // whether persistence succeeds, so retries never mint a new identity
  memoryClientId = clientId

  const storage = getLocalStorage()
  if (storage) {
    try {
      storage.setItem(CLIENT_ID_STORAGE_KEY, clientId)
    } catch {
      // storage unavailable or full — the in-memory fallback applies
    }
  }

  return `${clientId}:${storageKey}`
}

/** test-only: reset the in-memory identity and cached storage resolution */
export function __resetMemoryClientId(): void {
  memoryClientId = null
  resolvedStorage = undefined
}
