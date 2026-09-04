import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  CohortActivationConfigRecord,
  CohortActivationConfigUpdate,
  CohortActivationServerRecord,
  CohortActivationTransactionStore,
  JsonValue,
} from './doc-query-cohort-activation.js'

export const FINANCEWIKI_KB_ID = 'a3ba3c49-c770-5150-b393-4e750b31a61e' as const
export const FINANCEWIKI_KB_SERVER_NAME = 'KB' as const
export const FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION = 1 as const

const DOC_QUERY_TOOL_ALIAS = 'doc_query' as const
const MAX_KB_IDS = 32
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/

export type FinanceWikiAttachmentTarget = {
  chatbotId: string
  chatMode: string
}

export type FinanceWikiAttachmentManifest = {
  version: typeof FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION
  targets: FinanceWikiAttachmentTarget[]
}

export type FinanceWikiAttachmentConfigSnapshot = Omit<
  CohortActivationConfigRecord,
  'allowedTools' | 'parameters' | 'updatedAt'
> & {
  allowedTools: JsonValue
  parameters: JsonValue
  updatedAt: string
}

export type FinanceWikiAttachmentServerSnapshot = Omit<
  CohortActivationServerRecord,
  'parameters' | 'updatedAt'
> & {
  parameters: JsonValue
  updatedAt: string
}

export type FinanceWikiAttachmentReceiptEntry = {
  target: FinanceWikiAttachmentTarget
  configId: string
  prior: FinanceWikiAttachmentConfigSnapshot
  attached: FinanceWikiAttachmentConfigSnapshot
}

export type FinanceWikiAttachmentReceiptIntentEntry = {
  target: FinanceWikiAttachmentTarget
  configId: string
  prior: FinanceWikiAttachmentConfigSnapshot
  nextParameters: JsonValue
}

export type FinanceWikiAttachmentReceipt = {
  receiptVersion: typeof FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION
  financeWikiKbId: typeof FINANCEWIKI_KB_ID
  manifestFingerprint: string
  server: FinanceWikiAttachmentServerSnapshot
  entries: FinanceWikiAttachmentReceiptEntry[]
  state: 'applied' | 'rolling_back' | 'rolled_back'
  payloadDigest: string
}

export type FinanceWikiAttachmentReceiptIntent = {
  receiptVersion: typeof FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION
  financeWikiKbId: typeof FINANCEWIKI_KB_ID
  manifestFingerprint: string
  server: FinanceWikiAttachmentServerSnapshot
  entries: FinanceWikiAttachmentReceiptIntentEntry[]
  state: 'preparing'
  payloadDigest: string
}

export type FinanceWikiAttachmentReceiptFile =
  | FinanceWikiAttachmentReceipt
  | FinanceWikiAttachmentReceiptIntent

export type FinanceWikiAttachmentReceiptExpectation = {
  manifestFingerprint: string
  payloadDigest: string
  state: FinanceWikiAttachmentReceiptFile['state']
} | null

export type FinanceWikiAttachmentTransactionStore = Pick<
  CohortActivationTransactionStore,
  | 'findServerByName'
  | 'findServerById'
  | 'findConfigById'
  | 'findConfigsByServerId'
  | 'updateConfig'
>

export type FinanceWikiAttachmentStore = {
  transaction<T>(
    callback: (store: FinanceWikiAttachmentTransactionStore) => Promise<T>
  ): Promise<T>
}

export interface FinanceWikiAttachmentReceiptStore {
  read(): Promise<FinanceWikiAttachmentReceiptFile | null>
  write(
    receipt: FinanceWikiAttachmentReceiptFile,
    expected: FinanceWikiAttachmentReceiptExpectation
  ): Promise<void>
}

export type FinanceWikiAttachmentPlan = {
  status: 'ready' | 'noop'
  manifestFingerprint: string
  serverId: string
  targetCount: number
  modeCount: number
  alreadyAttached: number
  wouldAttach: number
  receiptState: FinanceWikiAttachmentReceiptFile['state'] | null
}

export type FinanceWikiAttachmentOperationResult =
  | {
      status: 'noop'
      receipt: FinanceWikiAttachmentReceipt | null
    }
  | {
      status: 'applied' | 'recovered' | 'rolled_back'
      receipt: FinanceWikiAttachmentReceipt
    }

export type FinanceWikiAttachmentReadback = {
  state: FinanceWikiAttachmentReceiptFile['state']
  targetCount: number
  attached: number
  restored: number
}

export class FinanceWikiAttachmentError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'FinanceWikiAttachmentError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new FinanceWikiAttachmentError(code, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value
  return structuredClone(value)
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  return stableStringify(left) === stableStringify(right)
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function normalizeUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    fail('INVALID_MANIFEST', `${field} must be a UUID`)
  }
  return value.trim().toLowerCase()
}

function normalizeChatMode(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length > 128 ||
    /[\r\n]/.test(value)
  ) {
    fail('INVALID_MANIFEST', 'chatMode is malformed')
  }
  return value
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string
): void {
  const allowed = new Set(keys)
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('INVALID_MANIFEST', `${label} contains an unsupported field`)
  }
}

function targetKey(target: FinanceWikiAttachmentTarget): string {
  return `${target.chatbotId}\u0000${target.chatMode}`
}

