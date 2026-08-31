import { createHash, randomUUID } from 'node:crypto'

export const DOC_QUERY_TOOL_ALIAS = 'doc_query' as const
export const DOC_QUERY_ROUTE_PATH = '/mcp/klicker' as const
export const DOC_QUERY_TARGET_SERVER_NAME = 'KB' as const
export const DOC_QUERY_TARGET_DESCRIPTION =
  'managed-by:klicker-doc-query-cohort-activation;scope:prd-klicker' as const
export const DOC_QUERY_TARGET_URL =
  'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker' as const
export const DOC_QUERY_TARGET_SCOPE = 'prd-klicker' as const
export const COHORT_ACTIVATION_RECEIPT_VERSION = 1 as const
/** Name of the explicit, values-free approval pin supplied to the runner. */
export const COHORT_ACTIVATION_MANIFEST_FINGERPRINT_ENV =
  'DOC_QUERY_COHORT_ACTIVATION_MANIFEST_FINGERPRINT' as const

/** The named corpora are held out of this operator by contract. */
export const COHORT_ACTIVATION_EXCLUDED_CORPORA = [
  'BF1',
  'DF CF2',
  'Vorkurs2',
] as const

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOOL_PATTERN = /^[A-Za-z0-9_-]+$/

export const DOC_QUERY_TOOL_NAMES = [DOC_QUERY_TOOL_ALIAS] as const
const SOURCE_DOC_QUERY_TOOL_NAMES = [
  'banking_expert',
  'bf1_expert',
  'bio144_expert',
  'cf1_expert',
  'df_ap_expert',
  'df_bf2_expert',
  'df_cf2_expert',
  'df_fineco_expert',
  'df_qf_expert',
  'fs26_intro_r_expert',
  'informatik_und_wirtschaft_video_expert',
  'mat141_expert',
  'mat182_expert',
  'mat183_expert',
  'python_and_r_expert',
  'radiosurfvet_expert',
  'vorkurs_expert',
] as const

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CohortActivationConfigRecord = {
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

export type CohortActivationServerRecord = {
  id: string
  name: string
  description: string | null
  url: string
  authType: string
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: JsonValue
  hasAuthSecret: boolean
  isActive: boolean
  updatedAt: Date
}

export type CohortActivationServerCreate = {
  id?: string
  name: string
  description: string
  url: string
  authType: 'bearer'
  /** Encrypted at rest; plaintext never enters this contract. */
  encryptedBearer: string
  passChatbotId: true
  chatbotIdHeader: 'Chatbot-ID'
  parameters: JsonValue
  isActive: true
}

export type CohortActivationConfigCreate = {
  id?: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonValue
  priority: number
  isEnabled: false
  parameters: JsonValue
}

export type CohortActivationConfigUpdate = {
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: JsonValue
  priority: number
  isEnabled: boolean
  parameters: JsonValue
}

export type CohortActivationTransactionStore = {
  findServerByName(name: string): Promise<CohortActivationServerRecord | null>
  findServerById(id: string): Promise<CohortActivationServerRecord | null>
  findConfigById(id: string): Promise<CohortActivationConfigRecord | null>
  findConfigByChatbotServer(
    chatbotId: string,
    mcpServerId: string,
    chatMode: string
  ): Promise<CohortActivationConfigRecord | null>
  findConfigsByServerId(
    mcpServerId: string
  ): Promise<CohortActivationConfigRecord[]>
  createServer(
    data: CohortActivationServerCreate
  ): Promise<CohortActivationServerRecord>
  createConfig(
    data: CohortActivationConfigCreate
  ): Promise<CohortActivationConfigRecord>
  updateConfig(
    id: string,
    expectedUpdatedAt: Date,
    data: CohortActivationConfigUpdate
  ): Promise<CohortActivationConfigRecord | null>
}

export type CohortActivationStore = {
  transaction<T>(
    callback: (store: CohortActivationTransactionStore) => Promise<T>
  ): Promise<T>
}

export type CohortActivationTargetContract = {
  serverName: string
  routePath: string
  scope: string
  url: string
}

export type CohortActivationManifestEntry = {
  configId: string
  chatbotId: string
  chatMode: string
  sourceServerId: string
  /** The multi-tenant reader exposes one stable public tool. */
  targetTool?: typeof DOC_QUERY_TOOL_ALIAS
  /** External knowledge-base identifier used by the reader scope. */
  kbId: string
  /** Stable corpus identity; aliases are accepted when reading a handoff. */
  corpusIdentity?: string
  corpusId?: string
  /** Stable corpus owner identity; aliases are accepted when reading a handoff. */
  corpusOwner?: string
  corpusOwnerId?: string
}

export type CohortActivationManifest = {
  fingerprint: string
  target: CohortActivationTargetContract
  entries: CohortActivationManifestEntry[]
  heldConfigIds: string[]
  /** Canonical exclusion names are required; this alias eases handoff parsing. */
  excludedCorpora?: string[]
  exclusions?: string[]
  /** Optional explicit row holds, kept separate from the named exclusions. */
  excludedConfigIds?: string[]
}

type SafeConfigSnapshot = Omit<
  CohortActivationConfigRecord,
  'allowedTools' | 'parameters' | 'updatedAt'
> & {
  allowedTools: JsonValue
  parameters: JsonValue
  updatedAt: string
}

type SafeServerSnapshot = Omit<
  CohortActivationServerRecord,
  'parameters' | 'updatedAt'
> & {
  parameters: JsonValue
  updatedAt: string
}

export type CohortActivationReceiptEntry = {
  manifest: CohortActivationManifestEntry
  prior: SafeConfigSnapshot
  target: SafeConfigSnapshot
}

export type CohortActivationReceiptState =
  | 'prepared'
  | 'switching'
  | 'switched'
  | 'rolling_back'
  | 'rolled_back'

export type CohortActivationReceipt = {
  receiptVersion: typeof COHORT_ACTIVATION_RECEIPT_VERSION
  manifestFingerprint: string
  target: CohortActivationTargetContract
  targetServer: SafeServerSnapshot
  heldConfigIds: string[]
  excludedCorpora: string[]
  excludedConfigIds: string[]
  entries: CohortActivationReceiptEntry[]
  switchedChatbotIds: string[]
  state: CohortActivationReceiptState
  payloadDigest: string
}

export type CohortActivationReceiptIntent = {
  receiptVersion: typeof COHORT_ACTIVATION_RECEIPT_VERSION
  manifestFingerprint: string
  target: CohortActivationTargetContract
  /** Null means the target server is resolved during the prepare transaction. */
  targetServerId: string | null
  targetConfigIds: Record<string, string>
  heldConfigIds: string[]
  excludedCorpora: string[]
  excludedConfigIds: string[]
  state: 'preparing'
  payloadDigest: string
}

export type CohortActivationReceiptFile =
  | CohortActivationReceipt
  | CohortActivationReceiptIntent

export type CohortActivationReceiptExpectation = {
  manifestFingerprint: string
  payloadDigest: string
  state: CohortActivationReceiptFile['state']
} | null

export type CohortActivationPrepareOptions = {
  encryptedBearer?: string
  intent?: CohortActivationReceiptIntent
}

export type CohortActivationDryRunResult = {
  status: 'dry-run'
  manifestFingerprint: string
  target: CohortActivationTargetContract
  entryCount: number
  heldCount: number
  wouldCreateServer: boolean
  wouldCreateConfigs: number
  wouldSwitch: number
  wouldPreserveSourceRows: true
}

export type CohortActivationReadback = {
  state: CohortActivationReceiptState | 'partial'
  entryCount: number
  chatbotCount: number
  switchedChatbotCount: number
  sourceEnabled: number
  sourceDisabled: number
  targetEnabled: number
  targetDisabled: number
  targetServerActive: boolean
}

export class CohortActivationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CohortActivationError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new CohortActivationError(code, message)
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value
  return structuredClone(value)
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true
  if (left === null || right === null) return false
  if (typeof left !== 'object' || typeof right !== 'object') {
    return left === right
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonEqual(value, right[index]!))
    )
  }
  const leftRecord = left as Record<string, JsonValue>
  const rightRecord = right as Record<string, JsonValue>
  const leftKeys = Object.keys(leftRecord).sort(compareStrings)
  const rightKeys = Object.keys(rightRecord).sort(compareStrings)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        jsonEqual(leftRecord[key]!, rightRecord[key]!)
    )
  )
}

function assertUuid(value: string, field: string): void {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    fail('INVALID_ID', `${field} must be a UUID`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeUuid(value: string, field: string): string {
  assertUuid(value, field)
  return value.toLowerCase()
}

function assertNonEmpty(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_MANIFEST', `${field} must not be blank`)
  }
}

function assertSafeIdentity(value: string, field: string): void {
  assertNonEmpty(value, field)
  if (value.length > 256 || /[\r\n]/.test(value)) {
    fail('INVALID_MANIFEST', `${field} is not a safe identity`)
  }
}

function isEmptyJsonObject(value: JsonValue): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}

