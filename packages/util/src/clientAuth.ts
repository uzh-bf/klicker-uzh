type SessionStorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getSessionStorage(): SessionStorageLike | undefined {
  return (globalThis as { sessionStorage?: SessionStorageLike }).sessionStorage
}

export function getStoredAuthToken(key: string): string | null {
  try {
    return getSessionStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function createAuthedFetch(key: string | string[]): typeof fetch {
  return function authedFetch(
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {}
  ): ReturnType<typeof fetch> {
    const keys = Array.isArray(key) ? key : [key]
    const token =
      keys.map((storageKey) => getStoredAuthToken(storageKey)).find(Boolean) ??
      null
    if (!token) {
      return fetch(input, init)
    }

    const headers = new Headers(init.headers)
    if (!headers.has('authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return fetch(input, { ...init, headers })
  }
}

export function bootstrapTokenFromUrl(
  searchParams: URLSearchParams,
  {
    storageKey,
    queryKey,
  }: {
    storageKey: string
    queryKey: string
  }
): URLSearchParams | null {
  const token = searchParams.get(queryKey)
  if (!token) return null

  const storage = getSessionStorage()
  if (!storage) return null

  try {
    storage.setItem(storageKey, token)
  } catch {
    return null
  }

  const stripped = new URLSearchParams(searchParams.toString())
  stripped.delete(queryKey)
  return stripped
}