function assertIdenticalTargetModeSets(
  targets: readonly FinanceWikiAttachmentTarget[]
): void {
  const modesByChatbot = new Map<string, Set<string>>()
  for (const target of targets) {
    const modes = modesByChatbot.get(target.chatbotId) ?? new Set<string>()
    modes.add(target.chatMode)
    modesByChatbot.set(target.chatbotId, modes)
  }
  const first = [...modesByChatbot.values()][0]
  if (!first) fail('INVALID_MANIFEST', 'targets are required')
  for (const modes of modesByChatbot.values()) {
    if (
      modes.size !== first.size ||
      [...modes].some((mode) => !first.has(mode))
    ) {
      fail(
        'TARGET_MODE_SET_MISMATCH',
        'target chatbots must cover identical chat-mode sets'
      )
    }
  }
}

export function parseFinanceWikiAttachmentManifest(
  value: unknown
): FinanceWikiAttachmentManifest {
  if (!isRecord(value)) fail('INVALID_MANIFEST', 'manifest must be an object')
  assertExactKeys(value, ['version', 'targets'], 'manifest')
  if (value.version !== FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION) {
    fail('INVALID_MANIFEST', 'manifest version is unsupported')
  }
  if (!Array.isArray(value.targets) || value.targets.length === 0) {
    fail('INVALID_MANIFEST', 'manifest targets are required')
  }

  const seen = new Set<string>()
  const targets = value.targets.map((value, index) => {
    if (!isRecord(value)) {
      fail('INVALID_MANIFEST', `target ${index + 1} is malformed`)
    }
    assertExactKeys(value, ['chatbotId', 'chatMode'], `target ${index + 1}`)
    const target = {
      chatbotId: normalizeUuid(value.chatbotId, 'chatbotId'),
      chatMode: normalizeChatMode(value.chatMode),
    }
    const key = targetKey(target)
    if (seen.has(key)) fail('DUPLICATE_TARGET', 'manifest target is repeated')
    seen.add(key)
    return target
  })

  targets.sort(
    (left, right) =>
      compareStrings(left.chatbotId, right.chatbotId) ||
      compareStrings(left.chatMode, right.chatMode)
  )
  assertIdenticalTargetModeSets(targets)
  return { version: 1, targets }
}

export function financeWikiAttachmentManifestFingerprint(
  manifest: FinanceWikiAttachmentManifest
): string {
  return digest({ version: manifest.version, targets: manifest.targets })
}

type ParsedDocQueryParameters = {
  representation: 'kb_id' | 'kb_ids'
  kbIds: string[]
  parameters: { [key: string]: JsonValue }
}

function normalizeKbId(value: unknown): string {
  return normalizeUuid(value, 'knowledge-base ID')
}

function parseDocQueryParameters(
  value: JsonValue,
  errorCode = 'PARAMETERS_MALFORMED'
): ParsedDocQueryParameters {
  if (!isJsonRecord(value))
    fail(errorCode, 'Doc Query parameters are malformed')
  const hasKbId = Object.hasOwn(value, 'kb_id')
  const hasKbIds = Object.hasOwn(value, 'kb_ids')
  if (hasKbId === hasKbIds) {
    fail(
      errorCode,
      'Doc Query parameters must use exactly one KB representation'
    )
  }
  if (value.required !== true || value.toolAlias !== DOC_QUERY_TOOL_ALIAS) {
    fail(errorCode, 'Doc Query parameters are not a required doc_query binding')
  }

  const kbIds = hasKbId
    ? [normalizeKbId(value.kb_id)]
    : (() => {
        if (!Array.isArray(value.kb_ids)) {
          fail(errorCode, 'kb_ids must be an array')
        }
        if (value.kb_ids.length < 1 || value.kb_ids.length > MAX_KB_IDS) {
          fail(errorCode, 'kb_ids has an invalid size')
        }
        const normalized = value.kb_ids.map(normalizeKbId)
        if (new Set(normalized).size !== normalized.length) {
          fail(errorCode, 'kb_ids must be unique')
        }
        return [...normalized].sort(compareStrings)
      })()

  return {
    representation: hasKbId ? 'kb_id' : 'kb_ids',
    kbIds,
    parameters: value,
  }
}

function assertAllowedTools(value: JsonValue): void {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    value[0] !== DOC_QUERY_TOOL_ALIAS
  ) {
    fail('PARAMETERS_MALFORMED', 'target config must expose only doc_query')
  }
}

function hasFinanceWiki(kbIds: readonly string[]): boolean {
  return kbIds.includes(FINANCEWIKI_KB_ID)
}

function withoutFinanceWiki(kbIds: readonly string[]): string[] {
  return kbIds.filter((kbId) => kbId !== FINANCEWIKI_KB_ID)
}

function nextParameters(parsed: ParsedDocQueryParameters): JsonValue {
  if (hasFinanceWiki(parsed.kbIds)) {
    fail('PARTIAL_ATTACHMENT', 'FinanceWiki is already attached')
  }
  if (parsed.kbIds.length >= MAX_KB_IDS) {
    fail('KB_IDS_LIMIT', 'the knowledge-base scope has no free slot')
  }
  const parameters = structuredClone(parsed.parameters)
  delete parameters.kb_id
  parameters.kb_ids = [...parsed.kbIds, FINANCEWIKI_KB_ID].sort(compareStrings)
  return parameters
}

function snapshotConfig(
  config: CohortActivationConfigRecord
): FinanceWikiAttachmentConfigSnapshot {
  return {
    id: config.id,
    chatbotId: config.chatbotId,
    mcpServerId: config.mcpServerId,
    chatMode: config.chatMode,
    allowedTools: cloneJson(config.allowedTools),
    priority: config.priority,
    isEnabled: config.isEnabled,
    parameters: cloneJson(config.parameters),
    updatedAt: config.updatedAt.toISOString(),
  }
}

