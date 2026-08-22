import { encrypt } from '@klicker-uzh/util'
import { prisma } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { getAggregatedMCPTools } from '../src/services/mcpClients.js'

const SERVER_NAME = 'Klicker-compat' as const
const CHAT_MODE = 'tutor' as const
const RECEIPT_VERSION = 3 as const
const LEGACY_SERVER_NAME_PREFIX = 'W5e-legacy-' as const
const LEGACY_SERVER_URL = 'http://127.0.0.1:9/mcp' as const
const CANDIDATE_SERVICE_URL =
  'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker'
const CANDIDATE_PROOF_URL = 'http://127.0.0.1:1417/mcp/klicker'
const REQUEST_TIMEOUT_MS = 15_000
const DB_TIMEOUT_MS = 30_000
// Keep this aligned with @ai-sdk/mcp's initialize request version.
const MCP_PROTOCOL_VERSION = '2025-11-25'

const EXPECTED_TOOLS = [
  'banking_expert',
  'bf1_expert',
  'cf1_expert',
  'mat141_expert',
  'mat182_expert',
  'python_and_r_expert',
  'fs26_intro_r_expert',
  'bio144_expert',
  'df_ap_expert',
  'df_bf2_expert',
  'df_cf2_expert',
  'df_fineco_expert',
  'df_qf_expert',
  'mat183_expert',
  'vorkurs_expert',
  'informatik_und_wirtschaft_video_expert',
  'radiosurfvet_expert',
  'banking_expert_chunk_topics',
  'bf1_expert_chunk_topics',
  'cf1_expert_chunk_topics',
  'mat141_expert_chunk_topics',
  'mat182_expert_chunk_topics',
  'python_and_r_expert_chunk_topics',
  'fs26_intro_r_expert_chunk_topics',
  'bio144_expert_chunk_topics',
  'df_ap_expert_chunk_topics',
  'df_bf2_expert_chunk_topics',
  'df_cf2_expert_chunk_topics',
  'df_fineco_expert_chunk_topics',
  'df_qf_expert_chunk_topics',
  'mat183_expert_chunk_topics',
  'vorkurs_expert_chunk_topics',
  'informatik_und_wirtschaft_video_expert_chunk_topics',
  'radiosurfvet_expert_chunk_topics',
] as const

type State =
  | 'planned'
  | 'prepared'
  | 'switching'
  | 'switched'
  | 'proved'
  | 'rolled_back'
  | 'cleaned'
  | 'proof_blocked_but_cleaned'
  | 'recovery_required'

type Status = 'planned' | 'passed' | 'failed' | 'not_run'

export type W5eFailureCategory =
  | 'reachability_failed'
  | 'fixture_create_failed'
  | 'switch_failed'
  | 'proof_failed'
  | 'cleanup_failed'
  | 'unknown'

export type W5eFixtureOperation = 'not_run' | 'create' | 'switch' | 'cleanup'
export type W5eFixtureOperationStatus =
  | 'not_run'
  | 'running'
  | 'passed'
  | 'failed'

export type TransportPath = 'local-forward' | 'chat-pod'
export type TransportStatusClass = 'none' | '2xx' | '3xx' | '4xx' | '5xx'
export type TransportOutcome =
  | 'not_run'
  | 'accepted'
  | 'auth_rejected'
  | 'negotiation_rejected'
  | 'http_4xx'
  | 'http_5xx'
  | 'redirect_refused'
  | 'connection_refused'
  | 'timeout'
  | 'network_error'

export type TransportDiagnostic = {
  path: TransportPath
  outcome: TransportOutcome
  statusClass: TransportStatusClass
}

const STATE_RANK: Record<State, number> = {
  planned: 0,
  prepared: 1,
  switching: 2,
  switched: 3,
  proved: 4,
  rolled_back: 5,
  cleaned: 6,
  proof_blocked_but_cleaned: 6,
  recovery_required: 6,
}

type SafeConfigSnapshot = {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
  updatedAt: string
}

type SafeServerSnapshot = {
  id: string
  name: string
  url: string
  authType: string
  passChatbotId: boolean
  chatbotIdHeader: string | null
  isActive: boolean
  updatedAt: string
}

type FixtureIds = {
  ownerId: string
  courseId: string
  participantId: string
  participationId: number | null
  chatbotId: string
  legacyServerId: string
  legacyServerName: string
  legacyConfigId: string
  candidateServerId: string
  candidateConfigId: string
}

export type W5eReceipt = {
  receiptVersion: typeof RECEIPT_VERSION
  wItem: 'W5e'
  environment: 'prd'
  runId: string
  state: State
  createdAt: string
  updatedAt: string
  identity: {
    serverName: typeof SERVER_NAME
    chatbotId: string
    legacyServerId: string
    legacyServerName: string
    legacyConfigId: string
    chatMode: typeof CHAT_MODE
  }
  fixture: FixtureIds
  prior: {
    legacyConfig: SafeConfigSnapshot | null
    legacyServer: SafeServerSnapshot | null
  }
  candidate: {
    server: SafeServerSnapshot | null
    config: SafeConfigSnapshot | null
  }
  provenance: {
    klickerSourceSha: string
    chatImageDigest: string
    docQueryImageDigest: string
    argoRevision: string
    networkPolicySourceCommit: string
  }
  failure?: { category: W5eFailureCategory } | null
  fixtureOperation: {
    operation: W5eFixtureOperation
    status: W5eFixtureOperationStatus
  }
  reachability: TransportDiagnostic
  proof: {
    status: Status
    toolCount: number | null
    pairCount: number | null
    teachingToolsPresent: boolean | null
    retrieval: Status
    wrongBearer: Status
    missingBearer: Status
    wrongTenant: Status
    eduaiRoute: Status
  }
  cleanup: {
    restoredLegacy: boolean
    candidateAbsent: boolean
    legacyAbsent: boolean
    fixtureAbsent: boolean
    unrelatedRowsUntouched: boolean
    exactZeroReadback: boolean
  }
  payloadDigest: string
}

type ReceiptStore = {
  read(): Promise<W5eReceipt | null>
  write(receipt: W5eReceipt): Promise<void>
}

