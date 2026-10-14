// Structured auth telemetry.
//
// One JSON line per event, carrying only non-sensitive fields: no state,
// code, token or cookie values, no raw authentication query strings, and no
// arbitrary deep-link contents — destinations are reduced to their host.
// Outcome categories distinguish expired/missing transaction context from
// provider-side failures so incidents can be triaged without exporting
// authentication material.
//
// This module must stay dependency-free: it is imported directly by
// node:test scripts (see scripts/*.mts).

function hostFromUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    return new URL(raw).host
  } catch {
    return null
  }
}

interface AuthEventFields {
  audience?: string | null
  providerId?: string
  outcome?: string
  destination?: string | null
  destinationHost?: string | null
  elapsedMs?: number
  errorCategory?: string
  action?: string
  method?: string
  path?: string
  release?: string
}

export function authEvent(
  event: string,
  requestId: string,
  fields: AuthEventFields = {}
) {
  const { destination, ...rest } = fields
  const record = {
    ts: new Date().toISOString(),
    event,
    requestId,
    release: process.env.APP_VERSION ?? undefined,
    ...rest,
    // Destinations are always reduced to the host, overriding any caller slip.
    destinationHost:
      rest.destinationHost ?? (destination ? hostFromUrl(destination) : null),
  }
  console.log(JSON.stringify(record))
}
