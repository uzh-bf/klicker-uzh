import { encrypt } from '@klicker-uzh/util'
import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { readFile, rename, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const CANARY_SERVER_NAME = 'Klicker-compat' as const
export const SYNTHETIC_CANARY_CHATBOT_NAME = 'doc-query-canary' as const
export const SYNTHETIC_CANARY_COURSE_NAME = 'doc-query-canary' as const
export const CANARY_RECEIPT_VERSION = 1 as const

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonState = Prisma.JsonValue | null

export type CanaryServerRecord = {
  id: string
  name: string
  description: string | null
  url: string
  authType: string
  authSecret: string | null
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: JsonState
  isActive: boolean
  updatedAt: Date
}

export type CanaryConfigRecord = {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonState
  priority: number
  isEnabled: boolean
  parameters: JsonState
  updatedAt: Date
}

export type SyntheticChatbotRecord = {
  id: string
  name: string
  courseName: string
}

export type CanaryServerSnapshot = CanaryServerRecord
export type CanaryConfigSnapshot = CanaryConfigRecord

export type CanaryBindingTransactionStore = {
  findSyntheticChatbot(id: string): Promise<SyntheticChatbotRecord | null>
  findServerByName(name: string): Promise<CanaryServerRecord | null>
  findServerById(id: string): Promise<CanaryServerRecord | null>
  findConfigById(id: string): Promise<CanaryConfigRecord | null>
  findConfigByChatbotServer(
    chatbotId: string,
    mcpServerId: string,
    chatMode: string
  ): Promise<CanaryConfigRecord | null>
  createServer(data: CreateServerData): Promise<CanaryServerRecord>
  createConfig(data: CreateConfigData): Promise<CanaryConfigRecord>
  updateServer(
    snapshot: CanaryServerSnapshot,
    data: ServerUpdateData
  ): Promise<CanaryServerRecord>
  updateConfig(
    snapshot: CanaryConfigSnapshot,
    data: ConfigUpdateData
  ): Promise<CanaryConfigRecord>
  deleteServer(snapshot: CanaryServerSnapshot): Promise<void>
  deleteConfig(snapshot: CanaryConfigSnapshot): Promise<void>
}

export type CanaryBindingStore = CanaryBindingTransactionStore & {
  transaction<T>(
    fn: (store: CanaryBindingTransactionStore) => Promise<T>
  ): Promise<T>
}

type CreateServerData = {
  name: string
  description: string
  url: string
  authType: string
  authSecret: string
  passChatbotId: boolean
  chatbotIdHeader: string
  parameters: Prisma.InputJsonValue
  isActive: boolean
}

type CreateConfigData = {
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: Prisma.InputJsonValue
  priority: number
  isEnabled: boolean
  parameters: Prisma.InputJsonValue
}

type ServerUpdateData = Partial<{
  description: string | null
  url: string
  authType: string
  authSecret: string | null
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: Prisma.InputJsonValue
  isActive: boolean
}>

type ConfigUpdateData = Partial<{
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: Prisma.InputJsonValue | null
  priority: number
  isEnabled: boolean
  parameters: Prisma.InputJsonValue | null
}>

export type CanaryReceiptState =
  | 'prepared'
  | 'switched'
  | 'rolled_back'
  | 'cleaned'

type SafeServerSnapshot = {
  id: string
  name: typeof CANARY_SERVER_NAME
  updatedAt: string
  isActive: boolean
}

type SafeConfigSnapshot = {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonState
  priority: number
  parameters: JsonState
  isEnabled: boolean
  updatedAt: string
}

export type CanaryReceipt = {
  receiptVersion: typeof CANARY_RECEIPT_VERSION
  identity: {
    serverName: typeof CANARY_SERVER_NAME
    chatbotId: string
    legacyConfigId: string
    chatMode: string
  }
  prior: {
    legacyConfig: SafeConfigSnapshot
  }
  candidate: {
    server: SafeServerSnapshot
    config: SafeConfigSnapshot
  }
  active: {
    legacyConfig: SafeConfigSnapshot
    server: SafeServerSnapshot
    config: SafeConfigSnapshot
  }
  state: CanaryReceiptState
  expectedCleanup: {
    serverId: string
    configId: string
    scope: 'synthetic-binding-only'
  }
  payloadDigest: string
}

export interface CanaryReceiptStore {
  read(): Promise<CanaryReceipt | null>
  write(receipt: CanaryReceipt): Promise<void>
}

export type CanaryBindingSettings = {
  chatbotId: string
  legacyConfigId: string
  chatMode: string
  candidateUrl: string
  candidateAllowedTools: string[]
  candidatePriority?: number
  bearerToken?: string
  receiptStore?: CanaryReceiptStore
  dryRun?: boolean
}

export type CanaryDryRunResult = {
  status: 'dry-run'
  serverName: typeof CANARY_SERVER_NAME
  chatbotId: string
  legacyConfigId: string
  chatMode: string
  candidateUrl: string
  candidateAllowedTools: string[]
  candidatePriority: number
  wouldCreate: {
    server: true
    config: true
  }
  wouldSwitch: {
    legacyConfigEnabled: false
    candidateServerActive: true
    candidateConfigEnabled: true
  }
}

export type CanaryOperationResult =
  | CanaryDryRunResult
  | {
      status: CanaryReceiptState
      receipt: CanaryReceipt
    }
  | {
      status: 'readback'
      receipt: CanaryReceipt
      serverPresent: boolean
      configPresent: boolean
      serverName: typeof CANARY_SERVER_NAME
    }

export class CanaryBindingError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CanaryBindingError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new CanaryBindingError(code, message)
}

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    fail('NON_SYNTHETIC_ID', `${field} must be a UUID`)
  }
}