function isSafeSourceAllowedTools(value: JsonValue): boolean {
  if (value === null) return true
  if (!Array.isArray(value)) return false
  return value.every(
    (tool) =>
      typeof tool === 'string' &&
      (tool === DOC_QUERY_TOOL_ALIAS ||
        (SOURCE_DOC_QUERY_TOOL_NAMES as readonly string[]).includes(tool))
  )
}

function assertSafeSourceReceiptFields(
  allowedTools: JsonValue,
  parameters: JsonValue
): void {
  if (parameters !== null && !isEmptyJsonObject(parameters)) {
    fail(
      'SOURCE_SHAPE_UNSUPPORTED',
      'source parameters are not safe to persist in a receipt'
    )
  }
  if (!isSafeSourceAllowedTools(allowedTools)) {
    fail(
      'SOURCE_SHAPE_UNSUPPORTED',
      'source allowlist is not safe to persist in a receipt'
    )
  }
}

function assertSafeSourceReceiptShape(
  config: CohortActivationConfigRecord
): void {
  assertSafeSourceReceiptFields(config.allowedTools, config.parameters)
}

function snapshotConfig(
  config: CohortActivationConfigRecord
): SafeConfigSnapshot {
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
): SafeServerSnapshot {
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
  snapshot: SafeConfigSnapshot
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
  snapshot: SafeConfigSnapshot
): boolean {
  return (
    configContentEqual(config, snapshot) &&
    config.updatedAt.toISOString() === snapshot.updatedAt
  )
}

function configShapeEqual(
  config: CohortActivationConfigRecord,
  snapshot: SafeConfigSnapshot
): boolean {
  return (
    config.id === snapshot.id &&
    config.chatbotId === snapshot.chatbotId &&
    config.mcpServerId === snapshot.mcpServerId &&
    config.chatMode === snapshot.chatMode &&
    jsonEqual(config.allowedTools, snapshot.allowedTools) &&
    config.priority === snapshot.priority &&
    jsonEqual(config.parameters, snapshot.parameters)
  )
}

function serverSnapshotEqual(
  server: CohortActivationServerRecord,
  snapshot: SafeServerSnapshot
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

function exclusionValues(
  manifest: Pick<CohortActivationManifest, 'excludedCorpora' | 'exclusions'>
): string[] {
  if (manifest.excludedCorpora && manifest.exclusions) {
    if (
      JSON.stringify(manifest.excludedCorpora) !==
      JSON.stringify(manifest.exclusions)
    ) {
      fail('EXCLUSION_CONTRACT_MISMATCH', 'manifest exclusion aliases differ')
    }
  }
  const values = manifest.excludedCorpora ?? manifest.exclusions
  if (!values) fail('EXCLUSIONS_MISSING', 'manifest exclusions are required')
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'string')
  ) {
    fail('EXCLUSION_CONTRACT_MISMATCH', 'manifest exclusions are malformed')
  }
  return [...values]
}

function canonicalExclusion(value: string): string {
  return value.trim().replaceAll('_', ' ').replaceAll(/\s+/g, ' ').toLowerCase()
}

function canonicalExcludedCorpora(
  manifest: Pick<CohortActivationManifest, 'excludedCorpora' | 'exclusions'>
): string[] {
  return exclusionValues(manifest)
    .map((value) => value.trim())
    .sort(compareStrings)
}

function excludedConfigValues(
  manifest: Pick<CohortActivationManifest, 'excludedConfigIds'>
): string[] {
  if (
    manifest.excludedConfigIds !== undefined &&
    (!Array.isArray(manifest.excludedConfigIds) ||
      manifest.excludedConfigIds.some((value) => typeof value !== 'string'))
  ) {
    fail('INVALID_MANIFEST', 'excluded config ids are malformed')
  }
  return [...(manifest.excludedConfigIds ?? [])]
}

function entryCorpusIdentity(entry: CohortActivationManifestEntry): string {
  if (
    entry.corpusIdentity !== undefined &&
    entry.corpusId !== undefined &&
    entry.corpusIdentity !== entry.corpusId
  ) {
    fail('CORPUS_IDENTITY_CONFLICT', 'corpus identity aliases differ')
  }
  const identity = entry.corpusIdentity ?? entry.corpusId
  const normalized = identity ?? ''
  assertSafeIdentity(normalized, 'entry.corpusIdentity')
  return normalized.trim()
}

function entryCorpusOwner(entry: CohortActivationManifestEntry): string {
  if (
    entry.corpusOwner !== undefined &&
    entry.corpusOwnerId !== undefined &&
    entry.corpusOwner !== entry.corpusOwnerId
  ) {
    fail('CORPUS_OWNER_CONFLICT', 'corpus owner aliases differ')
  }
  const owner = entry.corpusOwner ?? entry.corpusOwnerId
  const normalized = owner ?? ''
  assertSafeIdentity(normalized, 'entry.corpusOwner')
  return normalized.trim()
}

function entryTargetTool(entry: CohortActivationManifestEntry): string {
  return entry.targetTool ?? DOC_QUERY_TOOL_ALIAS
}

function canonicalManifest(
  manifest: Omit<CohortActivationManifest, 'fingerprint'>
) {
  return {
    target: manifest.target,
    entries: [...manifest.entries]
      .sort((left, right) => compareStrings(left.configId, right.configId))
      .map((entry) => ({
        configId: entry.configId,
        chatbotId: entry.chatbotId,
        chatMode: entry.chatMode,
        sourceServerId: entry.sourceServerId,
        targetTool: entryTargetTool(entry),
        kbId:
          typeof entry.kbId === 'string'
            ? entry.kbId.toLowerCase()
            : entry.kbId,
        corpusIdentity: entry.corpusIdentity ?? entry.corpusId,
        corpusOwner: entry.corpusOwner ?? entry.corpusOwnerId,
      })),
    heldConfigIds: [...manifest.heldConfigIds].sort(compareStrings),
    excludedCorpora: canonicalExcludedCorpora(manifest),
    excludedConfigIds: excludedConfigValues(manifest).sort(compareStrings),
  }
}

function assertNamedExclusions(manifest: CohortActivationManifest): string[] {
  const actual = canonicalExclusionValues(manifest)
  const expected = [...COHORT_ACTIVATION_EXCLUDED_CORPORA]
    .map(canonicalExclusion)
    .sort(compareStrings)
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail('EXCLUSION_CONTRACT_MISMATCH', 'manifest exclusions are not fixed')
  }
  return actual
}

function canonicalExclusionValues(
  manifest: Pick<CohortActivationManifest, 'excludedCorpora' | 'exclusions'>
): string[] {
  return exclusionValues(manifest).map(canonicalExclusion).sort(compareStrings)
}

function canonicalExcludedConfigIds(
  manifest: CohortActivationManifest
): string[] {
  return excludedConfigValues(manifest)
    .map((value) => normalizeUuid(value, 'excludedConfigIds'))
    .sort(compareStrings)
}

function assertCorpusOwnership(manifest: CohortActivationManifest): void {
  const ownership = new Map<string, string>()
  for (const entry of manifest.entries) {
    const kbId = normalizeUuid(entry.kbId, 'entry.kbId')
    const ownerKey = `${entryCorpusIdentity(entry)}\u0000${entryCorpusOwner(entry)}`
    const prior = ownership.get(kbId)
    if (prior && prior !== ownerKey) {
      fail(
        'KB_ID_OWNERSHIP_CONFLICT',
        'repeated kb id has conflicting ownership'
      )
    }
    ownership.set(kbId, ownerKey)
  }
}

function assertEntryNotExcluded(entry: CohortActivationManifestEntry): void {
  const identity = canonicalExclusion(entryCorpusIdentity(entry))
  if (
    [...COHORT_ACTIVATION_EXCLUDED_CORPORA].some(
      (excluded) => canonicalExclusion(excluded) === identity
    )
  ) {
    fail('EXCLUDED_CORPUS_INCLUDED', 'manifest includes an excluded corpus')
  }
}

function chatbotIds(entries: CohortActivationManifestEntry[]): string[] {
  return [
    ...new Set(
      entries.map((entry) => normalizeUuid(entry.chatbotId, 'entry.chatbotId'))
    ),
  ].sort(compareStrings)
}

function groupEntriesByChatbot(
  entries: CohortActivationReceiptEntry[]
): Array<[string, CohortActivationReceiptEntry[]]> {
  const groups = new Map<string, CohortActivationReceiptEntry[]>()
  for (const entry of entries) {
    const chatbotId = normalizeUuid(entry.manifest.chatbotId, 'entry.chatbotId')
    const group = groups.get(chatbotId) ?? []
    group.push(entry)
    groups.set(chatbotId, group)
  }
  return [...groups.entries()].sort(([left], [right]) =>
    compareStrings(left, right)
  )
}

