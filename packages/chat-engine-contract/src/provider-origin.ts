function exactHttpOrigin(value: string): string {
  const url = new URL(value)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Provider allowlist entries must be exact HTTP origins.')
  }
  return url.origin
}

export function parseProviderAllowedOrigins(
  value: string | undefined
): ReadonlySet<string> {
  const origins = new Set<string>()
  for (const entry of value?.split(',') ?? []) {
    const candidate = entry.trim()
    if (candidate) origins.add(exactHttpOrigin(candidate))
  }
  return origins
}

export function providerOriginIsAllowed(
  providerBaseUrl: string,
  allowedOrigins: ReadonlySet<string>
): boolean {
  try {
    return allowedOrigins.has(new URL(providerBaseUrl).origin)
  } catch {
    return false
  }
}
