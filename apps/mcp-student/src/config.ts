export type RuntimeSettings = {
  apiGraphqlEndpoint: string
  host: string
  jwtIssuer: string
  jwtSecret: string
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
  // Dedicated signing secret so a leaked APP_SECRET cannot forge MCP tokens.
  // The fallback keeps local and legacy deployments working until the
  // dedicated secret is populated everywhere.
  const jwtSecret = env.MCP_STUDENT_JWT_SECRET ?? env.APP_SECRET
  if (!jwtSecret) {
    throw new Error('APP_SECRET or MCP_STUDENT_JWT_SECRET is required')
  }

  const jwtIssuer = env.APP_ORIGIN_AUTH
  if (!jwtIssuer) {
    throw new Error('APP_ORIGIN_AUTH is required')
  }

  return {
    apiGraphqlEndpoint:
      env.MCP_STUDENT_GRAPHQL_ENDPOINT ?? `${apiOrigin}/api/graphql`,
    host: env.MCP_STUDENT_HOST ?? '0.0.0.0',
    jwtIssuer,
    jwtSecret,
    mcpEndpoint: endpointPath(env.MCP_STUDENT_PATH),
    port: intFromEnv(env, 'MCP_STUDENT_PORT', 7080),
    // Keeps the historical APP_SECRET default so introducing the dedicated
    // JWT secret does not silently re-key in-flight question references.
    questionRefSecret:
      env.MCP_STUDENT_QUESTION_REF_SECRET ?? env.APP_SECRET ?? jwtSecret,
    questionRefTtlSeconds: intFromEnv(
      env,
      'MCP_STUDENT_QUESTION_REF_TTL_SECONDS',
      20 * 60
    ),
  }
}