function makeReceiptFrom(
  receipt: CohortActivationReceipt,
  input: Pick<
    CohortActivationReceipt,
    'entries' | 'state' | 'switchedChatbotIds'
  >
): CohortActivationReceipt {
  return makeReceipt({
    manifestFingerprint: receipt.manifestFingerprint,
    target: receipt.target,
    targetServer: receipt.targetServer,
    heldConfigIds: receipt.heldConfigIds,
    excludedCorpora: receipt.excludedCorpora,
    excludedConfigIds: receipt.excludedConfigIds,
    entries: input.entries,
    switchedChatbotIds: input.switchedChatbotIds,
    state: input.state,
  })
}

export function fingerprintManifest(
  manifest: Omit<CohortActivationManifest, 'fingerprint'>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalManifest(manifest)))
    .digest('hex')
}

type ManifestValidationState = {
  configIds: Set<string>
  chatbotModes: Set<string>
  sourceServersByChatbot: Map<string, string>
}

function assertManifestShape(manifest: CohortActivationManifest): void {
  if (!manifest || typeof manifest !== 'object') {
    fail('INVALID_MANIFEST', 'manifest is malformed')
  }
  if (!manifest.target || typeof manifest.target !== 'object') {
    fail('TARGET_CONTRACT_MISMATCH', 'manifest target is malformed')
  }
  if (
    manifest.target.serverName !== DOC_QUERY_TARGET_SERVER_NAME ||
    manifest.target.routePath !== DOC_QUERY_ROUTE_PATH ||
    manifest.target.scope !== DOC_QUERY_TARGET_SCOPE ||
    manifest.target.url !== DOC_QUERY_TARGET_URL
  ) {
    fail('TARGET_CONTRACT_MISMATCH', 'manifest target is not the PRD contract')
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    fail('EMPTY_MANIFEST', 'manifest entries are required')
  }
  if (!Array.isArray(manifest.heldConfigIds)) {
    fail('INVALID_MANIFEST', 'held config ids must be an array')
  }
}

function validateManifestEntry(
  entry: CohortActivationManifestEntry,
  state: ManifestValidationState
): void {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_MANIFEST', 'manifest entry is malformed')
  }
  const configId = normalizeUuid(entry.configId, 'entry.configId')
  const chatbotId = normalizeUuid(entry.chatbotId, 'entry.chatbotId')
  const sourceServerId = normalizeUuid(
    entry.sourceServerId,
    'entry.sourceServerId'
  )
  assertNonEmpty(entry.chatMode, 'entry.chatMode')
  if (entry.targetTool !== undefined && typeof entry.targetTool !== 'string') {
    fail('INVALID_TARGET_SHAPE', 'target tool is malformed')
  }
  const targetTool = entryTargetTool(entry)
  if (!TOOL_PATTERN.test(targetTool)) {
    fail('INVALID_TARGET_SHAPE', 'target tool contains unsafe characters')
  }
  if (targetTool !== DOC_QUERY_TOOL_ALIAS) {
    fail(
      'UNKNOWN_TARGET_TOOL',
      'target tool is not the multi-tenant reader tool'
    )
  }
  normalizeUuid(entry.kbId, 'entry.kbId')
  entryCorpusIdentity(entry)
  entryCorpusOwner(entry)
  assertEntryNotExcluded(entry)
  if (state.configIds.has(configId)) {
    fail('DUPLICATE_CONFIG', 'manifest contains a duplicate config')
  }
  state.configIds.add(configId)
  const priorSourceServer = state.sourceServersByChatbot.get(chatbotId)
  if (priorSourceServer && priorSourceServer !== sourceServerId) {
    fail('MIXED_MODE_COVERAGE', 'one chatbot uses more than one source server')
  }
  state.sourceServersByChatbot.set(chatbotId, sourceServerId)
  const chatbotMode = `${chatbotId}:${entry.chatMode}`
  if (state.chatbotModes.has(chatbotMode)) {
    fail('DUPLICATE_TARGET_CONFIG', 'manifest targets one chatbot mode twice')
  }
  state.chatbotModes.add(chatbotMode)
}

function validateManifestEntries(
  manifest: CohortActivationManifest
): Set<string> {
  const state: ManifestValidationState = {
    configIds: new Set<string>(),
    chatbotModes: new Set<string>(),
    sourceServersByChatbot: new Map<string, string>(),
  }
  for (const entry of manifest.entries) {
    validateManifestEntry(entry, state)
  }
  return state.configIds
}

function validateHeldConfigIds(
  manifest: CohortActivationManifest,
  configIds: Set<string>
): Set<string> {
  const held = new Set<string>()
  for (const configId of manifest.heldConfigIds) {
    const normalizedId = normalizeUuid(configId, 'heldConfigIds')
    if (held.has(normalizedId) || configIds.has(normalizedId)) {
      fail('HELD_CONFIG_INCLUDED', 'held config overlaps the activation')
    }
    held.add(normalizedId)
  }
  return held
}

function validateExcludedConfigIds(
  manifest: CohortActivationManifest,
  configIds: Set<string>,
  held: Set<string>
): void {
  const excluded = new Set<string>()
  for (const configId of canonicalExcludedConfigIds(manifest)) {
    if (
      excluded.has(configId) ||
      held.has(configId) ||
      configIds.has(configId)
    ) {
      fail(
        'EXCLUDED_CONFIG_INCLUDED',
        'excluded config overlaps the activation'
      )
    }
    excluded.add(configId)
  }
}

export function validateManifest(manifest: CohortActivationManifest): void {
  assertManifestShape(manifest)
  assertNamedExclusions(manifest)
  const configIds = validateManifestEntries(manifest)
  const held = validateHeldConfigIds(manifest, configIds)
  validateExcludedConfigIds(manifest, configIds, held)
  assertCorpusOwnership(manifest)

  const expectedFingerprint = fingerprintManifest(manifest)
  if (manifest.fingerprint !== expectedFingerprint) {
    fail('MANIFEST_DRIFT', 'manifest fingerprint does not match its contents')
  }
}

export function validatePinnedManifest(
  manifest: CohortActivationManifest,
  approvedFingerprint = process.env[COHORT_ACTIVATION_MANIFEST_FINGERPRINT_ENV]
): void {
  validateManifest(manifest)
  const configuredFingerprint = approvedFingerprint
  if (
    !configuredFingerprint ||
    !/^[0-9a-f]{64}$/i.test(configuredFingerprint) ||
    manifest.fingerprint !== configuredFingerprint
  ) {
    fail('MANIFEST_NOT_PINNED', 'manifest is not explicitly approved')
  }
}

export function assertReceiptMatchesManifest(
  receipt: CohortActivationReceipt,
  manifest: CohortActivationManifest
): void {
  validateReceipt(receipt)
  if (receipt.manifestFingerprint !== manifest.fingerprint) {
    fail('RECEIPT_MANIFEST_MISMATCH', 'receipt does not match the manifest')
  }
}

function assertTargetServer(
  server: CohortActivationServerRecord | null,
  target: CohortActivationTargetContract
): asserts server is CohortActivationServerRecord {
  if (!server) fail('TARGET_SERVER_MISSING', 'target server is missing')
  if (server.description !== DOC_QUERY_TARGET_DESCRIPTION) {
    fail('TARGET_OWNERSHIP_UNKNOWN', 'target server ownership is not proven')
  }
  if (
    server.name !== target.serverName ||
    server.url !== target.url ||
    server.authType !== 'bearer' ||
    server.passChatbotId !== true ||
    server.chatbotIdHeader !== 'Chatbot-ID' ||
    server.hasAuthSecret !== true ||
    !isEmptyJsonObject(server.parameters) ||
    server.isActive !== true
  ) {
    fail('TARGET_SERVER_MISMATCH', 'target server contract does not match')
  }
}

function targetConfigData(
  entry: CohortActivationManifestEntry,
  targetServerId: string,
  priority: number,
  isEnabled: false
): CohortActivationConfigCreate
function targetConfigData(
  entry: CohortActivationManifestEntry,
  targetServerId: string,
  priority: number,
  isEnabled: true
): CohortActivationConfigUpdate
function targetConfigData(
  entry: CohortActivationManifestEntry,
  targetServerId: string,
  priority: number,
  isEnabled: boolean
): CohortActivationConfigCreate | CohortActivationConfigUpdate {
  return {
    chatbotId: normalizeUuid(entry.chatbotId, 'entry.chatbotId'),
    mcpServerId: targetServerId,
    chatMode: entry.chatMode,
    allowedTools: [DOC_QUERY_TOOL_ALIAS],
    priority,
    isEnabled,
    parameters: {
      required: true,
      toolAlias: DOC_QUERY_TOOL_ALIAS,
      kb_id: normalizeUuid(entry.kbId, 'entry.kbId'),
    },
  }
}

