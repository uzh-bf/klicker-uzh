/** Literal URL validation only; displaying a citation never performs a network lookup. */
export function getPublicSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const raw = value.trim()
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !host.includes('.') ||
      host.includes(':') ||
      /\.(?:localhost|local|internal|svc|cluster\.local)$/.test(host) ||
      /^(?:0|10|127)\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
      /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
      /^(?:22[4-9]|23\d|24\d|25[0-5])\./.test(host) ||
      decodeURIComponent(url.pathname).startsWith('/api/ingestion/resources/')
    )
      return undefined
    return raw
  } catch {
    return undefined
  }
}

/** Physical PDF positions belong in navigation, never in the displayed label. */
export function getSourceNavigationUrl(
  value: unknown,
  page?: number
): string | undefined {
  const url = getPublicSourceUrl(value)
  if (!url || !Number.isSafeInteger(page) || page === undefined || page < 1)
    return url
  if (!/\.pdf$/i.test(new URL(url).pathname)) return url
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1)
  const parts = fragment ? fragment.split('&') : []
  const remaining = parts.filter((part) => !/^page=/i.test(part))
  return `${base}#${[...remaining, `page=${page}`].join('&')}`
}
