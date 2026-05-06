export type RuntimeSettings = {
  appSecret: string
  apiGraphqlEndpoint: string
  host: string
  jwtIssuer?: string
  mcpEndpoint: `/${string}`
  port: number
  questionRefSecret: string
  questionRefTtlSeconds: number
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
  const apiOrigin = (env.APP_ORIGIN_API ?? 'http://localhost:3000').replace(
    /\/+$/,
    ''
  )
  const appSecret = env.APP_SECRET ?? 'abcd'

  return {
    appSecret,
    apiGraphqlEndpoint:
      env.MCP_STUDENT_GRAPHQL_ENDPOINT ?? `${apiOrigin}/api/graphql`,
    host: env.MCP_STUDENT_HOST ?? '0.0.0.0',
    jwtIssuer: env.APP_ORIGIN_AUTH,
    mcpEndpoint: endpointPath(env.MCP_STUDENT_PATH),
    port: intFromEnv(env, 'MCP_STUDENT_PORT', 7080),
    questionRefSecret: env.MCP_STUDENT_QUESTION_REF_SECRET ?? appSecret,
    questionRefTtlSeconds: intFromEnv(
      env,
      'MCP_STUDENT_QUESTION_REF_TTL_SECONDS',
      20 * 60
    ),
  }
}
