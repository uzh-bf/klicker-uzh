export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(';')
    .map((cookie) => {
      const index = cookie.indexOf('=')
      if (index === -1) return null

      const key = cookie.slice(0, index).trim()
      const value = cookie.slice(index + 1).trim()

      if (!key) return null

      return [decodeURIComponent(key), decodeURIComponent(value)] as const
    })
    .reduce(
      (acc, entry) => {
        if (!entry) return acc
        const [key, value] = entry
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
}
