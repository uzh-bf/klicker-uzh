import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { importPKCS8, SignJWT } from 'jose'

const RECEIPT_VERSION = 2
const MANIFEST_VERSION = 2
const EXPECTED_KB_COUNT = 15
const EXPECTED_CHATBOT_COUNT = 21
const EXPECTED_EXCLUDED_CHATBOT_COUNT = 2
const EXPECTED_CORPUS_PROOF_COUNT = 15
const EXPECTED_DIRECT_CALL_COUNT = EXPECTED_CORPUS_PROOF_COUNT * 2
const COLLECTION = 'klicker_course_materials_v1'
const STG_ENDPOINT =
  'http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker/kb'
const TOOL_NAME = 'doc_query'
const SCOPE_HEADER = 'X-Doc-Query-Scope-Token'
const DEFAULT_DEADLINE_MS = 30 * 60 * 1000
const TERMINATION_GRACE_MS = 2_000
const WORKER_PATH = fileURLToPath(import.meta.url)
const DEFAULT_LOCK_PATH = resolve(
  homedir(),
  '.klicker-stg-doc-query-proof.lock'
)
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

function compareUtf16Strings(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const SECRET_ENV_NAMES = [
  'DOC_QUERY_SCOPE_PRIVATE_KEY',
  'DOC_QUERY_SCOPE_KID',
  'DOC_QUERY_SCOPE_ISSUER',
  'DOC_QUERY_SCOPE_AUDIENCE',
]

// macOS adds this non-secret marker to spawned processes even with an explicit
// environment allowlist. It is the only platform-added name accepted here.
const PLATFORM_ENV_NAMES = new Set(['__CF_USER_TEXT_ENCODING'])
const WORKER_CONTROL_ENV_NAMES = new Set([
  'DOC_QUERY_PROOF_PARENT_PID',
  'DOC_QUERY_PROOF_MANIFEST_PATH',
])
const WORKER_INTEGRITY_ENV_NAMES = new Set([
  'DOC_QUERY_PROOF_MANIFEST_FINGERPRINT',
])
const ALLOWED_WORKER_ENV_NAMES = new Set([
  ...SECRET_ENV_NAMES,
  ...WORKER_CONTROL_ENV_NAMES,
  ...WORKER_INTEGRITY_ENV_NAMES,
  ...PLATFORM_ENV_NAMES,
])

const PRESERVATION_FIELDS = [
  'databaseWrites',
  'configurationChanges',
  'bindingChanges',
  'clusterChanges',
  'productionActions',
  'retries',
]

const FAILURE_CLASSES = new Set([
  'none',
  'manifest_refused',
  'duplicate_refused',
  'credential_missing',
  'protocol_failed',
  'canary_positive_failed',
  'canary_isolation_failed',
  'positive_failed',
  'isolation_failed',
  'child_failed',
  'child_signaled',
  'timeout',
  'interrupted',
])

const DIAGNOSTIC_CLASSES = new Set([
  'none',
  'signer_setup',
  'scope_signing',
  'mcp_invocation',
  'worker_protocol',
  'unknown',
])

class ProofFailure extends Error {
  constructor(failureClass, caseId = null, diagnosticClass = 'none') {
    super(failureClass)
    this.name = 'ProofFailure'
    this.failureClass = failureClass
    this.caseId = caseId
    this.diagnosticClass = DIAGNOSTIC_CLASSES.has(diagnosticClass)
      ? diagnosticClass
      : 'unknown'
  }
}

async function withDiagnostic(operation, diagnosticClass) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ProofFailure) {
      throw new ProofFailure(
        error.failureClass,
        error.caseId,
        error.diagnosticClass === 'none'
          ? diagnosticClass
          : error.diagnosticClass
      )
    }
    throw new ProofFailure('protocol_failed', null, diagnosticClass)
  }
}

function requireString(value, pattern) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProofFailure('manifest_refused')
  }
  if (pattern && !pattern.test(value)) {
    throw new ProofFailure('manifest_refused')
  }
  return value
}

function requireUuid(value) {
  return requireString(value, UUID_PATTERN).toLowerCase()
}

function requireFingerprint(value) {
  return requireString(value, FINGERPRINT_PATTERN)
}