function sourceConfigData(
  snapshot: SafeConfigSnapshot,
  isEnabled: boolean
): CohortActivationConfigUpdate {
  return {
    chatbotId: snapshot.chatbotId,
    mcpServerId: snapshot.mcpServerId,
    chatMode: snapshot.chatMode,
    allowedTools: cloneJson(snapshot.allowedTools),
    priority: snapshot.priority,
    isEnabled,
    parameters: cloneJson(snapshot.parameters),
  }
}

async function findTargetServer(
  tx: CohortActivationTransactionStore,
  manifest: CohortActivationManifest,
  encryptedBearer: string | undefined,
  targetServerId: string | null
): Promise<CohortActivationServerRecord> {
  const existing = await tx.findServerByName(manifest.target.serverName)
  if (existing) {
    assertTargetServer(existing, manifest.target)
    if (
      targetServerId !== null &&
      normalizeUuid(targetServerId, 'targetServerId') !==
        normalizeUuid(existing.id, 'targetServer.id')
    ) {
      fail('TARGET_SERVER_DRIFT', 'target server does not belong to the intent')
    }
    return existing
  }
  if (!encryptedBearer) {
    fail(
      'TARGET_AUTH_MISSING',
      'creating the target requires an encrypted bearer'
    )
  }
  const created = await tx.createServer({
    id: targetServerId
      ? normalizeUuid(targetServerId, 'targetServerId')
      : randomUUID(),
    name: manifest.target.serverName,
    description: DOC_QUERY_TARGET_DESCRIPTION,
    url: manifest.target.url,
    authType: 'bearer',
    encryptedBearer,
    passChatbotId: true,
    chatbotIdHeader: 'Chatbot-ID',
    parameters: {},
    isActive: true,
  })
  assertTargetServer(created, manifest.target)
  return created
}

async function assertTargetConfigAvailable(
  tx: CohortActivationTransactionStore,
  targetServer: CohortActivationServerRecord,
  entry: CohortActivationManifestEntry
): Promise<void> {
  const existing = await tx.findConfigByChatbotServer(
    normalizeUuid(entry.chatbotId, 'entry.chatbotId'),
    targetServer.id,
    entry.chatMode
  )
  if (existing) {
    fail(
      'DUPLICATE_TARGET_CONFIG',
      'target config already exists for the chatbot mode'
    )
  }
}

async function assertCompleteModeCoverage(
  tx: CohortActivationTransactionStore,
  manifest: CohortActivationManifest
): Promise<void> {
  const held = new Set(
    manifest.heldConfigIds.map((id) => normalizeUuid(id, 'heldConfigIds'))
  )
  const excluded = new Set(canonicalExcludedConfigIds(manifest))
  const groups = new Map<string, CohortActivationManifestEntry[]>()
  for (const entry of manifest.entries) {
    const chatbotId = normalizeUuid(entry.chatbotId, 'entry.chatbotId')
    const group = groups.get(chatbotId) ?? []
    group.push(entry)
    groups.set(chatbotId, group)
  }

  for (const [chatbotId, group] of groups) {
    const sourceServerId = normalizeUuid(
      group[0]!.sourceServerId,
      'entry.sourceServerId'
    )
    const sourceConfigs = await tx.findConfigsByServerId(sourceServerId)
    const expected = new Set(
      group.map((entry) => normalizeUuid(entry.configId, 'entry.configId'))
    )
    const active = sourceConfigs.filter(
      (config) =>
        config.chatbotId.toLowerCase() === chatbotId &&
        config.isEnabled &&
        !held.has(config.id.toLowerCase()) &&
        !excluded.has(config.id.toLowerCase())
    )
    if (
      active.length !== expected.size ||
      active.some((config) => !expected.has(config.id.toLowerCase()))
    ) {
      fail(
        'PARTIAL_MODE_COVERAGE',
        'manifest does not cover every enabled source mode'
      )
    }
  }
}

async function readSourceEntries(
  tx: CohortActivationTransactionStore,
  manifest: CohortActivationManifest
): Promise<
  Array<{ manifest: CohortActivationManifestEntry; prior: SafeConfigSnapshot }>
> {
  const entries: Array<{
    manifest: CohortActivationManifestEntry
    prior: SafeConfigSnapshot
  }> = []
  for (const entry of manifest.entries) {
    const source = await tx.findConfigById(entry.configId)
    if (!source) fail('CONFIG_MISSING', 'manifest config is missing')
    if (
      source.chatbotId.toLowerCase() !== entry.chatbotId.toLowerCase() ||
      source.chatMode !== entry.chatMode ||
      source.mcpServerId.toLowerCase() !== entry.sourceServerId.toLowerCase() ||
      source.isEnabled !== true
    ) {
      fail('SOURCE_MISMATCH', 'source config no longer matches manifest')
    }
    const sourceServer = await tx.findServerById(entry.sourceServerId)
    if (!sourceServer) fail('SOURCE_SERVER_MISSING', 'source server is missing')
    if (!sourceServer.isActive) {
      fail('SOURCE_SERVER_INACTIVE', 'source server is inactive')
    }
    assertSafeSourceReceiptShape(source)
    if (
      sourceServer.url === manifest.target.url ||
      sourceServer.url.endsWith(DOC_QUERY_ROUTE_PATH)
    ) {
      fail(
        'SOURCE_IS_TARGET',
        'test-route source cannot enter this cohortActivation'
      )
    }
    entries.push({ manifest: entry, prior: snapshotConfig(source) })
  }
  await assertCompleteModeCoverage(tx, manifest)
  return entries
}

function makeReceipt(
  input: Omit<CohortActivationReceipt, 'receiptVersion' | 'payloadDigest'>
): CohortActivationReceipt {
  const withoutDigest = {
    receiptVersion: COHORT_ACTIVATION_RECEIPT_VERSION,
    ...input,
  }
  return {
    ...withoutDigest,
    payloadDigest: createHash('sha256')
      .update(JSON.stringify(withoutDigest))
      .digest('hex'),
  }
}

export function makeCohortActivationReceiptIntent(
  manifest: CohortActivationManifest,
  targetServerId: string | null = null
): CohortActivationReceiptIntent {
  validateManifest(manifest)
  const targetConfigIds = Object.fromEntries(
    manifest.entries.map((entry) => [entry.configId, randomUUID()])
  )
  const withoutDigest = {
    receiptVersion: COHORT_ACTIVATION_RECEIPT_VERSION,
    manifestFingerprint: manifest.fingerprint,
    target: manifest.target,
    targetServerId,
    targetConfigIds,
    heldConfigIds: manifest.heldConfigIds,
    excludedCorpora: [...COHORT_ACTIVATION_EXCLUDED_CORPORA],
    excludedConfigIds: canonicalExcludedConfigIds(manifest),
    state: 'preparing' as const,
  }
  return {
    ...withoutDigest,
    payloadDigest: createHash('sha256')
      .update(JSON.stringify(withoutDigest))
      .digest('hex'),
  }
}

function assertReceiptIntentHeader(
  intent: CohortActivationReceiptIntent
): void {
  if (!isRecord(intent)) {
    fail('RECEIPT_INVALID', 'cohortActivation intent is malformed')
  }
  if (!isRecord(intent.target)) {
    fail('RECEIPT_INVALID', 'cohortActivation intent target is malformed')
  }
  if (intent.receiptVersion !== COHORT_ACTIVATION_RECEIPT_VERSION) {
    fail('RECEIPT_INVALID', 'unsupported cohortActivation receipt version')
  }
  if (intent.state !== 'preparing') {
    fail('RECEIPT_INVALID', 'cohortActivation intent state is malformed')
  }
  if (
    intent.target.serverName !== DOC_QUERY_TARGET_SERVER_NAME ||
    intent.target.routePath !== DOC_QUERY_ROUTE_PATH ||
    intent.target.scope !== DOC_QUERY_TARGET_SCOPE ||
    intent.target.url !== DOC_QUERY_TARGET_URL ||
    typeof intent.manifestFingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/i.test(intent.manifestFingerprint)
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation intent target is malformed')
  }
}

function validateReceiptIntentHeldIds(
  intent: CohortActivationReceiptIntent
): void {
  if (!Array.isArray(intent.heldConfigIds)) {
    fail('RECEIPT_INVALID', 'cohortActivation held ids are malformed')
  }
  const heldIds = new Set<string>()
  for (const configId of intent.heldConfigIds) {
    const normalized = normalizeUuid(configId, 'heldConfigIds')
    if (heldIds.has(normalized)) {
      fail('RECEIPT_INVALID', 'cohortActivation held ids repeat')
    }
    heldIds.add(normalized)
  }
}

