export const DEFAULT_KNOWLEDGE_GRAPH_QUERY_TIMEOUT_MS = 5000

export const KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT = 250
export const KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT = 500
export const KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT = 20
export const KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT = 100
export const KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT = 200

export type KnowledgeGraphConfig = {
  host: string
  port: number
  username?: string
  password?: string
  tls: boolean
  queryTimeoutMs: number
}

type KnowledgeGraphEnvironment = Record<string, string | undefined>

function parseRequiredHost(value: string | undefined): string {
  const host = value?.trim()

  if (!host) {
    throw new Error('KB_FALKORDB_HOST must be a non-empty value')
  }

  return host
}

function parseIntegerInRange({
  name,
  value,
  minimum,
  maximum,
}: {
  name: string
  value: string | undefined
  minimum: number
  maximum: number
}): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`
    )
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`
    )
  }

  return parsed
}

function parseTls(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new Error('KB_FALKORDB_TLS must be either true or false')
}

function optionalValue(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

export function getKnowledgeGraphConfig(
  env: KnowledgeGraphEnvironment = process.env
): KnowledgeGraphConfig {
  const queryTimeoutMs =
    env.KB_FALKORDB_QUERY_TIMEOUT_MS === undefined
      ? DEFAULT_KNOWLEDGE_GRAPH_QUERY_TIMEOUT_MS
      : parseIntegerInRange({
          name: 'KB_FALKORDB_QUERY_TIMEOUT_MS',
          value: env.KB_FALKORDB_QUERY_TIMEOUT_MS,
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        })

  return {
    host: parseRequiredHost(env.KB_FALKORDB_HOST),
    port: parseIntegerInRange({
      name: 'KB_FALKORDB_PORT',
      value: env.KB_FALKORDB_PORT,
      minimum: 1,
      maximum: 65535,
    }),
    username: optionalValue(env.KB_FALKORDB_USERNAME),
    password: optionalValue(env.KB_FALKORDB_PASSWORD),
    tls: parseTls(env.KB_FALKORDB_TLS),
    queryTimeoutMs,
  }
}
