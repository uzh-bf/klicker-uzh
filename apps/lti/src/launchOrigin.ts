export function parseToolOrigin(value: string) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('APP_ORIGIN_LTI must be an HTTP(S) origin')
  }
  return url.origin
}

interface LaunchRequest {
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface LaunchResponse {
  setHeader(name: string, value: string): unknown
}

export function createLaunchOriginCompatibility(
  toolOrigin: string,
  applied: () => void
) {
  return (
    request: LaunchRequest,
    response: LaunchResponse,
    next: () => void
  ) => {
    const body = request.body
    if (
      request.method !== 'POST' ||
      request.path !== '/' ||
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body)
    ) {
      next()
      return
    }
    if (
      !Object.hasOwn(body, 'ltijs_recovered_state') &&
      'id_token' in body &&
      typeof body.id_token === 'string' &&
      body.id_token.length > 0 &&
      'state' in body &&
      typeof body.state === 'string' &&
      body.state.length > 0
    ) {
      // The recovery form must send its Origin on the next POST. Reveal only
      // the origin in Referer, never the launch URL's path or query.
      response.setHeader('Referrer-Policy', 'origin')
    }
    if (
      request.headers['sec-fetch-site'] === 'none' &&
      request.headers.origin === toolOrigin &&
      'ltijs_recovered_state' in body &&
      typeof body.ltijs_recovered_state === 'string' &&
      body.ltijs_recovered_state.length > 0
    ) {
      // Origin is browser-controlled and must match the configured tool origin.
      // ltijs still verifies recovery/state signatures, expiry and the nonce.
      request.headers['sec-fetch-site'] = 'same-origin'
      applied()
    }
    next()
  }
}