function validateReceiptIntentExclusions(
  intent: CohortActivationReceiptIntent
): void {
  const expected = [...COHORT_ACTIVATION_EXCLUDED_CORPORA]
    .map(canonicalExclusion)
    .sort(compareStrings)
  if (
    !Array.isArray(intent.excludedCorpora) ||
    intent.excludedCorpora.some((value) => typeof value !== 'string') ||
    intent.excludedCorpora.length !== expected.length ||
    intent.excludedCorpora
      .map(canonicalExclusion)
      .sort(compareStrings)
      .some((value, index) => value !== expected[index])
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation exclusions are malformed')
  }
}

function validateReceiptIntentTargetConfigIds(
  intent: CohortActivationReceiptIntent
): void {
  if (
    !intent.targetConfigIds ||
    typeof intent.targetConfigIds !== 'object' ||
    Array.isArray(intent.targetConfigIds) ||
    Object.keys(intent.targetConfigIds).length === 0
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation intent target ids are malformed')
  }
  const targetConfigIds = Object.entries(intent.targetConfigIds)
  const targetIds = new Set<string>()
  for (const [configId, targetConfigId] of targetConfigIds) {
    assertUuid(configId, 'targetConfigIds.configId')
    assertUuid(targetConfigId, 'targetConfigIds.targetConfigId')
    if (targetIds.has(targetConfigId)) {
      fail(
        'RECEIPT_INVALID',
        'cohortActivation intent repeats a target config id'
      )
    }
    targetIds.add(targetConfigId)
  }
}

function assertReceiptIntentDigest(
  intent: CohortActivationReceiptIntent
): void {
  if (
    typeof intent.payloadDigest !== 'string' ||
    !/^[0-9a-f]{64}$/i.test(intent.payloadDigest)
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation intent digest is malformed')
  }
  const { payloadDigest: _ignored, ...withoutDigest } = intent
  const expected = createHash('sha256')
    .update(JSON.stringify(withoutDigest))
    .digest('hex')
  if (expected !== intent.payloadDigest) {
    fail('RECEIPT_INVALID', 'cohortActivation intent digest does not match')
  }
}

export function validateCohortActivationReceiptIntent(
  intent: CohortActivationReceiptIntent
): void {
  assertReceiptIntentHeader(intent)
  validateReceiptIntentHeldIds(intent)
  if (intent.targetServerId !== null) {
    assertUuid(intent.targetServerId, 'targetServerId')
  }
  validateReceiptIntentExclusions(intent)
  if (!Array.isArray(intent.excludedConfigIds)) {
    fail('RECEIPT_INVALID', 'cohortActivation excluded ids are malformed')
  }
  const excludedIds = new Set<string>()
  for (const configId of intent.excludedConfigIds) {
    const normalized = normalizeUuid(configId, 'excludedConfigIds')
    if (excludedIds.has(normalized)) {
      fail('RECEIPT_INVALID', 'cohortActivation excluded ids repeat')
    }
    excludedIds.add(normalized)
  }
  validateReceiptIntentTargetConfigIds(intent)
  assertReceiptIntentDigest(intent)
}

function assertIntentMatchesManifest(
  manifest: CohortActivationManifest,
  intent: CohortActivationReceiptIntent
): void {
  if (intent.manifestFingerprint !== manifest.fingerprint) {
    fail(
      'RECEIPT_MANIFEST_MISMATCH',
      'cohortActivation intent does not match manifest'
    )
  }
  const expectedHeldConfigIds = manifest.heldConfigIds
    .map((configId) => normalizeUuid(configId, 'heldConfigIds'))
    .sort(compareStrings)
  const actualHeldConfigIds = intent.heldConfigIds
    .map((configId) => normalizeUuid(configId, 'heldConfigIds'))
    .sort(compareStrings)
  const expectedExcludedConfigIds = canonicalExcludedConfigIds(manifest)
  const actualExcludedConfigIds = intent.excludedConfigIds
    .map((configId) => normalizeUuid(configId, 'excludedConfigIds'))
    .sort(compareStrings)
  if (
    JSON.stringify(actualHeldConfigIds) !==
      JSON.stringify(expectedHeldConfigIds) ||
    JSON.stringify(actualExcludedConfigIds) !==
      JSON.stringify(expectedExcludedConfigIds)
  ) {
    fail(
      'RECEIPT_INVALID',
      'cohortActivation intent holds do not match manifest'
    )
  }
}

function assertReceiptShape(receipt: CohortActivationReceipt): void {
  if (!isRecord(receipt)) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt is malformed')
  }
  if (receipt.receiptVersion !== COHORT_ACTIVATION_RECEIPT_VERSION) {
    fail('RECEIPT_INVALID', 'unsupported cohortActivation receipt version')
  }
  if (!isRecord(receipt.target) || !isRecord(receipt.targetServer)) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt target is malformed')
  }
  if (!Array.isArray(receipt.entries)) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt entries are malformed')
  }
  if (
    !Array.isArray(receipt.switchedChatbotIds) ||
    receipt.switchedChatbotIds.some(
      (chatbotId) => typeof chatbotId !== 'string'
    )
  ) {
    fail('RECEIPT_INVALID', 'switched chatbot checkpoint is malformed')
  }
  const receiptStates: CohortActivationReceiptState[] = [
    'prepared',
    'switching',
    'switched',
    'rolling_back',
    'rolled_back',
  ]
  if (!receiptStates.includes(receipt.state)) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt state is malformed')
  }
  for (const item of receipt.entries) {
    if (
      !isRecord(item) ||
      !isRecord(item.manifest) ||
      !isRecord(item.prior) ||
      !isRecord(item.target)
    ) {
      fail('RECEIPT_INVALID', 'cohortActivation receipt entry is malformed')
    }
  }
}

function assertReceiptTargetServer(receipt: CohortActivationReceipt): void {
  assertUuid(receipt.targetServer.id, 'targetServer.id')
  if (
    typeof receipt.targetServer.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(receipt.targetServer.updatedAt))
  ) {
    fail('RECEIPT_INVALID', 'target server timestamp is malformed')
  }
  if (
    receipt.targetServer.name !== receipt.target.serverName ||
    receipt.targetServer.description !== DOC_QUERY_TARGET_DESCRIPTION ||
    receipt.targetServer.url !== receipt.target.url ||
    receipt.targetServer.authType !== 'bearer' ||
    receipt.targetServer.passChatbotId !== true ||
    receipt.targetServer.chatbotIdHeader !== 'Chatbot-ID' ||
    receipt.targetServer.hasAuthSecret !== true ||
    !isEmptyJsonObject(receipt.targetServer.parameters) ||
    receipt.targetServer.isActive !== true
  ) {
    fail('RECEIPT_INVALID', 'target server snapshot is malformed')
  }
}

function validateSwitchedChatbotIds(
  receipt: CohortActivationReceipt,
  manifestChatbotIds: Set<string>
): Set<string> {
  const switchedChatbotIds = new Set(
    receipt.switchedChatbotIds.map((chatbotId) => chatbotId.toLowerCase())
  )
  if (
    receipt.switchedChatbotIds.some(
      (chatbotId) =>
        !UUID_PATTERN.test(chatbotId) ||
        !manifestChatbotIds.has(chatbotId.toLowerCase())
    ) ||
    switchedChatbotIds.size !== receipt.switchedChatbotIds.length
  ) {
    fail('RECEIPT_INVALID', 'switched chatbot checkpoint is malformed')
  }
  if (receipt.state === 'prepared' && receipt.switchedChatbotIds.length > 0) {
    fail('RECEIPT_INVALID', 'prepared receipt has switched chatbot ids')
  }
  if (
    receipt.state === 'switched' &&
    switchedChatbotIds.size !== manifestChatbotIds.size
  ) {
    fail('RECEIPT_INVALID', 'switched receipt is incomplete')
  }
  if (
    receipt.state === 'rolled_back' &&
    receipt.switchedChatbotIds.length > 0
  ) {
    fail('RECEIPT_INVALID', 'rolled-back receipt has switched chatbot ids')
  }
  return switchedChatbotIds
}