function snapshotServer(
  server: CohortActivationServerRecord
): FinanceWikiAttachmentServerSnapshot {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    url: server.url,
    authType: server.authType,
    passChatbotId: server.passChatbotId,
    chatbotIdHeader: server.chatbotIdHeader,
    hasAuthSecret: server.hasAuthSecret,
    parameters: cloneJson(server.parameters),
    isActive: server.isActive,
    updatedAt: server.updatedAt.toISOString(),
  }
}

function configContentEqual(
  config: CohortActivationConfigRecord,
  snapshot: FinanceWikiAttachmentConfigSnapshot
): boolean {
  return (
    config.id === snapshot.id &&
    config.chatbotId === snapshot.chatbotId &&
    config.mcpServerId === snapshot.mcpServerId &&
    config.chatMode === snapshot.chatMode &&
    jsonEqual(config.allowedTools, snapshot.allowedTools) &&
    config.priority === snapshot.priority &&
    config.isEnabled === snapshot.isEnabled &&
    jsonEqual(config.parameters, snapshot.parameters)
  )
}

function configSnapshotEqual(
  config: CohortActivationConfigRecord,
  snapshot: FinanceWikiAttachmentConfigSnapshot
): boolean {
  return (
    configContentEqual(config, snapshot) &&
    config.updatedAt.toISOString() === snapshot.updatedAt
  )
}

function serverSnapshotEqual(
  server: CohortActivationServerRecord,
  snapshot: FinanceWikiAttachmentServerSnapshot
): boolean {
  return (
    server.id === snapshot.id &&
    server.name === snapshot.name &&
    server.description === snapshot.description &&
    server.url === snapshot.url &&
    server.authType === snapshot.authType &&
    server.passChatbotId === snapshot.passChatbotId &&
    server.chatbotIdHeader === snapshot.chatbotIdHeader &&
    server.hasAuthSecret === snapshot.hasAuthSecret &&
    jsonEqual(server.parameters, snapshot.parameters) &&
    server.isActive === snapshot.isActive &&
    server.updatedAt.toISOString() === snapshot.updatedAt
  )
}

function assertNoSecretKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSecretKeys)
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (
      key === 'authSecret' ||
      key === 'bearerToken' ||
      key === 'encryptedSecret' ||
      key === 'ciphertext'
    ) {
      fail('RECEIPT_INVALID', 'receipt contains forbidden secret material')
    }
    assertNoSecretKeys(child)
  }
}

function assertIsoTimestamp(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    fail('RECEIPT_INVALID', 'receipt timestamp is malformed')
  }
}

function assertConfigSnapshot(
  value: unknown
): asserts value is FinanceWikiAttachmentConfigSnapshot {
  if (!isRecord(value)) fail('RECEIPT_INVALID', 'config snapshot is malformed')
  if (
    typeof value.id !== 'string' ||
    typeof value.chatbotId !== 'string' ||
    typeof value.mcpServerId !== 'string' ||
    typeof value.chatMode !== 'string' ||
    typeof value.priority !== 'number' ||
    typeof value.isEnabled !== 'boolean' ||
    !('allowedTools' in value) ||
    !('parameters' in value)
  ) {
    fail('RECEIPT_INVALID', 'config snapshot is malformed')
  }
  normalizeUuid(value.id, 'receipt config id')
  normalizeUuid(value.chatbotId, 'receipt chatbot id')
  normalizeUuid(value.mcpServerId, 'receipt server id')
  if (value.chatMode.length === 0 || /[\r\n]/.test(value.chatMode)) {
    fail('RECEIPT_INVALID', 'config snapshot mode is malformed')
  }
  assertIsoTimestamp(value.updatedAt)
  assertNoSecretKeys(value)
}

function assertServerSnapshot(
  value: unknown
): asserts value is FinanceWikiAttachmentServerSnapshot {
  if (!isRecord(value)) fail('RECEIPT_INVALID', 'server snapshot is malformed')
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    (typeof value.description !== 'string' && value.description !== null) ||
    typeof value.url !== 'string' ||
    typeof value.authType !== 'string' ||
    typeof value.passChatbotId !== 'boolean' ||
    (typeof value.chatbotIdHeader !== 'string' &&
      value.chatbotIdHeader !== null) ||
    typeof value.hasAuthSecret !== 'boolean' ||
    typeof value.isActive !== 'boolean' ||
    !('parameters' in value)
  ) {
    fail('RECEIPT_INVALID', 'server snapshot is malformed')
  }
  normalizeUuid(value.id, 'receipt server id')
  assertIsoTimestamp(value.updatedAt)
  assertNoSecretKeys(value)
}

function assertReceiptTarget(
  value: unknown
): asserts value is FinanceWikiAttachmentTarget {
  if (!isRecord(value)) fail('RECEIPT_INVALID', 'receipt target is malformed')
  normalizeUuid(value.chatbotId, 'receipt chatbot id')
  normalizeChatMode(value.chatMode)
}

function assertReceiptDigest(receipt: FinanceWikiAttachmentReceiptFile): void {
  if (!SHA256_PATTERN.test(receipt.payloadDigest)) {
    fail('RECEIPT_INVALID', 'receipt digest is malformed')
  }
  const { payloadDigest: _ignored, ...withoutDigest } = receipt
  if (digest(withoutDigest) !== receipt.payloadDigest) {
    fail('RECEIPT_INVALID', 'receipt digest does not match')
  }
}