function assertCandidateUrl(candidateUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(candidateUrl)
  } catch {
    fail('INVALID_CANDIDATE_URL', 'candidate URL is invalid')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('INVALID_CANDIDATE_URL', 'candidate URL must use HTTP or HTTPS')
  }
  if (parsed.username || parsed.password) {
    fail('CREDENTIAL_URL', 'candidate URL must not contain credentials')
  }
}

function normalizeSettings(settings: CanaryBindingSettings): Required<
  Pick<
    CanaryBindingSettings,
    | 'chatbotId'
    | 'legacyConfigId'
    | 'chatMode'
    | 'candidateUrl'
    | 'candidateAllowedTools'
  >
> &
  Pick<
    CanaryBindingSettings,
    'candidatePriority' | 'bearerToken' | 'receiptStore'
  > & {
    dryRun: boolean
  } {
  assertUuid(settings.chatbotId, 'chatbotId')
  assertUuid(settings.legacyConfigId, 'legacyConfigId')
  if (!settings.chatMode.trim()) {
    fail('INVALID_CHAT_MODE', 'chat mode is required')
  }
  if (settings.candidateAllowedTools.length === 0) {
    fail('INVALID_ALLOWED_TOOLS', 'at least one candidate tool is required')
  }
  if (
    settings.candidateAllowedTools.some(
      (toolName) => toolName.trim().length === 0
    )
  ) {
    fail('INVALID_ALLOWED_TOOLS', 'candidate tool names must not be blank')
  }
  assertCandidateUrl(settings.candidateUrl)

  const candidatePriority = settings.candidatePriority ?? 0
  if (!Number.isInteger(candidatePriority) || candidatePriority < 0) {
    fail(
      'INVALID_PRIORITY',
      'candidate priority must be a non-negative integer'
    )
  }

  return {
    chatbotId: settings.chatbotId,
    legacyConfigId: settings.legacyConfigId,
    chatMode: settings.chatMode,
    candidateUrl: settings.candidateUrl,
    candidateAllowedTools: [...settings.candidateAllowedTools],
    candidatePriority,
    bearerToken: settings.bearerToken,
    receiptStore: settings.receiptStore,
    dryRun: settings.dryRun ?? true,
  }
}

function assertSyntheticChatbot(
  chatbot: SyntheticChatbotRecord | null,
  chatbotId: string
): asserts chatbot is SyntheticChatbotRecord {
  if (!chatbot) {
    fail('SYNTHETIC_CHATBOT_NOT_FOUND', 'synthetic chatbot was not found')
  }
  if (
    chatbot.id !== chatbotId ||
    chatbot.name !== SYNTHETIC_CANARY_CHATBOT_NAME ||
    chatbot.courseName !== SYNTHETIC_CANARY_COURSE_NAME
  ) {
    fail('ORDINARY_ROW_REFUSED', 'target is not the synthetic canary chatbot')
  }
}