function validateReceiptEntry(
  receipt: CohortActivationReceipt,
  item: CohortActivationReceiptEntry,
  switchedChatbotIds: Set<string>,
  targetConfigIds: Set<string>
): void {
  assertUuid(item.prior.id, 'receipt.prior.id')
  assertUuid(item.prior.chatbotId, 'receipt.prior.chatbotId')
  assertUuid(item.prior.mcpServerId, 'receipt.prior.mcpServerId')
  assertUuid(item.target.id, 'receipt.target.id')
  assertUuid(item.target.chatbotId, 'receipt.target.chatbotId')
  assertUuid(item.target.mcpServerId, 'receipt.target.mcpServerId')
  if (targetConfigIds.has(item.target.id.toLowerCase())) {
    fail('RECEIPT_INVALID', 'target config ids repeat')
  }
  targetConfigIds.add(item.target.id.toLowerCase())
  if (
    typeof item.prior.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(item.prior.updatedAt)) ||
    typeof item.target.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(item.target.updatedAt)) ||
    typeof item.prior.priority !== 'number' ||
    !Number.isFinite(item.prior.priority) ||
    typeof item.target.priority !== 'number' ||
    !Number.isFinite(item.target.priority)
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation config snapshot is malformed')
  }
  if (
    (item.prior.parameters !== null &&
      !isEmptyJsonObject(item.prior.parameters)) ||
    !isSafeSourceAllowedTools(item.prior.allowedTools)
  ) {
    fail('RECEIPT_INVALID', 'receipt contains an unsafe source snapshot')
  }
  if (
    !item.prior.isEnabled ||
    item.target.mcpServerId.toLowerCase() !==
      receipt.targetServer.id.toLowerCase() ||
    item.target.chatbotId.toLowerCase() !==
      item.manifest.chatbotId.toLowerCase() ||
    item.target.chatMode !== item.manifest.chatMode ||
    item.prior.id.toLowerCase() !== item.manifest.configId.toLowerCase() ||
    item.prior.mcpServerId.toLowerCase() !==
      item.manifest.sourceServerId.toLowerCase() ||
    item.target.priority !== item.prior.priority ||
    item.prior.chatbotId.toLowerCase() !==
      item.manifest.chatbotId.toLowerCase() ||
    item.prior.chatMode !== item.manifest.chatMode ||
    !jsonEqual(item.target.allowedTools, [DOC_QUERY_TOOL_ALIAS]) ||
    !jsonEqual(item.target.parameters, {
      required: true,
      toolAlias: DOC_QUERY_TOOL_ALIAS,
      kb_id: normalizeUuid(item.manifest.kbId, 'entry.kbId'),
    })
  ) {
    fail('RECEIPT_INVALID', 'target config snapshot is malformed')
  }
  const expectedTargetEnabled = switchedChatbotIds.has(
    item.manifest.chatbotId.toLowerCase()
  )
  if (item.target.isEnabled !== expectedTargetEnabled) {
    fail('RECEIPT_INVALID', 'target config state does not match checkpoint')
  }
}

function validateReceiptEntries(
  receipt: CohortActivationReceipt,
  switchedChatbotIds: Set<string>
): void {
  const targetConfigIds = new Set<string>()
  for (const item of receipt.entries) {
    validateReceiptEntry(receipt, item, switchedChatbotIds, targetConfigIds)
  }
}

function assertReceiptDigest(receipt: CohortActivationReceipt): void {
  if (
    typeof receipt.payloadDigest !== 'string' ||
    !/^[0-9a-f]{64}$/i.test(receipt.payloadDigest)
  ) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt digest is malformed')
  }
  const { payloadDigest: _ignored, ...withoutDigest } = receipt
  const expected = createHash('sha256')
    .update(JSON.stringify(withoutDigest))
    .digest('hex')
  if (expected !== receipt.payloadDigest) {
    fail('RECEIPT_INVALID', 'cohortActivation receipt digest does not match')
  }
}

export function validateReceipt(receipt: CohortActivationReceipt): void {
  assertReceiptShape(receipt)
  validateManifest({
    fingerprint: receipt.manifestFingerprint,
    target: receipt.target,
    entries: receipt.entries.map(({ manifest }) => manifest),
    heldConfigIds: receipt.heldConfigIds,
    excludedCorpora: receipt.excludedCorpora,
    excludedConfigIds: receipt.excludedConfigIds,
  })
  assertReceiptTargetServer(receipt)
  const manifestChatbotIds = new Set(
    chatbotIds(receipt.entries.map(({ manifest }) => manifest))
  )
  const switchedChatbotIds = validateSwitchedChatbotIds(
    receipt,
    manifestChatbotIds
  )
  validateReceiptEntries(receipt, switchedChatbotIds)
  assertReceiptDigest(receipt)
}

function validateReceiptFile(receipt: CohortActivationReceiptFile): void {
  if (receipt.state === 'preparing')
    validateCohortActivationReceiptIntent(receipt)
  else validateReceipt(receipt)
}

export function receiptExpectation(
  receipt: CohortActivationReceiptFile | null
): CohortActivationReceiptExpectation {
  return receipt
    ? {
        manifestFingerprint: receipt.manifestFingerprint,
        payloadDigest: receipt.payloadDigest,
        state: receipt.state,
      }
    : null
}

const RECEIPT_STATE_TRANSITIONS: Record<
  CohortActivationReceiptFile['state'],
  readonly CohortActivationReceiptFile['state'][]
> = {
  preparing: ['prepared'],
  prepared: ['switching', 'switched', 'rolling_back', 'rolled_back'],
  switching: ['switching', 'switched', 'rolling_back', 'rolled_back'],
  switched: ['rolling_back', 'rolled_back'],
  rolling_back: ['rolling_back', 'rolled_back'],
  rolled_back: [],
}

/**
 * Validate the receipt compare-and-swap contract before replacing the file.
 * The runner holds the session lock while calling this function, but the
 * expected digest and state also reject stale or out-of-order writes.
 */
export function assertReceiptTransition(
  expected: CohortActivationReceiptExpectation,
  current: CohortActivationReceiptFile | null,
  next: CohortActivationReceiptFile
): void {
  validateReceiptFile(next)
  if (expected === null) {
    if (current !== null) {
      fail(
        'RECEIPT_CONCURRENT_WRITE',
        'receipt was created before the expected initial write'
      )
    }
    if (next.state !== 'preparing') {
      fail(
        'RECEIPT_STATE_TRANSITION',
        'an initial receipt must be a preparing intent'
      )
    }
    return
  }
  if (current === null) {
    fail(
      'RECEIPT_CONCURRENT_WRITE',
      'receipt disappeared before the expected transition'
    )
  }
  validateReceiptFile(current)
  if (
    current.manifestFingerprint !== expected.manifestFingerprint ||
    current.payloadDigest !== expected.payloadDigest ||
    current.state !== expected.state
  ) {
    fail(
      'RECEIPT_CONCURRENT_WRITE',
      'receipt changed before the expected transition'
    )
  }
  if (current.manifestFingerprint !== next.manifestFingerprint) {
    fail('RECEIPT_MANIFEST_MISMATCH', 'receipt transition changed the manifest')
  }
  if (current.payloadDigest === next.payloadDigest) return
  if (!RECEIPT_STATE_TRANSITIONS[current.state].includes(next.state)) {
    fail(
      'RECEIPT_STATE_TRANSITION',
      'receipt transition is not allowed from the current state'
    )
  }
}

export async function dryRunCohortActivation(
  store: CohortActivationStore,
  manifest: CohortActivationManifest
): Promise<CohortActivationDryRunResult> {
  validateManifest(manifest)
  const result = await store.transaction(async (tx) => {
    const target = await tx.findServerByName(manifest.target.serverName)
    if (target) assertTargetServer(target, manifest.target)
    const entries = await readSourceEntries(tx, manifest)
    if (target) {
      for (const { manifest: entry } of entries) {
        await assertTargetConfigAvailable(tx, target, entry)
      }
    }
    return {
      wouldCreateServer: target === null,
      wouldCreateConfigs: entries.length,
      wouldSwitch: entries.length,
    }
  })
  return {
    status: 'dry-run',
    manifestFingerprint: manifest.fingerprint,
    target: manifest.target,
    entryCount: manifest.entries.length,
    heldCount: manifest.heldConfigIds.length,
    ...result,
    wouldPreserveSourceRows: true,
  }
}

export async function prepareCohortActivation(
  store: CohortActivationStore,
  manifest: CohortActivationManifest,
  options: CohortActivationPrepareOptions
): Promise<CohortActivationReceipt> {
  validateManifest(manifest)
  const intent = options.intent ?? makeCohortActivationReceiptIntent(manifest)
  validateCohortActivationReceiptIntent(intent)
  assertIntentMatchesManifest(manifest, intent)
  const manifestConfigIds = new Set(
    manifest.entries.map((entry) => entry.configId.toLowerCase())
  )
  if (
    Object.keys(intent.targetConfigIds).length !== manifestConfigIds.size ||
    manifest.entries.some((entry) => !intent.targetConfigIds[entry.configId])
  ) {
    fail(
      'RECEIPT_INVALID',
      'cohortActivation intent does not cover the manifest'
    )
  }
  const prepared = await store.transaction(async (tx) => {
    const sourceEntries = await readSourceEntries(tx, manifest)
    const targetServer = await findTargetServer(
      tx,
      manifest,
      options.encryptedBearer,
      intent.targetServerId
    )
    const entries: CohortActivationReceiptEntry[] = []
    for (const { manifest: entry, prior } of sourceEntries) {
      await assertTargetConfigAvailable(tx, targetServer, entry)
      const created = await tx.createConfig({
        ...targetConfigData(entry, targetServer.id, prior.priority, false),
        id: intent.targetConfigIds[entry.configId],
      })
      const target = snapshotConfig(created)
      if (
        target.id !== intent.targetConfigIds[entry.configId] ||
        target.isEnabled ||
        target.mcpServerId !== targetServer.id ||
        !jsonEqual(target.allowedTools, [DOC_QUERY_TOOL_ALIAS]) ||
        !jsonEqual(target.parameters, {
          required: true,
          toolAlias: DOC_QUERY_TOOL_ALIAS,
          kb_id: normalizeUuid(entry.kbId, 'entry.kbId'),
        })
      ) {
        fail('TARGET_CONFIG_MISMATCH', 'created target config is not strict')
      }
      entries.push({ manifest: entry, prior, target })
    }
    return { targetServer: snapshotServer(targetServer), entries }
  })
  return makeReceipt({
    manifestFingerprint: manifest.fingerprint,
    target: manifest.target,
    targetServer: prepared.targetServer,
    heldConfigIds: manifest.heldConfigIds,
    excludedCorpora: [...COHORT_ACTIVATION_EXCLUDED_CORPORA],
    excludedConfigIds: canonicalExcludedConfigIds(manifest),
    entries: prepared.entries,
    switchedChatbotIds: [],
    state: 'prepared',
  })
}