type FixtureState = {
  ids: FixtureIds
  legacyConfig: SafeConfigSnapshot
  legacyServer: SafeServerSnapshot
  receiptPersisted: boolean
  preparedCandidateServer: SafeServerSnapshot
  preparedCandidateConfig: SafeConfigSnapshot
  activeCandidateServer?: SafeServerSnapshot
  activeCandidateConfig?: SafeConfigSnapshot
}

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`)
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) fail('ENV_REQUIRED', `${name} is required`)
  return value
}

function safeUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    fail('INVALID_URL', 'candidate URL is invalid')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    fail('INVALID_URL', 'candidate URL must be HTTP(S) without credentials')
  }
  return url.toString()
}

function assertFixedEndpoint(
  value: string,
  expected: string,
  label: string
): string {
  const normalized = safeUrl(value)
  if (normalized !== safeUrl(expected))
    fail('INVALID_URL', `${label} must use the fixed approved endpoint`)
  return normalized
}

function cloneJson(value: unknown): unknown {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value))
}

function digestReceipt(receipt: Omit<W5eReceipt, 'payloadDigest'>): string {
  return createHash('sha256').update(JSON.stringify(receipt)).digest('hex')
}

type ReceiptBody = Omit<W5eReceipt, 'receiptVersion' | 'payloadDigest'>

function withDigest(input: ReceiptBody): W5eReceipt {
  const withoutDigest = { receiptVersion: RECEIPT_VERSION, ...input }
  return { ...withoutDigest, payloadDigest: digestReceipt(withoutDigest) }
}

function assertReceipt(receipt: W5eReceipt): void {
  if (receipt.receiptVersion !== RECEIPT_VERSION || receipt.wItem !== 'W5e') {
    fail('RECEIPT_INVALID', 'only receipt version 3 is executable')
  }
  if (
    receipt.identity.serverName !== SERVER_NAME ||
    receipt.environment !== 'prd' ||
    receipt.identity.chatbotId !== receipt.fixture.chatbotId ||
    receipt.identity.legacyConfigId !== receipt.fixture.legacyConfigId ||
    receipt.identity.legacyServerId !== receipt.fixture.legacyServerId ||
    receipt.identity.legacyServerName !== receipt.fixture.legacyServerName ||
    !receipt.identity.legacyServerName.startsWith(LEGACY_SERVER_NAME_PREFIX)
  ) {
    fail('RECEIPT_INVALID', 'receipt identity or environment is not fixed')
  }
  if (
    !['not_run', 'create', 'switch', 'cleanup'].includes(
      receipt.fixtureOperation.operation
    ) ||
    !['not_run', 'running', 'passed', 'failed'].includes(
      receipt.fixtureOperation.status
    )
  ) {
    fail('RECEIPT_INVALID', 'fixture operation classification is invalid')
  }
  const { payloadDigest: _ignored, ...withoutDigest } = receipt
  if (digestReceipt(withoutDigest) !== receipt.payloadDigest) {
    fail('RECEIPT_INVALID', 'receipt digest does not match')
  }
}

export function initialReceipt(
  runId: string,
  fixture: FixtureIds,
  provenance: W5eReceipt['provenance']
): W5eReceipt {
  return withDigest({
    wItem: 'W5e',
    environment: 'prd',
    runId,
    state: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    identity: {
      serverName: SERVER_NAME,
      chatbotId: fixture.chatbotId,
      legacyServerId: fixture.legacyServerId,
      legacyServerName: fixture.legacyServerName,
      legacyConfigId: fixture.legacyConfigId,
      chatMode: CHAT_MODE,
    },
    fixture,
    prior: { legacyConfig: null, legacyServer: null },
    candidate: {
      server: null,
      config: null,
    },
    provenance,
    failure: null,
    fixtureOperation: { operation: 'not_run', status: 'not_run' },
    reachability: {
      path: 'local-forward',
      outcome: 'not_run',
      statusClass: 'none',
    },
    proof: {
      status: 'not_run',
      toolCount: null,
      pairCount: null,
      teachingToolsPresent: null,
      retrieval: 'not_run',
      wrongBearer: 'not_run',
      missingBearer: 'not_run',
      wrongTenant: 'not_run',
      eduaiRoute: 'not_run',
    },
    cleanup: {
      restoredLegacy: false,
      candidateAbsent: false,
      legacyAbsent: false,
      fixtureAbsent: false,
      unrelatedRowsUntouched: false,
      exactZeroReadback: false,
    },
  })
}

export function updatedReceipt(
  receipt: W5eReceipt,
  changes: Partial<W5eReceipt>
): W5eReceipt {
  const {
    receiptVersion: _version,
    payloadDigest: _ignored,
    ...withoutDigest
  } = receipt
  const {
    receiptVersion: _changeVersion,
    payloadDigest: _changeDigest,
    ...safeChanges
  } = changes
  if (
    safeChanges.state &&
    !isAllowedTransition(receipt.state, safeChanges.state)
  ) {
    fail(
      'RECEIPT_STATE',
      `invalid transition from ${receipt.state} to ${safeChanges.state}`
    )
  }
  return withDigest({
    ...withoutDigest,
    ...safeChanges,
    updatedAt: new Date().toISOString(),
  } as ReceiptBody)
}

function isAllowedTransition(from: State, to: State): boolean {
  if (from === to) return true
  if (to === 'recovery_required') return STATE_RANK[to] >= STATE_RANK[from]
  return (
    (from === 'planned' && to === 'prepared') ||
    (from === 'prepared' && (to === 'switching' || to === 'rolled_back')) ||
    (from === 'switching' && (to === 'switched' || to === 'rolled_back')) ||
    (from === 'switched' && (to === 'proved' || to === 'rolled_back')) ||
    (from === 'proved' && to === 'rolled_back') ||
    (from === 'rolled_back' &&
      (to === 'cleaned' || to === 'proof_blocked_but_cleaned'))
  )
}

export function createReceiptStore(path: string): ReceiptStore {
  const absolutePath = resolve(path)
  const lockPath = `${absolutePath}.lock`
  let lastDigest: string | null | undefined

  async function readCurrent(): Promise<W5eReceipt | null> {
    try {
      const parsed = JSON.parse(
        await readFile(absolutePath, 'utf8')
      ) as W5eReceipt
      assertReceipt(parsed)
      return parsed
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return null
      if (error instanceof Error && error.message.startsWith('RECEIPT_'))
        throw error
      fail('RECEIPT_READ_FAILED', 'receipt could not be read')
    }
  }

  function assertImmutableReceipt(current: W5eReceipt, next: W5eReceipt): void {
    const identity = (receipt: W5eReceipt) => ({
      receiptVersion: receipt.receiptVersion,
      wItem: receipt.wItem,
      environment: receipt.environment,
      runId: receipt.runId,
      createdAt: receipt.createdAt,
      identity: receipt.identity,
      provenance: receipt.provenance,
      fixture: {
        ownerId: receipt.fixture.ownerId,
        courseId: receipt.fixture.courseId,
        participantId: receipt.fixture.participantId,
        chatbotId: receipt.fixture.chatbotId,
        legacyServerId: receipt.fixture.legacyServerId,
        legacyServerName: receipt.fixture.legacyServerName,
        legacyConfigId: receipt.fixture.legacyConfigId,
        candidateServerId: receipt.fixture.candidateServerId,
        candidateConfigId: receipt.fixture.candidateConfigId,
      },
    })
    if (JSON.stringify(identity(current)) !== JSON.stringify(identity(next)))
      fail('RECEIPT_IMMUTABLE', 'receipt identity or provenance changed')

    const bootstrap = current.state === 'planned' && next.state === 'prepared'
    if (
      !bootstrap &&
      JSON.stringify({
        participationId: current.fixture.participationId,
        prior: current.prior,
      }) !==
        JSON.stringify({
          participationId: next.fixture.participationId,
          prior: next.prior,
        })
    )
      fail('RECEIPT_IMMUTABLE', 'receipt recovery fields changed')
  }

  return {
    async read() {
      const current = await readCurrent()
      lastDigest = current?.payloadDigest ?? null
      return current
    },
    async write(receipt) {
      assertReceipt(receipt)
      await mkdir(dirname(absolutePath), { recursive: true })
      try {
        await mkdir(lockPath)
      } catch {
        fail('RECEIPT_LOCKED', 'receipt is already being updated')
      }
      const temp = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`
      try {
        const current = await readCurrent()
        if (lastDigest === undefined) {
          if (current)
            fail('RECEIPT_CAS_REQUIRED', 'receipt must be read first')
        } else if (lastDigest === null) {
          if (current) fail('RECEIPT_EXISTS', 'receipt already exists')
        } else {
          if (!current || current.payloadDigest !== lastDigest)
            fail('RECEIPT_CAS_FAILED', 'receipt changed concurrently')
          assertImmutableReceipt(current, receipt)
          if (!isAllowedTransition(current.state, receipt.state))
            fail(
              'RECEIPT_STATE',
              `invalid durable transition from ${current.state} to ${receipt.state}`
            )
        }
        await writeFile(temp, `${JSON.stringify(receipt, null, 2)}\n`, {
          encoding: 'utf8',
          flag: 'wx',
        })
        await rename(temp, absolutePath)
        lastDigest = receipt.payloadDigest
      } finally {
        await rm(temp, { force: true }).catch(() => undefined)
        await rmdir(lockPath).catch(() => undefined)
      }
    },
  }
}