function requireMarkerList(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 8 ||
    value.some(
      (entry) =>
        typeof entry !== 'string' || entry.length === 0 || entry.length > 160
    )
  ) {
    throw new ProofFailure('manifest_refused')
  }
  return [...value]
}

function zeroPreservation() {
  return Object.fromEntries(PRESERVATION_FIELDS.map((name) => [name, 0]))
}

function hasExactZeroPreservation(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === PRESERVATION_FIELDS.length &&
    PRESERVATION_FIELDS.every((name) => value[name] === 0)
  )
}

function normalizeManifestForFingerprint(input) {
  return {
    version: input.version,
    environment: input.environment,
    collection: input.collection,
    singletonCanaryCaseId: input.singletonCanaryCaseId,
    cases: input.cases.map((entry) => ({
      id: entry.id,
      kbId: entry.kbId.toLowerCase(),
      chatbotIds: entry.chatbotIds.map((chatbotId) => chatbotId.toLowerCase()),
      positive: {
        question: entry.positive.question,
        expectAny: [...entry.positive.expectAny],
        minSources: entry.positive.minSources,
      },
      foreign: {
        question: entry.foreign.question,
        forbidReferences: [...entry.foreign.forbidReferences],
      },
    })),
    excludedChatbotIds: input.excludedChatbotIds.map((chatbotId) =>
      chatbotId.toLowerCase()
    ),
    activationManifestFingerprint: input.activationManifestFingerprint,
  }
}

export function computeManifestFingerprint(input) {
  return createHash('sha256')
    .update(JSON.stringify(normalizeManifestForFingerprint(input)), 'utf8')
    .digest('hex')
}

export function validateManifest(
  input,
  trustedFingerprint = process.env.DOC_QUERY_PROOF_MANIFEST_FINGERPRINT
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    input.version !== MANIFEST_VERSION ||
    input.environment !== 'stg' ||
    input.collection !== COLLECTION ||
    !Array.isArray(input.cases) ||
    input.cases.length !== EXPECTED_KB_COUNT ||
    !Array.isArray(input.excludedChatbotIds) ||
    input.excludedChatbotIds.length !== EXPECTED_EXCLUDED_CHATBOT_COUNT
  ) {
    throw new ProofFailure('manifest_refused')
  }

  const caseIds = new Set()
  const kbIds = new Set()
  const chatbotIds = new Set()
  const cases = input.cases.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ProofFailure('manifest_refused')
    }
    const id = requireString(entry.id, ID_PATTERN)
    const kbId = requireUuid(entry.kbId)
    if (caseIds.has(id) || kbIds.has(kbId)) {
      throw new ProofFailure('manifest_refused')
    }
    caseIds.add(id)
    kbIds.add(kbId)
    if (!Array.isArray(entry.chatbotIds) || entry.chatbotIds.length === 0) {
      throw new ProofFailure('manifest_refused')
    }
    const entryChatbots = entry.chatbotIds.map((chatbotId) => {
      const normalized = requireUuid(chatbotId)
      if (chatbotIds.has(normalized)) {
        throw new ProofFailure('manifest_refused')
      }
      chatbotIds.add(normalized)
      return normalized
    })
    const positive = entry.positive
    const foreign = entry.foreign
    if (
      !positive ||
      typeof positive !== 'object' ||
      !foreign ||
      typeof foreign !== 'object' ||
      Object.hasOwn(foreign, 'forbidAny')
    ) {
      throw new ProofFailure('manifest_refused')
    }
    const minSources = positive.minSources ?? 1
    if (!Number.isInteger(minSources) || minSources < 1 || minSources > 20) {
      throw new ProofFailure('manifest_refused')
    }
    return {
      id,
      kbId,
      chatbotIds: entryChatbots,
      positive: {
        question: requireString(positive.question),
        expectAny: requireMarkerList(positive.expectAny),
        minSources,
      },
      foreign: {
        question: requireString(foreign.question),
        forbidReferences: requireMarkerList(foreign.forbidReferences),
      },
    }
  })

  if (chatbotIds.size !== EXPECTED_CHATBOT_COUNT) {
    throw new ProofFailure('manifest_refused')
  }
  const excludedChatbotIds = input.excludedChatbotIds.map(requireUuid)
  if (
    new Set(excludedChatbotIds).size !== EXPECTED_EXCLUDED_CHATBOT_COUNT ||
    excludedChatbotIds.some((chatbotId) => chatbotIds.has(chatbotId))
  ) {
    throw new ProofFailure('manifest_refused')
  }
  const canaryCaseId = requireString(input.singletonCanaryCaseId, ID_PATTERN)
  if (cases[0].id !== canaryCaseId || cases[0].chatbotIds.length !== 1) {
    throw new ProofFailure('manifest_refused')
  }

  const activationManifestFingerprint = requireFingerprint(
    input.activationManifestFingerprint
  )
  const manifestFingerprint = requireFingerprint(input.manifestFingerprint)
  const normalizedManifest = {
    version: MANIFEST_VERSION,
    environment: 'stg',
    collection: COLLECTION,
    singletonCanaryCaseId: canaryCaseId,
    cases,
    excludedChatbotIds,
    activationManifestFingerprint,
  }
  const recomputedFingerprint = computeManifestFingerprint(normalizedManifest)
  if (
    manifestFingerprint !== recomputedFingerprint ||
    manifestFingerprint !== requireFingerprint(trustedFingerprint)
  ) {
    throw new ProofFailure('manifest_refused')
  }

  return {
    ...normalizedManifest,
    manifestFingerprint,
  }
}