function assertMutationInputs(settings: ReturnType<typeof normalizeSettings>) {
  if (!settings.receiptStore) {
    fail('RECEIPT_REQUIRED', 'mutation requires an explicit receipt store')
  }
  if (!settings.bearerToken?.trim()) {
    fail('BEARER_REQUIRED', 'mutation requires an in-memory bearer token')
  }
}

function cloneJson<T extends JsonState>(value: T): T {
  if (value === null) return value
  return JSON.parse(JSON.stringify(value)) as T
}

function jsonEqual(left: JsonState, right: JsonState): boolean {
  if (left === right) return true
  if (left === null || right === null) return false
  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    return (
      left.length === right.length &&
      left.every((value, index) =>
        jsonEqual(value as JsonState, right[index] as JsonState)
      )
    )
  }
  const leftKeys = Object.keys(left).sort((a, b) => a.localeCompare(b))
  const rightKeys = Object.keys(right).sort((a, b) => a.localeCompare(b))
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    (key, index) =>
      key === rightKeys[index] &&
      jsonEqual(
        (left as Record<string, JsonState>)[key] ?? null,
        (right as Record<string, JsonState>)[key] ?? null
      )
  )
}

function assertServerSnapshot(
  current: CanaryServerRecord | null,
  expected: CanaryServerSnapshot
): asserts current is CanaryServerRecord {
  if (!current || current.id !== expected.id) {
    fail('SNAPSHOT_MISMATCH', 'server snapshot no longer matches')
  }

  const matches =
    current.name === expected.name &&
    current.description === expected.description &&
    current.url === expected.url &&
    current.authType === expected.authType &&
    current.authSecret === expected.authSecret &&
    current.passChatbotId === expected.passChatbotId &&
    current.chatbotIdHeader === expected.chatbotIdHeader &&
    jsonEqual(current.parameters, expected.parameters) &&
    current.isActive === expected.isActive &&
    current.updatedAt.getTime() === expected.updatedAt.getTime()

  if (!matches) {
    fail('SNAPSHOT_MISMATCH', 'server snapshot no longer matches')
  }
}

function assertConfigSnapshot(
  current: CanaryConfigRecord | null,
  expected: CanaryConfigSnapshot
): asserts current is CanaryConfigRecord {
  if (!current || current.id !== expected.id) {
    fail('SNAPSHOT_MISMATCH', 'config snapshot no longer matches')
  }

  const matches =
    current.chatbotId === expected.chatbotId &&
    current.mcpServerId === expected.mcpServerId &&
    current.chatMode === expected.chatMode &&
    jsonEqual(current.allowedTools, expected.allowedTools) &&
    current.priority === expected.priority &&
    current.isEnabled === expected.isEnabled &&
    jsonEqual(current.parameters, expected.parameters) &&
    current.updatedAt.getTime() === expected.updatedAt.getTime()

  if (!matches) {
    fail('SNAPSHOT_MISMATCH', 'config snapshot no longer matches')
  }
}

function toSafeServerSnapshot(server: CanaryServerRecord): SafeServerSnapshot {
  return {
    id: server.id,
    name: CANARY_SERVER_NAME,
    updatedAt: server.updatedAt.toISOString(),
    isActive: server.isActive,
  }
}

function toSafeConfigSnapshot(config: CanaryConfigRecord): SafeConfigSnapshot {
  return {
    id: config.id,
    chatbotId: config.chatbotId,
    mcpServerId: config.mcpServerId,
    chatMode: config.chatMode,
    allowedTools: cloneJson(config.allowedTools),
    priority: config.priority,
    parameters: cloneJson(config.parameters),
    isEnabled: config.isEnabled,
    updatedAt: config.updatedAt.toISOString(),
  }
}

function receiptDigest(receipt: Omit<CanaryReceipt, 'payloadDigest'>): string {
  return createHash('sha256').update(JSON.stringify(receipt)).digest('hex')
}