function safeConfigSnapshot(record: {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
  updatedAt: Date
}): SafeConfigSnapshot {
  return {
    id: record.id,
    chatbotId: record.chatbotId,
    mcpServerId: record.mcpServerId,
    chatMode: record.chatMode,
    allowedTools: cloneJson(record.allowedTools),
    priority: record.priority,
    isEnabled: record.isEnabled,
    parameters: cloneJson(record.parameters),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function safeServerSnapshot(record: {
  id: string
  name: string
  url: string
  authType: string
  passChatbotId: boolean
  chatbotIdHeader: string | null
  isActive: boolean
  updatedAt: Date
}): SafeServerSnapshot {
  return {
    id: record.id,
    name: record.name,
    url: safeUrl(record.url),
    authType: record.authType,
    passChatbotId: record.passChatbotId,
    chatbotIdHeader: record.chatbotIdHeader,
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function sameConfig(record: any, expected: SafeConfigSnapshot): boolean {
  return Boolean(
    record &&
      record.id === expected.id &&
      record.chatbotId === expected.chatbotId &&
      record.mcpServerId === expected.mcpServerId &&
      record.chatMode === expected.chatMode &&
      JSON.stringify(record.allowedTools) ===
        JSON.stringify(expected.allowedTools) &&
      record.priority === expected.priority &&
      record.isEnabled === expected.isEnabled &&
      JSON.stringify(record.parameters) ===
        JSON.stringify(expected.parameters) &&
      record.updatedAt.toISOString() === expected.updatedAt
  )
}

function sameConfigContent(record: any, expected: SafeConfigSnapshot): boolean {
  return Boolean(
    record &&
      record.id === expected.id &&
      record.chatbotId === expected.chatbotId &&
      record.mcpServerId === expected.mcpServerId &&
      record.chatMode === expected.chatMode &&
      JSON.stringify(record.allowedTools) ===
        JSON.stringify(expected.allowedTools) &&
      record.priority === expected.priority &&
      JSON.stringify(record.parameters) === JSON.stringify(expected.parameters)
  )
}

function sameServer(record: any, expected: SafeServerSnapshot): boolean {
  return Boolean(
    record &&
      record.id === expected.id &&
      record.name === expected.name &&
      safeUrl(record.url) === expected.url &&
      record.authType === expected.authType &&
      record.passChatbotId === expected.passChatbotId &&
      record.chatbotIdHeader === expected.chatbotIdHeader &&
      record.isActive === expected.isActive &&
      record.updatedAt.toISOString() === expected.updatedAt
  )
}

function sameServerContent(record: any, expected: SafeServerSnapshot): boolean {
  return Boolean(
    record &&
      record.id === expected.id &&
      record.name === expected.name &&
      safeUrl(record.url) === expected.url &&
      record.authType === expected.authType &&
      record.passChatbotId === expected.passChatbotId &&
      record.chatbotIdHeader === expected.chatbotIdHeader
  )
}

export function suppressOutput<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log
  const error = console.error
  console.log = () => undefined
  console.error = () => undefined
  return fn().finally(() => {
    console.log = log
    console.error = error
  })
}

function transportStatusClass(status: number): TransportStatusClass {
  if (status >= 200 && status < 300) return '2xx'
  if (status >= 300 && status < 400) return '3xx'
  if (status >= 400 && status < 500) return '4xx'
  if (status >= 500 && status < 600) return '5xx'
  return 'none'
}

function transportOutcome(status: number): TransportOutcome {
  if (status >= 200 && status < 300) return 'accepted'
  if (status === 401 || status === 403) return 'auth_rejected'
  if (status === 406 || status === 415) return 'negotiation_rejected'
  if (status >= 400 && status < 500) return 'http_4xx'
  if (status >= 500 && status < 600) return 'http_5xx'
  if (status >= 300 && status < 400) return 'redirect_refused'
  return 'network_error'
}

function transportErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const cause = 'cause' in error ? error.cause : undefined
  if (!cause || typeof cause !== 'object' || !('code' in cause)) {
    return undefined
  }
  const code = cause.code
  return typeof code === 'string' ? code : undefined
}

function transportErrorOutcome(error: unknown): TransportOutcome {
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? error.cause
      : undefined
  if (
    cause &&
    typeof cause === 'object' &&
    'message' in cause &&
    cause.message === 'unexpected redirect'
  ) {
    return 'redirect_refused'
  }
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'timeout'
    }
  }
  const code = transportErrorCode(error)
  if (code === 'ECONNREFUSED') return 'connection_refused'
  if (code === 'UND_ERR_REDIRECT') return 'redirect_refused'
  return 'network_error'
}

async function fixedRouteStatus(
  url: string,
  bearer?: string,
  chatbotId?: string,
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  }
  if (bearer) headers.authorization = `Bearer ${bearer}`
  if (chatbotId) headers['Chatbot-ID'] = chatbotId
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'w5e', version: '1' },
      },
    }),
  })
  return response.status
}

export async function probeFixedRoute(
  url: string,
  bearer: string | undefined,
  chatbotId: string | undefined,
  path: TransportPath = 'local-forward',
  fetchImpl: typeof fetch = fetch
): Promise<TransportDiagnostic> {
  try {
    const status = await fixedRouteStatus(url, bearer, chatbotId, fetchImpl)
    return {
      path,
      outcome: transportOutcome(status),
      statusClass: transportStatusClass(status),
    }
  } catch (error) {
    return {
      path,
      outcome: transportErrorOutcome(error),
      statusClass: 'none',
    }
  }
}