function emptyReceipt() {
  return {
    receiptVersion: RECEIPT_VERSION,
    environment: 'stg',
    collection: COLLECTION,
    phase: 'preflight',
    result: 'failed',
    failureClass: 'none',
    diagnosticClass: 'none',
    failedCaseId: null,
    counts: {
      kbExpected: EXPECTED_KB_COUNT,
      kbPassed: 0,
      chatbotsInScope: EXPECTED_CHATBOT_COUNT,
      representativeChatbotsExpected: EXPECTED_CORPUS_PROOF_COUNT,
      representativeChatbotsPassed: 0,
      excludedExpected: EXPECTED_EXCLUDED_CHATBOT_COUNT,
      positivePassed: 0,
      isolationPassed: 0,
      directCallsAttempted: 0,
    },
    preservation: zeroPreservation(),
  }
}

function fixedFailureReceipt(
  failureClass,
  caseId = null,
  diagnosticClass = 'none'
) {
  const receipt = emptyReceipt()
  receipt.failureClass = FAILURE_CLASSES.has(failureClass)
    ? failureClass
    : 'protocol_failed'
  receipt.failedCaseId = ID_PATTERN.test(caseId ?? '') ? caseId : null
  receipt.diagnosticClass = DIAGNOSTIC_CLASSES.has(diagnosticClass)
    ? diagnosticClass
    : 'unknown'
  return receipt
}

function workerProtocolFailureReceipt(failureClass = 'protocol_failed') {
  return fixedFailureReceipt(failureClass, null, 'worker_protocol')
}

function extractDocuments(result, kbId) {
  if (
    !result ||
    typeof result !== 'object' ||
    result.isError === true ||
    !Array.isArray(result.content)
  ) {
    return null
  }
  const payloads =
    result.structuredContent === undefined
      ? result.content
          .filter((block) => block?.type === 'text')
          .map((block) => block.text)
      : [result.structuredContent]
  for (const payload of payloads) {
    try {
      const envelope =
        typeof payload === 'string' ? JSON.parse(payload) : payload
      const parsed =
        typeof envelope?.result === 'string'
          ? JSON.parse(envelope.result)
          : envelope
      if (parsed?.mode !== 'documents') continue
      if (
        !Array.isArray(parsed.sources) ||
        parsed.summary?.sources_returned !== parsed.sources.length ||
        !parsed.sources.every((source) => source?.kb_id === kbId)
      )
        return null
      return parsed
    } catch {
      // A non-JSON block is not proof and is never surfaced.
    }
  }
  return null
}

function documentHaystack(documents) {
  return documents.sources
    .flatMap((source) => [
      typeof source?.reference === 'string' ? source.reference : '',
      ...(Array.isArray(source?.chunks)
        ? source.chunks.map((chunk) =>
            typeof chunk?.content === 'string' ? chunk.content : ''
          )
        : []),
    ])
    .join('\n')
    .toLowerCase()
}

function hasAnyDocumentMarker(documents, markers) {
  const haystack = documentHaystack(documents)
  return markers.some((marker) => haystack.includes(marker.toLowerCase()))
}