function assertReceiptShape(receipt: FinanceWikiAttachmentReceiptFile): void {
  assertNoSecretKeys(receipt)
  if (!isRecord(receipt)) fail('RECEIPT_INVALID', 'receipt is malformed')
  if (
    receipt.receiptVersion !== FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION ||
    receipt.financeWikiKbId !== FINANCEWIKI_KB_ID ||
    typeof receipt.manifestFingerprint !== 'string' ||
    !SHA256_PATTERN.test(receipt.manifestFingerprint)
  ) {
    fail('RECEIPT_INVALID', 'receipt identity is malformed')
  }
  assertServerSnapshot(receipt.server)
  if (receipt.server.name !== FINANCEWIKI_KB_SERVER_NAME) {
    fail('RECEIPT_INVALID', 'receipt server is not KB')
  }
  if (!Array.isArray(receipt.entries) || receipt.entries.length === 0) {
    fail('RECEIPT_INVALID', 'receipt entries are required')
  }
  const keys = new Set<string>()
  for (const entry of receipt.entries) {
    if (!isRecord(entry)) fail('RECEIPT_INVALID', 'receipt entry is malformed')
    assertReceiptTarget(entry.target)
    assertConfigSnapshot(entry.prior)
    normalizeUuid(entry.configId, 'receipt config id')
    if (
      entry.configId.toLowerCase() !== entry.prior.id.toLowerCase() ||
      entry.prior.chatbotId.toLowerCase() !==
        entry.target.chatbotId.toLowerCase() ||
      entry.prior.chatMode !== entry.target.chatMode ||
      entry.prior.mcpServerId.toLowerCase() !== receipt.server.id.toLowerCase()
    ) {
      fail('RECEIPT_INVALID', 'receipt config identity is malformed')
    }
    if (keys.has(targetKey(entry.target))) {
      fail('RECEIPT_INVALID', 'receipt target is repeated')
    }
    keys.add(targetKey(entry.target))
    if (receipt.state === 'preparing') {
      if (!('nextParameters' in entry)) {
        fail('RECEIPT_INVALID', 'receipt intent is malformed')
      }
      const next = parseDocQueryParameters(entry.nextParameters as JsonValue)
      if (!hasFinanceWiki(next.kbIds) || next.representation !== 'kb_ids') {
        fail('RECEIPT_INVALID', 'receipt intent does not attach FinanceWiki')
      }
    } else {
      if (!('attached' in entry)) {
        fail('RECEIPT_INVALID', 'receipt entry is incomplete')
      }
      assertConfigSnapshot(entry.attached)
      if (
        entry.prior.id !== entry.attached.id ||
        entry.prior.chatbotId !== entry.attached.chatbotId ||
        entry.prior.chatMode !== entry.attached.chatMode ||
        !hasFinanceWiki(
          parseDocQueryParameters(entry.attached.parameters).kbIds
        ) ||
        entry.attached.mcpServerId.toLowerCase() !==
          receipt.server.id.toLowerCase()
      ) {
        fail('RECEIPT_INVALID', 'receipt attached snapshot is malformed')
      }
    }
  }
}

export function assertFinanceWikiAttachmentReceiptIntegrity(
  receipt: FinanceWikiAttachmentReceiptFile
): void {
  if (
    receipt.state !== 'preparing' &&
    receipt.state !== 'applied' &&
    receipt.state !== 'rolling_back' &&
    receipt.state !== 'rolled_back'
  ) {
    fail('RECEIPT_INVALID', 'receipt state is unsupported')
  }
  assertReceiptShape(receipt)
  assertReceiptDigest(receipt)
}

function manifestFromReceipt(
  receipt: FinanceWikiAttachmentReceiptFile
): FinanceWikiAttachmentManifest {
  return parseFinanceWikiAttachmentManifest({
    version: FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION,
    targets: receipt.entries.map(({ target }) => target),
  })
}

function assertReceiptMatchesManifest(
  receipt: FinanceWikiAttachmentReceiptFile,
  manifest: FinanceWikiAttachmentManifest
): void {
  if (
    receipt.manifestFingerprint !==
    financeWikiAttachmentManifestFingerprint(manifest)
  ) {
    fail('RECEIPT_MANIFEST_MISMATCH', 'receipt does not match the manifest')
  }
  const manifestKeys = manifest.targets.map(targetKey)
  const receiptKeys = receipt.entries.map(({ target }) => targetKey(target))
  if (
    manifestKeys.length !== receiptKeys.length ||
    manifestKeys.some((key, index) => key !== receiptKeys[index])
  ) {
    fail(
      'RECEIPT_MANIFEST_MISMATCH',
      'receipt targets do not match the manifest'
    )
  }
}

export function receiptExpectation(
  receipt: FinanceWikiAttachmentReceiptFile | null
): FinanceWikiAttachmentReceiptExpectation {
  return receipt
    ? {
        manifestFingerprint: receipt.manifestFingerprint,
        payloadDigest: receipt.payloadDigest,
        state: receipt.state,
      }
    : null
}

function makeIntent(
  manifest: FinanceWikiAttachmentManifest,
  server: FinanceWikiAttachmentServerSnapshot,
  entries: Array<{
    target: FinanceWikiAttachmentTarget
    config: CohortActivationConfigRecord
    nextParameters: JsonValue
  }>
): FinanceWikiAttachmentReceiptIntent {
  const withoutDigest = {
    receiptVersion: FINANCEWIKI_ATTACHMENT_RECEIPT_VERSION,
    financeWikiKbId: FINANCEWIKI_KB_ID,
    manifestFingerprint: financeWikiAttachmentManifestFingerprint(manifest),
    server,
    entries: entries.map(({ target, config, nextParameters }) => ({
      target,
      configId: config.id,
      prior: snapshotConfig(config),
      nextParameters: cloneJson(nextParameters),
    })),
    state: 'preparing' as const,
  }
  return { ...withoutDigest, payloadDigest: digest(withoutDigest) }
}