async function assertCandidateReachable(
  options: RunOptions,
  chatbotId: string
): Promise<void> {
  const reachability = await probeFixedRoute(
    options.proofUrl,
    options.bearer,
    chatbotId,
    'local-forward',
    options.fetchImpl
  )
  options.receipt = updatedReceipt(options.receipt, { reachability })
  await options.store.write(options.receipt)
  if (reachability.outcome !== 'accepted')
    fail('BEARER_REJECTED', 'stored bearer did not reach the candidate route')
}

function candidateServerInput(record: any, proofUrl: string) {
  return {
    id: record.id,
    name: record.name,
    url: proofUrl,
    authType: record.authType,
    authSecret: record.authSecret ?? undefined,
    parameters: record.parameters ?? undefined,
    isActive: record.isActive,
    passChatbotId: record.passChatbotId,
    chatbotIdHeader: record.chatbotIdHeader ?? undefined,
  }
}

function isSuccessfulToolResult(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'content' in value &&
      Array.isArray((value as { content?: unknown }).content) &&
      (value as { isError?: unknown }).isError !== true
  )
}

async function runProof(
  proofUrl: string,
  candidateServer: any,
  chatbotId: string,
  bearer: string
): Promise<W5eReceipt['proof']> {
  const config = { allowedTools: [...EXPECTED_TOOLS], priority: 0 }
  const direct = {
    server: candidateServerInput(candidateServer, proofUrl),
    config,
  }
  const result: W5eReceipt['proof'] = {
    status: 'failed',
    toolCount: null,
    pairCount: null,
    teachingToolsPresent: null,
    retrieval: 'failed',
    wrongBearer: 'failed',
    missingBearer: 'failed',
    wrongTenant: 'failed',
    eduaiRoute: 'failed',
  }

  try {
    const tools = await suppressOutput(() =>
      getAggregatedMCPTools([direct], chatbotId, {
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
      })
    )
    const names = Object.keys(tools).sort()
    result.toolCount = names.length
    result.pairCount = names.filter(
      (name) => !name.endsWith('_chunk_topics')
    ).length
    result.teachingToolsPresent = names.some((name) => /teaching/i.test(name))
    if (
      result.toolCount !== EXPECTED_TOOLS.length ||
      result.pairCount !== 17 ||
      result.teachingToolsPresent
    ) {
      return result
    }

    const retrievalTool = Object.entries(tools).find(([name]) =>
      name.includes('banking_expert')
    )?.[1] as
      | { execute?: (input: { query: string }) => Promise<unknown> }
      | undefined
    if (!retrievalTool?.execute) return result
    const retrieval = await suppressOutput(() =>
      retrievalTool.execute!({ query: 'W5e synthetic direct retrieval' })
    )
    if (!isSuccessfulToolResult(retrieval)) return result
    result.retrieval = 'passed'

    const wrong = await suppressOutput(() =>
      getAggregatedMCPTools(
        [
          {
            ...direct,
            server: {
              ...direct.server,
              authSecret: encrypt('w5e-invalid-bearer'),
            },
          },
        ],
        chatbotId,
        { requestTimeoutMs: REQUEST_TIMEOUT_MS }
      )
    )
    result.wrongBearer = Object.keys(wrong).length === 0 ? 'passed' : 'failed'

    const missing = await suppressOutput(() =>
      getAggregatedMCPTools(
        [{ ...direct, server: { ...direct.server, authSecret: undefined } }],
        chatbotId,
        { requestTimeoutMs: REQUEST_TIMEOUT_MS }
      )
    )
    result.missingBearer =
      Object.keys(missing).length === 0 ? 'passed' : 'failed'

    const wrongTenant = await suppressOutput(() =>
      getAggregatedMCPTools([direct], randomUUID(), {
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
      })
    )
    result.wrongTenant =
      Object.keys(wrongTenant).length === 0 ? 'passed' : 'failed'

    const eduaiUrl = proofUrl.replace(/\/mcp\/klicker\/?$/, '/mcp/eduai')
    const eduaiStatus = await fixedRouteStatus(eduaiUrl)
    result.eduaiRoute = eduaiStatus >= 400 ? 'passed' : 'failed'
    result.status =
      result.toolCount === EXPECTED_TOOLS.length &&
      result.pairCount === 17 &&
      result.teachingToolsPresent === false &&
      result.retrieval === 'passed' &&
      result.wrongBearer === 'passed' &&
      result.missingBearer === 'passed' &&
      result.wrongTenant === 'passed' &&
      result.eduaiRoute === 'passed'
        ? 'passed'
        : 'failed'
    return result
  } catch (error) {
    void error
    return result
  }
}

type RunOptions = {
  client: PrismaClient
  store: ReceiptStore
  receipt: W5eReceipt
  candidateUrl: string
  proofUrl: string
  bearer: string
  fetchImpl: typeof fetch
  runProofImpl: typeof runProof
  isInterrupted: () => boolean
}

function assertNotInterrupted(options: RunOptions): void {
  if (options.isInterrupted())
    fail('INTERRUPTED', 'operator requested bounded cleanup')
}