function hasAnyReferenceMarker(documents, markers) {
  const references = documents.sources
    .map((source) =>
      typeof source?.reference === 'string'
        ? source.reference.toLowerCase()
        : ''
    )
    .filter(Boolean)
  return markers.some((marker) => {
    const normalized = marker.toLowerCase()
    return references.some((reference) => reference.includes(normalized))
  })
}

async function createScopeSigner(environment) {
  let privateKey
  try {
    privateKey = await importPKCS8(
      environment.DOC_QUERY_SCOPE_PRIVATE_KEY.replaceAll(String.raw`\n`, '\n'),
      'ES256'
    )
  } catch {
    throw new ProofFailure('credential_missing')
  }
  return async ({ kbId, chatbotId, sessionId }) => {
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({ kb_id: kbId, chatbot_id: chatbotId })
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: environment.DOC_QUERY_SCOPE_KID,
      })
      .setIssuer(environment.DOC_QUERY_SCOPE_ISSUER)
      .setAudience(environment.DOC_QUERY_SCOPE_AUDIENCE)
      .setSubject(sessionId)
      .setJti(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey)
  }
}

export function createMcpTransport(
  mintScopeToken,
  Transport = StreamableHTTPClientTransport
) {
  const target = new URL(STG_ENDPOINT)
  const scopedFetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url !== target.href) throw new ProofFailure('protocol_failed')
    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    headers.delete('authorization')
    headers.set(SCOPE_HEADER, `Bearer ${await mintScopeToken()}`)
    return fetch(input, { ...init, headers, redirect: 'error' })
  }
  return new Transport(target, {
    requestInit: { redirect: 'error' },
    fetch: scopedFetch,
    reconnectionOptions: {
      initialReconnectionDelay: 1_000,
      maxReconnectionDelay: 30_000,
      reconnectionDelayGrowFactor: 1.5,
      maxRetries: 0,
    },
  })
}

async function invokeMcp({ mintScopeToken, question }) {
  const client = new Client({
    name: 'klicker-stg-doc-query-proof',
    version: '1',
  })
  const transport = createMcpTransport(mintScopeToken)
  try {
    await client.connect(transport)
    return await client.callTool({
      name: TOOL_NAME,
      arguments: { question },
    })
  } finally {
    await client.close().catch(() => undefined)
  }
}

async function provePositive(invoke, signer, proofCase, chatbotId) {
  const sessionId = randomUUID()
  const result = await invoke({
    mintScopeToken: () =>
      signer({ kbId: proofCase.kbId, chatbotId, sessionId }),
    question: proofCase.positive.question,
  })
  const documents = extractDocuments(result, proofCase.kbId)
  return Boolean(
    documents?.summary.sources_returned >= proofCase.positive.minSources &&
      hasAnyDocumentMarker(documents, proofCase.positive.expectAny)
  )
}

async function proveIsolation(invoke, signer, proofCase, chatbotId) {
  const sessionId = randomUUID()
  const result = await invoke({
    mintScopeToken: () =>
      signer({ kbId: proofCase.kbId, chatbotId, sessionId }),
    question: proofCase.foreign.question,
  })
  const documents = extractDocuments(result, proofCase.kbId)
  return Boolean(
    documents?.sources &&
      !hasAnyReferenceMarker(documents, proofCase.foreign.forbidReferences)
  )
}

function recordPositivePass(receipt) {
  receipt.counts.positivePassed += 1
}

function recordCompletedCase(receipt) {
  receipt.counts.isolationPassed += 1
  receipt.counts.representativeChatbotsPassed += 1
  receipt.counts.kbPassed += 1
}

async function runCanaryProof(invoke, signer, manifest, receipt) {
  const canary = manifest.cases[0]
  const canaryChatbotId = canary.chatbotIds[0]
  receipt.phase = 'canary'

  if (!(await provePositive(invoke, signer, canary, canaryChatbotId))) {
    throw new ProofFailure('canary_positive_failed', canary.id)
  }
  recordPositivePass(receipt)
  if (!(await proveIsolation(invoke, signer, canary, canaryChatbotId))) {
    throw new ProofFailure('canary_isolation_failed', canary.id)
  }
  recordCompletedCase(receipt)
}

