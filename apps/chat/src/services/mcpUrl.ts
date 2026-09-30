type McpUrlEnvNames = {
  host: string
  path: string
  port: string
  scheme: string
  url: string
}

export function buildMcpServiceUrl({
  defaultDevelopmentPort,
  env,
  names,
}: {
  defaultDevelopmentPort: string
  env: NodeJS.ProcessEnv
  names: McpUrlEnvNames
}): string | null {
  const explicitUrl = env[names.url]
  if (explicitUrl) {
    return explicitUrl
  }

  const path = normalizedMcpPath(env[names.path])
  const host = env[names.host]
  if (host) {
    const scheme = env[names.scheme] ?? 'http'
    const port = env[names.port] ? `:${env[names.port]}` : ''
    return `${scheme}://${host}${port}${path}`
  }

  if (env.NODE_ENV === 'development') {
    return `http://localhost:${env[names.port] ?? defaultDevelopmentPort}${path}`
  }

  return null
}

function normalizedMcpPath(value: string | undefined): string {
  if (!value) return '/mcp'
  return value.startsWith('/') ? value : `/${value}`
}