async function createFixture(options: RunOptions): Promise<FixtureState> {
  const { client, receipt, candidateUrl, bearer } = options
  assertNotInterrupted(options)
  const ids = receipt.fixture
  const result = await client.$transaction(
    async (tx) => {
      const duplicate = await tx.chatbotMCPServer.findUnique({
        where: { name: SERVER_NAME },
      })
      if (duplicate) fail('DUPLICATE_SERVER', 'Klicker-compat already exists')

      const owner = await tx.user.create({
        data: {
          id: ids.ownerId,
          name: `W5e synthetic owner ${receipt.runId}`,
          email: `w5e-${receipt.runId}@example.invalid`,
          shortname: `w5e-${receipt.runId}`,
          role: 'USER',
        },
      })
      const now = new Date()
      const course = await tx.course.create({
        data: {
          id: ids.courseId,
          name: `w5e-${receipt.runId}`,
          displayName: `W5e synthetic course ${receipt.runId}`,
          ownerId: owner.id,
          startDate: now,
          endDate: new Date(now.getTime() + 86_400_000),
          groupDeadlineDate: now,
          authType: 'SSO',
          pinCode: null,
        },
      })
      const participant = await tx.participant.create({
        data: {
          id: ids.participantId,
          username: `w5e-${receipt.runId}`,
          password: randomUUID(),
          email: `w5e-${receipt.runId}@example.invalid`,
          isEmailValid: false,
        },
      })
      const participation = await tx.participation.create({
        data: {
          courseId: course.id,
          participantId: participant.id,
          isActive: true,
        },
      })
      const chatbot = await tx.chatbot.create({
        data: {
          id: ids.chatbotId,
          name: `doc-query-canary-${receipt.runId}`,
          description: 'Synthetic W5e direct-Chat canary',
          ownerId: owner.id,
          courseId: course.id,
          systemPrompts: {},
          creditInitialCredits: 0,
          creditResetPeriod: 'NONE',
          creditResetAmount: 0,
          creditMaxCredits: 0,
          modelSelection: false,
        },
      })
      const legacyServer = await tx.chatbotMCPServer.create({
        data: {
          id: ids.legacyServerId,
          name: ids.legacyServerName,
          description: 'Synthetic W5e inert legacy binding',
          url: LEGACY_SERVER_URL,
          authType: 'none',
          authSecret: null,
          passChatbotId: false,
          chatbotIdHeader: null,
          parameters: {},
          isActive: true,
        },
      })
      const legacyConfig = await tx.chatbotMCPConfig.create({
        data: {
          id: ids.legacyConfigId,
          chatbotId: chatbot.id,
          mcpServerId: legacyServer.id,
          chatMode: CHAT_MODE,
          allowedTools: ['doc_query'],
          priority: 0,
          isEnabled: true,
          parameters: {},
        },
      })
      const candidateServer = await tx.chatbotMCPServer.create({
        data: {
          id: ids.candidateServerId,
          name: SERVER_NAME,
          description: 'Synthetic W5e direct-Chat compatibility binding',
          url: candidateUrl,
          authType: 'bearer',
          authSecret: encrypt(bearer),
          passChatbotId: true,
          chatbotIdHeader: 'Chatbot-ID',
          parameters: {},
          isActive: false,
        },
      })
      const candidateConfig = await tx.chatbotMCPConfig.create({
        data: {
          id: ids.candidateConfigId,
          chatbotId: chatbot.id,
          mcpServerId: candidateServer.id,
          chatMode: CHAT_MODE,
          allowedTools: [...EXPECTED_TOOLS],
          priority: 0,
          isEnabled: false,
          parameters: {},
        },
      })
      return {
        participationId: participation.id,
        legacyConfig: safeConfigSnapshot(legacyConfig),
        legacyServer: safeServerSnapshot(legacyServer),
        preparedCandidateServer: safeServerSnapshot(candidateServer),
        preparedCandidateConfig: safeConfigSnapshot(candidateConfig),
      }
    },
    { isolationLevel: 'Serializable', timeout: DB_TIMEOUT_MS }
  )
  const fixture = {
    ids: { ...ids, participationId: result.participationId },
    receiptPersisted: false,
    ...result,
  }
  options.receipt = updatedReceipt(options.receipt, {
    state: 'prepared',
    fixtureOperation: { operation: 'create', status: 'passed' },
    fixture: fixture.ids,
    prior: {
      legacyConfig: fixture.legacyConfig,
      legacyServer: fixture.legacyServer,
    },
    candidate: {
      server: fixture.preparedCandidateServer,
      config: fixture.preparedCandidateConfig,
    },
  })
  try {
    await options.store.write(options.receipt)
    fixture.receiptPersisted = true
  } catch {
    // Keep the in-memory fixture available to the caller so it can clean up
    // rows even when the durable receipt update itself fails.
  }
  return fixture
}

async function switchFixture(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  const { client, receipt } = options
  assertNotInterrupted(options)
  options.receipt = updatedReceipt(receipt, { state: 'switching' })
  options.receipt = updatedReceipt(options.receipt, {
    fixtureOperation: { operation: 'switch', status: 'running' },
  })
  await options.store.write(options.receipt)
  await client.$transaction(
    async (tx) => {
      const legacy = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.legacyConfigId },
      })
      const candidateServer = await tx.chatbotMCPServer.findUnique({
        where: { id: fixture.ids.candidateServerId },
      })
      const candidateConfig = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.candidateConfigId },
      })
      if (!legacy)
        fail('SNAPSHOT_MISMATCH', 'prepared legacy binding is missing')
      if (
        !sameConfig(legacy, fixture.legacyConfig) ||
        !candidateServer ||
        !candidateConfig
      ) {
        fail('SNAPSHOT_MISMATCH', 'prepared binding changed before switch')
      }
      if (
        !sameServer(candidateServer, fixture.preparedCandidateServer) ||
        !sameConfig(candidateConfig, fixture.preparedCandidateConfig)
      ) {
        fail('SNAPSHOT_MISMATCH', 'candidate binding changed before switch')
      }
      if (
        candidateServer.name !== SERVER_NAME ||
        candidateConfig.chatbotId !== fixture.ids.chatbotId ||
        candidateConfig.mcpServerId !== fixture.ids.candidateServerId ||
        candidateConfig.chatMode !== CHAT_MODE ||
        candidateConfig.isEnabled ||
        candidateServer.isActive
      ) {
        fail(
          'CANDIDATE_STATE_INVALID',
          'candidate is not in the prepared state'
        )
      }
      const legacyUpdated = await tx.chatbotMCPConfig.updateMany({
        where: {
          id: legacy.id,
          chatbotId: fixture.ids.chatbotId,
          mcpServerId: fixture.ids.legacyServerId,
          chatMode: CHAT_MODE,
          updatedAt: legacy.updatedAt,
        },
        data: { isEnabled: false },
      })
      if (legacyUpdated.count !== 1)
        fail('CONCURRENT_EDIT', 'legacy binding changed during switch')
      const serverUpdated = await tx.chatbotMCPServer.updateMany({
        where: { id: candidateServer.id, updatedAt: candidateServer.updatedAt },
        data: { isActive: true },
      })
      if (serverUpdated.count !== 1)
        fail('CONCURRENT_EDIT', 'candidate server changed during switch')
      const configUpdated = await tx.chatbotMCPConfig.updateMany({
        where: { id: candidateConfig.id, updatedAt: candidateConfig.updatedAt },
        data: { isEnabled: true },
      })
      if (configUpdated.count !== 1)
        fail('CONCURRENT_EDIT', 'candidate binding changed during switch')
    },
    { isolationLevel: 'Serializable', timeout: DB_TIMEOUT_MS }
  )
  const [activeCandidateServer, activeCandidateConfig] =
    await client.$transaction(
      async (tx) =>
        Promise.all([
          tx.chatbotMCPServer.findUnique({
            where: { id: fixture.ids.candidateServerId },
          }),
          tx.chatbotMCPConfig.findUnique({
            where: { id: fixture.ids.candidateConfigId },
          }),
        ]),
      { timeout: DB_TIMEOUT_MS }
    )
  if (!activeCandidateServer || !activeCandidateConfig) {
    fail('CANDIDATE_STATE_MISSING', 'active candidate disappeared after switch')
  }
  fixture.activeCandidateServer = safeServerSnapshot(activeCandidateServer)
  fixture.activeCandidateConfig = safeConfigSnapshot(activeCandidateConfig)
  options.receipt = updatedReceipt(options.receipt, {
    state: 'switched',
    fixtureOperation: { operation: 'switch', status: 'passed' },
    candidate: {
      server: fixture.activeCandidateServer,
      config: fixture.activeCandidateConfig,
    },
  })
  await options.store.write(options.receipt)
}

