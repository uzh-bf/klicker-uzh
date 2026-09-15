const UUID_PATH_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function auditMediaContentAddress(contentHash: string): string {
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new TypeError('Audit media content hash is invalid')
  }
  return `sha256/${contentHash}`
}

export function assertAllowedKlickerMediaSource(
  value: string,
  allowedHosts: readonly string[]
): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TypeError('Klicker media source URL is invalid')
  }

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError(
      'Klicker media source must be a query-free HTTPS URL without credentials'
    )
  }

  const normalizedHosts = new Set(
    allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean)
  )
  if (!normalizedHosts.has(url.hostname.toLowerCase())) {
    throw new TypeError('Klicker media source host is not allowlisted')
  }

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(url.pathname)
  } catch {
    throw new TypeError('Klicker media source path is invalid')
  }
  const pathSegments = decodedPath.split('/').slice(1)
  if (
    pathSegments.length < 2 ||
    !UUID_PATH_SEGMENT.test(pathSegments[0] ?? '') ||
    pathSegments.some(
      (segment) => segment === '' || segment === '.' || segment === '..'
    )
  ) {
    throw new TypeError('Klicker media source path is not allowlisted')
  }

  return url.toString()
}
