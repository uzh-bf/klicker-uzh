import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type {
  CohortActivationConfigRecord,
  CohortActivationServerRecord,
  CohortActivationTransactionStore,
  JsonValue,
} from './doc-query-cohort-activation.js'
import {
  FINANCEWIKI_KB_ID,
  type FinanceWikiAttachmentReceiptStore,
  type FinanceWikiAttachmentStore,
  planFinanceWikiAttachment,
} from './financewiki-attachment.js'

const BASE_KB_ID = '00000000-0000-4000-8000-000000000301'
const SERVER_ID = '00000000-0000-4000-8000-000000000101'
const CHATBOT_ID = '00000000-0000-4000-8000-000000000102'
const SHARED_COLLECTION = 'klicker_course_materials_v1'
const EXPECTED_CONSUMER_KEYS = new Set([
  'schema_version',
  'producer_sha256',
  'catalog_name',
  'project_id',
  'collection',
  'kb_id',
  'resource_active',
  'tool_name',
  'records',
])

type FinanceWikiConsumer = {
  schema_version: number
  producer_sha256: string
  catalog_name: string
  project_id: string
  collection: string
  kb_id: string
  resource_active: boolean
  tool_name: string
  records: unknown[]
}

type FixtureArguments = {
  identityPath: string
  expectedProducerSha256: string
  outputPath: string | null
}

function fail(message: string): never {
  throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseArguments(argv: readonly string[]): FixtureArguments {
  let identityPath: string | null = null
  let expectedProducerSha256: string | null = null
  let outputPath: string | null = null
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) fail(`${argument} requires a value`)
    if (argument === '--identity') identityPath = value
    else if (argument === '--expected-producer-sha256') {
      expectedProducerSha256 = value
    } else if (argument === '--output') outputPath = value
    else fail('unsupported fixture argument')
    index += 1
  }
  if (!identityPath || !expectedProducerSha256) {
    fail('--identity and --expected-producer-sha256 are required')
  }
  return { identityPath, expectedProducerSha256, outputPath }
}

function parseConsumer(
  value: unknown,
  expectedDigest: string
): FinanceWikiConsumer {
  if (!/^[0-9a-f]{64}$/.test(expectedDigest)) {
    fail('expected producer SHA-256 is malformed')
  }
  if (!isRecord(value)) fail('FinanceWiki consumer must be an object')
  const keys = Object.keys(value)
  if (
    keys.length !== EXPECTED_CONSUMER_KEYS.size ||
    keys.some((key) => !EXPECTED_CONSUMER_KEYS.has(key))
  ) {
    fail('FinanceWiki consumer has an unsupported shape')
  }
  const expected = {
    schema_version: 1,
    producer_sha256: expectedDigest,
    catalog_name: 'financewiki_public_web',
    project_id: 'catalog-financewiki',
    collection: SHARED_COLLECTION,
    kb_id: FINANCEWIKI_KB_ID,
    resource_active: true,
    tool_name: 'doc_query',
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue)
      fail(`FinanceWiki consumer ${key} drifted`)
  }
  if (!Array.isArray(value.records) || value.records.length === 0) {
    fail('FinanceWiki consumer records are required')
  }
  return value as FinanceWikiConsumer
}

function makeServer(): CohortActivationServerRecord {
  return {
    id: SERVER_ID,
    name: 'KB',
    description: 'Synthetic existing shared KB server',
    url: 'https://kb.synthetic.invalid/mcp',
    authType: 'bearer',
    passChatbotId: true,
    chatbotIdHeader: 'Chatbot-ID',
    parameters: {},
    hasAuthSecret: true,
    isActive: true,
    updatedAt: new Date('2026-09-04T10:00:00.000Z'),
  }
}

function makeConfig(
  id: string,
  chatMode: string
): CohortActivationConfigRecord {
  return {
    id,
    chatbotId: CHATBOT_ID,
    mcpServerId: SERVER_ID,
    chatMode,
    allowedTools: ['doc_query'],
    priority: 4,
    isEnabled: true,
    parameters: {
      required: true,
      toolAlias: 'doc_query',
      kb_id: BASE_KB_ID,
    },
    updatedAt: new Date('2026-09-04T10:00:00.000Z'),
  }
}

