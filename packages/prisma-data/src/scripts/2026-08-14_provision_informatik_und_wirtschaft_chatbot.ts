import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'

const RAW_TOOL_NAME = 'informatik_und_wirtschaft_video_expert'
const TOOL_ALIAS = 'doc_query'
const STRICT_PARAMETERS = { required: true, toolAlias: TOOL_ALIAS }
const DRY_RUN = process.env.DRY_RUN !== 'false'
const VALIDATE_ONLY = process.argv.includes('--validate-only')
const inputUrl = new URL(
  '../data/_local/informatik-und-wirtschaft-chatbot.json',
  import.meta.url
)
const lockUrl = new URL(
  '../data/_local/informatik-und-wirtschaft-chatbot.lock.json',
  import.meta.url
)
let disconnect: (() => Promise<void>) | undefined

type Database = PrismaClient | Prisma.TransactionClient
type AuthType = 'bearer' | 'basic' | 'none' | 'custom'
type CreditResetPeriod = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'

interface ProvisionInput {
  isTemplate: boolean
  courseId: string
  ownerId: string
  chatbotId: string
  disclaimerId: string
  mcpServerId: string
  mcpConfigIds: { tutor: string; explainer: string }
  chatbot: {
    name: string
    description: string
    systemPrompts: {
      tutor: { prompt: string; description: string }
      explainer: { prompt: string; description: string }
    }
    creditInitialCredits: number
    creditResetPeriod: CreditResetPeriod
    creditResetAmount: number
    creditMaxCredits: number
    modelSelection: boolean
    allowedModelIds: string[]
  }
  disclaimer: { name: string; title: string; introText: string }
  mcpServer: {
    name: string
    description: string
    url: string
    authType: AuthType
    authSecretEnvVar: string | null
    passChatbotId: boolean
    chatbotIdHeader: string | null
  }
}

interface ConfigState {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
}

interface ServerState {
  id: string
  name: string
  description: string | null
  url: string
  authType: string
  authSecretHash: string | null
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: unknown
  isActive: boolean
}

interface Snapshot {
  courseOwnerId: string | null
  ownerExists: boolean
  disclaimer: unknown | null
  chatbot: unknown | null
  server: ServerState | null
  serverNameId: string | null
  configsById: Array<ConfigState | null>
  chatbotConfigs: ConfigState[]
  competingChatbots: number
  competingDisclaimers: number
}

interface LockReceipt {
  version: 1
  stage: 'before' | 'after'
  status: 'dry-run' | 'applied'
  payloadHash: string
  beforeStateHash: string
  afterStateHash: string | null
  plannedCreates: number
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,63}$/
const HEADER_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/
const AUTH_TYPES = new Set(['bearer', 'basic', 'none', 'custom'])
const RESET_PERIODS = new Set([
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'NONE',
])

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function keys(value: Record<string, unknown>, allowed: string[], path: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`${path} contains unsupported fields`)
  }
}

function stringValue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  max = 10_000
): string {
  const result = value[key]
  if (typeof result !== 'string' || result.trim() === '') {
    throw new Error(`${path}.${key} must be a non-empty string`)
  }
  if (result.length > max) {
    throw new Error(`${path}.${key} is too long`)
  }
  return result
}

function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  max = 10_000
): string | null {
  const result = value[key]
  if (result === undefined || result === null) return null
  if (typeof result !== 'string' || result.length > max) {
    throw new Error(`${path}.${key} must be a valid string`)
  }
  return result
}

function booleanValue(
  value: Record<string, unknown>,
  key: string,
  path: string
): boolean {
  if (typeof value[key] !== 'boolean') {
    throw new Error(`${path}.${key} must be a boolean`)
  }
  return value[key] as boolean
}

function integerValue(
  value: Record<string, unknown>,
  key: string,
  path: string
): number {
  const result = value[key]
  if (!Number.isInteger(result) || (result as number) < 0) {
    throw new Error(`${path}.${key} must be a non-negative integer`)
  }
  if ((result as number) > 1_000_000) {
    throw new Error(`${path}.${key} is too large`)
  }
  return result as number
}

function uuidValue(
  value: Record<string, unknown>,
  key: string,
  path: string
): string {
  const result = stringValue(value, key, path, 36)
  if (!UUID.test(result)) throw new Error(`${path}.${key} must be a UUID`)
  return result
}

