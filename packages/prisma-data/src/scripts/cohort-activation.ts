import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

export const SOURCE_SERVER_NAME = 'Klicker-compat' as const
export const TARGET_SERVER_NAME = 'KB' as const
export const TARGET_AUTH_TYPE = 'scope_token' as const
export const DOC_QUERY_TOOL = 'doc_query' as const
export const ACTIVATION_RECEIPT_VERSION = 1 as const

export const EXPECTED_CORPORA = 15 as const
export const EXPECTED_COURSES = 16 as const
export const EXPECTED_CHATBOTS = 22 as const
export const EXPECTED_CONFIGURATIONS = 48 as const
export const EXPECTED_BINDINGS = EXPECTED_CHATBOTS
export const EXPECTED_EXCLUDED_CONFIGURATIONS = 4 as const
export const EXPECTED_EXCLUDED_CHATBOTS = 2 as const

export const EXCLUDED_SOURCE_TOOLS = [
  'bf1_expert',
  'df_cf2_expert',
  'vorkurs2_expert',
] as const

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type FrozenConfiguration = {
  allowedTools: string[]
  chatbotId: string
  chatMode: string
  configId: string
  parameters: JsonValue
  priority: number
  sourceServerId: string
  alias?: string
}

export type FrozenCorpus = {
  chatbotIds: string[]
  configurations: FrozenConfiguration[]
  courseIds: string[]
  kbId: string
  kbName: string
  ownerId: string
  sourceCollection: string
  targetCollection: string
  tool: string
  description?: string | null
  alias?: string
}

export type FrozenExcludedConfiguration = {
  chatbotId: string
  chatMode: string
  configId: string
  serverId: string
  tool: string
}

export type FrozenCohortManifest = {
  collection: string
  corpora: FrozenCorpus[]
  environment: string
  excluded: FrozenExcludedConfiguration[]
  singletonCanaryKbId: string
  version: number
  fingerprint?: string
}

export type ActivationTarget = {
  description: string
  url: string
}

export type KnowledgeBaseRecord = {
  id: string
  name: string
  description: string | null
  ownerId: string
  deletedAt: Date | null
  updatedAt: Date
}

export type ChatbotRecord = {
  id: string
  courseId: string
  ownerId: string
  updatedAt: Date
}

export type ActivationServerRecord = {
  id: string
  name: string
  description: string | null
  url: string
  authType: string
  authSecret: string | null
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: JsonValue
  isActive: boolean
  updatedAt: Date
}

export type ActivationConfigRecord = {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonValue
  priority: number
  isEnabled: boolean
  parameters: JsonValue
  updatedAt: Date
}

export type ActivationBindingRecord = {
  id: string
  kbId: string
  chatbotId: string
  isEnabled: boolean
  updatedAt: Date
}

export type ActivationServerCreate = {
  name: string
  description: string
  url: string
  authType: string
  authSecret: string
  passChatbotId: false
  chatbotIdHeader: null
  parameters: JsonValue
  isActive: true
}

export type ActivationKnowledgeBaseCreate = {
  id: string
  name: string
  description: string | null
  ownerId: string
}

export type ActivationBindingCreate = {
  kbId: string
  chatbotId: string
  isEnabled: false
}

export type ActivationConfigCreate = {
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonValue
  priority: number
  isEnabled: false
  parameters: JsonValue
}

export type ActivationTransactionStore = {
  findKnowledgeBaseById(id: string): Promise<KnowledgeBaseRecord | null>
  findKnowledgeBasesByName(name: string): Promise<KnowledgeBaseRecord[]>
  findChatbotById(id: string): Promise<ChatbotRecord | null>
  findServersByName(name: string): Promise<ActivationServerRecord[]>
  findConfigById(id: string): Promise<ActivationConfigRecord | null>
  findConfigsByServerId(mcpServerId: string): Promise<ActivationConfigRecord[]>
  findBindingsByChatbotId(chatbotId: string): Promise<ActivationBindingRecord[]>
  createKnowledgeBase(
    data: ActivationKnowledgeBaseCreate
  ): Promise<KnowledgeBaseRecord>
  createServer(data: ActivationServerCreate): Promise<ActivationServerRecord>
  createBinding(data: ActivationBindingCreate): Promise<ActivationBindingRecord>
  createConfig(data: ActivationConfigCreate): Promise<ActivationConfigRecord>
  updateBinding(
    snapshot: ActivationBindingRecord,
    isEnabled: boolean
  ): Promise<ActivationBindingRecord>
  updateConfig(
    snapshot: ActivationConfigRecord,
    isEnabled: boolean
  ): Promise<ActivationConfigRecord>
}

export type ActivationStore = ActivationTransactionStore & {
  transaction<T>(
    callback: (store: ActivationTransactionStore) => Promise<T>
  ): Promise<T>
}

export type ReceiptAliases = {
  sourceServer: typeof SOURCE_SERVER_NAME
  targetServer: typeof TARGET_SERVER_NAME
  corpora: string[]
  chatbots: string[]
  configurations: string[]
}

export type ReceiptCounts = {
  corpora: typeof EXPECTED_CORPORA
  courses: typeof EXPECTED_COURSES
  chatbots: typeof EXPECTED_CHATBOTS
  configurations: typeof EXPECTED_CONFIGURATIONS
  bindings: typeof EXPECTED_BINDINGS
}

type SafeServerSnapshot = {
  alias: typeof SOURCE_SERVER_NAME | typeof TARGET_SERVER_NAME
  fingerprint: string
  hasTransportCredential: boolean
  isActive: boolean
  updatedAt: string
}

type SafeIdentitySnapshot = {
  alias: string
  fingerprint: string
  updatedAt: string
}

type SafeConfigSnapshot = SafeIdentitySnapshot & {
  chatbotAlias: string
  chatMode: string
  isEnabled: boolean
}

type SafeBindingSnapshot = SafeIdentitySnapshot & {
  chatbotAlias: string
  corpusAlias: string
  isEnabled: boolean
}

export type ActivationReceiptState =
  | 'prepared'
  | 'switching'
  | 'switched'
  | 'rolling_back'
  | 'rolled_back'

export type ActivationReceipt = {
  receiptVersion: typeof ACTIVATION_RECEIPT_VERSION
  manifestFingerprint: string
  counts: ReceiptCounts
  aliases: ReceiptAliases
  sourceServer: SafeServerSnapshot
  targetServer: SafeServerSnapshot
  corpora: SafeIdentitySnapshot[]
  chatbots: SafeIdentitySnapshot[]
  legacyConfigurations: SafeConfigSnapshot[]
  bindings: SafeBindingSnapshot[]
  configurations: SafeConfigSnapshot[]
  switchedChatbotAliases: string[]
  pendingChatbotAlias: string | null
  pendingRollbackAliases: string[]
  state: ActivationReceiptState
  payloadDigest: string
}

export type ActivationReceiptIntent = {
  receiptVersion: typeof ACTIVATION_RECEIPT_VERSION
  manifestFingerprint: string
  counts: ReceiptCounts
  aliases: ReceiptAliases
  state: 'preparing'
  payloadDigest: string
}

export type ActivationReceiptPayload =
  | ActivationReceipt
  | ActivationReceiptIntent

export interface ActivationReceiptStore {
  read(): Promise<ActivationReceiptPayload | null>
  write(receipt: ActivationReceiptPayload): Promise<void>
}

export type ActivationOptions = {
  receiptStore?: ActivationReceiptStore
  target: ActivationTarget
  dryRun?: boolean
}

export type ActivationWrites = {
  knowledgeBases: number
  server: number
  bindings: number
  configurations: number
}

export type ActivationResult = {
  status: 'dry-run' | 'prepared' | 'switched' | 'rolled_back' | 'readback'
  manifestFingerprint: string
  counts: ReceiptCounts
  aliases: {
    sourceServer: typeof SOURCE_SERVER_NAME
    targetServer: typeof TARGET_SERVER_NAME
    chatbotAliases: string[]
    switchedChatbotAliases: string[]
  }
  fingerprints: {
    manifest: string
    receipt?: string
  }
  writes: ActivationWrites
  legacyRowsPreserved: true
  receipt?: ActivationReceipt
}

export class CohortActivationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CohortActivationError'
    this.code = code
  }
}

type ManifestIndex = {
  corpusByAlias: Map<string, FrozenCorpus>
  corpusAliasByChatbotId: Map<string, string>
  chatbotAliasForId: Map<string, string>
  chatbotIdByAlias: Map<string, string>
  configByAlias: Map<string, FrozenConfiguration>
  configsByChatbotAlias: Map<string, Array<[string, FrozenConfiguration]>>
  bindingAliasByChatbotAlias: Map<string, string>
  aliases: ReceiptAliases
  counts: ReceiptCounts
  sourceServerIds: Set<string>
}

type InspectedState = {
  sourceServer: ActivationServerRecord
  targetServer: ActivationServerRecord | null
  corpora: Map<string, KnowledgeBaseRecord>
  chatbots: Map<string, ChatbotRecord>
  legacyConfigurations: Map<string, ActivationConfigRecord>
  configurations: Map<string, ActivationConfigRecord | null>
  bindings: Map<string, ActivationBindingRecord | null>
  otherBindingsByChatbotAlias: Map<string, ActivationBindingRecord[]>
}