function createReadOnlyFixtureStore(): {
  store: FinanceWikiAttachmentStore
  server: CohortActivationServerRecord
  configs: CohortActivationConfigRecord[]
} {
  const server = makeServer()
  const configs = [
    makeConfig('00000000-0000-4000-8000-000000000201', 'review'),
    makeConfig('00000000-0000-4000-8000-000000000202', 'tutor'),
  ]
  const transactionStore: CohortActivationTransactionStore = {
    async findServerByName(name) {
      return name === server.name ? server : null
    },
    async findServerById(id) {
      return id === server.id ? server : null
    },
    async findConfigById(id) {
      return configs.find((config) => config.id === id) ?? null
    },
    async findConfigByChatbotServer(chatbotId, mcpServerId, chatMode) {
      return (
        configs.find(
          (config) =>
            config.chatbotId === chatbotId &&
            config.mcpServerId === mcpServerId &&
            config.chatMode === chatMode
        ) ?? null
      )
    },
    async findConfigsByServerId(mcpServerId) {
      return configs.filter((config) => config.mcpServerId === mcpServerId)
    },
    async createServer() {
      fail('the attachment fixture plan must stay read-only')
    },
    async createConfig() {
      fail('the attachment fixture plan must stay read-only')
    },
    async updateConfig() {
      fail('the attachment fixture plan must stay read-only')
    },
  }
  return {
    server,
    configs,
    store: {
      async transaction(callback) {
        return callback(transactionStore)
      },
    },
  }
}

const emptyReceiptStore: FinanceWikiAttachmentReceiptStore = {
  async read() {
    return null
  },
  async write() {
    fail('the attachment fixture plan must not write a receipt')
  },
}

export async function verifyFinanceWikiAttachmentFixture(
  identityPath: string,
  expectedProducerSha256: string
): Promise<Record<string, unknown>> {
  const consumer = parseConsumer(
    JSON.parse(await readFile(identityPath, 'utf8')) as unknown,
    expectedProducerSha256
  )
  const fixture = createReadOnlyFixtureStore()
  const targets = fixture.configs.map(({ chatbotId, chatMode }) => ({
    chatbotId,
    chatMode,
  }))
  const plan = await planFinanceWikiAttachment(
    fixture.store,
    { version: 1, targets },
    emptyReceiptStore
  )
  const plannedAuthorizedKbIds = [BASE_KB_ID, FINANCEWIKI_KB_ID].sort(
    (left, right) => left.localeCompare(right)
  )
  if (
    plan.status !== 'ready' ||
    plan.targetCount !== fixture.configs.length ||
    plan.wouldAttach !== fixture.configs.length ||
    plan.alreadyAttached !== 0
  ) {
    fail('the production attachment planner did not cover every enabled mode')
  }
  const oneToolPerConfig = fixture.configs.every(
    (config) =>
      JSON.stringify(config.allowedTools) === JSON.stringify(['doc_query'])
  )
  const priorParameters = fixture.configs.map((config) =>
    structuredClone(config.parameters as JsonValue)
  )
  return {
    status: 'proof',
    identity: {
      schema_version: consumer.schema_version,
      producer_sha256: consumer.producer_sha256,
      catalog_name: consumer.catalog_name,
      project_id: consumer.project_id,
      collection: consumer.collection,
      kb_id: consumer.kb_id,
      resource_active: consumer.resource_active,
      tool_name: consumer.tool_name,
      record_count: consumer.records.length,
    },
    server_name: fixture.server.name,
    server_count: 1,
    config_count: fixture.configs.length,
    one_tool_per_config: oneToolPerConfig,
    existing_tool_name: 'doc_query',
    prior_parameters: priorParameters,
    planned_authorized_kb_ids: plannedAuthorizedKbIds,
    plan,
    proof: {
      uses_production_planner: true,
      covers_every_enabled_mode: plan.targetCount === fixture.configs.length,
      creates_server_or_config: false,
      writes_database_or_receipt: false,
    },
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const proof = await verifyFinanceWikiAttachmentFixture(
    args.identityPath,
    args.expectedProducerSha256
  )
  const rendered = `${JSON.stringify(proof, null, 2)}\n`
  if (args.outputPath) await writeFile(args.outputPath, rendered, 'utf8')
  else process.stdout.write(rendered)
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'fixture failed'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
