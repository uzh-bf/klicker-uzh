import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { open, readFile, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { generateKeyPair, importPKCS8, SignJWT } from 'jose'

const RECEIPT_VERSION = 1
const MANIFEST_VERSION = 1
const EXPECTED_KB_COUNT = 15
const EXPECTED_CHATBOT_COUNT = 21
const EXPECTED_EXCLUDED_CHATBOT_COUNT = 2
const COLLECTION = 'klicker_course_materials_v1'
const STG_ENDPOINT =
  'http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker'
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

const SECRET_ENV_NAMES = [
  'DOC_QUERY_JWT_TOKEN_KLICKER',
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
const ALLOWED_WORKER_ENV_NAMES = new Set([
  ...SECRET_ENV_NAMES,
  ...WORKER_CONTROL_ENV_NAMES,
  ...PLATFORM_ENV_NAMES,
])

const REJECTION_CLASSES = [
  'missing',
  'expired',
  'forged',
  'wrong_issuer',
  'wrong_audience',
  'unknown_key',
  'trusted_filter_override',
]

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
  'rejection_failed',
  'positive_failed',
  'isolation_failed',
  'child_failed',
  'child_signaled',
  'timeout',
  'interrupted',
])

class ProofFailure extends Error {
  constructor(failureClass, caseId = null, rejectionClass = null) {
    super(failureClass)
    this.name = 'ProofFailure'
    this.failureClass = failureClass
    this.caseId = caseId
    this.rejectionClass = rejectionClass
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
  return requireString(value, UUID_PATTERN).toLocaleLowerCase('en')
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

export function validateManifest(input) {
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

  return {
    version: MANIFEST_VERSION,
    environment: 'stg',
    collection: COLLECTION,
    singletonCanaryCaseId: canaryCaseId,
    cases,
    excludedChatbotIds,
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
    failedCaseId: null,
    failedRejectionClass: null,
    counts: {
      kbExpected: EXPECTED_KB_COUNT,
      kbPassed: 0,
      chatbotsExpected: EXPECTED_CHATBOT_COUNT,
      chatbotsPassed: 0,
      excludedExpected: EXPECTED_EXCLUDED_CHATBOT_COUNT,
      positivePassed: 0,
      isolationPassed: 0,
      rejectionsPassed: 0,
    },
    rejections: Object.fromEntries(
      REJECTION_CLASSES.map((name) => [name, 'not_run'])
    ),
    preservation: zeroPreservation(),
  }
}

function fixedFailureReceipt(
  failureClass,
  caseId = null,
  rejectionClass = null
) {
  const receipt = emptyReceipt()
  receipt.failureClass = FAILURE_CLASSES.has(failureClass)
    ? failureClass
    : 'protocol_failed'
  receipt.failedCaseId = ID_PATTERN.test(caseId ?? '') ? caseId : null
  receipt.failedRejectionClass = REJECTION_CLASSES.includes(rejectionClass)
    ? rejectionClass
    : null
  return receipt
}

function extractDocuments(result) {
  if (
    !result ||
    typeof result !== 'object' ||
    result.isError === true ||
    !Array.isArray(result.content)
  ) {
    return null
  }
  for (const block of result.content) {
    if (block?.type !== 'text' || typeof block.text !== 'string') {
      continue
    }
    try {
      const parsed = JSON.parse(block.text)
      if (
        parsed?.mode === 'documents' &&
        Array.isArray(parsed.sources) &&
        Number.isInteger(parsed?.summary?.sources_returned)
      ) {
        return parsed
      }
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
    .toLocaleLowerCase('en')
}

function hasAnyDocumentMarker(documents, markers) {
  const haystack = documentHaystack(documents)
  return markers.some((marker) =>
    haystack.includes(marker.toLocaleLowerCase('en'))
  )
}

function hasAnyReferenceMarker(documents, markers) {
  const references = documents.sources
    .map((source) =>
      typeof source?.reference === 'string'
        ? source.reference.toLocaleLowerCase('en')
        : ''
    )
    .filter(Boolean)
  return markers.some((marker) => {
    const normalized = marker.toLocaleLowerCase('en')
    return references.some((reference) => reference.includes(normalized))
  })
}

function isRejected(result) {
  if (!result || typeof result !== 'object') return false
  if (result.isError === true) return true
  if (!Array.isArray(result.content)) return false
  return result.content.some((block) => {
    if (block?.type !== 'text' || typeof block.text !== 'string') {
      return false
    }
    try {
      const parsed = JSON.parse(block.text)
      return Boolean(parsed?.error)
    } catch {
      return /unauthorized|invalid token|invalid arguments/i.test(block.text)
    }
  })
}

async function createScopeSigner(environment) {
  let privateKey
  try {
    privateKey = await importPKCS8(
      environment.DOC_QUERY_SCOPE_PRIVATE_KEY.replaceAll('\\n', '\n'),
      'ES256'
    )
  } catch {
    throw new ProofFailure('credential_missing')
  }
  const rogueKey = (await generateKeyPair('ES256')).privateKey

  return async ({ kbId, chatbotId, variant = 'valid' }) => {
    const now = Math.floor(Date.now() / 1000)
    const issuer =
      variant === 'wrong_issuer'
        ? 'urn:klicker:doc-query-proof:rejected-issuer'
        : environment.DOC_QUERY_SCOPE_ISSUER
    const audience =
      variant === 'wrong_audience'
        ? 'urn:klicker:doc-query-proof:rejected-audience'
        : environment.DOC_QUERY_SCOPE_AUDIENCE
    const kid =
      variant === 'unknown_key'
        ? 'klicker-doc-query-proof-unknown-key'
        : environment.DOC_QUERY_SCOPE_KID
    const signingKey = variant === 'forged' ? rogueKey : privateKey
    const issuedAt = variant === 'expired' ? now - 7_200 : now
    const expiresAt = variant === 'expired' ? now - 3_600 : now + 300

    return new SignJWT({ kb_id: kbId, chatbot_id: chatbotId })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(randomUUID())
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(signingKey)
  }
}

export function createMcpTransport(
  headers,
  Transport = StreamableHTTPClientTransport
) {
  return new Transport(new URL(STG_ENDPOINT), {
    requestInit: { headers, redirect: 'error' },
    reconnectionOptions: {
      initialReconnectionDelay: 1_000,
      maxReconnectionDelay: 30_000,
      reconnectionDelayGrowFactor: 1.5,
      maxRetries: 0,
    },
  })
}

async function invokeMcp({ bearer, scopeToken, question, override }) {
  const headers = { authorization: `Bearer ${bearer}` }
  if (scopeToken) headers[SCOPE_HEADER] = `Bearer ${scopeToken}`
  const client = new Client({
    name: 'klicker-stg-doc-query-proof',
    version: '1',
  })
  const transport = createMcpTransport(headers)
  try {
    await client.connect(transport)
    return await client.callTool({
      name: TOOL_NAME,
      arguments: override
        ? {
            question,
            metadata_filters: { resource_active: false, kb_id: override },
          }
        : { question },
    })
  } finally {
    await client.close().catch(() => undefined)
  }
}

async function provePositive(
  invoke,
  signer,
  environment,
  proofCase,
  chatbotId
) {
  const token = await signer({ kbId: proofCase.kbId, chatbotId })
  const result = await invoke({
    bearer: environment.DOC_QUERY_JWT_TOKEN_KLICKER,
    scopeToken: token,
    question: proofCase.positive.question,
  })
  const documents = extractDocuments(result)
  return Boolean(
    documents &&
      documents.summary.sources_returned >= proofCase.positive.minSources &&
      hasAnyDocumentMarker(documents, proofCase.positive.expectAny)
  )
}

async function proveIsolation(
  invoke,
  signer,
  environment,
  proofCase,
  chatbotId
) {
  const token = await signer({ kbId: proofCase.kbId, chatbotId })
  const result = await invoke({
    bearer: environment.DOC_QUERY_JWT_TOKEN_KLICKER,
    scopeToken: token,
    question: proofCase.foreign.question,
  })
  const documents = extractDocuments(result)
  return Boolean(
    documents &&
      !hasAnyReferenceMarker(documents, proofCase.foreign.forbidReferences)
  )
}

async function proveRejections(
  invoke,
  signer,
  environment,
  proofCase,
  chatbotId,
  foreignKbId,
  receipt
) {
  const variants = [
    ['missing', null],
    ['expired', 'expired'],
    ['forged', 'forged'],
    ['wrong_issuer', 'wrong_issuer'],
    ['wrong_audience', 'wrong_audience'],
    ['unknown_key', 'unknown_key'],
  ]

  for (const [rejectionClass, variant] of variants) {
    const scopeToken = variant
      ? await signer({ kbId: proofCase.kbId, chatbotId, variant })
      : undefined
    const result = await invoke({
      bearer: environment.DOC_QUERY_JWT_TOKEN_KLICKER,
      scopeToken,
      question: proofCase.positive.question,
    })
    if (!isRejected(result)) {
      throw new ProofFailure('rejection_failed', proofCase.id, rejectionClass)
    }
    receipt.rejections[rejectionClass] = 'passed'
    receipt.counts.rejectionsPassed += 1
  }

  const validToken = await signer({ kbId: proofCase.kbId, chatbotId })
  const overrideResult = await invoke({
    bearer: environment.DOC_QUERY_JWT_TOKEN_KLICKER,
    scopeToken: validToken,
    question: proofCase.positive.question,
    override: foreignKbId,
  })
  if (!isRejected(overrideResult)) {
    throw new ProofFailure(
      'rejection_failed',
      proofCase.id,
      'trusted_filter_override'
    )
  }
  receipt.rejections.trusted_filter_override = 'passed'
  receipt.counts.rejectionsPassed += 1
}

export async function runProofMatrix({
  manifest,
  environment,
  invoke = invokeMcp,
}) {
  const receipt = emptyReceipt()
  try {
    const signer = await createScopeSigner(environment)
    const canary = manifest.cases[0]
    const canaryChatbotId = canary.chatbotIds[0]
    receipt.phase = 'canary'

    if (
      !(await provePositive(
        invoke,
        signer,
        environment,
        canary,
        canaryChatbotId
      ))
    ) {
      throw new ProofFailure('canary_positive_failed', canary.id)
    }
    receipt.counts.positivePassed += 1
    if (
      !(await proveIsolation(
        invoke,
        signer,
        environment,
        canary,
        canaryChatbotId
      ))
    ) {
      throw new ProofFailure('canary_isolation_failed', canary.id)
    }
    receipt.counts.isolationPassed += 1
    receipt.counts.chatbotsPassed += 1

    receipt.phase = 'rejections'
    await proveRejections(
      invoke,
      signer,
      environment,
      canary,
      canaryChatbotId,
      manifest.cases[1].kbId,
      receipt
    )

    receipt.phase = 'matrix'
    for (const proofCase of manifest.cases) {
      for (const chatbotId of proofCase.chatbotIds) {
        if (proofCase === canary && chatbotId === canaryChatbotId) continue
        if (
          !(await provePositive(
            invoke,
            signer,
            environment,
            proofCase,
            chatbotId
          ))
        ) {
          throw new ProofFailure('positive_failed', proofCase.id)
        }
        receipt.counts.positivePassed += 1
        if (
          !(await proveIsolation(
            invoke,
            signer,
            environment,
            proofCase,
            chatbotId
          ))
        ) {
          throw new ProofFailure('isolation_failed', proofCase.id)
        }
        receipt.counts.isolationPassed += 1
        receipt.counts.chatbotsPassed += 1
      }
      receipt.counts.kbPassed += 1
    }

    receipt.phase = 'complete'
    receipt.result = 'passed'
    receipt.failureClass = 'none'
    return receipt
  } catch (error) {
    const failure =
      error instanceof ProofFailure
        ? error
        : new ProofFailure('protocol_failed')
    receipt.result = 'failed'
    receipt.failureClass = failure.failureClass
    receipt.failedCaseId = failure.caseId
    receipt.failedRejectionClass = failure.rejectionClass
    if (failure.rejectionClass) {
      receipt.rejections[failure.rejectionClass] = 'failed'
    }
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

async function readManifest(path) {
  let raw
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new ProofFailure('manifest_refused')
  }
  try {
    return validateManifest(JSON.parse(raw))
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
    !['preflight', 'canary', 'rejections', 'matrix', 'complete'].includes(
      value.phase
    ) ||
    !['passed', 'failed'].includes(value.result) ||
    !FAILURE_CLASSES.has(value.failureClass)
  ) {
    return fixedFailureReceipt('protocol_failed')
  }
  if (value.result === 'failed' && value.failureClass === 'none') {
    return fixedFailureReceipt('protocol_failed')
  }
  if (
    value.result === 'passed' &&
    (value.phase !== 'complete' ||
      value.failureClass !== 'none' ||
      value.failedCaseId !== null ||
      value.failedRejectionClass !== null ||
      value.counts?.kbExpected !== EXPECTED_KB_COUNT ||
      value.counts?.kbPassed !== EXPECTED_KB_COUNT ||
      value.counts?.chatbotsExpected !== EXPECTED_CHATBOT_COUNT ||
      value.counts?.chatbotsPassed !== EXPECTED_CHATBOT_COUNT ||
      value.counts?.excludedExpected !== EXPECTED_EXCLUDED_CHATBOT_COUNT ||
      value.counts?.positivePassed !== EXPECTED_CHATBOT_COUNT ||
      value.counts?.isolationPassed !== EXPECTED_CHATBOT_COUNT ||
      value.counts?.rejectionsPassed !== REJECTION_CLASSES.length ||
      REJECTION_CLASSES.some((name) => value.rejections?.[name] !== 'passed') ||
      !hasExactZeroPreservation(value.preservation))
  ) {
    return fixedFailureReceipt('protocol_failed')
  }
  const receipt = emptyReceipt()
  receipt.phase = value.phase
  receipt.result = value.result
  receipt.failureClass = value.failureClass
  receipt.failedCaseId = ID_PATTERN.test(value.failedCaseId ?? '')
    ? value.failedCaseId
    : null
  receipt.failedRejectionClass = REJECTION_CLASSES.includes(
    value.failedRejectionClass
  )
    ? value.failedRejectionClass
    : null
  for (const key of Object.keys(receipt.counts)) {
    const count = value.counts?.[key]
    receipt.counts[key] = Number.isInteger(count)
      ? Math.max(0, Math.min(count, 100))
      : receipt.counts[key]
  }
  for (const name of REJECTION_CLASSES) {
    receipt.rejections[name] = ['not_run', 'passed', 'failed'].includes(
      value.rejections?.[name]
    )
      ? value.rejections[name]
      : 'not_run'
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

async function acquireLock(path) {
  try {
    return await open(path, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') return null
    throw error
  }
}

export async function superviseProof({
  sourceEnvironment = process.env,
  childPath = WORKER_PATH,
  childArgs = ['--worker'],
  deadlineMs = DEFAULT_DEADLINE_MS,
  lockPath = DEFAULT_LOCK_PATH,
  installSignalHandlers = false,
}) {
  const startedAt = Date.now()
  const lock = await acquireLock(lockPath)
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
  const signalHandlers = new Map()

  try {
    const environment = minimalChildEnvironment(sourceEnvironment, process.pid)
    child = spawn(process.execPath, [resolve(childPath), ...childArgs], {
      detached: true,
      env: environment,
      shell: false,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    child.on('message', (candidate) => {
      if (message === null) message = sanitizeReceipt(candidate)
    })

    let forceTimer
    const terminateChildGroup = () => {
      killProcessGroup(child, 'SIGTERM')
      if (forceTimer) return
      forceTimer = setTimeout(
        () => killProcessGroup(child, 'SIGKILL'),
        TERMINATION_GRACE_MS
      )
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

    let receipt = message ?? fixedFailureReceipt('protocol_failed')
    if (timedOut) receipt = fixedFailureReceipt('timeout')
    else if (interrupted) receipt = fixedFailureReceipt('interrupted')
    else if (close.signal) receipt = fixedFailureReceipt('child_signaled')
    else if (close.code === 0) {
      if (
        message?.result !== 'passed' &&
        message?.failureClass !== 'protocol_failed'
      ) {
        receipt = fixedFailureReceipt('child_failed')
      }
    } else if (message === null || message.result === 'passed') {
      receipt = fixedFailureReceipt('child_failed')
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
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler)
    }
    await lock.close().catch(() => undefined)
    await unlink(lockPath).catch(() => undefined)
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
      environment.DOC_QUERY_PROOF_MANIFEST_PATH
    )
    const receipt = await runProofMatrix({ manifest, environment })
    sendWorkerReceipt(receipt, receipt.result === 'passed' ? 0 : 1)
  } catch (error) {
    const receipt =
      error instanceof ProofFailure
        ? fixedFailureReceipt(
            error.failureClass,
            error.caseId,
            error.rejectionClass
          )
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