function fail(code: string, message: string): never {
  throw new CohortActivationError(code, message)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    fail('INVALID_MANIFEST', 'an identifier is invalid')
  }
}

function assertName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !NAME_PATTERN.test(value)) {
    fail('INVALID_MANIFEST', 'a name is invalid')
  }
}

function assertKnowledgeBaseName(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 255 ||
    !value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    fail('INVALID_MANIFEST', 'a knowledge base name is invalid')
  }
}

function assertMode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !MODE_PATTERN.test(value)) {
    fail('INVALID_MANIFEST', 'a chat mode is invalid')
  }
}

function assertNonEmpty(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_MANIFEST', 'a required value is blank')
  }
}

function assertUrl(value: unknown): asserts value is string {
  if (typeof value !== 'string') fail('INVALID_TARGET', 'target URL is invalid')
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    fail('INVALID_TARGET', 'target URL is invalid')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail('INVALID_TARGET', 'target URL must use HTTP or HTTPS')
  }
  if (parsed.username || parsed.password) {
    fail('INVALID_TARGET', 'target URL must not contain credentials')
  }
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(record[key])])
    )
  }
  return value
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function padAlias(index: number): string {
  return String(index + 1).padStart(3, '0')
}

function canonicalManifest(manifest: FrozenCohortManifest): unknown {
  return {
    version: manifest.version,
    collection: manifest.collection,
    environment: manifest.environment,
    singletonCanaryKbId: manifest.singletonCanaryKbId,
    corpora: [...manifest.corpora]
      .sort((left, right) => left.kbId.localeCompare(right.kbId))
      .map((corpus) => ({
        kbId: corpus.kbId,
        kbName: corpus.kbName,
        ownerId: corpus.ownerId,
        description: corpus.description ?? null,
        sourceCollection: corpus.sourceCollection,
        targetCollection: corpus.targetCollection,
        tool: corpus.tool,
        alias: corpus.alias,
        chatbotIds: [...corpus.chatbotIds].sort(),
        courseIds: [...corpus.courseIds].sort(),
        configurations: [...corpus.configurations]
          .sort((left, right) => left.configId.localeCompare(right.configId))
          .map((configuration) => ({
            ...configuration,
            allowedTools: [...configuration.allowedTools],
          })),
      })),
    excluded: [...manifest.excluded].sort((left, right) =>
      left.configId.localeCompare(right.configId)
    ),
  }
}

export function fingerprintManifest(manifest: FrozenCohortManifest): string {
  return fingerprint(canonicalManifest(manifest))
}

export function fingerprintManifestText(contents: string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function assertManifestShape(manifest: FrozenCohortManifest): void {
  if (!isPlainObject(manifest)) fail('INVALID_MANIFEST', 'manifest is invalid')
  if (manifest.version !== 1) {
    fail('INVALID_MANIFEST', 'manifest version is unsupported')
  }
  assertNonEmpty(manifest.collection)
  assertNonEmpty(manifest.environment)
  assertUuid(manifest.singletonCanaryKbId)
  if (!Array.isArray(manifest.corpora) || !Array.isArray(manifest.excluded)) {
    fail('INVALID_MANIFEST', 'manifest collections are invalid')
  }
  if (manifest.corpora.length !== EXPECTED_CORPORA) {
    fail('COHORT_COUNT_MISMATCH', 'corpus count is not approved')
  }
  if (manifest.excluded.length !== EXPECTED_EXCLUDED_CONFIGURATIONS) {
    fail(
      'COHORT_COUNT_MISMATCH',
      'excluded configuration count is not approved'
    )
  }
  if (
    manifest.excluded.some((entry) => !isPlainObject(entry)) ||
    manifest.corpora.some((entry) => !isPlainObject(entry))
  ) {
    fail('INVALID_MANIFEST', 'manifest entries are invalid')
  }
}

export function validateCohortManifest(manifest: FrozenCohortManifest): void {
  assertManifestShape(manifest)
  const corpusIds = new Set<string>()
  const chatbotIds = new Set<string>()
  const courseIds = new Set<string>()
  const configIds = new Set<string>()
  const chatbotModes = new Set<string>()
  const excludedIds = new Set<string>()
  const excludedChatbotIds = new Set<string>()
  const sourceServerIds = new Set<string>()

  for (const corpus of manifest.corpora) {
    assertUuid(corpus.kbId)
    assertUuid(corpus.ownerId)
    assertKnowledgeBaseName(corpus.kbName)
    assertNonEmpty(corpus.sourceCollection)
    assertNonEmpty(corpus.targetCollection)
    assertName(corpus.tool)
    if (EXCLUDED_SOURCE_TOOLS.includes(corpus.tool as never)) {
      fail('EXCLUDED_CORPUS', 'an excluded corpus is present')
    }
    if (corpusIds.has(corpus.kbId)) {
      fail('DUPLICATE_CORPUS', 'a corpus identifier is repeated')
    }
    corpusIds.add(corpus.kbId)
    if (!Array.isArray(corpus.chatbotIds) || !Array.isArray(corpus.courseIds)) {
      fail('INVALID_MANIFEST', 'corpus references are invalid')
    }
    if (corpus.chatbotIds.length === 0 || corpus.courseIds.length === 0) {
      fail('INVALID_MANIFEST', 'a corpus has no owners')
    }
    const localChatbots = new Set<string>()
    const localCourses = new Set<string>()
    for (const chatbotId of corpus.chatbotIds) {
      assertUuid(chatbotId)
      if (localChatbots.has(chatbotId) || chatbotIds.has(chatbotId)) {
        fail('DUPLICATE_CHATBOT', 'a chatbot is assigned more than once')
      }
      localChatbots.add(chatbotId)
      chatbotIds.add(chatbotId)
    }
    for (const courseId of corpus.courseIds) {
      assertUuid(courseId)
      if (localCourses.has(courseId) || courseIds.has(courseId)) {
        fail('DUPLICATE_COURSE', 'a course is assigned more than once')
      }
      localCourses.add(courseId)
      courseIds.add(courseId)
    }
    if (!Array.isArray(corpus.configurations)) {
      fail('INVALID_MANIFEST', 'corpus configurations are invalid')
    }
    const localConfigChatbots = new Set<string>()
    for (const configuration of corpus.configurations) {
      assertUuid(configuration.configId)
      assertUuid(configuration.chatbotId)
      assertUuid(configuration.sourceServerId)
      assertMode(configuration.chatMode)
      if (!localChatbots.has(configuration.chatbotId)) {
        fail(
          'CONFIG_CHATBOT_MISMATCH',
          'a configuration references another corpus'
        )
      }
      if (
        !Array.isArray(configuration.allowedTools) ||
        configuration.allowedTools.length !== 1 ||
        configuration.allowedTools[0] !== corpus.tool
      ) {
        fail('SOURCE_CONFIG_MISMATCH', 'a source allowlist is not frozen')
      }
      if (
        !Number.isInteger(configuration.priority) ||
        configuration.priority < 0
      ) {
        fail('INVALID_MANIFEST', 'a configuration priority is invalid')
      }
      if (
        !isPlainObject(configuration.parameters) ||
        configuration.parameters.required !== true ||
        configuration.parameters.toolAlias !== DOC_QUERY_TOOL
      ) {
        fail('SOURCE_CONFIG_MISMATCH', 'a source parameter shape is not frozen')
      }
      if (configIds.has(configuration.configId)) {
        fail('DUPLICATE_CONFIG', 'a configuration identifier is repeated')
      }
      configIds.add(configuration.configId)
      localConfigChatbots.add(configuration.chatbotId)
      const modeKey = `${configuration.chatbotId}:${configuration.chatMode}`
      if (chatbotModes.has(modeKey)) {
        fail('DUPLICATE_CONFIG', 'a chatbot mode is repeated')
      }
      chatbotModes.add(modeKey)
      sourceServerIds.add(configuration.sourceServerId)
    }
    for (const chatbotId of localChatbots) {
      if (!localConfigChatbots.has(chatbotId)) {
        fail('INVALID_MANIFEST', 'a chatbot has no frozen configuration')
      }
    }
  }

  if (
    chatbotIds.size !== EXPECTED_CHATBOTS ||
    courseIds.size !== EXPECTED_COURSES ||
    configIds.size !== EXPECTED_CONFIGURATIONS
  ) {
    fail(
      'COHORT_COUNT_MISMATCH',
      'chatbot, course, or configuration count is not approved'
    )
  }
  if (sourceServerIds.size === 0) {
    fail('INVALID_MANIFEST', 'source server is missing')
  }
  for (const entry of manifest.excluded) {
    assertUuid(entry.configId)
    assertUuid(entry.chatbotId)
    assertUuid(entry.serverId)
    assertMode(entry.chatMode)
    assertName(entry.tool)
    if (!EXCLUDED_SOURCE_TOOLS.includes(entry.tool as never)) {
      fail('EXCLUDED_CORPUS', 'an excluded entry is not in the exclusion set')
    }
    if (!sourceServerIds.has(entry.serverId)) {
      fail(
        'SOURCE_SERVER_MISMATCH',
        'excluded configuration uses another server'
      )
    }
    if (excludedIds.has(entry.configId) || configIds.has(entry.configId)) {
      fail('DUPLICATE_CONFIG', 'an excluded configuration overlaps the cohort')
    }
    excludedIds.add(entry.configId)
    excludedChatbotIds.add(entry.chatbotId)
    if (chatbotIds.has(entry.chatbotId)) {
      fail('EXCLUDED_CORPUS', 'an excluded chatbot is in the cohort')
    }
  }
  if (excludedChatbotIds.size !== EXPECTED_EXCLUDED_CHATBOTS) {
    fail('COHORT_COUNT_MISMATCH', 'excluded chatbot count is not approved')
  }
  if (
    manifest.fingerprint &&
    manifest.fingerprint !== fingerprintManifest(manifest)
  ) {
    fail('MANIFEST_DRIFT', 'manifest fingerprint does not match contents')
  }
}

export function parseFrozenActivationManifest(
  contents: string,
  expectedFileFingerprint?: string
): FrozenCohortManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    fail('INVALID_MANIFEST', 'manifest JSON is invalid')
  }
  if (!isPlainObject(parsed)) fail('INVALID_MANIFEST', 'manifest is invalid')
  const fileFingerprint = fingerprintManifestText(contents)
  if (expectedFileFingerprint && fileFingerprint !== expectedFileFingerprint) {
    fail('MANIFEST_DRIFT', 'manifest file fingerprint does not match')
  }
  const manifest = parsed as unknown as FrozenCohortManifest
  validateCohortManifest(manifest)
  return { ...manifest, fingerprint: fingerprintManifest(manifest) }
}