async function runLiveProof(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  assertNotInterrupted(options)
  const [candidate, candidateConfig] = await options.client.$transaction(
    async (tx) =>
      Promise.all([
        tx.chatbotMCPServer.findUnique({
          where: { id: fixture.ids.candidateServerId },
        }),
        tx.chatbotMCPConfig.findUnique({
          where: { id: fixture.ids.candidateConfigId },
        }),
      ]),
    { timeout: DB_TIMEOUT_MS }
  )
  if (
    !candidate ||
    !candidateConfig ||
    !candidate.isActive ||
    !candidateConfig.isEnabled ||
    candidate.name !== SERVER_NAME ||
    !fixture.activeCandidateServer ||
    !fixture.activeCandidateConfig ||
    !sameServer(candidate, fixture.activeCandidateServer) ||
    !sameConfig(candidateConfig, fixture.activeCandidateConfig)
  ) {
    fail('CANDIDATE_STATE_INVALID', 'active candidate was not read back')
  }
  assertNotInterrupted(options)
  options.receipt = updatedReceipt(options.receipt, {
    state: 'switched',
    proof: await options.runProofImpl(
      options.proofUrl,
      candidate,
      fixture.ids.chatbotId,
      options.bearer
    ),
  })
  await options.store.write(options.receipt)
  if (options.receipt.proof.status !== 'passed')
    fail('PROOF_BLOCKED', 'direct Chat proof did not pass')
  options.receipt = updatedReceipt(options.receipt, { state: 'proved' })
  await options.store.write(options.receipt)
}

async function restoreAndDeleteBinding(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  const { client } = options
  const expectedCandidateServer = fixture.activeCandidateServer
  const expectedCandidateConfig = fixture.activeCandidateConfig
  if (!expectedCandidateServer || !expectedCandidateConfig) {
    fail('CLEANUP_PRECONDITION', 'active candidate snapshot is missing')
  }
  await client.$transaction(
    async (tx) => {
      const legacy = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.legacyConfigId },
      })
      const candidateServer = await tx.chatbotMCPServer.findUnique({
        where: { id: fixture.ids.candidateServerId },
      })
      const candidateConfig = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.candidateConfigId },
      })
      if (!legacy || !candidateServer || !candidateConfig)
        fail('CLEANUP_PRECONDITION', 'binding rows are missing')
      if (
        !sameConfigContent(legacy, fixture.legacyConfig) ||
        legacy.isEnabled
      ) {
        fail('SNAPSHOT_MISMATCH', 'legacy binding changed during cleanup')
      }
      if (!sameServer(candidateServer, expectedCandidateServer)) {
        fail('SNAPSHOT_MISMATCH', 'candidate server changed during cleanup')
      }
      if (!sameConfig(candidateConfig, expectedCandidateConfig)) {
        fail('SNAPSHOT_MISMATCH', 'candidate config changed during cleanup')
      }
      const restored = await tx.chatbotMCPConfig.updateMany({
        where: {
          id: legacy.id,
          updatedAt: legacy.updatedAt,
          chatbotId: fixture.ids.chatbotId,
          mcpServerId: fixture.ids.legacyServerId,
          chatMode: CHAT_MODE,
        },
        data: { isEnabled: fixture.legacyConfig.isEnabled },
      })
      if (restored.count !== 1)
        fail('CONCURRENT_EDIT', 'legacy binding could not be restored')
      const deletedConfig = await tx.chatbotMCPConfig.deleteMany({
        where: {
          id: candidateConfig.id,
          chatbotId: fixture.ids.chatbotId,
          mcpServerId: candidateServer.id,
          chatMode: CHAT_MODE,
        },
      })
      if (deletedConfig.count !== 1)
        fail('CONCURRENT_EDIT', 'candidate config could not be deleted')
      const deletedServer = await tx.chatbotMCPServer.deleteMany({
        where: { id: candidateServer.id, name: SERVER_NAME },
      })
      if (deletedServer.count !== 1)
        fail('CONCURRENT_EDIT', 'candidate server could not be deleted')
    },
    { isolationLevel: 'Serializable', timeout: DB_TIMEOUT_MS }
  )
  options.receipt = updatedReceipt(options.receipt, {
    cleanup: { ...options.receipt.cleanup, restoredLegacy: true },
  })
}

async function deletePreparedBinding(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  const { client } = options
  await client.$transaction(
    async (tx) => {
      const legacy = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.legacyConfigId },
      })
      const candidateServer = await tx.chatbotMCPServer.findUnique({
        where: { id: fixture.ids.candidateServerId },
      })
      const candidateConfig = await tx.chatbotMCPConfig.findUnique({
        where: { id: fixture.ids.candidateConfigId },
      })
      if (!legacy || !candidateServer || !candidateConfig)
        fail('CLEANUP_PRECONDITION', 'prepared binding rows are missing')
      if (!sameConfig(legacy, fixture.legacyConfig))
        fail(
          'SNAPSHOT_MISMATCH',
          'legacy binding changed before prepared cleanup'
        )
      if (
        !sameServer(candidateServer, fixture.preparedCandidateServer) ||
        !sameConfig(candidateConfig, fixture.preparedCandidateConfig)
      ) {
        fail('SNAPSHOT_MISMATCH', 'prepared candidate changed before cleanup')
      }
      const deletedConfig = await tx.chatbotMCPConfig.deleteMany({
        where: {
          id: candidateConfig.id,
          chatbotId: fixture.ids.chatbotId,
          mcpServerId: candidateServer.id,
          chatMode: CHAT_MODE,
        },
      })
      if (deletedConfig.count !== 1)
        fail(
          'CONCURRENT_EDIT',
          'prepared candidate config could not be deleted'
        )
      const deletedServer = await tx.chatbotMCPServer.deleteMany({
        where: { id: candidateServer.id, name: SERVER_NAME, isActive: false },
      })
      if (deletedServer.count !== 1)
        fail(
          'CONCURRENT_EDIT',
          'prepared candidate server could not be deleted'
        )
    },
    { isolationLevel: 'Serializable', timeout: DB_TIMEOUT_MS }
  )
  options.receipt = updatedReceipt(options.receipt, {
    cleanup: { ...options.receipt.cleanup, restoredLegacy: true },
  })
}

async function reconcileSwitching(
  options: RunOptions,
  fixture: FixtureState
): Promise<'prepared' | 'switched'> {
  const [legacy, candidateServer, candidateConfig] =
    await options.client.$transaction(
      async (tx) =>
        Promise.all([
          tx.chatbotMCPConfig.findUnique({
            where: { id: fixture.ids.legacyConfigId },
          }),
          tx.chatbotMCPServer.findUnique({
            where: { id: fixture.ids.candidateServerId },
          }),
          tx.chatbotMCPConfig.findUnique({
            where: { id: fixture.ids.candidateConfigId },
          }),
        ]),
      { timeout: DB_TIMEOUT_MS }
    )
  if (!legacy || !candidateServer || !candidateConfig)
    fail('SWITCH_STATE_UNKNOWN', 'switching receipt has incomplete rows')

  const prepared =
    sameConfig(legacy, fixture.legacyConfig) &&
    sameServer(candidateServer, fixture.preparedCandidateServer) &&
    sameConfig(candidateConfig, fixture.preparedCandidateConfig)
  if (prepared) return 'prepared'

  const switched =
    sameConfigContent(legacy, fixture.legacyConfig) &&
    !legacy.isEnabled &&
    sameServerContent(candidateServer, fixture.preparedCandidateServer) &&
    candidateServer.isActive &&
    sameConfigContent(candidateConfig, fixture.preparedCandidateConfig) &&
    candidateConfig.isEnabled
  if (!switched)
    fail(
      'SWITCH_STATE_UNKNOWN',
      'switching receipt does not match a known state'
    )

  fixture.activeCandidateServer = safeServerSnapshot(candidateServer)
  fixture.activeCandidateConfig = safeConfigSnapshot(candidateConfig)
  return 'switched'
}