function makeReceipt(
  input: Omit<CanaryReceipt, 'receiptVersion' | 'payloadDigest'>
): CanaryReceipt {
  const { payloadDigest: _ignoredPayloadDigest, ...receiptInput } =
    input as Omit<CanaryReceipt, 'receiptVersion'>
  const withoutDigest = {
    receiptVersion: CANARY_RECEIPT_VERSION,
    ...receiptInput,
  }
  return {
    ...withoutDigest,
    payloadDigest: receiptDigest(withoutDigest),
  }
}

function assertReceiptIntegrity(receipt: CanaryReceipt): void {
  if (receipt.receiptVersion !== CANARY_RECEIPT_VERSION) {
    fail('RECEIPT_INVALID', 'receipt version is unsupported')
  }
  if (receipt.identity.serverName !== CANARY_SERVER_NAME) {
    fail('RECEIPT_INVALID', 'receipt server identity is not Klicker-compat')
  }
  const { payloadDigest: _payloadDigest, ...withoutDigest } = receipt
  if (receiptDigest(withoutDigest) !== receipt.payloadDigest) {
    fail('RECEIPT_INVALID', 'receipt payload digest does not match')
  }
}

async function readReceipt(
  settings: ReturnType<typeof normalizeSettings>
): Promise<CanaryReceipt | null> {
  if (!settings.receiptStore) return null
  const receipt = await settings.receiptStore.read()
  if (receipt) assertReceiptIntegrity(receipt)
  return receipt
}

function requireNoReceipt(receipt: CanaryReceipt | null): void {
  if (receipt) {
    fail('RECEIPT_EXISTS', 'an existing canary receipt blocks a rerun')
  }
}

function requireReceipt(
  receipt: CanaryReceipt | null,
  settings: ReturnType<typeof normalizeSettings>
): CanaryReceipt {
  if (!receipt) fail('RECEIPT_MISSING', 'canary receipt is required')
  if (
    receipt.identity.chatbotId !== settings.chatbotId ||
    receipt.identity.legacyConfigId !== settings.legacyConfigId ||
    receipt.identity.chatMode !== settings.chatMode
  ) {
    fail('RECEIPT_MISMATCH', 'receipt identity does not match the request')
  }
  return receipt
}

async function inspectSyntheticState(
  store: CanaryBindingTransactionStore,
  settings: ReturnType<typeof normalizeSettings>,
  options: { requireLegacyEnabled?: boolean } = {}
): Promise<{
  chatbot: SyntheticChatbotRecord
  legacyConfig: CanaryConfigRecord
  legacyServer: CanaryServerRecord
  candidateServer: CanaryServerRecord | null
  candidateConfig: CanaryConfigRecord | null
}> {
  const chatbot = await store.findSyntheticChatbot(settings.chatbotId)
  assertSyntheticChatbot(chatbot, settings.chatbotId)

  const legacyConfig = await store.findConfigById(settings.legacyConfigId)
  if (!legacyConfig) {
    fail('PRIOR_STATE_MISSING', 'legacy binding snapshot is missing')
  }
  if (
    legacyConfig.chatbotId !== settings.chatbotId ||
    legacyConfig.chatMode !== settings.chatMode
  ) {
    fail('ORDINARY_ROW_REFUSED', 'legacy binding does not belong to the canary')
  }
  if (options.requireLegacyEnabled !== false && !legacyConfig.isEnabled) {
    fail('PRIOR_STATE_INVALID', 'legacy binding must be enabled before prepare')
  }

  const legacyServer = await store.findServerById(legacyConfig.mcpServerId)
  if (!legacyServer) {
    fail('PRIOR_STATE_MISSING', 'legacy MCP server is missing')
  }
  if (legacyServer.name === CANARY_SERVER_NAME) {
    fail('ORDINARY_ROW_REFUSED', 'legacy binding already uses the canary name')
  }

  const candidateServer = await store.findServerByName(CANARY_SERVER_NAME)
  const candidateConfig = candidateServer
    ? await store.findConfigByChatbotServer(
        settings.chatbotId,
        candidateServer.id,
        settings.chatMode
      )
    : null

  return {
    chatbot,
    legacyConfig,
    legacyServer,
    candidateServer,
    candidateConfig:
      candidateConfig && candidateConfig.mcpServerId === candidateServer?.id
        ? candidateConfig
        : null,
  }
}