export function createFileActivationReceiptStore(
  receiptPath: string
): ActivationReceiptStore {
  const absolutePath = resolve(receiptPath)
  return {
    async read() {
      try {
        const contents = await readFile(absolutePath, 'utf8')
        return JSON.parse(contents) as ActivationReceiptPayload
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return null
        }
        fail('RECEIPT_READ_FAILED', 'could not read activation receipt')
      }
    },
    async write(receipt) {
      await mkdir(dirname(absolutePath), { recursive: true })
      const temporaryPath = `${absolutePath}.tmp-${process.pid}`
      await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      })
      await chmod(temporaryPath, 0o600)
      await rename(temporaryPath, absolutePath)
    },
  }
}

type PrismaActivationClient = Pick<
  PrismaClient,
  'kB' | 'chatbot' | 'kBChatbot' | 'chatbotMCPServer' | 'chatbotMCPConfig'
>

function mapKnowledgeBase(record: {
  id: string
  name: string
  description: string | null
  ownerId: string
  deletedAt: Date | null
  updatedAt: Date
}): KnowledgeBaseRecord {
  return record
}

function mapChatbot(record: {
  id: string
  courseId: string
  course: { ownerId: string }
  updatedAt: Date
}): ChatbotRecord {
  return {
    id: record.id,
    courseId: record.courseId,
    ownerId: record.course.ownerId,
    updatedAt: record.updatedAt,
  }
}

function mapServer(record: {
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
  updatedAt: Date
}): ActivationServerRecord {
  return { ...record, parameters: record.parameters as JsonValue }
}

function mapConfig(record: {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
  updatedAt: Date
}): ActivationConfigRecord {
  return {
    ...record,
    allowedTools: record.allowedTools as JsonValue,
    parameters: record.parameters as JsonValue,
  }
}

function mapBinding(record: {
  id: string
  kbId: string
  chatbotId: string
  isEnabled: boolean
  updatedAt: Date
}): ActivationBindingRecord {
  return record
}

function createPrismaActivationDelegate(
  client: PrismaActivationClient
): ActivationTransactionStore {
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
    updatedAt: true,
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
    updatedAt: true,
  } as const
  const bindingSelect = {
    id: true,
    kbId: true,
    chatbotId: true,
    isEnabled: true,
    updatedAt: true,
  } as const
  const kbSelect = {
    id: true,
    name: true,
    description: true,
    ownerId: true,
    deletedAt: true,
    updatedAt: true,
  } as const

  return {
    async findKnowledgeBaseById(id) {
      const record = await client.kB.findUnique({
        where: { id },
        select: kbSelect,
      })
      return record ? mapKnowledgeBase(record) : null
    },
    async findKnowledgeBasesByName(name) {
      const records = await client.kB.findMany({
        where: { name },
        select: kbSelect,
      })
      return records.map(mapKnowledgeBase)
    },
    async findChatbotById(id) {
      const record = await client.chatbot.findUnique({
        where: { id },
        select: {
          id: true,
          courseId: true,
          updatedAt: true,
          course: { select: { ownerId: true } },
        },
      })
      return record ? mapChatbot(record) : null
    },
    async findServersByName(name) {
      const records = await client.chatbotMCPServer.findMany({
        where: { name },
        select: serverSelect,
      })
      return records.map(mapServer)
    },
    async findConfigById(id) {
      const record = await client.chatbotMCPConfig.findUnique({
        where: { id },
        select: configSelect,
      })
      return record ? mapConfig(record) : null
    },
    async findConfigsByServerId(mcpServerId) {
      const records = await client.chatbotMCPConfig.findMany({
        where: { mcpServerId },
        select: configSelect,
      })
      return records.map(mapConfig)
    },
    async findBindingsByChatbotId(chatbotId) {
      const records = await client.kBChatbot.findMany({
        where: { chatbotId },
        select: bindingSelect,
      })
      return records.map(mapBinding)
    },
    async createKnowledgeBase(data) {
      const record = await client.kB.create({
        data,
        select: kbSelect,
      })
      return mapKnowledgeBase(record)
    },
    async createServer(data) {
      const record = await client.chatbotMCPServer.create({
        data: data as never,
        select: serverSelect,
      })
      return mapServer(record)
    },
    async createBinding(data) {
      const record = await client.kBChatbot.create({
        data,
        select: bindingSelect,
      })
      return mapBinding(record)
    },
    async createConfig(data) {
      const record = await client.chatbotMCPConfig.create({
        data: data as never,
        select: configSelect,
      })
      return mapConfig(record)
    },
    async updateBinding(snapshot, isEnabled) {
      const result = await client.kBChatbot.updateMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
        data: { isEnabled },
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'knowledge base binding changed during switch')
      }
      const updated = await client.kBChatbot.findUnique({
        where: { id: snapshot.id },
        select: bindingSelect,
      })
      if (!updated)
        fail('BINDING_MISSING', 'knowledge base binding disappeared')
      return mapBinding(updated)
    },
    async updateConfig(snapshot, isEnabled) {
      const result = await client.chatbotMCPConfig.updateMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
        data: { isEnabled },
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'target configuration changed during switch')
      }
      const updated = await client.chatbotMCPConfig.findUnique({
        where: { id: snapshot.id },
        select: configSelect,
      })
      if (!updated)
        fail('TARGET_CONFIG_MISSING', 'target configuration disappeared')
      return mapConfig(updated)
    },
  }
}

export function createPrismaActivationStore(
  client: PrismaClient
): ActivationStore {
  return {
    ...createPrismaActivationDelegate(client),
    async transaction(callback) {
      return client.$transaction(
        async (tx) => callback(createPrismaActivationDelegate(tx)),
        { isolationLevel: 'Serializable' }
      )
    },
  }
}

function buildManifestIndex(manifest: FrozenCohortManifest): ManifestIndex {
  validateCohortManifest(manifest)
  const sortedCorpora = [...manifest.corpora].sort((left, right) =>
    left.kbId.localeCompare(right.kbId)
  )
  const corpusByAlias = new Map<string, FrozenCorpus>()
  const corpusAliasByChatbotId = new Map<string, string>()
  sortedCorpora.forEach((corpus, index) => {
    const alias = `corpus-${padAlias(index)}`
    corpusByAlias.set(alias, corpus)
    for (const chatbotId of corpus.chatbotIds) {
      if (corpusAliasByChatbotId.has(chatbotId)) {
        fail('DUPLICATE_CHATBOT', 'a chatbot is assigned to multiple corpora')
      }
      corpusAliasByChatbotId.set(chatbotId, alias)
    }
  })

  const chatbotIds = [...corpusAliasByChatbotId.keys()].sort()
  const chatbotAliasForId = new Map<string, string>()
  const chatbotIdByAlias = new Map<string, string>()
  chatbotIds.forEach((chatbotId, index) => {
    const alias = `chatbot-${padAlias(index)}`
    chatbotAliasForId.set(chatbotId, alias)
    chatbotIdByAlias.set(alias, chatbotId)
  })

  const sortedConfigurations = manifest.corpora
    .flatMap((corpus) => corpus.configurations)
    .sort((left, right) => left.configId.localeCompare(right.configId))
  const configByAlias = new Map<string, FrozenConfiguration>()
  const configsByChatbotAlias = new Map<
    string,
    Array<[string, FrozenConfiguration]>
  >()
  sortedConfigurations.forEach((configuration, index) => {
    const alias = `config-${padAlias(index)}`
    configByAlias.set(alias, configuration)
    const chatbotAlias = chatbotAliasForId.get(configuration.chatbotId)
    if (!chatbotAlias) fail('INVALID_MANIFEST', 'a chatbot alias is missing')
    const list = configsByChatbotAlias.get(chatbotAlias) ?? []
    list.push([alias, configuration])
    configsByChatbotAlias.set(chatbotAlias, list)
  })

  const bindingAliasByChatbotAlias = new Map<string, string>()
  for (const chatbotAlias of chatbotIdByAlias.keys()) {
    const chatbotId = chatbotIdByAlias.get(chatbotAlias)!
    const corpusAlias = corpusAliasByChatbotId.get(chatbotId)
    if (!corpusAlias) fail('INVALID_MANIFEST', 'a corpus alias is missing')
    bindingAliasByChatbotAlias.set(
      chatbotAlias,
      `binding-${corpusAlias}-${chatbotAlias}`
    )
  }

  return {
    corpusByAlias,
    corpusAliasByChatbotId,
    chatbotAliasForId,
    chatbotIdByAlias,
    configByAlias,
    configsByChatbotAlias,
    bindingAliasByChatbotAlias,
    aliases: {
      sourceServer: SOURCE_SERVER_NAME,
      targetServer: TARGET_SERVER_NAME,
      corpora: [...corpusByAlias.keys()].sort(),
      chatbots: [...chatbotIdByAlias.keys()].sort(),
      configurations: [...configByAlias.keys()].sort(),
    },
    counts: {
      corpora: EXPECTED_CORPORA,
      courses: EXPECTED_COURSES,
      chatbots: EXPECTED_CHATBOTS,
      configurations: EXPECTED_CONFIGURATIONS,
      bindings: EXPECTED_BINDINGS,
    },
    sourceServerIds: new Set(
      sortedConfigurations.map((configuration) => configuration.sourceServerId)
    ),
  }
}

