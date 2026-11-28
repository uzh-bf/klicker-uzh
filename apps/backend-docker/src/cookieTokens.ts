/**
 * Returns every value the Cookie header carries for one cookie name, in
 * header order. A browser sends several cookies with the same name when they
 * differ by domain or path, for example a host-only copy left over from an
 * older login next to the shared-domain cookie of the current one.
 */
export function readCookieValues(
  header: string | undefined,
  name: string
): string[] {
  if (!header) return []

  const values: string[] = []
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1 || pair.slice(0, separator).trim() !== name) continue

    const raw = pair.slice(separator + 1).trim()
    try {
      values.push(decodeURIComponent(raw))
    } catch {
      values.push(raw)
    }
  }
  return values
}

/**
 * Picks the first token that verifies, so an expired duplicate cannot shadow
 * a valid one. Without a valid token the first value is kept, which leaves the
 * single-cookie behavior unchanged.
 */
export async function pickVerifiedToken(
  values: string[],
  verify: (token: string) => Promise<unknown>
): Promise<string | undefined> {
  if (values.length < 2) return values[0]

  for (const value of values) {
    try {
      await verify(value)
      return value
    } catch {
      // try the next duplicate
    }
  }
  return values[0]
}