async function runSerialProof(invoke, signer, manifest, receipt) {
  receipt.phase = 'matrix'
  for (const proofCase of manifest.cases.slice(1)) {
    const representativeChatbotId = [...proofCase.chatbotIds]
      .sort(compareUtf16Strings)
      .at(-1)
    if (
      !(await provePositive(invoke, signer, proofCase, representativeChatbotId))
    ) {
      throw new ProofFailure('positive_failed', proofCase.id)
    }
    recordPositivePass(receipt)
    if (
      !(await proveIsolation(
        invoke,
        signer,
        proofCase,
        representativeChatbotId
      ))
    ) {
      throw new ProofFailure('isolation_failed', proofCase.id)
    }
    recordCompletedCase(receipt)
  }
}

export async function runProofMatrix({
  manifest,
  environment,
  invoke = invokeMcp,
  createSigner = createScopeSigner,
}) {
  const receipt = emptyReceipt()
  try {
    const invokeWithCap = async (request) => {
      receipt.counts.directCallsAttempted += 1
      if (receipt.counts.directCallsAttempted > EXPECTED_DIRECT_CALL_COUNT) {
        throw new ProofFailure('protocol_failed')
      }
      return withDiagnostic(() => invoke(request), 'mcp_invocation')
    }
    const rawSigner = await withDiagnostic(
      () => createSigner(environment),
      'signer_setup'
    )
    const signer = (request) =>
      withDiagnostic(() => rawSigner(request), 'scope_signing')
    await runCanaryProof(invokeWithCap, signer, manifest, receipt)
    await runSerialProof(invokeWithCap, signer, manifest, receipt)

    receipt.phase = 'complete'
    receipt.result = 'passed'
    receipt.failureClass = 'none'
    receipt.diagnosticClass = 'none'
    return receipt
  } catch (error) {
    const failure =
      error instanceof ProofFailure
        ? error
        : new ProofFailure('protocol_failed', null, 'unknown')
    receipt.result = 'failed'
    receipt.failureClass = failure.failureClass
    receipt.diagnosticClass = failure.diagnosticClass
    receipt.failedCaseId = failure.caseId
    return receipt
  }
}

function requiredWorkerEnvironment(source) {
  const environment = {}
  for (const name of SECRET_ENV_NAMES) {
    const value = source[name]
    if (typeof value !== 'string' || value.length === 0) {
      throw new ProofFailure('credential_missing')
    }
    environment[name] = value
  }
  const manifestPath = source.DOC_QUERY_PROOF_MANIFEST_PATH
  if (typeof manifestPath !== 'string' || !isAbsolute(manifestPath)) {
    throw new ProofFailure('manifest_refused')
  }
  environment.DOC_QUERY_PROOF_MANIFEST_PATH = manifestPath
  environment.DOC_QUERY_PROOF_MANIFEST_FINGERPRINT = requireFingerprint(
    source.DOC_QUERY_PROOF_MANIFEST_FINGERPRINT
  )
  return environment
}

export function validateWorkerEnvironment(source) {
  for (const name of Object.keys(source)) {
    if (!ALLOWED_WORKER_ENV_NAMES.has(name)) {
      throw new ProofFailure('protocol_failed')
    }
  }
}

export function minimalChildEnvironment(source, parentPid) {
  return {
    ...requiredWorkerEnvironment(source),
    DOC_QUERY_PROOF_PARENT_PID: String(parentPid),
  }
}

async function readManifest(path, trustedFingerprint) {
  let raw
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new ProofFailure('manifest_refused')
  }
  try {
    return validateManifest(JSON.parse(raw), trustedFingerprint)
  } catch (error) {
    if (error instanceof ProofFailure) throw error
    throw new ProofFailure('manifest_refused')
  }
}