function makeIntent(
  index: ManifestIndex,
  manifestFingerprint: string
): ActivationReceiptIntent {
  const withoutDigest = {
    receiptVersion: ACTIVATION_RECEIPT_VERSION,
    manifestFingerprint,
    counts: index.counts,
    aliases: index.aliases,
    state: 'preparing' as const,
  }
  return {
    ...withoutDigest,
    payloadDigest: fingerprint(withoutDigest),
  }
}

function makeReceipt(
  input: Omit<ActivationReceipt, 'receiptVersion' | 'payloadDigest'>
): ActivationReceipt {
  const withoutDigest = {
    receiptVersion: ACTIVATION_RECEIPT_VERSION,
    ...input,
  }
  return {
    ...withoutDigest,
    payloadDigest: fingerprint(withoutDigest),
  }
}

function assertPayloadDigest(payload: ActivationReceiptPayload): void {
  if (payload.receiptVersion !== ACTIVATION_RECEIPT_VERSION) {
    fail('RECEIPT_INVALID', 'receipt version is unsupported')
  }
  const { payloadDigest: _payloadDigest, ...withoutDigest } = payload
  if (fingerprint(withoutDigest) !== payload.payloadDigest) {
    fail('RECEIPT_INVALID', 'receipt digest does not match')
  }
}

function isReceiptIntent(
  payload: ActivationReceiptPayload
): payload is ActivationReceiptIntent {
  return payload.state === 'preparing'
}

async function readReceipt(
  receiptStore: ActivationReceiptStore | undefined
): Promise<ActivationReceiptPayload | null> {
  if (!receiptStore) return null
  const payload = await receiptStore.read()
  if (payload) assertPayloadDigest(payload)
  return payload
}

function assertReceiptMatchesIndex(
  receipt: ActivationReceiptPayload,
  index: ManifestIndex,
  manifestFingerprint: string
): void {
  assertPayloadDigest(receipt)
  if (receipt.manifestFingerprint !== manifestFingerprint) {
    fail('RECEIPT_MISMATCH', 'receipt does not match the manifest')
  }
  if (canonicalJson(receipt.counts) !== canonicalJson(index.counts)) {
    fail('RECEIPT_MISMATCH', 'receipt counts do not match the manifest')
  }
  if (canonicalJson(receipt.aliases) !== canonicalJson(index.aliases)) {
    fail('RECEIPT_MISMATCH', 'receipt aliases do not match the manifest')
  }
}

function serverFingerprint(server: ActivationServerRecord): string {
  return fingerprint({
    id: server.id,
    name: server.name,
    description: server.description,
    url: server.url,
    authType: server.authType,
    authSecret: server.authSecret,
    passChatbotId: server.passChatbotId,
    chatbotIdHeader: server.chatbotIdHeader,
    parameters: server.parameters,
    isActive: server.isActive,
    updatedAt: server.updatedAt,
  })
}

function knowledgeBaseFingerprint(kb: KnowledgeBaseRecord): string {
  return fingerprint(kb)
}

function chatbotFingerprint(chatbot: ChatbotRecord): string {
  return fingerprint(chatbot)
}

function configFingerprint(config: ActivationConfigRecord): string {
  return fingerprint(config)
}

function bindingFingerprint(binding: ActivationBindingRecord): string {
  return fingerprint(binding)
}

function safeServerSnapshot(
  server: ActivationServerRecord,
  alias: typeof SOURCE_SERVER_NAME | typeof TARGET_SERVER_NAME
): SafeServerSnapshot {
  return {
    alias,
    fingerprint: serverFingerprint(server),
    hasTransportCredential: server.authSecret !== null,
    isActive: server.isActive,
    updatedAt: server.updatedAt.toISOString(),
  }
}