function assertCandidateSettings(
  settings: ReturnType<typeof normalizeSettings>
): void {
  if (settings.bearerToken?.includes('\n')) {
    fail('INVALID_BEARER', 'bearer token must be a single line')
  }
}

export async function dryRunCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryDryRunResult> {
  const normalized = normalizeSettings({ ...settings, dryRun: true })
  const receipt = await readReceipt(normalized)
  requireNoReceipt(receipt)
  const state = await inspectSyntheticState(store, normalized)
  if (state.candidateServer) {
    fail('DUPLICATE_SERVER', 'Klicker-compat already exists')
  }

  return {
    status: 'dry-run',
    serverName: CANARY_SERVER_NAME,
    chatbotId: normalized.chatbotId,
    legacyConfigId: normalized.legacyConfigId,
    chatMode: normalized.chatMode,
    candidateUrl: normalized.candidateUrl,
    candidateAllowedTools: normalized.candidateAllowedTools,
    candidatePriority: normalized.candidatePriority ?? 0,
    wouldCreate: { server: true, config: true },
    wouldSwitch: {
      legacyConfigEnabled: false,
      candidateServerActive: true,
      candidateConfigEnabled: true,
    },
  }
}

export async function prepareCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryOperationResult> {
  const normalized = normalizeSettings(settings)
  if (normalized.dryRun) return dryRunCanaryBinding(store, normalized)
  assertMutationInputs(normalized)
  assertCandidateSettings(normalized)

  const receipt = await readReceipt(normalized)
  requireNoReceipt(receipt)

  const result = await store.transaction(async (tx) => {
    const state = await inspectSyntheticState(tx, normalized)
    if (state.candidateServer) {
      fail('DUPLICATE_SERVER', 'Klicker-compat already exists')
    }

    const candidateServer = await tx.createServer({
      name: CANARY_SERVER_NAME,
      description: 'Synthetic doc-query compatibility binding',
      url: normalized.candidateUrl,
      authType: 'bearer',
      // The plaintext bearer exists only in this process and is immediately
      // converted to the normal encrypted-at-rest representation.
      authSecret: encrypt(normalized.bearerToken!),
      passChatbotId: true,
      chatbotIdHeader: 'Chatbot-ID',
      parameters: {},
      isActive: false,
    })
    const candidateConfig = await tx.createConfig({
      chatbotId: normalized.chatbotId,
      mcpServerId: candidateServer.id,
      chatMode: normalized.chatMode,
      allowedTools: normalized.candidateAllowedTools,
      priority: normalized.candidatePriority ?? 0,
      isEnabled: false,
      parameters: {},
    })

    return makeReceipt({
      identity: {
        serverName: CANARY_SERVER_NAME,
        chatbotId: normalized.chatbotId,
        legacyConfigId: normalized.legacyConfigId,
        chatMode: normalized.chatMode,
      },
      prior: {
        legacyConfig: toSafeConfigSnapshot(state.legacyConfig),
      },
      candidate: {
        server: toSafeServerSnapshot(candidateServer),
        config: toSafeConfigSnapshot(candidateConfig),
      },
      active: {
        legacyConfig: toSafeConfigSnapshot(state.legacyConfig),
        server: toSafeServerSnapshot(candidateServer),
        config: toSafeConfigSnapshot(candidateConfig),
      },
      state: 'prepared',
      expectedCleanup: {
        serverId: candidateServer.id,
        configId: candidateConfig.id,
        scope: 'synthetic-binding-only',
      },
    })
  })

  await normalized.receiptStore!.write(result)
  return { status: 'prepared', receipt: result }
}

async function inspectReceiptState(
  store: CanaryBindingTransactionStore,
  settings: ReturnType<typeof normalizeSettings>,
  receipt: CanaryReceipt
): Promise<{
  legacyConfig: CanaryConfigRecord
  candidateServer: CanaryServerRecord
  candidateConfig: CanaryConfigRecord
}> {
  const state = await inspectSyntheticState(store, settings, {
    requireLegacyEnabled: false,
  })
  if (!state.candidateServer || !state.candidateConfig) {
    fail('CANDIDATE_STATE_MISSING', 'Klicker-compat candidate state is missing')
  }
  if (
    state.candidateServer.id !== receipt.candidate.server.id ||
    state.candidateConfig.id !== receipt.candidate.config.id
  ) {
    fail('SNAPSHOT_MISMATCH', 'candidate identity no longer matches receipt')
  }
  return {
    legacyConfig: state.legacyConfig,
    candidateServer: state.candidateServer,
    candidateConfig: state.candidateConfig,
  }
}