function sanitizeReceipt(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    value.receiptVersion !== RECEIPT_VERSION ||
    value.environment !== 'stg' ||
    value.collection !== COLLECTION ||
    !['preflight', 'canary', 'matrix', 'complete'].includes(value.phase) ||
    !['passed', 'failed'].includes(value.result) ||
    !FAILURE_CLASSES.has(value.failureClass) ||
    !DIAGNOSTIC_CLASSES.has(value.diagnosticClass)
  ) {
    return workerProtocolFailureReceipt()
  }
  if (!hasExactZeroPreservation(value.preservation)) {
    return workerProtocolFailureReceipt()
  }
  if (value.result === 'failed' && value.failureClass === 'none') {
    return workerProtocolFailureReceipt()
  }
  if (
    value.result === 'passed' &&
    (value.phase !== 'complete' ||
      value.failureClass !== 'none' ||
      value.diagnosticClass !== 'none' ||
      value.failedCaseId !== null ||
      value.counts?.kbExpected !== EXPECTED_KB_COUNT ||
      value.counts?.kbPassed !== EXPECTED_KB_COUNT ||
      value.counts?.chatbotsInScope !== EXPECTED_CHATBOT_COUNT ||
      value.counts?.representativeChatbotsExpected !==
        EXPECTED_CORPUS_PROOF_COUNT ||
      value.counts?.representativeChatbotsPassed !==
        EXPECTED_CORPUS_PROOF_COUNT ||
      value.counts?.excludedExpected !== EXPECTED_EXCLUDED_CHATBOT_COUNT ||
      value.counts?.positivePassed !== EXPECTED_CORPUS_PROOF_COUNT ||
      value.counts?.isolationPassed !== EXPECTED_CORPUS_PROOF_COUNT ||
      value.counts?.directCallsAttempted !== EXPECTED_DIRECT_CALL_COUNT)
  ) {
    return workerProtocolFailureReceipt()
  }
  const receipt = emptyReceipt()
  receipt.phase = value.phase
  receipt.result = value.result
  receipt.failureClass = value.failureClass
  receipt.diagnosticClass = value.diagnosticClass
  receipt.failedCaseId = ID_PATTERN.test(value.failedCaseId ?? '')
    ? value.failedCaseId
    : null
  for (const key of Object.keys(receipt.counts)) {
    const count = value.counts?.[key]
    receipt.counts[key] = Number.isInteger(count)
      ? Math.max(0, Math.min(count, 100))
      : receipt.counts[key]
  }
  return receipt
}

function killProcessGroup(child, signal) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    try {
      child.kill(signal)
    } catch {
      // The process already exited.
    }
  }
}

function isDatabaseLockError(error) {
  return (
    typeof error?.message === 'string' &&
    error.message.includes('database is locked')
  )
}

function lockGuardPath(path) {
  return `${path}.guard.sqlite`
}

async function acquireLock(path) {
  let database
  const marker = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_APPEND |
      constants.O_NOFOLLOW,
    0o600
  )
  try {
    database = new DatabaseSync(lockGuardPath(path), { timeout: 0 })
    database.exec('BEGIN EXCLUSIVE')
    return {
      // Keep the exclusive transaction open for the complete supervised
      // proof. The guard database and marker are persistent and never unlinked
      // during cleanup, so an old owner cannot remove a replacement marker.
      close: async () => {
        try {
          database.exec('ROLLBACK')
        } finally {
          database.close()
        }
      },
    }
  } catch (error) {
    try {
      database?.close()
    } catch {
      // The connection may not have opened.
    }
    if (isDatabaseLockError(error)) return null
    throw error
  } finally {
    await marker.close()
  }
}

