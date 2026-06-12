import { Redis } from 'ioredis'

const CHATBOT_GRAPH_PREFIX = 'klickeruzh:chatbot:'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type FalkorDBConfig = {
  host: string
  port: number
  username: string
  password: string
}

export type FalkorDBEnv = Record<string, string | undefined>

type FalkorDBEnvKey =
  | 'FALKORDB_HOST'
  | 'FALKORDB_PORT'
  | 'FALKORDB_USERNAME'
  | 'FALKORDB_PASSWORD'

export type FalkorDBClient = {
  call(command: string, ...args: string[]): Promise<unknown>
  quit?(): Promise<unknown>
}

export type ChatbotGraphArgs = {
  chatbotId: string
  client?: FalkorDBClient
}

export type ChatbotGraphQueryArgs = ChatbotGraphArgs & {
  query: string
}

export function getChatbotGraphName(chatbotId: string): string {
  if (!UUID_PATTERN.test(chatbotId)) {
    throw new Error('chatbotId must be a valid UUID')
  }

  return `${CHATBOT_GRAPH_PREFIX}${chatbotId}`
}

export function loadFalkorDBConfig(
  env: FalkorDBEnv = process.env
): FalkorDBConfig {
  const host = requireEnvValue(env, 'FALKORDB_HOST')
  const username = requireEnvValue(env, 'FALKORDB_USERNAME')
  const password = requireEnvValue(env, 'FALKORDB_PASSWORD')
  const rawPort = requireEnvValue(env, 'FALKORDB_PORT')
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FALKORDB_PORT must be an integer between 1 and 65535')
  }

  return {
    host,
    port,
    username,
    password,
  }
}

export function createFalkorDBClient(
  config: FalkorDBConfig = loadFalkorDBConfig()
): FalkorDBClient {
  return new Redis({
    family: 4,
    host: config.host,
    password: config.password,
    port: config.port,
    username: config.username,
  })
}

export async function createChatbotGraph(
  args: ChatbotGraphArgs
): Promise<void> {
  const graphName = getChatbotGraphName(args.chatbotId)
  const query = createGraphMetadataQuery(args.chatbotId)

  await withFalkorDBClient(args.client, async (client) => {
    await client.call('GRAPH.QUERY', graphName, query)
  })
}

export async function deleteChatbotGraph(
  args: ChatbotGraphArgs
): Promise<void> {
  const graphName = getChatbotGraphName(args.chatbotId)

  await withFalkorDBClient(args.client, async (client) => {
    await client.call('GRAPH.DELETE', graphName)
  })
}

export async function readChatbotGraph(
  args: ChatbotGraphQueryArgs
): Promise<unknown> {
  const graphName = getChatbotGraphName(args.chatbotId)
  const query = requireQuery(args.query)

  return await withFalkorDBClient(args.client, async (client) => {
    return await client.call('GRAPH.RO_QUERY', graphName, query)
  })
}

export async function writeChatbotGraph(
  args: ChatbotGraphQueryArgs
): Promise<unknown> {
  const graphName = getChatbotGraphName(args.chatbotId)
  const query = requireQuery(args.query)

  return await withFalkorDBClient(args.client, async (client) => {
    return await client.call('GRAPH.QUERY', graphName, query)
  })
}

function createGraphMetadataQuery(chatbotId: string): string {
  // TODO: Upload course/chatbot source data into this graph once the ingestion
  // pipeline is available for chatbot-specific knowledge graphs.
  return (
    'MERGE (:GraphMetadata {' +
    'managedBy: "klickeruzh", ' +
    'resource: "chatbot", ' +
    `chatbotId: "${chatbotId}"` +
    '}) RETURN 1'
  )
}

function requireEnvValue(env: FalkorDBEnv, key: FalkorDBEnvKey): string {
  const value = env[key]?.trim()

  if (!value) {
    throw new Error(`${key} is required`)
  }

  return value
}

function requireQuery(query: string): string {
  if (!query.trim()) {
    throw new Error('query must not be empty')
  }

  return query
}

async function withFalkorDBClient<T>(
  client: FalkorDBClient | undefined,
  operation: (client: FalkorDBClient) => Promise<T>
): Promise<T> {
  if (client) {
    return await operation(client)
  }

  const createdClient = createFalkorDBClient()

  try {
    return await operation(createdClient)
  } finally {
    await createdClient.quit?.()
  }
}
