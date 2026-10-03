export function participantDataUseReturn(value: string, origin: string) {
  try {
    const destination = new URL(value, origin)
    if (
      destination.origin !== origin ||
      destination.pathname.endsWith('/account/data-use')
    ) {
      return '/'
    }
    for (const key of ['participantToken', 'signedLtiData', 'jwt', 'token']) {
      destination.searchParams.delete(key)
    }
    return destination.pathname + destination.search
  } catch {
    return '/'
  }
}

const RETURN_TARGET_KEY = 'participant_data_use_return'

/**
 * Session storage is optional: a privacy-restricted or partitioned browser
 * context can throw on access. The completion flow must still work, so every
 * storage operation here is best-effort and never propagates an error.
 */
function getSessionStorage(storage?: Storage) {
  if (storage) return storage
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : undefined
  } catch {
    return undefined
  }
}

export function storeDataUseReturnTarget(value: string, storage?: Storage) {
  try {
    getSessionStorage(storage)?.setItem(RETURN_TARGET_KEY, value)
  } catch {
    // Losing the return target only softens the post-completion destination.
  }
}

export function readDataUseReturnTarget(storage?: Storage) {
  try {
    return getSessionStorage(storage)?.getItem(RETURN_TARGET_KEY) ?? null
  } catch {
    return null
  }
}

export function clearDataUseReturnTarget(storage?: Storage) {
  try {
    getSessionStorage(storage)?.removeItem(RETURN_TARGET_KEY)
  } catch {
    // A failed cleanup must not turn a saved choice into a reported failure.
  }
}