export async function superviseProof({
  sourceEnvironment = process.env,
  childPath = WORKER_PATH,
  childArgs = ['--worker'],
  deadlineMs = DEFAULT_DEADLINE_MS,
  lockPath = DEFAULT_LOCK_PATH,
  installSignalHandlers = false,
  acquireLockForProof = acquireLock,
  spawnForProof = spawn,
}) {
  const startedAt = Date.now()
  let lock
  try {
    lock = await acquireLockForProof(lockPath)
  } catch (error) {
    const failureClass =
      error instanceof ProofFailure ? error.failureClass : 'child_failed'
    return {
      ...fixedFailureReceipt(failureClass),
      exitCode: null,
      signal: null,
      elapsedMs: Math.min(Date.now() - startedAt, DEFAULT_DEADLINE_MS + 5_000),
    }
  }
  if (!lock) {
    return {
      ...fixedFailureReceipt('duplicate_refused'),
      exitCode: null,
      signal: null,
      elapsedMs: 0,
    }
  }
  let child
  let interrupted = false
  let timedOut = false
  let message = null
  let forceTimer
  const signalHandlers = new Map()

  try {
    const environment = minimalChildEnvironment(sourceEnvironment, process.pid)
    child = spawnForProof(
      process.execPath,
      [resolve(childPath), ...childArgs],
      {
        detached: true,
        env: environment,
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      }
    )
    child.on('message', (candidate) => {
      if (message === null) message = sanitizeReceipt(candidate)
    })

    const terminateChildGroup = () => {
      killProcessGroup(child, 'SIGTERM')
      if (forceTimer) return
      forceTimer = setTimeout(
        () => killProcessGroup(child, 'SIGKILL'),
        TERMINATION_GRACE_MS
      )
      forceTimer.unref()
    }

    if (installSignalHandlers) {
      for (const signal of ['SIGINT', 'SIGHUP', 'SIGTERM']) {
        const handler = () => {
          interrupted = true
          terminateChildGroup()
        }
        signalHandlers.set(signal, handler)
        process.once(signal, handler)
      }
    }

    const deadlineTimer = setTimeout(() => {
      timedOut = true
      terminateChildGroup()
    }, deadlineMs)
    deadlineTimer.unref()

    const close = await new Promise((resolveClose) => {
      let settled = false
      const settle = (code, signal) => {
        if (settled) return
        settled = true
        resolveClose({ code, signal })
      }
      child.once('error', () => settle(null, null))
      child.once('close', settle)
    })
    clearTimeout(deadlineTimer)

    let receipt = message ?? workerProtocolFailureReceipt()
    if (timedOut) receipt = fixedFailureReceipt('timeout')
    else if (interrupted) receipt = fixedFailureReceipt('interrupted')
    else if (close.signal) receipt = fixedFailureReceipt('child_signaled')
    else if (close.code === 0) {
      if (message?.result !== 'passed') {
        receipt = workerProtocolFailureReceipt('child_failed')
      }
    } else if (
      !Number.isInteger(close.code) ||
      close.code <= 0 ||
      message === null ||
      message.result === 'passed'
    ) {
      receipt = workerProtocolFailureReceipt('child_failed')
    }

    return {
      ...receipt,
      exitCode:
        Number.isInteger(close.code) && close.code >= 0 && close.code <= 255
          ? close.code
          : null,
      signal:
        typeof close.signal === 'string' && close.signal.length <= 16
          ? close.signal
          : null,
      elapsedMs: Math.min(Date.now() - startedAt, DEFAULT_DEADLINE_MS + 5_000),
    }
  } catch (error) {
    const failureClass =
      error instanceof ProofFailure ? error.failureClass : 'child_failed'
    return {
      ...fixedFailureReceipt(failureClass),
      exitCode: null,
      signal: null,
      elapsedMs: Math.min(Date.now() - startedAt, DEFAULT_DEADLINE_MS + 5_000),
    }
  } finally {
    if (forceTimer) clearTimeout(forceTimer)
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler)
    }
    await lock.close().catch(() => undefined)
  }
}

function sendWorkerReceipt(receipt, exitCode) {
  if (typeof process.send !== 'function') process.exit(exitCode)
  process.send(receipt, () => process.exit(exitCode))
}

async function workerMain() {
  const expectedParentPid = Number(process.env.DOC_QUERY_PROOF_PARENT_PID)
  const parentWatch = setInterval(() => {
    if (
      !Number.isInteger(expectedParentPid) ||
      process.ppid !== expectedParentPid
    ) {
      process.exit(1)
    }
  }, 250)
  parentWatch.unref()

  for (const signal of ['SIGINT', 'SIGHUP', 'SIGTERM']) {
    process.once(signal, () => process.exit(1))
  }

  try {
    validateWorkerEnvironment(process.env)
    const environment = requiredWorkerEnvironment(process.env)
    const manifest = await readManifest(
      environment.DOC_QUERY_PROOF_MANIFEST_PATH,
      environment.DOC_QUERY_PROOF_MANIFEST_FINGERPRINT
    )
    const receipt = await runProofMatrix({ manifest, environment })
    sendWorkerReceipt(receipt, receipt.result === 'passed' ? 0 : 1)
  } catch (error) {
    const receipt =
      error instanceof ProofFailure
        ? fixedFailureReceipt(error.failureClass, error.caseId)
        : fixedFailureReceipt('protocol_failed')
    sendWorkerReceipt(receipt, 1)
  }
}

async function launcherMain() {
  const receipt = await superviseProof({ installSignalHandlers: true })
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
  process.exitCode = receipt.result === 'passed' ? 0 : 1
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href ===
    pathToFileURL(WORKER_PATH).href

if (isMain) {
  if (process.argv[2] === '--worker') await workerMain()
  else await launcherMain()
}
