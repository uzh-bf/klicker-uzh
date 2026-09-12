export interface PlatformRegistration {
  url: string
  name: string
  clientId: string
  authenticationEndpoint: string
  accesstokenEndpoint: string
  authConfig: { method: 'JWK_SET'; key: string }
}

export function resolvePlatforms(
  env: NodeJS.ProcessEnv
): PlatformRegistration[] {
  let additional: unknown = []
  try {
    if (env.LTI_ADDITIONAL_PLATFORMS) {
      additional = JSON.parse(env.LTI_ADDITIONAL_PLATFORMS)
    }
  } catch {
    throw new Error('LTI_ADDITIONAL_PLATFORMS must contain valid JSON')
  }
  if (!Array.isArray(additional)) {
    throw new Error('LTI_ADDITIONAL_PLATFORMS must be an array')
  }

  const registrations: unknown[] = [
    {
      url: env.LTI_URL,
      name: env.LTI_NAME,
      clientId: env.LTI_CLIENT_ID,
      authenticationEndpoint: env.LTI_AUTH_ENDPOINT,
      accesstokenEndpoint: env.LTI_TOKEN_ENDPOINT,
      authConfig: { method: 'JWK_SET', key: env.LTI_KEYS_ENDPOINT },
    },
    ...additional,
  ]
  const seen = new Set<string>()
  return registrations.map((value, index) => {
    const invalid = () => new Error(`Invalid LTI platform at index ${index}`)
    if (!value || typeof value !== 'object') throw invalid()
    const item = value as Record<string, unknown>
    const text = (field: string): string => {
      const result = item[field]
      if (typeof result !== 'string' || !result.trim()) throw invalid()
      return result
    }
    const endpoint = (value: string): string => {
      let parsed: URL
      try {
        parsed = new URL(value)
      } catch {
        throw invalid()
      }
      if (
        ![
          'https:',
          ...(env.NODE_ENV === 'development' ? ['http:'] : []),
        ].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      ) {
        throw invalid()
      }
      return value
    }
    const auth = item.authConfig as Record<string, unknown> | null
    if (
      auth?.method !== 'JWK_SET' ||
      typeof auth.key !== 'string' ||
      !auth.key.trim()
    ) {
      throw invalid()
    }
    const platform: PlatformRegistration = {
      url: endpoint(text('url')),
      name: text('name'),
      clientId: text('clientId'),
      authenticationEndpoint: endpoint(text('authenticationEndpoint')),
      accesstokenEndpoint: endpoint(text('accesstokenEndpoint')),
      authConfig: { method: 'JWK_SET', key: endpoint(auth.key) },
    }
    const identity = JSON.stringify([platform.url, platform.clientId])
    if (seen.has(identity))
      throw new Error('Duplicate LTI platform registration')
    seen.add(identity)
    return platform
  })
}