function assertSafeServerSnapshot(
  current: CanaryServerRecord,
  expected: SafeServerSnapshot
): void {
  if (
    current.id !== expected.id ||
    current.name !== expected.name ||
    current.isActive !== expected.isActive ||
    current.updatedAt.toISOString() !== expected.updatedAt
  ) {
    fail('SNAPSHOT_MISMATCH', 'candidate server version no longer matches')
  }
}

function assertSafeConfigSnapshot(
  current: CanaryConfigRecord,
  expected: SafeConfigSnapshot
): void {
  if (
    current.id !== expected.id ||
    current.chatbotId !== expected.chatbotId ||
    current.mcpServerId !== expected.mcpServerId ||
    current.chatMode !== expected.chatMode ||
    !jsonEqual(current.allowedTools, expected.allowedTools) ||
    current.priority !== expected.priority ||
    !jsonEqual(current.parameters, expected.parameters) ||
    current.isEnabled !== expected.isEnabled ||
    current.updatedAt.toISOString() !== expected.updatedAt
  ) {
    fail('SNAPSHOT_MISMATCH', 'candidate config version no longer matches')
  }
}

function assertRestoredConfig(
  current: CanaryConfigRecord,
  expected: SafeConfigSnapshot
): void {
  if (
    current.id !== expected.id ||
    current.chatbotId !== expected.chatbotId ||
    current.mcpServerId !== expected.mcpServerId ||
    current.chatMode !== expected.chatMode ||
    !jsonEqual(current.allowedTools, expected.allowedTools) ||
    current.priority !== expected.priority ||
    !jsonEqual(current.parameters, expected.parameters) ||
    !current.isEnabled
  ) {
    fail('SNAPSHOT_MISMATCH', 'legacy binding was not restored')
  }
}

export async function switchCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryOperationResult> {
  const normalized = normalizeSettings(settings)
  const receipt = requireReceipt(await readReceipt(normalized), normalized)
  if (receipt.state !== 'prepared') {
    fail('RECEIPT_STATE', 'only a prepared canary can be switched')
  }
  if (normalized.dryRun) {
    const state = await inspectReceiptState(store, normalized, receipt)
    assertSafeConfigSnapshot(state.legacyConfig, receipt.active.legacyConfig)
    assertSafeServerSnapshot(state.candidateServer, receipt.active.server)
    assertSafeConfigSnapshot(state.candidateConfig, receipt.active.config)
    return { status: 'prepared', receipt }
  }

  const result = await store.transaction(async (tx) => {
    const state = await inspectReceiptState(tx, normalized, receipt)
    const legacySnapshot = state.legacyConfig
    const candidateServerSnapshot = state.candidateServer
    const candidateConfigSnapshot = state.candidateConfig

    assertSafeConfigSnapshot(legacySnapshot, receipt.active.legacyConfig)
    assertSafeServerSnapshot(candidateServerSnapshot, receipt.active.server)
    assertSafeConfigSnapshot(candidateConfigSnapshot, receipt.active.config)

    const disabledLegacy = await tx.updateConfig(legacySnapshot, {
      isEnabled: false,
    })
    const activeCandidateServer = await tx.updateServer(
      candidateServerSnapshot,
      { isActive: true }
    )
    const enabledCandidateConfig = await tx.updateConfig(
      candidateConfigSnapshot,
      { isEnabled: true }
    )

    return makeReceipt({
      ...receipt,
      prior: { legacyConfig: toSafeConfigSnapshot(legacySnapshot) },
      candidate: {
        server: toSafeServerSnapshot(activeCandidateServer),
        config: toSafeConfigSnapshot(enabledCandidateConfig),
      },
      active: {
        legacyConfig: toSafeConfigSnapshot(disabledLegacy),
        server: toSafeServerSnapshot(activeCandidateServer),
        config: toSafeConfigSnapshot(enabledCandidateConfig),
      },
      state: 'switched',
      expectedCleanup: {
        serverId: activeCandidateServer.id,
        configId: enabledCandidateConfig.id,
        scope: 'synthetic-binding-only',
      },
    })
  })

  await normalized.receiptStore!.write(result)
  return { status: 'switched', receipt: result }
}