export async function recoverPreparedCohortActivation(
  store: CohortActivationStore,
  manifest: CohortActivationManifest,
  intent: CohortActivationReceiptIntent
): Promise<CohortActivationReceipt> {
  validateManifest(manifest)
  validateCohortActivationReceiptIntent(intent)
  assertIntentMatchesManifest(manifest, intent)
  if (
    Object.keys(intent.targetConfigIds).length !== manifest.entries.length ||
    manifest.entries.some((entry) => !intent.targetConfigIds[entry.configId])
  ) {
    fail(
      'RECEIPT_INVALID',
      'cohortActivation intent does not cover the manifest'
    )
  }
  const recovered = await store.transaction(async (tx) => {
    const targetServer = await tx.findServerByName(manifest.target.serverName)
    if (!targetServer) {
      fail('RECOVERY_NOT_PREPARED', 'prepare transaction was not committed')
    }
    if (
      intent.targetServerId !== null &&
      targetServer.id.toLowerCase() !== intent.targetServerId.toLowerCase()
    ) {
      fail('RECOVERY_AMBIGUOUS', 'target server does not belong to the intent')
    }
    assertTargetServer(targetServer, manifest.target)
    const targetConfigs = await tx.findConfigsByServerId(targetServer.id)
    if (targetConfigs.length === 0) {
      fail('RECOVERY_NOT_PREPARED', 'prepare configs were not committed')
    }
    const expectedTargetConfigIds = new Set(
      manifest.entries.map((entry) =>
        intent.targetConfigIds[entry.configId]?.toLowerCase()
      )
    )
    if (
      expectedTargetConfigIds.size !== manifest.entries.length ||
      manifest.entries.some(
        (entry) =>
          !intent.targetConfigIds[entry.configId] ||
          !targetConfigs.some(
            (target) =>
              target.id.toLowerCase() ===
              intent.targetConfigIds[entry.configId]!.toLowerCase()
          )
      )
    ) {
      fail('RECOVERY_AMBIGUOUS', 'target config set is incomplete')
    }
    const sourceEntries = await readSourceEntries(tx, manifest)
    const entries: CohortActivationReceiptEntry[] = []
    for (const { manifest: entry, prior } of sourceEntries) {
      const targetConfigId = intent.targetConfigIds[entry.configId]
      const target = targetConfigId
        ? await tx.findConfigById(targetConfigId)
        : null
      if (
        !target ||
        target.id !== targetConfigId ||
        target.isEnabled ||
        target.mcpServerId !== targetServer.id ||
        !jsonEqual(target.allowedTools, [DOC_QUERY_TOOL_ALIAS]) ||
        !jsonEqual(target.parameters, {
          required: true,
          toolAlias: DOC_QUERY_TOOL_ALIAS,
          kb_id: normalizeUuid(entry.kbId, 'entry.kbId'),
        })
      ) {
        fail('RECOVERY_AMBIGUOUS', 'target config state is not prepared')
      }
      entries.push({ manifest: entry, prior, target: snapshotConfig(target) })
    }
    return { targetServer: snapshotServer(targetServer), entries }
  })
  return makeReceipt({
    manifestFingerprint: manifest.fingerprint,
    target: manifest.target,
    targetServer: recovered.targetServer,
    heldConfigIds: manifest.heldConfigIds,
    excludedCorpora: [...COHORT_ACTIVATION_EXCLUDED_CORPORA],
    excludedConfigIds: canonicalExcludedConfigIds(manifest),
    entries: recovered.entries,
    switchedChatbotIds: [],
    state: 'prepared',
  })
}

function requireState(
  receipt: CohortActivationReceipt,
  expected: CohortActivationReceiptState | CohortActivationReceiptState[]
): void {
  validateReceipt(receipt)
  const allowed = Array.isArray(expected) ? expected : [expected]
  if (!allowed.includes(receipt.state)) {
    fail('INVALID_STATE', `cohortActivation receipt has an invalid state`)
  }
}

export type CohortActivationReceiptCheckpoint = (
  receipt: CohortActivationReceipt
) => Promise<void>

export async function switchCohortActivation(
  store: CohortActivationStore,
  receipt: CohortActivationReceipt,
  checkpoint?: CohortActivationReceiptCheckpoint
): Promise<CohortActivationReceipt> {
  requireState(receipt, 'prepared')
  let current = receipt
  const groups = groupEntriesByChatbot(receipt.entries)
  for (const [chatbotId, group] of groups) {
    await checkpoint?.(
      makeReceiptFrom(current, {
        entries: current.entries,
        state: 'switching',
        switchedChatbotIds: current.switchedChatbotIds,
      })
    )
    // Keep every mode for one chatbot in the same serializable transaction.
    const switchedEntries = await store.transaction(async (tx) => {
      const targetServer = await tx.findServerById(current.targetServer.id)
      if (
        !targetServer ||
        !serverSnapshotEqual(targetServer, current.targetServer)
      ) {
        fail('TARGET_SERVER_DRIFT', 'target server changed after prepare')
      }
      const entries: CohortActivationReceiptEntry[] = []
      for (const item of group) {
        const source = await tx.findConfigById(item.manifest.configId)
        if (!source || !configSnapshotEqual(source, item.prior)) {
          fail('SOURCE_DRIFT', 'source config changed after prepare')
        }
        const target = await tx.findConfigById(item.target.id)
        if (!target || !configSnapshotEqual(target, item.target)) {
          fail('TARGET_DRIFT', 'target config changed after prepare')
        }
        const disabledSource = await tx.updateConfig(
          source.id,
          source.updatedAt,
          sourceConfigData(item.prior, false)
        )
        if (!disabledSource || disabledSource.isEnabled) {
          fail('CONCURRENT_EDIT', 'source config compare-and-set failed')
        }
        const enabledTarget = await tx.updateConfig(
          target.id,
          target.updatedAt,
          targetConfigData(
            item.manifest,
            targetServer.id,
            item.prior.priority,
            true
          )
        )
        if (!enabledTarget || !enabledTarget.isEnabled) {
          fail('CONCURRENT_EDIT', 'target config compare-and-set failed')
        }
        entries.push({ ...item, target: snapshotConfig(enabledTarget) })
      }
      return entries
    })
    const changed = new Map(
      switchedEntries.map((entry) => [entry.manifest.configId, entry])
    )
    const switchedChatbotIds = [
      ...new Set([...current.switchedChatbotIds, chatbotId]),
    ].sort(compareStrings)
    const entries = current.entries.map(
      (entry) => changed.get(entry.manifest.configId) ?? entry
    )
    current = makeReceiptFrom(current, {
      entries,
      state:
        switchedChatbotIds.length === groups.length ? 'switched' : 'switching',
      switchedChatbotIds,
    })
    await checkpoint?.(current)
  }
  return current
}

type RollbackTransactionState = {
  item: CohortActivationReceiptEntry
  source: CohortActivationConfigRecord
  target: CohortActivationConfigRecord
  state: 'old' | 'new'
}

function rollbackItemState(
  source: CohortActivationConfigRecord,
  target: CohortActivationConfigRecord
): 'old' | 'new' {
  if (source.isEnabled && !target.isEnabled) return 'old'
  if (!source.isEnabled && target.isEnabled) return 'new'
  fail('READBACK_STATE_MISMATCH', 'chatbot group is partially switched')
}