function stringArray(
  value: Record<string, unknown>,
  key: string,
  path: string
): string[] {
  const result = value[key]
  if (!Array.isArray(result) || result.length === 0 || result.length > 50) {
    throw new Error(`${path}.${key} must be a non-empty string array`)
  }
  if (
    result.some(
      (item) =>
        typeof item !== 'string' || item.trim() === '' || item.length > 128
    )
  ) {
    throw new Error(`${path}.${key} contains an invalid string`)
  }
  const strings = result as string[]
  if (new Set(strings).size !== strings.length) {
    throw new Error(`${path}.${key} contains duplicates`)
  }
  return strings
}

function promptValue(value: unknown, path: string) {
  const prompt = record(value, path)
  keys(prompt, ['prompt', 'description'], path)
  return {
    prompt: stringValue(prompt, 'prompt', path, 20_000),
    description: stringValue(prompt, 'description', path, 5_000),
  }
}

export function parseProvisionInput(raw: unknown): ProvisionInput {
  const root = record(raw, 'input')
  keys(
    root,
    [
      'isTemplate',
      'courseId',
      'ownerId',
      'chatbotId',
      'disclaimerId',
      'mcpServerId',
      'mcpConfigIds',
      'chatbot',
      'disclaimer',
      'mcpServer',
    ],
    'input'
  )

  const configIds = record(root.mcpConfigIds, 'input.mcpConfigIds')
  keys(configIds, ['tutor', 'explainer'], 'input.mcpConfigIds')
  const mcpConfigIds = {
    tutor: uuidValue(configIds, 'tutor', 'input.mcpConfigIds'),
    explainer: uuidValue(configIds, 'explainer', 'input.mcpConfigIds'),
  }
  if (mcpConfigIds.tutor === mcpConfigIds.explainer) {
    throw new Error('input.mcpConfigIds must contain two different UUIDs')
  }

  const chatbot = record(root.chatbot, 'input.chatbot')
  keys(
    chatbot,
    [
      'name',
      'description',
      'systemPrompts',
      'creditInitialCredits',
      'creditResetPeriod',
      'creditResetAmount',
      'creditMaxCredits',
      'modelSelection',
      'allowedModelIds',
    ],
    'input.chatbot'
  )
  const prompts = record(chatbot.systemPrompts, 'input.chatbot.systemPrompts')
  keys(prompts, ['tutor', 'explainer'], 'input.chatbot.systemPrompts')
  const resetPeriod = stringValue(
    chatbot,
    'creditResetPeriod',
    'input.chatbot',
    16
  )
  if (!RESET_PERIODS.has(resetPeriod)) {
    throw new Error('input.chatbot.creditResetPeriod is unsupported')
  }

  const disclaimer = record(root.disclaimer, 'input.disclaimer')
  keys(disclaimer, ['name', 'title', 'introText'], 'input.disclaimer')

  const mcpServer = record(root.mcpServer, 'input.mcpServer')
  keys(
    mcpServer,
    [
      'name',
      'description',
      'url',
      'authType',
      'authSecretEnvVar',
      'passChatbotId',
      'chatbotIdHeader',
    ],
    'input.mcpServer'
  )
  const authType = stringValue(mcpServer, 'authType', 'input.mcpServer', 16)
  if (!AUTH_TYPES.has(authType)) {
    throw new Error('input.mcpServer.authType is unsupported')
  }
  const authSecretEnvVar = optionalString(
    mcpServer,
    'authSecretEnvVar',
    'input.mcpServer',
    64
  )
  if (
    (authType === 'none' && authSecretEnvVar !== null) ||
    (authType !== 'none' &&
      (authSecretEnvVar === null || !ENV_NAME.test(authSecretEnvVar)))
  ) {
    throw new Error('input.mcpServer credential policy does not match authType')
  }
  const passChatbotId = booleanValue(
    mcpServer,
    'passChatbotId',
    'input.mcpServer'
  )
  const chatbotIdHeader = optionalString(
    mcpServer,
    'chatbotIdHeader',
    'input.mcpServer',
    64
  )
  if (
    passChatbotId
      ? chatbotIdHeader === null || !HEADER_NAME.test(chatbotIdHeader)
      : chatbotIdHeader !== null
  ) {
    throw new Error('input.mcpServer chatbot ID header policy is invalid')
  }
  const url = stringValue(mcpServer, 'url', 'input.mcpServer', 2_000)
  try {
    const parsedUrl = new URL(url)
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.username !== '' ||
      parsedUrl.password !== ''
    ) {
      throw new Error('unsupported URL')
    }
  } catch {
    throw new Error(
      'input.mcpServer.url must be an HTTP(S) URL without credentials'
    )
  }

  return {
    isTemplate:
      root.isTemplate === undefined
        ? false
        : booleanValue(root, 'isTemplate', 'input'),
    courseId: uuidValue(root, 'courseId', 'input'),
    ownerId: uuidValue(root, 'ownerId', 'input'),
    chatbotId: uuidValue(root, 'chatbotId', 'input'),
    disclaimerId: uuidValue(root, 'disclaimerId', 'input'),
    mcpServerId: uuidValue(root, 'mcpServerId', 'input'),
    mcpConfigIds,
    chatbot: {
      name: stringValue(chatbot, 'name', 'input.chatbot', 200),
      description: stringValue(chatbot, 'description', 'input.chatbot', 5_000),
      systemPrompts: {
        tutor: promptValue(prompts.tutor, 'input.chatbot.systemPrompts.tutor'),
        explainer: promptValue(
          prompts.explainer,
          'input.chatbot.systemPrompts.explainer'
        ),
      },
      creditInitialCredits: integerValue(
        chatbot,
        'creditInitialCredits',
        'input.chatbot'
      ),
      creditResetPeriod: resetPeriod as CreditResetPeriod,
      creditResetAmount: integerValue(
        chatbot,
        'creditResetAmount',
        'input.chatbot'
      ),
      creditMaxCredits: integerValue(
        chatbot,
        'creditMaxCredits',
        'input.chatbot'
      ),
      modelSelection: booleanValue(chatbot, 'modelSelection', 'input.chatbot'),
      allowedModelIds: stringArray(chatbot, 'allowedModelIds', 'input.chatbot'),
    },
    disclaimer: {
      name: stringValue(disclaimer, 'name', 'input.disclaimer', 200),
      title: stringValue(disclaimer, 'title', 'input.disclaimer', 500),
      introText: stringValue(
        disclaimer,
        'introText',
        'input.disclaimer',
        20_000
      ),
    },
    mcpServer: {
      name: stringValue(mcpServer, 'name', 'input.mcpServer', 200),
      description: stringValue(
        mcpServer,
        'description',
        'input.mcpServer',
        5_000
      ),
      url,
      authType: authType as AuthType,
      authSecretEnvVar,
      passChatbotId,
      chatbotIdHeader,
    },
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonical(entry)).join(',')}]`
  }
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

function loadInput(): ProvisionInput {
  if (!fs.existsSync(inputUrl)) {
    throw new Error(
      'Missing provisioner input in the ignored local data directory'
    )
  }
  return parseProvisionInput(JSON.parse(fs.readFileSync(inputUrl, 'utf8')))
}

function serverState(row: {
  id: string
  name: string
  description: string | null
  url: string
  authType: string
  authSecret: string | null
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: unknown
  isActive: boolean
}): ServerState {
  const { authSecret, ...publicRow } = row
  return {
    ...publicRow,
    authSecretHash: authSecret ? hash(authSecret) : null,
  }
}

function configState(row: ConfigState): ConfigState {
  return row
}

async function readSnapshot(
  db: Database,
  input: ProvisionInput
): Promise<Snapshot> {
  const serverSelect = {
    id: true,
    name: true,
    description: true,
    url: true,
    authType: true,
    authSecret: true,
    passChatbotId: true,
    chatbotIdHeader: true,
    parameters: true,
    isActive: true,
  } as const
  const configSelect = {
    id: true,
    chatbotId: true,
    mcpServerId: true,
    chatMode: true,
    allowedTools: true,
    priority: true,
    isEnabled: true,
    parameters: true,
  } as const

  const [course, owner, disclaimer, chatbot, server, serverByName] =
    await Promise.all([
      db.course.findUnique({
        where: { id: input.courseId },
        select: { ownerId: true },
      }),
      db.user.findUnique({
        where: { id: input.ownerId },
        select: { id: true },
      }),
      db.chatbotDisclaimer.findUnique({
        where: { id: input.disclaimerId },
        select: {
          id: true,
          name: true,
          title: true,
          introText: true,
          mediaUrl: true,
          mediaType: true,
          ownerId: true,
        },
      }),
      db.chatbot.findUnique({
        where: { id: input.chatbotId },
        select: {
          id: true,
          name: true,
          description: true,
          avatar: true,
          systemPrompts: true,
          creditInitialCredits: true,
          creditResetPeriod: true,
          creditResetAmount: true,
          creditMaxCredits: true,
          modelSelection: true,
          allowedModelIds: true,
          allowedReasoningEffortsByModel: true,
          openaiApiKey: true,
          openaiBaseUrl: true,
          disclaimerId: true,
          ownerId: true,
          courseId: true,
        },
      }),
      db.chatbotMCPServer.findUnique({
        where: { id: input.mcpServerId },
        select: serverSelect,
      }),
      db.chatbotMCPServer.findUnique({
        where: { name: input.mcpServer.name },
        select: { id: true },
      }),
    ])

  const [configsById, chatbotConfigs, competingChatbots, competingDisclaimers] =
    await Promise.all([
      db.chatbotMCPConfig.findMany({
        where: {
          id: { in: [input.mcpConfigIds.tutor, input.mcpConfigIds.explainer] },
        },
        select: configSelect,
      }),
      db.chatbotMCPConfig.findMany({
        where: { chatbotId: input.chatbotId },
        orderBy: { id: 'asc' },
        select: configSelect,
      }),
      db.chatbot.count({
        where: {
          courseId: input.courseId,
          name: input.chatbot.name,
          id: { not: input.chatbotId },
        },
      }),
      db.chatbotDisclaimer.count({
        where: {
          ownerId: input.ownerId,
          name: input.disclaimer.name,
          id: { not: input.disclaimerId },
        },
      }),
    ])

  const configById = [
    input.mcpConfigIds.tutor,
    input.mcpConfigIds.explainer,
  ].map((id) => {
    const row = configsById.find((candidate) => candidate.id === id)
    return row ? configState(row) : null
  })

  return {
    courseOwnerId: course?.ownerId ?? null,
    ownerExists: owner !== null,
    disclaimer,
    chatbot,
    server: server ? serverState(server) : null,
    serverNameId: serverByName?.id ?? null,
    configsById: configById,
    chatbotConfigs: chatbotConfigs.map(configState),
    competingChatbots,
    competingDisclaimers,
  }
}

function expected(input: ProvisionInput) {
  return {
    disclaimer: {
      id: input.disclaimerId,
      name: input.disclaimer.name,
      title: input.disclaimer.title,
      introText: input.disclaimer.introText,
      mediaUrl: null,
      mediaType: null,
      ownerId: input.ownerId,
    },
    chatbot: {
      id: input.chatbotId,
      name: input.chatbot.name,
      description: input.chatbot.description,
      avatar: null,
      systemPrompts: input.chatbot.systemPrompts,
      creditInitialCredits: input.chatbot.creditInitialCredits,
      creditResetPeriod: input.chatbot.creditResetPeriod,
      creditResetAmount: input.chatbot.creditResetAmount,
      creditMaxCredits: input.chatbot.creditMaxCredits,
      modelSelection: input.chatbot.modelSelection,
      allowedModelIds: input.chatbot.allowedModelIds,
      allowedReasoningEffortsByModel: null,
      openaiApiKey: null,
      openaiBaseUrl: null,
      disclaimerId: input.disclaimerId,
      ownerId: input.ownerId,
      courseId: input.courseId,
    },
    server: {
      id: input.mcpServerId,
      name: input.mcpServer.name,
      description: input.mcpServer.description,
      url: input.mcpServer.url,
      authType: input.mcpServer.authType,
      passChatbotId: input.mcpServer.passChatbotId,
      chatbotIdHeader: input.mcpServer.chatbotIdHeader,
      parameters: {},
      isActive: false,
      authSecretPresent: input.mcpServer.authType !== 'none',
    },
    configs: [
      {
        id: input.mcpConfigIds.tutor,
        chatbotId: input.chatbotId,
        mcpServerId: input.mcpServerId,
        chatMode: 'tutor',
        allowedTools: [RAW_TOOL_NAME],
        priority: 0,
        isEnabled: true,
        parameters: STRICT_PARAMETERS,
      },
      {
        id: input.mcpConfigIds.explainer,
        chatbotId: input.chatbotId,
        mcpServerId: input.mcpServerId,
        chatMode: 'explainer',
        allowedTools: [RAW_TOOL_NAME],
        priority: 0,
        isEnabled: true,
        parameters: STRICT_PARAMETERS,
      },
    ],
  }
}

function compareServer(actual: ServerState, expectedServer: unknown): boolean {
  const { authSecretHash, ...publicState } = actual
  return (
    canonical({
      ...publicState,
      authSecretPresent: authSecretHash !== null,
    }) === canonical(expectedServer)
  )
}

function mode(snapshot: Snapshot, input: ProvisionInput): 'create' | 'noop' {
  if (snapshot.courseOwnerId !== input.ownerId || !snapshot.ownerExists) {
    throw new Error('The reviewed course or owner does not exist')
  }
  if (snapshot.competingChatbots > 0 || snapshot.competingDisclaimers > 0) {
    throw new Error('A competing chatbot or disclaimer already exists')
  }
  if (snapshot.serverNameId && snapshot.serverNameId !== input.mcpServerId) {
    throw new Error('The target MCP server name belongs to another row')
  }
  if (
    snapshot.configsById.some(
      (config) => config !== null && config.chatbotId !== input.chatbotId
    )
  ) {
    throw new Error('A target MCP configuration ID belongs to another chatbot')
  }
  const configIds = new Set([
    input.mcpConfigIds.tutor,
    input.mcpConfigIds.explainer,
  ])
  if (snapshot.chatbotConfigs.some((config) => !configIds.has(config.id))) {
    throw new Error(
      'The target chatbot already has competing MCP configurations'
    )
  }

  const desired = expected(input)
  const present = [
    snapshot.disclaimer,
    snapshot.chatbot,
    snapshot.server,
    ...snapshot.configsById,
  ].filter((row) => row !== null).length
  if (present === 0) return 'create'
  if (present !== 5) {
    throw new Error('The target provision is partial; no writes are allowed')
  }
  const configsMatch = snapshot.configsById.every(
    (actual, index) =>
      actual !== null && canonical(actual) === canonical(desired.configs[index])
  )
  const allConfigsMatch =
    snapshot.chatbotConfigs.length === desired.configs.length &&
    snapshot.chatbotConfigs.every((actual) =>
      desired.configs.some((config) => canonical(actual) === canonical(config))
    )
  if (
    !snapshot.disclaimer ||
    canonical(snapshot.disclaimer) !== canonical(desired.disclaimer) ||
    !snapshot.chatbot ||
    canonical(snapshot.chatbot) !== canonical(desired.chatbot) ||
    !snapshot.server ||
    !compareServer(snapshot.server, desired.server) ||
    !configsMatch ||
    !allConfigsMatch
  ) {
    throw new Error('The target provision exists but does not match exactly')
  }
  return 'noop'
}

function receipt(): LockReceipt | null {
  if (!fs.existsSync(lockUrl)) return null
  const raw: unknown = JSON.parse(fs.readFileSync(lockUrl, 'utf8'))
  if (
    typeof raw !== 'object' ||
    raw === null ||
    Array.isArray(raw) ||
    (raw as Record<string, unknown>).version !== 1 ||
    !['before', 'after'].includes(
      String((raw as Record<string, unknown>).stage)
    ) ||
    !['dry-run', 'applied'].includes(
      String((raw as Record<string, unknown>).status)
    ) ||
    typeof (raw as Record<string, unknown>).payloadHash !== 'string' ||
    typeof (raw as Record<string, unknown>).beforeStateHash !== 'string' ||
    ((raw as Record<string, unknown>).afterStateHash !== null &&
      typeof (raw as Record<string, unknown>).afterStateHash !== 'string') ||
    typeof (raw as Record<string, unknown>).plannedCreates !== 'number'
  ) {
    throw new Error('The local provisioner lock is invalid')
  }
  return raw as LockReceipt
}

function writeReceipt(value: LockReceipt) {
  fs.mkdirSync(new URL('.', lockUrl), { recursive: true })
  fs.writeFileSync(lockUrl, `${JSON.stringify(value, null, 2)}\n`)
}

function authSecret(input: ProvisionInput): string | null {
  if (input.mcpServer.authType === 'none') return null
  const value = input.mcpServer.authSecretEnvVar
    ? process.env[input.mcpServer.authSecretEnvVar]
    : undefined
  if (!value) {
    throw new Error(
      'The configured MCP credential environment variable is empty'
    )
  }
  return value
}

async function verifyExistingSecret(
  db: Database,
  input: ProvisionInput,
  snapshot: Snapshot,
  secret: string | null,
  decryptSecret: (value: string) => string
) {
  if (!snapshot.server || input.mcpServer.authType === 'none') return
  const row = await db.chatbotMCPServer.findUnique({
    where: { id: input.mcpServerId },
    select: { authSecret: true },
  })
  if (!row?.authSecret || !secret) {
    throw new Error('The existing MCP credential is missing')
  }
  try {
    if (decryptSecret(row.authSecret) !== secret) throw new Error('mismatch')
  } catch {
    throw new Error('The existing MCP credential does not match the payload')
  }
}

async function createRows(
  db: Database,
  input: ProvisionInput,
  secret: string | null,
  encryptSecret: (value: string) => string
) {
  const desired = expected(input)
  await db.chatbotDisclaimer.create({ data: desired.disclaimer })
  await db.chatbotMCPServer.create({
    data: {
      id: desired.server.id,
      name: desired.server.name,
      description: desired.server.description,
      url: desired.server.url,
      authType: desired.server.authType,
      authSecret: secret === null ? null : encryptSecret(secret),
      passChatbotId: desired.server.passChatbotId,
      chatbotIdHeader: desired.server.chatbotIdHeader,
      parameters: desired.server.parameters as Prisma.InputJsonValue,
      isActive: desired.server.isActive,
    },
  })
  await db.chatbot.create({
    data: {
      ...desired.chatbot,
      systemPrompts: input.chatbot.systemPrompts as Prisma.InputJsonValue,
    },
  })
  for (const config of desired.configs) {
    await db.chatbotMCPConfig.create({
      data: {
        ...config,
        allowedTools: config.allowedTools as Prisma.InputJsonValue,
        parameters: config.parameters as Prisma.InputJsonValue,
      },
    })
  }
}

async function main() {
  const input = loadInput()
  const payloadHash = hash(input)
  if (VALIDATE_ONLY) {
    console.log(
      'Provisioner input validated: one chatbot, one MCP server, two MCP configurations'
    )
    return
  }
  if (input.isTemplate) {
    throw new Error(
      'The ignored provisioner input is still marked as a template'
    )
  }

  const [{ prisma }, { decrypt, encrypt }] = await Promise.all([
    import('@klicker-uzh/prisma'),
    import('@klicker-uzh/util'),
  ])
  disconnect = () => prisma.$disconnect()

  const savedReceipt = receipt()
  if (savedReceipt?.stage === 'after') {
    throw new Error('The provisioner already has an after-state receipt')
  }
  const before = await readSnapshot(prisma, input)
  const beforeStateHash = hash(before)
  const beforeMode = mode(before, input)
  const plannedCreates = beforeMode === 'create' ? 5 : 0

  if (DRY_RUN) {
    if (
      savedReceipt &&
      (savedReceipt.payloadHash !== payloadHash ||
        savedReceipt.beforeStateHash !== beforeStateHash)
    ) {
      throw new Error(
        'The dry-run lock does not match the current payload or state'
      )
    }
    if (!savedReceipt) {
      writeReceipt({
        version: 1,
        stage: 'before',
        status: 'dry-run',
        payloadHash,
        beforeStateHash,
        afterStateHash: null,
        plannedCreates,
      })
    }
    console.log(`Dry run complete: ${plannedCreates} rows would be created`)
    return
  }

  if (
    !savedReceipt ||
    savedReceipt.status !== 'dry-run' ||
    savedReceipt.payloadHash !== payloadHash ||
    savedReceipt.beforeStateHash !== beforeStateHash
  ) {
    throw new Error(
      'Apply requires a matching dry-run lock with unchanged state'
    )
  }

  const secret = authSecret(input)
  const after = await prisma.$transaction(
    async (tx) => {
      const transactionBefore = await readSnapshot(tx, input)
      if (hash(transactionBefore) !== savedReceipt.beforeStateHash) {
        throw new Error(
          'The transaction starting state differs from the dry-run lock'
        )
      }
      if (mode(transactionBefore, input) !== beforeMode) {
        throw new Error('The transaction mode differs from the dry-run lock')
      }
      await verifyExistingSecret(tx, input, transactionBefore, secret, decrypt)
      if (beforeMode === 'create') await createRows(tx, input, secret, encrypt)
      const transactionAfter = await readSnapshot(tx, input)
      if (mode(transactionAfter, input) !== 'noop') {
        throw new Error('Provision verification failed inside the transaction')
      }
      return transactionAfter
    },
    { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
  )

  writeReceipt({
    version: 1,
    stage: 'after',
    status: 'applied',
    payloadHash,
    beforeStateHash,
    afterStateHash: hash(after),
    plannedCreates,
  })
  console.log(`Apply complete: ${plannedCreates} rows created and verified`)
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Provisioner failed')
    process.exitCode = 1
  } finally {
    await disconnect?.()
  }
}