function makeAppliedReceipt(
  intent: FinanceWikiAttachmentReceiptIntent,
  attached: FinanceWikiAttachmentConfigSnapshot[]
): FinanceWikiAttachmentReceipt {
  if (attached.length !== intent.entries.length) {
    fail('TRANSACTION_FAILED', 'transaction returned an incomplete config set')
  }
  const withoutDigest = {
    receiptVersion: intent.receiptVersion,
    financeWikiKbId: intent.financeWikiKbId,
    manifestFingerprint: intent.manifestFingerprint,
    server: intent.server,
    entries: intent.entries.map((entry, index) => ({
      target: entry.target,
      configId: entry.configId,
      prior: entry.prior,
      attached: attached[index]!,
    })),
    state: 'applied' as const,
  }
  return { ...withoutDigest, payloadDigest: digest(withoutDigest) }
}

function updateReceiptState(
  receipt: FinanceWikiAttachmentReceipt,
  state: 'rolling_back' | 'rolled_back'
): FinanceWikiAttachmentReceipt {
  const { payloadDigest: _ignored, ...withoutDigest } = receipt
  const next = { ...withoutDigest, state }
  return { ...next, payloadDigest: digest(next) }
}

async function readReceipt(
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentReceiptFile | null> {
  const receipt = await receiptStore.read()
  if (receipt) assertFinanceWikiAttachmentReceiptIntegrity(receipt)
  return receipt
}

function requireReceipt(
  receipt: FinanceWikiAttachmentReceiptFile | null
): FinanceWikiAttachmentReceiptFile {
  if (!receipt) fail('RECEIPT_MISSING', 'FinanceWiki receipt is required')
  return receipt
}

function assertServerReady(server: CohortActivationServerRecord): void {
  if (
    server.name !== FINANCEWIKI_KB_SERVER_NAME ||
    !server.isActive ||
    server.authType.toLowerCase() !== 'bearer' ||
    !server.hasAuthSecret ||
    server.url.trim().length === 0
  ) {
    fail('KB_SERVER_INVALID', 'the active bearer KB server is required')
  }
  normalizeUuid(server.id, 'KB server id')
}

type AttachmentState = {
  server: CohortActivationServerRecord
  serverSnapshot: FinanceWikiAttachmentServerSnapshot
  entries: Array<{
    target: FinanceWikiAttachmentTarget
    config: CohortActivationConfigRecord
    parsed: ParsedDocQueryParameters
  }>
  allAttached: boolean
}

async function readAttachmentState(
  store: FinanceWikiAttachmentStore,
  manifest: FinanceWikiAttachmentManifest
): Promise<AttachmentState> {
  return store.transaction(async (tx) => {
    const server = await tx.findServerByName(FINANCEWIKI_KB_SERVER_NAME)
    if (!server) fail('KB_SERVER_MISSING', 'the KB server is required')
    assertServerReady(server)
    const configs = await tx.findConfigsByServerId(server.id)
    const targetsByKey = new Map(
      manifest.targets.map((target) => [targetKey(target), target])
    )
    const enabledByKey = new Map<string, CohortActivationConfigRecord>()
    const targetChatbots = new Set(
      manifest.targets.map(({ chatbotId }) => chatbotId)
    )

    for (const config of configs) {
      if (
        !config.isEnabled ||
        !targetChatbots.has(config.chatbotId.toLowerCase())
      ) {
        continue
      }
      const key = targetKey({
        chatbotId: config.chatbotId.toLowerCase(),
        chatMode: config.chatMode,
      })
      if (!targetsByKey.has(key)) {
        fail(
          'TARGET_MODES_INCOMPLETE',
          'the manifest does not cover every enabled target mode'
        )
      }
      if (enabledByKey.has(key)) {
        fail('CONFIG_DUPLICATE', 'a target mode has multiple enabled configs')
      }
      enabledByKey.set(key, config)
    }

    const entries = manifest.targets.map((target) => {
      const config = enabledByKey.get(targetKey(target))
      if (!config) {
        fail('CONFIG_MISSING', 'an enabled target config is required')
      }
      if (
        config.chatbotId.toLowerCase() !== target.chatbotId ||
        config.chatMode !== target.chatMode ||
        config.mcpServerId !== server.id
      ) {
        fail('CONFIG_MISMATCH', 'target config identity does not match')
      }
      assertAllowedTools(config.allowedTools)
      const parsed = parseDocQueryParameters(config.parameters)
      return { target, config, parsed }
    })

    const first = entries[0]!.parsed
    const firstBase = withoutFinanceWiki(first.kbIds)
    for (const entry of entries.slice(1)) {
      if (
        entry.parsed.representation !== first.representation ||
        withoutFinanceWiki(entry.parsed.kbIds).length !== firstBase.length ||
        withoutFinanceWiki(entry.parsed.kbIds).some(
          (kbId, index) => kbId !== firstBase[index]
        )
      ) {
        fail(
          'MODE_SET_MISMATCH',
          'enabled target modes do not share one canonical KB set'
        )
      }
    }

    const attachedCount = entries.filter(({ parsed }) =>
      hasFinanceWiki(parsed.kbIds)
    ).length
    if (attachedCount !== 0 && attachedCount !== entries.length) {
      fail('PARTIAL_ATTACHMENT', 'FinanceWiki is attached to only some modes')
    }

    return {
      server,
      serverSnapshot: snapshotServer(server),
      entries,
      allAttached: attachedCount === entries.length,
    }
  })
}

function assertCurrentReceiptState(
  state: AttachmentState,
  receipt: FinanceWikiAttachmentReceipt,
  expected: 'attached' | 'prior'
): void {
  if (!serverSnapshotEqual(state.server, receipt.server)) {
    fail('RECEIPT_STALE', 'receipt server timestamp or content is stale')
  }
  for (const current of state.entries) {
    const entry = receipt.entries.find(
      ({ target }) => targetKey(target) === targetKey(current.target)
    )
    if (!entry) fail('RECEIPT_STALE', 'receipt target set is stale')
    const snapshot = expected === 'attached' ? entry.attached : entry.prior
    if (!configSnapshotEqual(current.config, snapshot)) {
      fail('RECEIPT_STALE', 'receipt config timestamp or content is stale')
    }
  }
}

function receiptManifest(
  receipt: FinanceWikiAttachmentReceiptFile
): FinanceWikiAttachmentManifest {
  const manifest = manifestFromReceipt(receipt)
  assertReceiptMatchesManifest(receipt, manifest)
  return manifest
}

function assertNoExistingReceiptForApply(
  receipt: FinanceWikiAttachmentReceiptFile | null,
  state: AttachmentState,
  manifest: FinanceWikiAttachmentManifest
): FinanceWikiAttachmentOperationResult | null {
  if (!receipt) {
    if (state.allAttached) return { status: 'noop', receipt: null }
    return null
  }
  assertReceiptMatchesManifest(receipt, manifest)
  if (receipt.state === 'applied') {
    assertCurrentReceiptState(state, receipt, 'attached')
    return { status: 'noop', receipt }
  }
  fail(
    receipt.state === 'preparing' ? 'RECEIPT_IN_PROGRESS' : 'RECEIPT_TERMINAL',
    'an existing FinanceWiki receipt blocks apply'
  )
}

export async function planFinanceWikiAttachment(
  store: FinanceWikiAttachmentStore,
  value: unknown,
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentPlan> {
  const manifest = parseFinanceWikiAttachmentManifest(value)
  const receipt = await readReceipt(receiptStore)
  const state = await readAttachmentState(store, manifest)
  if (receipt) {
    assertReceiptMatchesManifest(receipt, manifest)
    if (receipt.state === 'applied') {
      assertCurrentReceiptState(state, receipt, 'attached')
    } else if (receipt.state === 'rolled_back') {
      assertCurrentReceiptState(state, receipt, 'prior')
    } else {
      fail('RECEIPT_IN_PROGRESS', 'an unfinished FinanceWiki receipt exists')
    }
  }
  return {
    status: state.allAttached ? 'noop' : 'ready',
    manifestFingerprint: financeWikiAttachmentManifestFingerprint(manifest),
    serverId: state.server.id,
    targetCount: state.entries.length,
    modeCount: new Set(state.entries.map(({ target }) => target.chatMode)).size,
    alreadyAttached: state.allAttached ? state.entries.length : 0,
    wouldAttach: state.allAttached ? 0 : state.entries.length,
    receiptState: receipt?.state ?? null,
  }
}

async function applyIntent(
  store: FinanceWikiAttachmentStore,
  intent: FinanceWikiAttachmentReceiptIntent
): Promise<FinanceWikiAttachmentConfigSnapshot[]> {
  return store.transaction(async (tx) => {
    const server = await tx.findServerById(intent.server.id)
    if (!server || !serverSnapshotEqual(server, intent.server)) {
      fail('RECEIPT_STALE', 'KB server changed after the pre-read')
    }
    const currentConfigs: CohortActivationConfigRecord[] = []
    for (const entry of intent.entries) {
      const current = await tx.findConfigById(entry.configId)
      if (!current || !configSnapshotEqual(current, entry.prior)) {
        fail('RECEIPT_STALE', 'target config changed after the pre-read')
      }
      assertAllowedTools(current.allowedTools)
      const parsed = parseDocQueryParameters(current.parameters)
      if (hasFinanceWiki(parsed.kbIds)) {
        fail('RECEIPT_STALE', 'FinanceWiki appeared after the pre-read')
      }
      currentConfigs.push(current)
    }

    const attached: FinanceWikiAttachmentConfigSnapshot[] = []
    for (const [index, current] of currentConfigs.entries()) {
      const entry = intent.entries[index]!
      const data: CohortActivationConfigUpdate = {
        chatbotId: current.chatbotId,
        mcpServerId: current.mcpServerId,
        chatMode: current.chatMode,
        allowedTools: cloneJson(current.allowedTools),
        priority: current.priority,
        isEnabled: current.isEnabled,
        parameters: cloneJson(entry.nextParameters),
      }
      const updated = await tx.updateConfig(current.id, current.updatedAt, data)
      if (!updated)
        fail('CONCURRENT_EDIT', 'target config compare-and-set failed')
      attached.push(snapshotConfig(updated))
    }
    return attached
  })
}

export async function applyFinanceWikiAttachment(
  store: FinanceWikiAttachmentStore,
  value: unknown,
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentOperationResult> {
  const manifest = parseFinanceWikiAttachmentManifest(value)
  const receipt = await readReceipt(receiptStore)
  const state = await readAttachmentState(store, manifest)
  const noOp = assertNoExistingReceiptForApply(receipt, state, manifest)
  if (noOp) return noOp

  const intent = makeIntent(
    manifest,
    state.serverSnapshot,
    state.entries.map(({ target, config, parsed }) => ({
      target,
      config,
      nextParameters: nextParameters(parsed),
    }))
  )
  await receiptStore.write(intent, null)

  const attached = await applyIntent(store, intent)
  const applied = makeAppliedReceipt(intent, attached)
  await receiptStore.write(applied, receiptExpectation(intent))
  return { status: 'applied', receipt: applied }
}

type ReceiptCurrentState = {
  server: CohortActivationServerRecord | null
  configs: Array<CohortActivationConfigRecord | null>
}

async function readReceiptCurrentState(
  store: FinanceWikiAttachmentStore,
  receipt: FinanceWikiAttachmentReceiptFile
): Promise<ReceiptCurrentState> {
  return store.transaction(async (tx) => ({
    server: await tx.findServerById(receipt.server.id),
    configs: await Promise.all(
      receipt.entries.map(({ configId }) => tx.findConfigById(configId))
    ),
  }))
}

function assertIntentServer(
  current: CohortActivationServerRecord | null,
  intent: FinanceWikiAttachmentReceiptIntent
): void {
  if (!current || !serverSnapshotEqual(current, intent.server)) {
    fail('RECOVERY_STALE', 'KB server does not match the receipt intent')
  }
}

function expectedAttachedContent(
  prior: FinanceWikiAttachmentConfigSnapshot,
  nextParameters: JsonValue
): FinanceWikiAttachmentConfigSnapshot {
  return { ...prior, parameters: cloneJson(nextParameters) }
}

function classifyIntentConfig(
  current: CohortActivationConfigRecord | null,
  entry: FinanceWikiAttachmentReceiptIntentEntry
): 'old' | 'new' {
  if (!current) fail('RECOVERY_STALE', 'target config is missing')
  if (configContentEqual(current, entry.prior)) return 'old'
  if (
    configContentEqual(
      current,
      expectedAttachedContent(entry.prior, entry.nextParameters)
    )
  ) {
    return 'new'
  }
  fail('RECOVERY_AMBIGUOUS', 'target config is neither prior nor attached')
}

async function recoverPreparing(
  store: FinanceWikiAttachmentStore,
  receiptStore: FinanceWikiAttachmentReceiptStore,
  intent: FinanceWikiAttachmentReceiptIntent
): Promise<FinanceWikiAttachmentOperationResult> {
  const current = await readReceiptCurrentState(store, intent)
  assertIntentServer(current.server, intent)
  const states = intent.entries.map((entry, index) =>
    classifyIntentConfig(current.configs[index] ?? null, entry)
  )
  const hasOld = states.includes('old')
  const hasNew = states.includes('new')
  if (hasOld && hasNew) {
    fail('RECOVERY_AMBIGUOUS', 'target configs are partially attached')
  }
  if (hasOld) {
    const attached = await applyIntent(store, intent)
    const applied = makeAppliedReceipt(intent, attached)
    await receiptStore.write(applied, receiptExpectation(intent))
    return { status: 'recovered', receipt: applied }
  }
  const attached = current.configs.map((config) => {
    if (!config) return fail('RECOVERY_STALE', 'target config is missing')
    return snapshotConfig(config)
  })
  const applied = makeAppliedReceipt(intent, attached)
  await receiptStore.write(applied, receiptExpectation(intent))
  return { status: 'recovered', receipt: applied }
}

async function rollbackTransaction(
  store: FinanceWikiAttachmentStore,
  receipt: FinanceWikiAttachmentReceipt
): Promise<void> {
  await store.transaction(async (tx) => {
    const server = await tx.findServerById(receipt.server.id)
    if (!server || !serverSnapshotEqual(server, receipt.server)) {
      fail('RECEIPT_STALE', 'KB server changed before rollback')
    }
    const currentConfigs: CohortActivationConfigRecord[] = []
    for (const entry of receipt.entries) {
      const current = await tx.findConfigById(entry.configId)
      if (!current || !configSnapshotEqual(current, entry.attached)) {
        fail('RECEIPT_STALE', 'target config changed before rollback')
      }
      currentConfigs.push(current)
    }
    for (const [index, current] of currentConfigs.entries()) {
      const entry = receipt.entries[index]!
      const data: CohortActivationConfigUpdate = {
        chatbotId: current.chatbotId,
        mcpServerId: current.mcpServerId,
        chatMode: current.chatMode,
        allowedTools: cloneJson(current.allowedTools),
        priority: current.priority,
        isEnabled: current.isEnabled,
        parameters: cloneJson(entry.prior.parameters),
      }
      if (!(await tx.updateConfig(current.id, current.updatedAt, data))) {
        fail('CONCURRENT_EDIT', 'target config rollback compare-and-set failed')
      }
    }
  })
}

async function recoverRollingBack(
  store: FinanceWikiAttachmentStore,
  receiptStore: FinanceWikiAttachmentReceiptStore,
  receipt: FinanceWikiAttachmentReceipt
): Promise<FinanceWikiAttachmentOperationResult> {
  const current = await readReceiptCurrentState(store, receipt)
  if (!current.server || !serverSnapshotEqual(current.server, receipt.server)) {
    fail('RECOVERY_STALE', 'KB server does not match the rollback receipt')
  }
  const states = current.configs.map((config, index) => {
    const entry = receipt.entries[index]!
    if (!config) return fail('RECOVERY_STALE', 'target config is missing')
    if (configContentEqual(config, entry.prior)) return 'old' as const
    if (configSnapshotEqual(config, entry.attached)) return 'new' as const
    return fail(
      'RECOVERY_AMBIGUOUS',
      'target config is neither attached nor restored'
    )
  })
  if (states.includes('old') && states.includes('new')) {
    fail('RECOVERY_AMBIGUOUS', 'target configs are partially restored')
  }
  if (states.every((state) => state === 'new')) {
    await rollbackTransaction(store, receipt)
  }
  const rolledBack = updateReceiptState(receipt, 'rolled_back')
  await receiptStore.write(rolledBack, receiptExpectation(receipt))
  return { status: 'recovered', receipt: rolledBack }
}

export async function recoverFinanceWikiAttachment(
  store: FinanceWikiAttachmentStore,
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentOperationResult> {
  const receipt = requireReceipt(await readReceipt(receiptStore))
  if (receipt.state === 'preparing') {
    return recoverPreparing(store, receiptStore, receipt)
  }
  if (receipt.state === 'rolling_back') {
    return recoverRollingBack(store, receiptStore, receipt)
  }
  fail('RECEIPT_STATE', 'receipt does not need recovery')
}

export async function rollbackFinanceWikiAttachment(
  store: FinanceWikiAttachmentStore,
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentOperationResult> {
  const receipt = await readReceipt(receiptStore)
  if (receipt?.state !== 'applied') {
    fail('RECEIPT_STATE', 'rollback requires an applied receipt')
  }
  const manifest = receiptManifest(receipt)
  const state = await readAttachmentState(store, manifest)
  assertCurrentReceiptState(state, receipt, 'attached')
  const rollingBack = updateReceiptState(receipt, 'rolling_back')
  await receiptStore.write(rollingBack, receiptExpectation(receipt))
  await rollbackTransaction(store, receipt)
  const rolledBack = updateReceiptState(rollingBack, 'rolled_back')
  await receiptStore.write(rolledBack, receiptExpectation(rollingBack))
  return { status: 'rolled_back', receipt: rolledBack }
}

export async function readFinanceWikiAttachment(
  store: FinanceWikiAttachmentStore,
  receiptStore: FinanceWikiAttachmentReceiptStore
): Promise<FinanceWikiAttachmentReadback> {
  const receipt = requireReceipt(await readReceipt(receiptStore))
  if (receipt.state === 'preparing') {
    fail('RECEIPT_STATE', 'readback requires an applied or rolled-back receipt')
  }
  const current = await readReceiptCurrentState(store, receipt)
  if (!current.server || !serverSnapshotEqual(current.server, receipt.server)) {
    fail('RECEIPT_STALE', 'KB server does not match the receipt')
  }
  let attached = 0
  let restored = 0
  for (const [index, config] of current.configs.entries()) {
    const entry = receipt.entries[index]!
    if (!config) fail('CONFIG_MISSING', 'receipt config is missing')
    if (configSnapshotEqual(config, entry.attached)) attached += 1
    if (configContentEqual(config, entry.prior)) restored += 1
  }
  return {
    state: receipt.state,
    targetCount: receipt.entries.length,
    attached,
    restored,
  }
}

function assertReceiptExpectation(
  expected: FinanceWikiAttachmentReceiptExpectation,
  current: FinanceWikiAttachmentReceiptFile | null
): void {
  if (expected === null) {
    if (current) fail('RECEIPT_CONCURRENT_WRITE', 'receipt already exists')
    return
  }
  if (
    !current ||
    current.manifestFingerprint !== expected.manifestFingerprint ||
    current.payloadDigest !== expected.payloadDigest ||
    current.state !== expected.state
  ) {
    fail('RECEIPT_CONCURRENT_WRITE', 'receipt changed before write')
  }
}

export function createFileFinanceWikiAttachmentReceiptStore(
  receiptPath: string
): FinanceWikiAttachmentReceiptStore {
  const absolutePath = resolve(receiptPath)
  const readCurrent =
    async (): Promise<FinanceWikiAttachmentReceiptFile | null> => {
      try {
        const value = JSON.parse(
          await readFile(absolutePath, 'utf8')
        ) as unknown
        if (!isRecord(value)) fail('RECEIPT_INVALID', 'receipt is malformed')
        assertFinanceWikiAttachmentReceiptIntegrity(
          value as FinanceWikiAttachmentReceiptFile
        )
        return value as FinanceWikiAttachmentReceiptFile
      } catch (error) {
        if (error instanceof FinanceWikiAttachmentError) throw error
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return null
        }
        fail('RECEIPT_READ_FAILED', 'receipt could not be read')
      }
    }

  return {
    read: readCurrent,
    async write(receipt, expected) {
      assertFinanceWikiAttachmentReceiptIntegrity(receipt)
      const directory = dirname(absolutePath)
      await mkdir(directory, { recursive: true })
      const lockPath = `${absolutePath}.lock`
      let lock: Awaited<ReturnType<typeof open>> | undefined
      try {
        try {
          lock = await open(lockPath, 'wx')
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'EEXIST'
          ) {
            fail('RECEIPT_LOCKED', 'another receipt write is active')
          }
          throw error
        }
        const current = await readCurrent()
        assertReceiptExpectation(expected, current)
        if (current?.payloadDigest === receipt.payloadDigest) return
        const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
        let renamed = false
        try {
          const temporary = await open(temporaryPath, 'wx', 0o600)
          try {
            await temporary.writeFile(
              `${JSON.stringify(receipt, null, 2)}\n`,
              'utf8'
            )
            await temporary.sync()
          } finally {
            await temporary.close()
          }
          const latest = await readCurrent()
          assertReceiptExpectation(expected, latest)
          await rename(temporaryPath, absolutePath)
          renamed = true
          const directoryHandle = await open(directory, 'r')
          try {
            await directoryHandle.sync()
          } finally {
            await directoryHandle.close()
          }
        } finally {
          if (!renamed) {
            await unlink(temporaryPath).catch(
              (error: NodeJS.ErrnoException) => {
                if (error.code !== 'ENOENT') throw error
              }
            )
          }
        }
      } finally {
        if (lock) {
          await lock.close()
          await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error
          })
        }
      }
    },
  }
}