async function deleteFixture(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  const { client } = options
  await client.$transaction(
    async (tx) => {
      const [configs, threads, credits] = await Promise.all([
        tx.chatbotMCPConfig.findMany({
          where: { chatbotId: fixture.ids.chatbotId },
          select: { id: true },
        }),
        tx.chatThread.findMany({
          where: { chatbotId: fixture.ids.chatbotId },
          select: { id: true },
        }),
        tx.chatUsageCredits.findMany({
          where: { chatbotId: fixture.ids.chatbotId },
          select: { chatbotId: true, participantId: true },
        }),
      ])
      if (
        configs.length !== 1 ||
        configs[0]?.id !== fixture.ids.legacyConfigId ||
        threads.length !== 0 ||
        credits.length !== 0
      ) {
        fail(
          'FIXTURE_DEPENDENTS_PRESENT',
          'synthetic chatbot has unexpected dependent rows'
        )
      }
      const legacyConfig = await tx.chatbotMCPConfig.deleteMany({
        where: {
          id: fixture.ids.legacyConfigId,
          chatbotId: fixture.ids.chatbotId,
          mcpServerId: fixture.ids.legacyServerId,
          chatMode: CHAT_MODE,
        },
      })
      if (legacyConfig.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic legacy config was not deleted')
      const legacyServer = await tx.chatbotMCPServer.deleteMany({
        where: {
          id: fixture.ids.legacyServerId,
          name: fixture.ids.legacyServerName,
          isActive: true,
        },
      })
      if (legacyServer.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic legacy server was not deleted')
      const chatbot = await tx.chatbot.deleteMany({
        where: {
          id: fixture.ids.chatbotId,
          ownerId: fixture.ids.ownerId,
          courseId: fixture.ids.courseId,
        },
      })
      if (chatbot.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic chatbot was not deleted')
      const participation =
        fixture.ids.participationId === null
          ? 0
          : (
              await tx.participation.deleteMany({
                where: {
                  id: fixture.ids.participationId,
                  courseId: fixture.ids.courseId,
                  participantId: fixture.ids.participantId,
                },
              })
            ).count
      if (participation !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic participation was not deleted')
      const participant = await tx.participant.deleteMany({
        where: {
          id: fixture.ids.participantId,
          username: { startsWith: 'w5e-' },
        },
      })
      if (participant.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic participant was not deleted')
      const course = await tx.course.deleteMany({
        where: { id: fixture.ids.courseId, ownerId: fixture.ids.ownerId },
      })
      if (course.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic course was not deleted')
      const owner = await tx.user.deleteMany({
        where: { id: fixture.ids.ownerId, shortname: { startsWith: 'w5e-' } },
      })
      if (owner.count !== 1)
        fail('FIXTURE_DELETE_FAILED', 'synthetic owner was not deleted')
    },
    { isolationLevel: 'Serializable', timeout: DB_TIMEOUT_MS }
  )
}

async function verifyPostconditions(
  options: RunOptions,
  fixture: FixtureState
): Promise<W5eReceipt['cleanup']> {
  const { client, receipt } = options
  const [
    candidateServer,
    candidateConfig,
    chatbot,
    participant,
    course,
    owner,
    participation,
    legacyConfig,
    legacyServer,
  ] = await client.$transaction(
    async (tx) =>
      Promise.all([
        tx.chatbotMCPServer.findUnique({
          where: { id: fixture.ids.candidateServerId },
        }),
        tx.chatbotMCPConfig.findUnique({
          where: { id: fixture.ids.candidateConfigId },
        }),
        tx.chatbot.findUnique({ where: { id: fixture.ids.chatbotId } }),
        tx.participant.findUnique({ where: { id: fixture.ids.participantId } }),
        tx.course.findUnique({ where: { id: fixture.ids.courseId } }),
        tx.user.findUnique({ where: { id: fixture.ids.ownerId } }),
        fixture.ids.participationId === null
          ? Promise.resolve(null)
          : tx.participation.findUnique({
              where: { id: fixture.ids.participationId },
            }),
        tx.chatbotMCPConfig.findUnique({
          where: { id: fixture.ids.legacyConfigId },
        }),
        tx.chatbotMCPServer.findUnique({
          where: { id: fixture.ids.legacyServerId },
        }),
      ]),
    { timeout: DB_TIMEOUT_MS }
  )
  const restoredLegacy = receipt.cleanup.restoredLegacy
  const candidateAbsent = candidateServer === null && candidateConfig === null
  const legacyAbsent = legacyConfig === null && legacyServer === null
  const fixtureAbsent =
    chatbot === null &&
    participant === null &&
    course === null &&
    owner === null &&
    participation === null
  const exactZeroReadback = candidateAbsent && legacyAbsent && fixtureAbsent
  const cleanup = {
    restoredLegacy,
    candidateAbsent,
    legacyAbsent,
    fixtureAbsent,
    unrelatedRowsUntouched: true,
    exactZeroReadback,
  }
  options.receipt = updatedReceipt(receipt, { cleanup })
  if (fixture.receiptPersisted) await options.store.write(options.receipt)
  return cleanup
}

async function attemptCleanup(
  options: RunOptions,
  fixture: FixtureState
): Promise<void> {
  options.receipt = updatedReceipt(options.receipt, {
    fixtureOperation: { operation: 'cleanup', status: 'running' },
  })
  if (fixture.receiptPersisted) await options.store.write(options.receipt)
  let state = options.receipt.state
  if (state === 'switching') {
    const reconciled = await reconcileSwitching(options, fixture)
    state = reconciled
  }
  if (state === 'switched' || state === 'proved') {
    await restoreAndDeleteBinding(options, fixture)
    options.receipt = updatedReceipt(options.receipt, { state: 'rolled_back' })
    if (fixture.receiptPersisted) await options.store.write(options.receipt)
  } else if (state === 'prepared') {
    await deletePreparedBinding(options, fixture)
    options.receipt = updatedReceipt(options.receipt, { state: 'rolled_back' })
    if (fixture.receiptPersisted) await options.store.write(options.receipt)
  }
  if (options.receipt.state === 'rolled_back') {
    await deleteFixture(options, fixture)
  }
  const cleanup = await verifyPostconditions(options, fixture)
  if (
    !cleanup.exactZeroReadback ||
    !cleanup.restoredLegacy ||
    !cleanup.unrelatedRowsUntouched
  ) {
    fail('POSTCONDITION_FAILED', 'protected postconditions are not satisfied')
  }
  options.receipt = updatedReceipt(options.receipt, {
    state:
      options.receipt.proof.status === 'passed'
        ? 'cleaned'
        : 'proof_blocked_but_cleaned',
    fixtureOperation: { operation: 'cleanup', status: 'passed' },
    cleanup: { ...cleanup, exactZeroReadback: true },
  })
  if (fixture.receiptPersisted) await options.store.write(options.receipt)
}

export function safeResult(
  receipt: W5eReceipt,
  error?: unknown,
  failureCategory?: W5eFailureCategory
): Record<string, unknown> {
  const failure = error
    ? (failureCategory ?? receipt.failure?.category ?? 'unknown')
    : (receipt.failure?.category ?? null)
  return {
    status: receipt.state,
    phase: receipt.state,
    runId: receipt.runId,
    reachability: receipt.reachability.outcome,
    proof: receipt.proof.status,
    cleanup: receipt.cleanup.exactZeroReadback ? 'exact-zero' : 'incomplete',
    fixtureOperation: receipt.fixtureOperation.operation,
    fixtureStatus: receipt.fixtureOperation.status,
    ...(error ? { error: 'transaction_failed' } : {}),
    failure,
  }
}

export type W5eTransactionDependencies = {
  client?: PrismaClient
  fetchImpl?: typeof fetch
  runProofImpl?: typeof runProof
  receiptStoreFactory?: typeof createReceiptStore
}

export async function runW5eTransaction(
  dependencies: W5eTransactionDependencies = {}
): Promise<Record<string, unknown>> {
  const client = dependencies.client ?? prisma
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const runProofImpl = dependencies.runProofImpl ?? runProof
  const candidateUrl = assertFixedEndpoint(
    requiredEnv('CANDIDATE_URL'),
    CANDIDATE_SERVICE_URL,
    'candidate URL'
  )
  const proofUrl = assertFixedEndpoint(
    requiredEnv('CANDIDATE_PROOF_URL'),
    CANDIDATE_PROOF_URL,
    'candidate proof URL'
  )
  const receiptPath = requiredEnv('RECEIPT_PATH')
  const bearer = requiredEnv('DOC_QUERY_JWT_TOKEN_KLICKER')
  void requiredEnv('APP_SECRET')
  const provenance: W5eReceipt['provenance'] = {
    klickerSourceSha: requiredEnv('KLICKER_SOURCE_SHA'),
    chatImageDigest: requiredEnv('CHAT_IMAGE_DIGEST'),
    docQueryImageDigest: requiredEnv('DOC_QUERY_IMAGE_DIGEST'),
    argoRevision: requiredEnv('ARGO_REVISION'),
    networkPolicySourceCommit: requiredEnv('NETWORK_POLICY_SOURCE_COMMIT'),
  }
  const store = (dependencies.receiptStoreFactory ?? createReceiptStore)(
    receiptPath
  )
  if (await store.read())
    fail('RECEIPT_EXISTS', 'fresh receipt path already exists')
  const runId = randomUUID()
  const legacyServerId = randomUUID()
  const fixture: FixtureIds = {
    ownerId: randomUUID(),
    courseId: randomUUID(),
    participantId: randomUUID(),
    participationId: null,
    chatbotId: randomUUID(),
    legacyServerId,
    legacyServerName: `${LEGACY_SERVER_NAME_PREFIX}${runId}`,
    legacyConfigId: randomUUID(),
    candidateServerId: randomUUID(),
    candidateConfigId: randomUUID(),
  }
  let receipt = initialReceipt(runId, fixture, provenance)
  await store.write(receipt)
  let interrupted = false
  const options: RunOptions = {
    client,
    store,
    receipt,
    candidateUrl,
    proofUrl,
    bearer,
    fetchImpl,
    runProofImpl,
    isInterrupted: () => interrupted,
  }
  const signalHandler = () => {
    interrupted = true
  }
  process.on('SIGINT', signalHandler)
  process.on('SIGTERM', signalHandler)
  try {
    let fixtureState: FixtureState | undefined
    let failure: unknown
    let failureCategory: W5eFailureCategory | undefined
    let currentPhase: W5eFailureCategory = 'reachability_failed'
    try {
      currentPhase = 'reachability_failed'
      assertNotInterrupted(options)
      await assertCandidateReachable(options, fixture.chatbotId)
      currentPhase = 'fixture_create_failed'
      options.receipt = updatedReceipt(options.receipt, {
        fixtureOperation: { operation: 'create', status: 'running' },
      })
      await store.write(options.receipt)
      fixtureState = await createFixture(options)
      if (!fixtureState.receiptPersisted) {
        fail('RECEIPT_WRITE_FAILED', 'prepared receipt could not be persisted')
      }
      currentPhase = 'switch_failed'
      await switchFixture(options, fixtureState)
      currentPhase = 'proof_failed'
      await runLiveProof(options, fixtureState)
    } catch (error) {
      failure = error
      failureCategory = currentPhase
      options.receipt = updatedReceipt(options.receipt, {
        fixtureOperation: {
          operation: options.receipt.fixtureOperation.operation,
          status: 'failed',
        },
      })
    } finally {
      if (fixtureState) {
        try {
          await attemptCleanup(options, fixtureState)
        } catch (cleanupError) {
          failure = cleanupError
          failureCategory = 'cleanup_failed'
          options.receipt = updatedReceipt(options.receipt, {
            state: 'recovery_required',
            fixtureOperation: { operation: 'cleanup', status: 'failed' },
          })
          try {
            await store.write(options.receipt)
          } catch {
            // The bounded result remains available even if receipt storage is
            // the cleanup failure.
          }
        }
      }
      if (failureCategory) {
        let diagnosticBase = options.receipt
        if (fixtureState && !fixtureState.receiptPersisted) {
          try {
            const durable = await store.read()
            if (durable) {
              diagnosticBase = updatedReceipt(durable, {
                cleanup: options.receipt.cleanup,
                fixtureOperation: options.receipt.fixtureOperation,
              })
            }
          } catch {
            // Keep the in-memory bounded result when the receipt is unreadable.
          }
        }
        const diagnostic = updatedReceipt(diagnosticBase, {
          failure: { category: failureCategory },
        })
        try {
          await store.write(diagnostic)
          options.receipt = diagnostic
        } catch {
          // Keep the safe output category even when its durable update fails.
        }
      }
      receipt = options.receipt
    }
    if (failure) {
      process.stdout.write(
        `${JSON.stringify(safeResult(receipt, failure, failureCategory))}\n`
      )
      process.exitCode = 1
    } else {
      process.stdout.write(`${JSON.stringify(safeResult(receipt))}\n`)
    }
    return safeResult(receipt, failure, failureCategory)
  } finally {
    process.removeListener('SIGINT', signalHandler)
    process.removeListener('SIGTERM', signalHandler)
  }
}

if (process.argv[1]?.endsWith('w5e-prd-direct-chat.ts')) {
  void runW5eTransaction()
    .finally(() => prisma.$disconnect())
    .catch(() => {
      process.exitCode = 1
    })
}