async function readRollbackStates(
  tx: CohortActivationTransactionStore,
  receipt: CohortActivationReceipt,
  group: CohortActivationReceiptEntry[]
): Promise<{
  targetServer: CohortActivationServerRecord
  states: RollbackTransactionState[]
}> {
  const targetServer = await tx.findServerById(receipt.targetServer.id)
  if (
    !targetServer ||
    !serverSnapshotEqual(targetServer, receipt.targetServer)
  ) {
    fail('TARGET_SERVER_DRIFT', 'target server changed before rollback')
  }
  const states: RollbackTransactionState[] = []
  for (const item of group) {
    const source = await tx.findConfigById(item.manifest.configId)
    const target = await tx.findConfigById(item.target.id)
    if (!source || !target)
      fail('CONFIG_MISSING', 'cohortActivation config is missing')
    if (!configShapeEqual(source, item.prior)) {
      fail('SOURCE_DRIFT', 'source config changed before rollback')
    }
    if (!configShapeEqual(target, item.target)) {
      fail('TARGET_DRIFT', 'target config changed before rollback')
    }
    states.push({
      item,
      source,
      target,
      state: rollbackItemState(source, target),
    })
  }
  const hasOld = states.some(({ state }) => state === 'old')
  const hasNew = states.some(({ state }) => state === 'new')
  if (hasOld && hasNew) {
    fail('READBACK_STATE_MISMATCH', 'chatbot group is partially switched')
  }
  return { targetServer, states }
}

async function restoreRollbackStates(
  tx: CohortActivationTransactionStore,
  targetServer: CohortActivationServerRecord,
  states: RollbackTransactionState[]
): Promise<CohortActivationReceiptEntry[]> {
  const entries: CohortActivationReceiptEntry[] = []
  for (const { item, source, target, state } of states) {
    if (state === 'old') {
      entries.push({
        ...item,
        target: { ...item.target, isEnabled: false },
      })
      continue
    }
    const disabledTarget = await tx.updateConfig(
      target.id,
      target.updatedAt,
      targetConfigData(
        item.manifest,
        targetServer.id,
        item.prior.priority,
        false
      )
    )
    if (!disabledTarget || disabledTarget.isEnabled) {
      fail('ROLLBACK_FAILED', 'target config was not disabled')
    }
    const enabledSource = await tx.updateConfig(
      source.id,
      source.updatedAt,
      sourceConfigData(item.prior, true)
    )
    if (!enabledSource || !configContentEqual(enabledSource, item.prior)) {
      fail('ROLLBACK_FAILED', 'source config was not restored')
    }
    entries.push({ ...item, target: snapshotConfig(disabledTarget) })
  }
  return entries
}

async function rollbackChatbotGroup(
  tx: CohortActivationTransactionStore,
  receipt: CohortActivationReceipt,
  group: CohortActivationReceiptEntry[]
): Promise<CohortActivationReceiptEntry[]> {
  const { targetServer, states } = await readRollbackStates(tx, receipt, group)
  return restoreRollbackStates(tx, targetServer, states)
}

function rollbackReceiptState(
  groupIndex: number,
  groupCount: number
): 'rolled_back' | 'rolling_back' {
  return groupIndex === groupCount - 1 ? 'rolled_back' : 'rolling_back'
}

export async function rollbackCohortActivation(
  store: CohortActivationStore,
  receipt: CohortActivationReceipt,
  checkpoint?: CohortActivationReceiptCheckpoint
): Promise<CohortActivationReceipt> {
  requireState(receipt, ['prepared', 'switching', 'switched', 'rolling_back'])
  let current = receipt
  const groups = groupEntriesByChatbot(receipt.entries)
  for (const [groupIndex, [chatbotId, group]] of groups.entries()) {
    await checkpoint?.(
      makeReceiptFrom(current, {
        entries: current.entries,
        state: 'rolling_back',
        switchedChatbotIds: current.switchedChatbotIds,
      })
    )
    // Roll back one chatbot at a time so another chatbot cannot be half-restored.
    const restoredEntries = await store.transaction((tx) =>
      rollbackChatbotGroup(tx, current, group)
    )
    const changed = new Map(
      restoredEntries.map((entry) => [entry.manifest.configId, entry])
    )
    const switchedChatbotIds = current.switchedChatbotIds.filter(
      (id) => id !== chatbotId
    )
    const entries = current.entries.map(
      (entry) => changed.get(entry.manifest.configId) ?? entry
    )
    current = makeReceiptFrom(current, {
      entries,
      state: rollbackReceiptState(groupIndex, groups.length),
      switchedChatbotIds,
    })
    await checkpoint?.(current)
  }
  return current
}

function readbackItemState(
  source: CohortActivationConfigRecord,
  target: CohortActivationConfigRecord
): 'prepared' | 'switched' {
  if (source.isEnabled && !target.isEnabled) return 'prepared'
  if (!source.isEnabled && target.isEnabled) return 'switched'
  fail('READBACK_STATE_MISMATCH', 'chatbot group is partially switched')
}

async function readReceiptStateItem(
  tx: CohortActivationTransactionStore,
  item: CohortActivationReceiptEntry
): Promise<{
  source: CohortActivationConfigRecord
  target: CohortActivationConfigRecord
  state: 'prepared' | 'switched'
}> {
  const source = await tx.findConfigById(item.manifest.configId)
  const target = await tx.findConfigById(item.target.id)
  if (!source || !target)
    fail('CONFIG_MISSING', 'cohortActivation config is missing')
  const sourceShapeMatches = configShapeEqual(source, item.prior)
  const targetShapeMatches = configShapeEqual(target, item.target)
  if (!sourceShapeMatches) {
    fail('SOURCE_READBACK_MISMATCH', 'source config differs from receipt')
  }
  if (!targetShapeMatches) {
    fail('TARGET_READBACK_MISMATCH', 'target config differs from receipt')
  }
  return { source, target, state: readbackItemState(source, target) }
}

function makeReadbackResult(
  receipt: CohortActivationReceipt,
  targetServer: CohortActivationServerRecord
): CohortActivationReadback {
  return {
    state: receipt.state,
    entryCount: receipt.entries.length,
    chatbotCount: chatbotIds(receipt.entries.map(({ manifest }) => manifest))
      .length,
    switchedChatbotCount: 0,
    sourceEnabled: 0,
    sourceDisabled: 0,
    targetEnabled: 0,
    targetDisabled: 0,
    targetServerActive: targetServer.isActive,
  }
}

function recordReadbackItem(
  result: CohortActivationReadback,
  actualChatbotStates: Map<string, 'prepared' | 'switched'>,
  item: CohortActivationReceiptEntry,
  source: CohortActivationConfigRecord,
  target: CohortActivationConfigRecord,
  state: 'prepared' | 'switched'
): void {
  const chatbotId = normalizeUuid(item.manifest.chatbotId, 'entry.chatbotId')
  const priorState = actualChatbotStates.get(chatbotId)
  if (priorState && priorState !== state) {
    fail('READBACK_STATE_MISMATCH', 'chatbot group is partially switched')
  }
  actualChatbotStates.set(chatbotId, state)
  if (source.isEnabled) result.sourceEnabled += 1
  else result.sourceDisabled += 1
  if (target.isEnabled) result.targetEnabled += 1
  else result.targetDisabled += 1
}

function finalizeReadback(
  result: CohortActivationReadback,
  receipt: CohortActivationReceipt,
  actualChatbotStates: Map<string, 'prepared' | 'switched'>
): void {
  const actualStates = new Set(actualChatbotStates.values())
  if (actualStates.size > 1) result.state = 'partial'
  else if (actualStates.has('switched')) result.state = 'switched'
  else if (actualStates.has('prepared')) {
    result.state = receipt.state === 'rolled_back' ? 'rolled_back' : 'prepared'
  }
  result.switchedChatbotCount = [...actualChatbotStates.values()].filter(
    (state) => state === 'switched'
  ).length
  if (receipt.state === 'switched' && result.state !== 'switched') {
    fail('READBACK_STATE_MISMATCH', 'switched state is not active')
  }
  if (receipt.state === 'rolled_back' && result.state !== 'rolled_back') {
    fail('READBACK_STATE_MISMATCH', 'rolled-back state is not restored')
  }
}

async function readCohortActivationStateInTransaction(
  tx: CohortActivationTransactionStore,
  receipt: CohortActivationReceipt
): Promise<CohortActivationReadback> {
  const targetServer = await tx.findServerById(receipt.targetServer.id)
  if (
    !targetServer ||
    !serverSnapshotEqual(targetServer, receipt.targetServer)
  ) {
    fail('TARGET_SERVER_DRIFT', 'target server differs from receipt')
  }
  const result = makeReadbackResult(receipt, targetServer)
  const actualChatbotStates = new Map<string, 'prepared' | 'switched'>()
  for (const item of receipt.entries) {
    const { source, target, state } = await readReceiptStateItem(tx, item)
    recordReadbackItem(result, actualChatbotStates, item, source, target, state)
  }
  finalizeReadback(result, receipt, actualChatbotStates)
  return result
}

export async function readCohortActivationState(
  store: CohortActivationStore,
  receipt: CohortActivationReceipt
): Promise<CohortActivationReadback> {
  validateReceipt(receipt)
  return store.transaction((tx) =>
    readCohortActivationStateInTransaction(tx, receipt)
  )
}