export async function rollbackCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryOperationResult> {
  const normalized = normalizeSettings(settings)
  const receipt = requireReceipt(await readReceipt(normalized), normalized)
  if (receipt.state !== 'switched') {
    fail('RECEIPT_STATE', 'only a switched canary can be rolled back')
  }
  if (normalized.dryRun) {
    const state = await inspectReceiptState(store, normalized, receipt)
    assertSafeConfigSnapshot(state.legacyConfig, receipt.active.legacyConfig)
    assertSafeServerSnapshot(state.candidateServer, receipt.active.server)
    assertSafeConfigSnapshot(state.candidateConfig, receipt.active.config)
    return { status: 'switched', receipt }
  }

  const result = await store.transaction(async (tx) => {
    const state = await inspectReceiptState(tx, normalized, receipt)
    assertSafeConfigSnapshot(state.legacyConfig, receipt.active.legacyConfig)
    assertSafeServerSnapshot(state.candidateServer, receipt.active.server)
    assertSafeConfigSnapshot(state.candidateConfig, receipt.active.config)

    const restoredLegacy = await tx.updateConfig(state.legacyConfig, {
      isEnabled: true,
    })
    await tx.deleteConfig(state.candidateConfig)
    await tx.deleteServer(state.candidateServer)

    return makeReceipt({
      ...receipt,
      candidate: receipt.candidate,
      active: {
        legacyConfig: toSafeConfigSnapshot(restoredLegacy),
        server: receipt.active.server,
        config: receipt.active.config,
      },
      state: 'rolled_back',
      expectedCleanup: {
        serverId: receipt.candidate.server.id,
        configId: receipt.candidate.config.id,
        scope: 'synthetic-binding-only',
      },
    })
  })

  await normalized.receiptStore!.write(result)
  return { status: 'rolled_back', receipt: result }
}

export async function readbackCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryOperationResult> {
  const normalized = normalizeSettings({ ...settings, dryRun: true })
  const receipt = requireReceipt(await readReceipt(normalized), normalized)
  const server = await store.findServerById(receipt.candidate.server.id)
  const config = await store.findConfigById(receipt.candidate.config.id)
  return {
    status: 'readback',
    receipt,
    serverPresent: server?.name === CANARY_SERVER_NAME,
    configPresent: config?.mcpServerId === receipt.candidate.server.id,
    serverName: CANARY_SERVER_NAME,
  }
}

export async function cleanupCanaryBinding(
  store: CanaryBindingStore,
  settings: CanaryBindingSettings
): Promise<CanaryOperationResult> {
  const normalized = normalizeSettings({ ...settings, dryRun: true })
  const receipt = requireReceipt(await readReceipt(normalized), normalized)
  if (receipt.state !== 'rolled_back') {
    fail('RECEIPT_STATE', 'cleanup requires a rolled-back canary')
  }
  const server = await store.findServerById(receipt.candidate.server.id)
  const config = await store.findConfigById(receipt.candidate.config.id)
  const legacy = await store.findConfigById(receipt.identity.legacyConfigId)
  if (server || config) {
    fail('CLEANUP_INCOMPLETE', 'synthetic candidate rows still exist')
  }
  if (!legacy) {
    fail('CLEANUP_INCOMPLETE', 'legacy binding is missing after rollback')
  }
  assertRestoredConfig(legacy, receipt.prior.legacyConfig)
  const cleanedReceipt = makeReceipt({
    ...receipt,
    state: 'cleaned',
  })
  await normalized.receiptStore!.write(cleanedReceipt)
  return {
    status: 'cleaned',
    receipt: cleanedReceipt,
  }
}

export function createFileCanaryReceiptStore(
  receiptPath: string
): CanaryReceiptStore {
  const absolutePath = resolve(receiptPath)
  return {
    async read() {
      try {
        const contents = await readFile(absolutePath, 'utf8')
        return JSON.parse(contents) as CanaryReceipt
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return null
        }
        fail('RECEIPT_READ_FAILED', 'could not read canary receipt')
      }
    },
    async write(receipt) {
      await mkdir(dirname(absolutePath), { recursive: true })
      const temporaryPath = `${absolutePath}.tmp-${process.pid}`
      await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })
      await rename(temporaryPath, absolutePath)
    },
  }
}