function safeIdentitySnapshot(
  alias: string,
  record: { updatedAt: Date },
  recordFingerprint: string
): SafeIdentitySnapshot {
  return {
    alias,
    fingerprint: recordFingerprint,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function safeConfigSnapshot(
  alias: string,
  chatbotAlias: string,
  config: ActivationConfigRecord
): SafeConfigSnapshot {
  return {
    ...safeIdentitySnapshot(alias, config, configFingerprint(config)),
    chatbotAlias,
    chatMode: config.chatMode,
    isEnabled: config.isEnabled,
  }
}

function safeBindingSnapshot(
  alias: string,
  chatbotAlias: string,
  corpusAlias: string,
  binding: ActivationBindingRecord
): SafeBindingSnapshot {
  return {
    ...safeIdentitySnapshot(alias, binding, bindingFingerprint(binding)),
    chatbotAlias,
    corpusAlias,
    isEnabled: binding.isEnabled,
  }
}

function targetConfigData(
  configuration: FrozenConfiguration,
  targetServerId: string
): ActivationConfigCreate {
  return {
    chatbotId: configuration.chatbotId,
    mcpServerId: targetServerId,
    chatMode: configuration.chatMode,
    allowedTools: [DOC_QUERY_TOOL],
    priority: configuration.priority,
    isEnabled: false,
    parameters: { required: true, toolAlias: DOC_QUERY_TOOL },
  }
}

function chatbotAliasFor(index: ManifestIndex, chatbotId: string): string {
  const alias = index.chatbotAliasForId.get(chatbotId)
  if (!alias) fail('INVALID_MANIFEST', 'a chatbot alias is missing')
  return alias
}

function resolveChatbotAlias(index: ManifestIndex, alias: string): string {
  const chatbotId = index.chatbotIdByAlias.get(alias)
  if (!chatbotId)
    fail('UNKNOWN_CHATBOT', 'chatbot alias is not in the manifest')
  return chatbotId
}

function corpusAliasFor(index: ManifestIndex, chatbotId: string): string {
  const corpusAlias = index.corpusAliasByChatbotId.get(chatbotId)
  if (!corpusAlias) fail('INVALID_MANIFEST', 'a corpus alias is missing')
  return corpusAlias
}

function configsForChatbot(
  index: ManifestIndex,
  chatbotAlias: string
): Array<[string, FrozenConfiguration]> {
  const configurations = index.configsByChatbotAlias.get(chatbotAlias)
  if (!configurations || configurations.length === 0) {
    fail('INVALID_MANIFEST', 'chatbot has no mode configurations')
  }
  return configurations
}

function targetConfigKey(chatbotId: string, chatMode: string): string {
  return `${chatbotId}:${chatMode}`
}

function assertSourceServer(
  server: ActivationServerRecord | null
): asserts server is ActivationServerRecord {
  if (!server || server.name !== SOURCE_SERVER_NAME) {
    fail('SOURCE_SERVER_MISSING', 'the unique source server is missing')
  }
  if (!server.isActive || !server.authSecret?.trim()) {
    fail(
      'SOURCE_CREDENTIAL_MISSING',
      'the source transport credential is unavailable'
    )
  }
}

function assertTargetServer(
  server: ActivationServerRecord | null,
  source: ActivationServerRecord,
  target: ActivationTarget
): asserts server is ActivationServerRecord {
  if (!server || server.name !== TARGET_SERVER_NAME) {
    fail('TARGET_SERVER_MISSING', 'the reserved target server is missing')
  }
  if (
    server.description !== target.description ||
    server.url !== target.url ||
    server.authType !== TARGET_AUTH_TYPE ||
    server.authSecret !== source.authSecret ||
    server.passChatbotId !== false ||
    server.chatbotIdHeader !== null ||
    !jsonEqual(server.parameters, {}) ||
    server.isActive !== true
  ) {
    fail(
      'TARGET_SERVER_MISMATCH',
      'the reserved target server contract drifted'
    )
  }
}

function assertKnowledgeBase(
  kb: KnowledgeBaseRecord | null,
  corpus: FrozenCorpus
): asserts kb is KnowledgeBaseRecord {
  if (
    !kb ||
    kb.id !== corpus.kbId ||
    kb.name !== corpus.kbName ||
    kb.ownerId !== corpus.ownerId ||
    kb.description !== (corpus.description ?? null) ||
    kb.deletedAt !== null
  ) {
    fail('KB_DRIFT', 'a deterministic knowledge base row drifted')
  }
}

function assertChatbot(
  chatbot: ChatbotRecord | null,
  corpus: FrozenCorpus
): asserts chatbot is ChatbotRecord {
  if (!chatbot) fail('CHATBOT_MISSING', 'a manifest chatbot is missing')
  if (
    !corpus.chatbotIds.includes(chatbot.id) ||
    !corpus.courseIds.includes(chatbot.courseId) ||
    chatbot.ownerId !== corpus.ownerId
  ) {
    fail('CHATBOT_DRIFT', 'a chatbot owner or course drifted')
  }
}

function assertSourceConfiguration(
  config: ActivationConfigRecord | null,
  configuration: FrozenConfiguration
): asserts config is ActivationConfigRecord {
  if (
    !config ||
    config.id !== configuration.configId ||
    config.chatbotId !== configuration.chatbotId ||
    config.mcpServerId !== configuration.sourceServerId ||
    config.chatMode !== configuration.chatMode ||
    !jsonEqual(config.allowedTools, configuration.allowedTools) ||
    config.priority !== configuration.priority ||
    !jsonEqual(config.parameters, configuration.parameters)
  ) {
    fail('SOURCE_CONFIG_DRIFT', 'a legacy configuration drifted')
  }
}

function assertTargetConfiguration(
  config: ActivationConfigRecord | null,
  configuration: FrozenConfiguration,
  targetServerId: string
): asserts config is ActivationConfigRecord {
  if (
    !config ||
    config.chatbotId !== configuration.chatbotId ||
    config.mcpServerId !== targetServerId ||
    config.chatMode !== configuration.chatMode ||
    !jsonEqual(config.allowedTools, [DOC_QUERY_TOOL]) ||
    config.priority !== configuration.priority ||
    !jsonEqual(config.parameters, {
      required: true,
      toolAlias: DOC_QUERY_TOOL,
    })
  ) {
    fail('TARGET_CONFIG_DRIFT', 'a target configuration drifted')
  }
}

function assertBinding(
  binding: ActivationBindingRecord | null,
  kbId: string,
  chatbotId: string
): asserts binding is ActivationBindingRecord {
  if (!binding || binding.kbId !== kbId || binding.chatbotId !== chatbotId) {
    fail('BINDING_DRIFT', 'a knowledge base binding drifted')
  }
}

async function findTargetServer(
  store: ActivationTransactionStore
): Promise<ActivationServerRecord | null> {
  const servers = await store.findServersByName(TARGET_SERVER_NAME)
  if (servers.length > 1) {
    fail('TARGET_SERVER_DRIFT', 'target server ownership is not unique')
  }
  return servers[0] ?? null
}

async function inspectCohortState(
  store: ActivationTransactionStore,
  index: ManifestIndex,
  target: ActivationTarget
): Promise<InspectedState> {
  const sourceServers = await store.findServersByName(SOURCE_SERVER_NAME)
  if (sourceServers.length !== 1) {
    fail('SOURCE_SERVER_MISSING', 'server ownership is not unique')
  }
  const sourceServer = sourceServers[0]!
  assertSourceServer(sourceServer)

  const corpora = new Map<string, KnowledgeBaseRecord>()
  for (const [alias, corpus] of index.corpusByAlias.entries()) {
    const kb = await store.findKnowledgeBaseById(corpus.kbId)
    if (kb) {
      assertKnowledgeBase(kb, corpus)
      const sameName = await store.findKnowledgeBasesByName(corpus.kbName)
      if (sameName.some((candidate) => candidate.id !== corpus.kbId)) {
        fail('KB_NAME_COLLISION', 'a knowledge base name is not deterministic')
      }
      corpora.set(alias, kb)
    } else {
      const sameName = await store.findKnowledgeBasesByName(corpus.kbName)
      if (sameName.length > 0) {
        fail('KB_NAME_COLLISION', 'a knowledge base name is not deterministic')
      }
    }
  }

  const chatbots = new Map<string, ChatbotRecord>()
  for (const [
    chatbotId,
    corpusAlias,
  ] of index.corpusAliasByChatbotId.entries()) {
    const corpus = index.corpusByAlias.get(corpusAlias)
    if (!corpus) fail('INVALID_MANIFEST', 'a corpus alias is missing')
    const chatbot = await store.findChatbotById(chatbotId)
    assertChatbot(chatbot, corpus)
    chatbots.set(chatbotAliasFor(index, chatbotId), chatbot)
  }

  const legacyConfigurations = new Map<string, ActivationConfigRecord>()
  for (const [alias, configuration] of index.configByAlias.entries()) {
    const config = await store.findConfigById(configuration.configId)
    assertSourceConfiguration(config, configuration)
    legacyConfigurations.set(alias, config)
  }

  const targetServer = await findTargetServer(store)
  if (targetServer) assertTargetServer(targetServer, sourceServer, target)

  const configurations = new Map<string, ActivationConfigRecord | null>()
  for (const alias of index.configByAlias.keys()) {
    configurations.set(alias, null)
  }
  if (targetServer) {
    const expectedByKey = new Map<string, string>()
    for (const [alias, configuration] of index.configByAlias.entries()) {
      expectedByKey.set(
        targetConfigKey(configuration.chatbotId, configuration.chatMode),
        alias
      )
    }
    const targetConfigurations = await store.findConfigsByServerId(
      targetServer.id
    )
    for (const config of targetConfigurations) {
      const alias = expectedByKey.get(
        targetConfigKey(config.chatbotId, config.chatMode)
      )
      if (!alias || configurations.get(alias) !== null) {
        fail(
          'TARGET_CONFIG_DRIFT',
          'the target server has an unexpected configuration'
        )
      }
      const expected = index.configByAlias.get(alias)
      if (!expected) fail('INVALID_MANIFEST', 'target configuration is missing')
      assertTargetConfiguration(config, expected, targetServer.id)
      configurations.set(alias, config)
    }
  }

  const bindings = new Map<string, ActivationBindingRecord | null>()
  const otherBindingsByChatbotAlias = new Map<
    string,
    ActivationBindingRecord[]
  >()
  for (const [
    chatbotId,
    corpusAlias,
  ] of index.corpusAliasByChatbotId.entries()) {
    const chatbotAlias = chatbotAliasFor(index, chatbotId)
    const allBindings = await store.findBindingsByChatbotId(chatbotId)
    const kb = corpora.get(corpusAlias)
    const targetBindings = kb
      ? allBindings.filter(
          (binding) => binding.kbId === kb.id && binding.chatbotId === chatbotId
        )
      : []
    if (targetBindings.length > 1) {
      fail('BINDING_DRIFT', 'a target binding is duplicated')
    }
    const targetBinding = targetBindings[0] ?? null
    if (targetBinding) assertBinding(targetBinding, kb!.id, chatbotId)
    bindings.set(chatbotAlias, targetBinding)
    otherBindingsByChatbotAlias.set(
      chatbotAlias,
      allBindings.filter((binding) => binding !== targetBinding)
    )
  }

  return {
    sourceServer,
    targetServer,
    corpora,
    chatbots,
    legacyConfigurations,
    configurations,
    bindings,
    otherBindingsByChatbotAlias,
  }
}

function assertNoEnabledTargetRows(state: InspectedState): void {
  for (const binding of state.bindings.values()) {
    if (binding?.isEnabled) {
      fail('MIXED_STATE', 'a target binding is already enabled')
    }
  }
  for (const config of state.configurations.values()) {
    if (config?.isEnabled) {
      fail('MIXED_STATE', 'a target configuration is already enabled')
    }
  }
}

function assertNoEnabledOtherBinding(state: InspectedState): void {
  for (const bindings of state.otherBindingsByChatbotAlias.values()) {
    if (bindings.some((binding) => binding.isEnabled)) {
      fail(
        'ENABLED_KB_CONFLICT',
        'another knowledge base is already enabled for the chatbot'
      )
    }
  }
}

type GroupState = 'missing' | 'prepared' | 'switched' | 'mixed'

function groupAliases(index: ManifestIndex, chatbotAlias: string): string[] {
  return configsForChatbot(index, chatbotAlias).map(([alias]) => alias)
}

function groupState(
  state: InspectedState,
  index: ManifestIndex,
  chatbotAlias: string
): GroupState {
  const binding = state.bindings.get(chatbotAlias)
  const configurations = groupAliases(index, chatbotAlias).map((alias) =>
    state.configurations.get(alias)
  )
  if (!binding || configurations.some((configuration) => !configuration)) {
    return 'missing'
  }
  const enabled = [
    binding.isEnabled,
    ...configurations.map((configuration) => configuration!.isEnabled),
  ]
  if (enabled.every((value) => value === false)) return 'prepared'
  if (enabled.every((value) => value === true)) return 'switched'
  return 'mixed'
}

function assertTargetGroupsCoherent(
  state: InspectedState,
  index: ManifestIndex
): void {
  for (const chatbotAlias of index.aliases.chatbots) {
    const status = groupState(state, index, chatbotAlias)
    if (status === 'missing' || status === 'mixed') {
      fail('MIXED_STATE', 'a target chatbot group is incomplete or mixed')
    }
  }
}

function requirePreparedRows(
  state: InspectedState,
  index: ManifestIndex
): void {
  if (!state.targetServer) {
    fail('PREPARE_INCOMPLETE', 'the target server is missing')
  }
  if (
    [...state.corpora.values()].length !== EXPECTED_CORPORA ||
    [...state.configurations.values()].some((config) => !config) ||
    [...state.bindings.values()].some((binding) => !binding)
  ) {
    fail('PREPARE_INCOMPLETE', 'target rows are incomplete')
  }
  assertNoEnabledTargetRows(state)
  for (const chatbotAlias of index.aliases.chatbots) {
    if (groupState(state, index, chatbotAlias) !== 'prepared') {
      fail('PREPARE_INCOMPLETE', 'a target chatbot group is not prepared')
    }
  }
}

function assertSafeIdentity(
  expected: SafeIdentitySnapshot,
  alias: string,
  record: { updatedAt: Date },
  recordFingerprint: string
): void {
  if (
    expected.alias !== alias ||
    expected.fingerprint !== recordFingerprint ||
    expected.updatedAt !== record.updatedAt.toISOString()
  ) {
    fail('SNAPSHOT_MISMATCH', 'a receipt snapshot no longer matches')
  }
}

function findReceiptSnapshot<T extends { alias: string }>(
  entries: T[],
  alias: string
): T {
  const entry = entries.find((candidate) => candidate.alias === alias)
  if (!entry) fail('RECEIPT_INVALID', 'a receipt snapshot is missing')
  return entry
}

function assertReceiptCurrent(
  state: InspectedState,
  index: ManifestIndex,
  receipt: ActivationReceipt,
  options: { pendingChatbotAlias?: string } = {}
): void {
  if (!state.targetServer) {
    fail('SNAPSHOT_MISMATCH', 'the target server is missing')
  }
  if (
    receipt.sourceServer.fingerprint !==
      serverFingerprint(state.sourceServer) ||
    receipt.sourceServer.updatedAt !==
      state.sourceServer.updatedAt.toISOString() ||
    receipt.sourceServer.isActive !== state.sourceServer.isActive ||
    receipt.sourceServer.hasTransportCredential !==
      Boolean(state.sourceServer.authSecret)
  ) {
    fail('SNAPSHOT_MISMATCH', 'the source server snapshot no longer matches')
  }
  if (
    receipt.targetServer.fingerprint !==
      serverFingerprint(state.targetServer) ||
    receipt.targetServer.updatedAt !==
      state.targetServer.updatedAt.toISOString() ||
    receipt.targetServer.isActive !== state.targetServer.isActive
  ) {
    fail('SNAPSHOT_MISMATCH', 'the target server snapshot no longer matches')
  }

  for (const alias of index.corpusByAlias.keys()) {
    const current = state.corpora.get(alias)
    if (!current) fail('SNAPSHOT_MISMATCH', 'a knowledge base is missing')
    assertSafeIdentity(
      findReceiptSnapshot(receipt.corpora, alias),
      alias,
      current,
      knowledgeBaseFingerprint(current)
    )
  }
  for (const [alias, expectedChatbotId] of index.chatbotIdByAlias.entries()) {
    const current = state.chatbots.get(alias)
    if (!current || current.id !== expectedChatbotId) {
      fail('SNAPSHOT_MISMATCH', 'a chatbot snapshot no longer matches')
    }
    assertSafeIdentity(
      findReceiptSnapshot(receipt.chatbots, alias),
      alias,
      current,
      chatbotFingerprint(current)
    )
  }
  for (const [alias, config] of state.legacyConfigurations.entries()) {
    const expected = findReceiptSnapshot(receipt.legacyConfigurations, alias)
    const chatbotAlias = chatbotAliasFor(index, config.chatbotId)
    assertSafeIdentity(expected, alias, config, configFingerprint(config))
    if (
      expected.chatbotAlias !== chatbotAlias ||
      expected.chatMode !== config.chatMode ||
      expected.isEnabled !== config.isEnabled
    ) {
      fail(
        'SNAPSHOT_MISMATCH',
        'a legacy configuration snapshot no longer matches'
      )
    }
  }
  for (const [alias, expectedConfiguration] of index.configByAlias.entries()) {
    const current = state.configurations.get(alias)
    if (!current) fail('SNAPSHOT_MISMATCH', 'a target configuration is missing')
    const chatbotAlias = chatbotAliasFor(index, expectedConfiguration.chatbotId)
    const expected = findReceiptSnapshot(receipt.configurations, alias)
    if (options.pendingChatbotAlias === chatbotAlias) {
      assertTargetConfiguration(
        current,
        expectedConfiguration,
        state.targetServer.id
      )
      if (
        expected.chatbotAlias !== chatbotAlias ||
        expected.chatMode !== current.chatMode
      ) {
        fail('SNAPSHOT_MISMATCH', 'a target configuration identity changed')
      }
      continue
    }
    assertSafeIdentity(expected, alias, current, configFingerprint(current))
    if (
      expected.chatbotAlias !== chatbotAlias ||
      expected.chatMode !== current.chatMode ||
      expected.isEnabled !== current.isEnabled
    ) {
      fail(
        'SNAPSHOT_MISMATCH',
        'a target configuration snapshot no longer matches'
      )
    }
  }
  for (const chatbotAlias of index.aliases.chatbots) {
    const binding = state.bindings.get(chatbotAlias)
    if (!binding) fail('SNAPSHOT_MISMATCH', 'a target binding is missing')
    const chatbotId = resolveChatbotAlias(index, chatbotAlias)
    const corpusAlias = corpusAliasFor(index, chatbotId)
    const kb = state.corpora.get(corpusAlias)
    if (!kb) fail('SNAPSHOT_MISMATCH', 'a target knowledge base is missing')
    const expected = findReceiptSnapshot(
      receipt.bindings,
      index.bindingAliasByChatbotAlias.get(chatbotAlias)!
    )
    if (options.pendingChatbotAlias === chatbotAlias) {
      assertBinding(binding, kb.id, chatbotId)
      if (
        expected.chatbotAlias !== chatbotAlias ||
        expected.corpusAlias !== corpusAlias
      ) {
        fail('SNAPSHOT_MISMATCH', 'a target binding identity changed')
      }
      continue
    }
    assertSafeIdentity(
      expected,
      expected.alias,
      binding,
      bindingFingerprint(binding)
    )
    if (
      expected.chatbotAlias !== chatbotAlias ||
      expected.corpusAlias !== corpusAlias ||
      expected.isEnabled !== binding.isEnabled
    ) {
      fail('SNAPSHOT_MISMATCH', 'a target binding snapshot no longer matches')
    }
  }
}

function makeReceiptFromState(
  state: InspectedState,
  index: ManifestIndex,
  manifestFingerprint: string,
  input: {
    state: ActivationReceiptState
    switchedChatbotAliases: string[]
    pendingChatbotAlias?: string | null
    pendingRollbackAliases?: string[]
  }
): ActivationReceipt {
  if (!state.targetServer) {
    fail('TARGET_SERVER_MISSING', 'the target server is missing')
  }
  const corpora = [...index.corpusByAlias.entries()]
    .map(([alias]) => {
      const kb = state.corpora.get(alias)
      if (!kb) fail('KB_MISSING', 'a deterministic knowledge base is missing')
      return safeIdentitySnapshot(alias, kb, knowledgeBaseFingerprint(kb))
    })
    .sort((left, right) => left.alias.localeCompare(right.alias))
  const chatbots = [...index.chatbotIdByAlias.entries()]
    .map(([alias]) => {
      const chatbot = state.chatbots.get(alias)
      if (!chatbot) fail('CHATBOT_MISSING', 'a manifest chatbot is missing')
      return safeIdentitySnapshot(alias, chatbot, chatbotFingerprint(chatbot))
    })
    .sort((left, right) => left.alias.localeCompare(right.alias))
  const legacyConfigurations = [...index.configByAlias.entries()]
    .map(([alias, configuration]) => {
      const config = state.legacyConfigurations.get(alias)
      if (!config)
        fail('SOURCE_CONFIG_MISSING', 'a legacy configuration is missing')
      return safeConfigSnapshot(
        alias,
        chatbotAliasFor(index, configuration.chatbotId),
        config
      )
    })
    .sort((left, right) => left.alias.localeCompare(right.alias))
  const configurations = [...index.configByAlias.entries()]
    .map(([alias, configuration]) => {
      const config = state.configurations.get(alias)
      if (!config)
        fail('TARGET_CONFIG_MISSING', 'a target configuration is missing')
      return safeConfigSnapshot(
        alias,
        chatbotAliasFor(index, configuration.chatbotId),
        config
      )
    })
    .sort((left, right) => left.alias.localeCompare(right.alias))
  const bindings = [...index.chatbotIdByAlias.entries()]
    .map(([chatbotAlias, chatbotId]) => {
      const binding = state.bindings.get(chatbotAlias)
      if (!binding) fail('BINDING_MISSING', 'a target binding is missing')
      return safeBindingSnapshot(
        index.bindingAliasByChatbotAlias.get(chatbotAlias)!,
        chatbotAlias,
        corpusAliasFor(index, chatbotId),
        binding
      )
    })
    .sort((left, right) => left.alias.localeCompare(right.alias))

  return makeReceipt({
    manifestFingerprint,
    counts: index.counts,
    aliases: index.aliases,
    sourceServer: safeServerSnapshot(state.sourceServer, SOURCE_SERVER_NAME),
    targetServer: safeServerSnapshot(state.targetServer, TARGET_SERVER_NAME),
    corpora,
    chatbots,
    legacyConfigurations,
    bindings,
    configurations,
    switchedChatbotAliases: [...new Set(input.switchedChatbotAliases)].sort(),
    pendingChatbotAlias: input.pendingChatbotAlias ?? null,
    pendingRollbackAliases: [
      ...new Set(input.pendingRollbackAliases ?? []),
    ].sort(),
    state: input.state,
  })
}

function zeroWrites(): ActivationWrites {
  return {
    knowledgeBases: 0,
    server: 0,
    bindings: 0,
    configurations: 0,
  }
}

function operationResult(
  status: ActivationResult['status'],
  index: ManifestIndex,
  manifestFingerprint: string,
  writes: ActivationWrites,
  receipt?: ActivationReceipt
): ActivationResult {
  return {
    status,
    manifestFingerprint,
    counts: index.counts,
    aliases: {
      sourceServer: SOURCE_SERVER_NAME,
      targetServer: TARGET_SERVER_NAME,
      chatbotAliases: [...index.aliases.chatbots],
      switchedChatbotAliases: receipt
        ? [...receipt.switchedChatbotAliases]
        : [],
    },
    fingerprints: {
      manifest: manifestFingerprint,
      ...(receipt ? { receipt: receipt.payloadDigest } : {}),
    },
    writes,
    legacyRowsPreserved: true,
    ...(receipt ? { receipt } : {}),
  }
}

function validateTarget(target: ActivationTarget): void {
  assertNonEmpty(target.description)
  assertUrl(target.url)
}

function validateReceiptState(
  receipt: ActivationReceipt,
  allowed: ActivationReceiptState[]
): void {
  if (!allowed.includes(receipt.state)) {
    fail('RECEIPT_STATE', 'receipt state is not valid for this operation')
  }
}

function requireReceipt(
  payload: ActivationReceiptPayload | null,
  index: ManifestIndex,
  manifestFingerprint: string
): ActivationReceipt {
  if (!payload || isReceiptIntent(payload)) {
    fail('RECEIPT_MISSING', 'a complete activation receipt is required')
  }
  assertReceiptMatchesIndex(payload, index, manifestFingerprint)
  return payload
}

function hasTargetRows(state: InspectedState): boolean {
  return (
    [...state.bindings.values()].some((binding) => Boolean(binding)) ||
    [...state.configurations.values()].some((config) => Boolean(config))
  )
}

function assertNoUntrackedPartialTargetRows(
  state: InspectedState,
  index: ManifestIndex
): void {
  if (!hasTargetRows(state)) return
  if (!state.targetServer) {
    fail('MIXED_STATE', 'target rows exist without the reserved target server')
  }
  assertTargetGroupsCoherent(state, index)
}

function targetWriteCounts(state: InspectedState): ActivationWrites {
  return {
    knowledgeBases: EXPECTED_CORPORA - state.corpora.size,
    server: state.targetServer ? 0 : 1,
    bindings: [...state.bindings.values()].filter((binding) => !binding).length,
    configurations: [...state.configurations.values()].filter(
      (configuration) => !configuration
    ).length,
  }
}

export async function dryRunCohortActivation(
  store: ActivationStore,
  manifest: FrozenCohortManifest,
  target: ActivationTarget
): Promise<ActivationResult> {
  validateTarget(target)
  const index = buildManifestIndex(manifest)
  const manifestFingerprint = fingerprintManifest(manifest)
  const state = await inspectCohortState(store, index, target)
  if (state.targetServer) {
    assertTargetGroupsCoherent(state, index)
  }
  assertNoEnabledTargetRows(state)
  return operationResult(
    'dry-run',
    index,
    manifestFingerprint,
    targetWriteCounts(state)
  )
}

export async function prepareCohortActivation(
  store: ActivationStore,
  manifest: FrozenCohortManifest,
  options: ActivationOptions
): Promise<ActivationResult> {
  validateTarget(options.target)
  const index = buildManifestIndex(manifest)
  const manifestFingerprint = fingerprintManifest(manifest)
  if (options.dryRun) {
    return dryRunCohortActivation(store, manifest, options.target)
  }
  if (!options.receiptStore) {
    fail('RECEIPT_REQUIRED', 'a durable receipt store is required')
  }

  const existing = await readReceipt(options.receiptStore)
  if (existing) {
    assertReceiptMatchesIndex(existing, index, manifestFingerprint)
    if (isReceiptIntent(existing)) {
      const intentState = await inspectCohortState(store, index, options.target)
      assertNoEnabledTargetRows(intentState)
      assertNoUntrackedPartialTargetRows(intentState, index)
    } else {
      validateReceiptState(existing, ['prepared'])
      const state = await inspectCohortState(store, index, options.target)
      assertReceiptCurrent(state, index, existing)
      requirePreparedRows(state, index)
      return operationResult(
        'prepared',
        index,
        manifestFingerprint,
        zeroWrites(),
        existing
      )
    }
  } else {
    const initialState = await inspectCohortState(store, index, options.target)
    assertNoEnabledTargetRows(initialState)
    assertNoUntrackedPartialTargetRows(initialState, index)
    await options.receiptStore.write(makeIntent(index, manifestFingerprint))
  }

  const writes = zeroWrites()
  const receipt = await store.transaction(async (tx) => {
    const state = await inspectCohortState(tx, index, options.target)
    assertNoEnabledTargetRows(state)

    for (const [alias, corpus] of index.corpusByAlias.entries()) {
      if (state.corpora.has(alias)) continue
      const collisions = await tx.findKnowledgeBasesByName(corpus.kbName)
      if (collisions.length > 0) {
        fail('KB_NAME_COLLISION', 'a knowledge base name is not deterministic')
      }
      const created = await tx.createKnowledgeBase({
        id: corpus.kbId,
        name: corpus.kbName,
        description: corpus.description ?? null,
        ownerId: corpus.ownerId,
      })
      assertKnowledgeBase(created, corpus)
      state.corpora.set(alias, created)
      writes.knowledgeBases += 1
    }

    if (!state.targetServer) {
      const encryptedTransportCredential = state.sourceServer.authSecret
      if (!encryptedTransportCredential) {
        fail(
          'SOURCE_CREDENTIAL_MISSING',
          'the source transport credential is unavailable'
        )
      }
      const created = await tx.createServer({
        name: TARGET_SERVER_NAME,
        description: options.target.description,
        url: options.target.url,
        authType: TARGET_AUTH_TYPE,
        authSecret: encryptedTransportCredential,
        passChatbotId: false,
        chatbotIdHeader: null,
        parameters: {},
        isActive: true,
      })
      assertTargetServer(created, state.sourceServer, options.target)
      state.targetServer = created
      writes.server += 1
    }

    for (const [chatbotAlias, chatbotId] of index.chatbotIdByAlias.entries()) {
      const corpusAlias = corpusAliasFor(index, chatbotId)
      const kb = state.corpora.get(corpusAlias)
      if (!kb) fail('KB_MISSING', 'a deterministic knowledge base is missing')
      const existingBinding = state.bindings.get(chatbotAlias)
      if (existingBinding) {
        assertBinding(existingBinding, kb.id, chatbotId)
      } else {
        const createdBinding = await tx.createBinding({
          kbId: kb.id,
          chatbotId,
          isEnabled: false,
        })
        assertBinding(createdBinding, kb.id, chatbotId)
        state.bindings.set(chatbotAlias, createdBinding)
        writes.bindings += 1
      }
    }

    for (const [alias, configuration] of index.configByAlias.entries()) {
      const existingConfig = state.configurations.get(alias)
      if (existingConfig) {
        assertTargetConfiguration(
          existingConfig,
          configuration,
          state.targetServer.id
        )
        continue
      }
      const createdConfig = await tx.createConfig(
        targetConfigData(configuration, state.targetServer.id)
      )
      assertTargetConfiguration(
        createdConfig,
        configuration,
        state.targetServer.id
      )
      state.configurations.set(alias, createdConfig)
      writes.configurations += 1
    }

    requirePreparedRows(state, index)
    return makeReceiptFromState(state, index, manifestFingerprint, {
      state: 'prepared',
      switchedChatbotAliases: [],
    })
  })
  await options.receiptStore.write(receipt)
  return operationResult(
    'prepared',
    index,
    manifestFingerprint,
    writes,
    receipt
  )
}

async function prepareOrReadReceipt(
  manifest: FrozenCohortManifest,
  receiptStore: ActivationReceiptStore
): Promise<{
  index: ManifestIndex
  manifestFingerprint: string
  receipt: ActivationReceipt
}> {
  const index = buildManifestIndex(manifest)
  const manifestFingerprint = fingerprintManifest(manifest)
  const payload = await readReceipt(receiptStore)
  const receipt = requireReceipt(payload, index, manifestFingerprint)
  return {
    index,
    manifestFingerprint,
    receipt,
  }
}

async function applyChatbotSwitch(
  tx: ActivationTransactionStore,
  state: InspectedState,
  index: ManifestIndex,
  chatbotAlias: string,
  enabled: boolean
): Promise<void> {
  const chatbotId = resolveChatbotAlias(index, chatbotAlias)
  const corpusAlias = corpusAliasFor(index, chatbotId)
  const kb = state.corpora.get(corpusAlias)
  if (!kb) fail('KB_MISSING', 'a deterministic knowledge base is missing')

  const binding = state.bindings.get(chatbotAlias)
  if (!binding) fail('BINDING_MISSING', 'the chatbot binding is missing')
  assertBinding(binding, kb.id, chatbotId)
  if (binding.isEnabled !== enabled) {
    await tx.updateBinding(binding, enabled)
  }

  for (const [alias, configuration] of configsForChatbot(index, chatbotAlias)) {
    const config = state.configurations.get(alias)
    if (!config)
      fail('TARGET_CONFIG_MISSING', 'a chatbot configuration is missing')
    if (!state.targetServer) {
      fail('TARGET_SERVER_MISSING', 'the target server is missing')
    }
    assertTargetConfiguration(config, configuration, state.targetServer.id)
    if (config.isEnabled !== enabled) {
      await tx.updateConfig(config, enabled)
    }
  }
}

function assertCandidateGroup(
  state: InspectedState,
  index: ManifestIndex,
  chatbotAlias: string,
  desired: 'prepared' | 'switched'
): void {
  const current = groupState(state, index, chatbotAlias)
  if (current !== desired) {
    fail(
      'MIXED_STATE',
      'the selected chatbot group is not in the expected state'
    )
  }
}

export async function switchCohortChatbot(
  store: ActivationStore,
  manifest: FrozenCohortManifest,
  options: ActivationOptions & { chatbotAlias: string }
): Promise<ActivationResult> {
  validateTarget(options.target)
  const index = buildManifestIndex(manifest)
  const manifestFingerprint = fingerprintManifest(manifest)
  const chatbotId = resolveChatbotAlias(index, options.chatbotAlias)
  void chatbotId
  if (options.dryRun) {
    return operationResult('dry-run', index, manifestFingerprint, zeroWrites())
  }
  if (!options.receiptStore) {
    fail('RECEIPT_REQUIRED', 'a durable receipt store is required')
  }
  const { receipt } = await prepareOrReadReceipt(manifest, options.receiptStore)
  validateReceiptState(receipt, ['prepared', 'switched'])

  const currentState = await inspectCohortState(store, index, options.target)
  assertReceiptCurrent(currentState, index, receipt)
  assertTargetGroupsCoherent(currentState, index)
  if (receipt.switchedChatbotAliases.includes(options.chatbotAlias)) {
    assertCandidateGroup(currentState, index, options.chatbotAlias, 'switched')
    return operationResult(
      'switched',
      index,
      manifestFingerprint,
      zeroWrites(),
      receipt
    )
  }
  assertCandidateGroup(currentState, index, options.chatbotAlias, 'prepared')
  assertNoEnabledOtherBinding(currentState)

  const switchingReceipt = makeReceiptFromState(
    currentState,
    index,
    manifestFingerprint,
    {
      state: 'switching',
      switchedChatbotAliases: receipt.switchedChatbotAliases,
      pendingChatbotAlias: options.chatbotAlias,
    }
  )
  await options.receiptStore.write(switchingReceipt)

  const switchedReceipt = await store.transaction(async (tx) => {
    const state = await inspectCohortState(tx, index, options.target)
    assertReceiptCurrent(state, index, receipt)
    assertTargetGroupsCoherent(state, index)
    assertCandidateGroup(state, index, options.chatbotAlias, 'prepared')
    assertNoEnabledOtherBinding(state)
    await applyChatbotSwitch(tx, state, index, options.chatbotAlias, true)
    const after = await inspectCohortState(tx, index, options.target)
    return makeReceiptFromState(after, index, manifestFingerprint, {
      state: 'switched',
      switchedChatbotAliases: [
        ...receipt.switchedChatbotAliases,
        options.chatbotAlias,
      ],
    })
  })
  await options.receiptStore.write(switchedReceipt)
  return operationResult(
    'switched',
    index,
    manifestFingerprint,
    zeroWrites(),
    switchedReceipt
  )
}

export async function rollbackCohortChatbot(
  store: ActivationStore,
  manifest: FrozenCohortManifest,
  options: ActivationOptions & { chatbotAlias: string }
): Promise<ActivationResult> {
  validateTarget(options.target)
  const index = buildManifestIndex(manifest)
  const manifestFingerprint = fingerprintManifest(manifest)
  resolveChatbotAlias(index, options.chatbotAlias)
  if (options.dryRun) {
    return operationResult('dry-run', index, manifestFingerprint, zeroWrites())
  }
  if (!options.receiptStore) {
    fail('RECEIPT_REQUIRED', 'a durable receipt store is required')
  }
  const { receipt } = await prepareOrReadReceipt(manifest, options.receiptStore)
  validateReceiptState(receipt, ['switched', 'switching', 'rolling_back'])
  if (
    !receipt.switchedChatbotAliases.includes(options.chatbotAlias) &&
    !(
      receipt.state === 'switching' &&
      receipt.pendingChatbotAlias === options.chatbotAlias
    )
  ) {
    fail('RECEIPT_STATE', 'chatbot was not switched')
  }
  if (
    (receipt.state === 'rolling_back' || receipt.state === 'switching') &&
    receipt.state !== 'switching' &&
    !receipt.pendingRollbackAliases.includes(options.chatbotAlias)
  ) {
    fail('RECEIPT_STATE', 'rollback intent does not name the chatbot')
  }

  const stateBefore = await inspectCohortState(store, index, options.target)
  const pending =
    receipt.state === 'rolling_back' || receipt.state === 'switching'
  assertReceiptCurrent(
    stateBefore,
    index,
    receipt,
    pending ? { pendingChatbotAlias: options.chatbotAlias } : {}
  )
  assertTargetGroupsCoherent(stateBefore, index)
  if (!pending) {
    assertCandidateGroup(stateBefore, index, options.chatbotAlias, 'switched')
  } else {
    const current = groupState(stateBefore, index, options.chatbotAlias)
    if (current !== 'switched' && current !== 'prepared') {
      fail('MIXED_STATE', 'the selected chatbot group is mixed')
    }
  }

  let rollbackReceipt = receipt
  if (!pending) {
    rollbackReceipt = makeReceiptFromState(
      stateBefore,
      index,
      manifestFingerprint,
      {
        state: 'rolling_back',
        switchedChatbotAliases: receipt.switchedChatbotAliases,
        pendingRollbackAliases: [options.chatbotAlias],
      }
    )
    await options.receiptStore.write(rollbackReceipt)
  } else if (receipt.state === 'switching') {
    rollbackReceipt = makeReceiptFromState(
      stateBefore,
      index,
      manifestFingerprint,
      {
        state: 'rolling_back',
        switchedChatbotAliases: receipt.switchedChatbotAliases.includes(
          options.chatbotAlias
        )
          ? receipt.switchedChatbotAliases
          : [...receipt.switchedChatbotAliases, options.chatbotAlias],
        pendingRollbackAliases: [options.chatbotAlias],
      }
    )
    await options.receiptStore.write(rollbackReceipt)
  }

  const finalReceipt = await store.transaction(async (tx) => {
    const state = await inspectCohortState(tx, index, options.target)
    assertReceiptCurrent(state, index, rollbackReceipt, {
      pendingChatbotAlias: options.chatbotAlias,
    })
    assertTargetGroupsCoherent(state, index)
    const current = groupState(state, index, options.chatbotAlias)
    if (current !== 'switched' && current !== 'prepared') {
      fail('MIXED_STATE', 'the selected chatbot group is mixed')
    }
    if (current === 'switched') {
      await applyChatbotSwitch(tx, state, index, options.chatbotAlias, false)
    }
    const remaining = rollbackReceipt.switchedChatbotAliases.filter(
      (alias) => alias !== options.chatbotAlias
    )
    const after = await inspectCohortState(tx, index, options.target)
    return makeReceiptFromState(after, index, manifestFingerprint, {
      state: remaining.length === 0 ? 'rolled_back' : 'switched',
      switchedChatbotAliases: remaining,
    })
  })
  await options.receiptStore.write(finalReceipt)
  return operationResult(
    finalReceipt.state === 'rolled_back' ? 'rolled_back' : 'switched',
    index,
    manifestFingerprint,
    zeroWrites(),
    finalReceipt
  )
}

export async function readbackCohortActivation(
  store: ActivationStore,
  manifest: FrozenCohortManifest,
  options: ActivationOptions
): Promise<ActivationResult> {
  validateTarget(options.target)
  if (!options.receiptStore) {
    fail('RECEIPT_REQUIRED', 'a durable receipt store is required')
  }
  const { index, manifestFingerprint, receipt } = await prepareOrReadReceipt(
    manifest,
    options.receiptStore
  )
  validateReceiptState(receipt, ['prepared', 'switched', 'rolled_back'])
  const state = await inspectCohortState(store, index, options.target)
  if (receipt.state === 'prepared' || receipt.state === 'rolled_back') {
    requirePreparedRows(state, index)
    assertReceiptCurrent(state, index, receipt)
  } else {
    assertReceiptCurrent(state, index, receipt)
    assertTargetGroupsCoherent(state, index)
  }
  return operationResult(
    'readback',
    index,
    manifestFingerprint,
    zeroWrites(),
    receipt
  )
}
