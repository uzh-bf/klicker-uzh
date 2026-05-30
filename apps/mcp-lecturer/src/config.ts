export type RuntimeSettings = {
  host: string
  mcpEndpoint: `/${string}`
  port: number
}

function intFromEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number
): number {
  const value = env[key]
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function endpointPath(value: string | undefined): `/${string}` {
  if (!value) return '/mcp'
  return value.startsWith('/') ? (value as `/${string}`) : `/${value}`
}

export function getRuntimeSettings(
  env: NodeJS.ProcessEnv = process.env
): RuntimeSettings {
  return {
    host: env.MCP_LECTURER_HOST ?? '0.0.0.0',
    mcpEndpoint: endpointPath(env.MCP_LECTURER_PATH),
    port: intFromEnv(env, 'MCP_LECTURER_PORT', 7081),
  }
}