function mapServerRecord(record: {
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
}): CanaryServerRecord {
  return { ...record, parameters: record.parameters as JsonState }
}

function mapConfigRecord(record: {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
  updatedAt: Date
}): CanaryConfigRecord {
  return {
    ...record,
    allowedTools: record.allowedTools as JsonState,
    parameters: record.parameters as JsonState,
  }
}

type PrismaCanaryClient = Pick<
  PrismaClient,
  'chatbot' | 'chatbotMCPServer' | 'chatbotMCPConfig'
>

function createPrismaDelegateStore(
  client: PrismaCanaryClient
): CanaryBindingTransactionStore {
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

  return {
    async findSyntheticChatbot(id) {
      const record = await client.chatbot.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          course: { select: { name: true } },
        },
      })
      return record
        ? { id: record.id, name: record.name, courseName: record.course.name }
        : null
    },
    async findServerByName(name) {
      const record = await client.chatbotMCPServer.findUnique({
        where: { name },
        select: serverSelect,
      })
      return record ? mapServerRecord(record) : null
    },
    async findServerById(id) {
      const record = await client.chatbotMCPServer.findUnique({
        where: { id },
        select: serverSelect,
      })
      return record ? mapServerRecord(record) : null
    },
    async findConfigById(id) {
      const record = await client.chatbotMCPConfig.findUnique({
        where: { id },
        select: configSelect,
      })
      return record ? mapConfigRecord(record) : null
    },
    async findConfigByChatbotServer(chatbotId, mcpServerId, chatMode) {
      const record = await client.chatbotMCPConfig.findUnique({
        where: {
          chatbotId_mcpServerId_chatMode: {
            chatbotId,
            mcpServerId,
            chatMode,
          },
        },
        select: configSelect,
      })
      return record ? mapConfigRecord(record) : null
    },
    async createServer(data) {
      const record = await client.chatbotMCPServer.create({
        data,
        select: serverSelect,
      })
      return mapServerRecord(record)
    },
    async createConfig(data) {
      const record = await client.chatbotMCPConfig.create({
        data,
        select: configSelect,
      })
      return mapConfigRecord(record)
    },
    async updateServer(snapshot, data) {
      const current = await this.findServerById(snapshot.id)
      assertServerSnapshot(current, snapshot)
      const result = await client.chatbotMCPServer.updateMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
        data,
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'server changed during the transaction')
      }
      const updated = await this.findServerById(snapshot.id)
      if (!updated) fail('CANDIDATE_STATE_MISSING', 'server disappeared')
      return updated
    },
    async updateConfig(snapshot, data) {
      const current = await this.findConfigById(snapshot.id)
      assertConfigSnapshot(current, snapshot)
      const result = await client.chatbotMCPConfig.updateMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
        data,
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'config changed during the transaction')
      }
      const updated = await this.findConfigById(snapshot.id)
      if (!updated) fail('CANDIDATE_STATE_MISSING', 'config disappeared')
      return updated
    },
    async deleteServer(snapshot) {
      const current = await this.findServerById(snapshot.id)
      assertServerSnapshot(current, snapshot)
      const result = await client.chatbotMCPServer.deleteMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'server changed during cleanup')
      }
    },
    async deleteConfig(snapshot) {
      const current = await this.findConfigById(snapshot.id)
      assertConfigSnapshot(current, snapshot)
      const result = await client.chatbotMCPConfig.deleteMany({
        where: { id: snapshot.id, updatedAt: snapshot.updatedAt },
      })
      if (result.count !== 1) {
        fail('CONCURRENT_EDIT', 'config changed during cleanup')
      }
    },
  }
}

export function createPrismaCanaryBindingStore(
  client: PrismaClient
): CanaryBindingStore {
  return {
    ...createPrismaDelegateStore(client),
    async transaction(fn) {
      return client.$transaction(
        async (tx) => fn(createPrismaDelegateStore(tx)),
        { isolationLevel: 'Serializable' }
      )
    },
  }
}
