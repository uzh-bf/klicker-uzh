// Evaluation-only capture of the document passages an opted-in local Klicker
// evaluation target actually persisted for one completed turn (schema v1).
//
// Enablement is explicit: `KLICKER_EVAL_EVIDENCE_DIR` selects the private
// output directory and `KLICKER_EVAL_RUN_ID` names the run. Each completed
// turn writes one exclusive capture bound to the generated completion response
// id, the caller run id, the requested and persisted model, the trimmed
// question hash, the answer hash and the persisted chat mode. Only recognized
// `KB_`-namespaced `doc_query` calls in `documents` mode are read, and only
// `sources[].chunks[].content` values are exported. Tool arguments, reasoning,
// arbitrary payload properties and source metadata are never exported, and
// expected answers never reach this module.
//
// Statuses stay distinct so an absent context is never mistaken for a known
// empty one:
//   complete   - bounded, ordered passages were captured; never truncated
//   empty      - a recognized document call returned no usable passage
//   no_calls   - the turn made no recognized document call at all
//   incomplete - a document call failed, was malformed/mixed/unknown, or the
//                recognized passages exceeded a bound; no context is exported
// One malformed, failed, mixed or unknown document result makes the whole case
// incomplete, and a broken or non-text sibling representation is never ignored
// just because another representation parsed. An unsafe passage or a
// filesystem failure fails the opted-in run instead of being redacted or
// silently dropped.
//
// Capture files are written exclusively with mode 0600 into a non-symlink
// directory that is not readable or writable by group or other.

import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const EVIDENCE_SCHEMA_VERSION = 1
export const MAX_EVIDENCE_PASSAGES = 64
export const MAX_EVIDENCE_TEXT_BYTES = 256 * 1024
export const MAX_EVIDENCE_SERIALIZED_BYTES = 2 * 1024 * 1024
export const EVIDENCE_STATUSES = Object.freeze([
  'complete',
  'empty',
  'no_calls',
  'incomplete',
])

// Envelope unwrapping is bounded so a pathological nesting cannot be walked
// without limit. The captured document payload sits well inside this depth.
const MAX_EVIDENCE_DEPTH = 5

// Only the knowledge-base document tool is recognized: the `KB_` namespace
// prefix plus `doc_query`, with the optional disambiguation suffix
// `toSafeToolName` appends when two servers expose the same tool name (see
// `toSafeToolName` in `src/lib/sources/normalizeSources.ts` for the suffix
// length). An unrelated server's own `doc_query` tool is never captured.
const DOC_QUERY_TOOL_NAME_RE = /^KB_doc_query(_[0-9a-f]{16})?$/

const SAFE_ID_RE = /^[A-Za-z0-9._-]+$/

const URL_WITH_CREDENTIALS_RE = /https?:\/\/[^\s/?#@]+:[^\s/?#@]*@/i
const PRIVATE_HOSTNAME_RE =
  /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d|10\.\d+\.\d+\.\d|192\.168\.\d+\.\d|172\.(1[6-9]|2\d|3[01])\.\d+\.\d|\[::1\])$/i
const PRIVATE_HOST_SUFFIX_RE = /\.(localhost|internal|local|svc)$/i
const CREDENTIAL_ASSIGNMENT_RE =
  /(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*\S/i
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/
const PRIVATE_KEY_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/

export function evidenceError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

export function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex')
}

export function isDocQueryToolName(toolName) {
  return typeof toolName === 'string' && DOC_QUERY_TOOL_NAME_RE.test(toolName)
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

// Decodes one persisted tool result into a document payload. Every
// representation an envelope presents must resolve: a direct payload object, an
// MCP `structuredContent`, MCP text content, a FastMCP `{ result: <json> }`
// wrapper or a JSON string. When several representations coexist they must be
// canonically equivalent. A representation that is broken, non-text or too
// deeply nested makes the whole result malformed rather than being ignored
// because a sibling representation parsed.
function decodeResult(raw, depth = 0) {
  if (depth > MAX_EVIDENCE_DEPTH) return { malformed: true }
  if (typeof raw === 'string') {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { malformed: true }
    }
    return decodeResult(parsed, depth + 1)
  }
  const value = record(raw)
  if (!value) return { malformed: true }
  if (value.isError === true || 'error' in value) return { failed: true }
  if (Array.isArray(value.sources)) {
    if (
      'structuredContent' in value ||
      'content' in value ||
      'result' in value
    ) {
      return { malformed: true }
    }
    return { payload: value }
  }

  const representations = []
  if (value.structuredContent !== undefined) {
    representations.push(value.structuredContent)
  }
  if (
    'content' in value &&
    (!Array.isArray(value.content) || value.content.length !== 1)
  ) {
    return { malformed: true }
  }
  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      const entry = record(item)
      if (entry?.type !== 'text') return { malformed: true }
      representations.push(entry.text)
    }
  }
  if (value.result !== undefined) representations.push(value.result)
  if (representations.length === 0) return { unknown: true }

  const payloads = []
  for (const representation of representations) {
    const decoded = decodeResult(representation, depth + 1)
    if (decoded.failed) return { failed: true }
    if (decoded.malformed) return { malformed: true }
    if (decoded.unknown) return { unknown: true }
    if (decoded.conflict) return { conflict: true }
    payloads.push(decoded.payload)
  }
  const canonical = canonicalJson(payloads[0])
  if (payloads.some((payload) => canonicalJson(payload) !== canonical)) {
    return { conflict: true }
  }
  return { payload: payloads[0] }
}

function serializedBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8')
  } catch {
    return undefined
  }
}

// Reads `sources[].chunks[].content` in the order the tool supplied it. Every
// structural surprise makes the whole case incomplete rather than dropping or
// inventing context.
function collectPassages(payload) {
  if (payload.mode !== 'documents') {
    return { reason: 'result_mode_not_documents' }
  }
  if (!Array.isArray(payload.sources)) return { reason: 'result_malformed' }
  const passages = []
  for (const rawSource of payload.sources) {
    const source = record(rawSource)
    if (!source || !Array.isArray(source.chunks)) {
      return { reason: 'result_malformed' }
    }
    for (const rawChunk of source.chunks) {
      const chunk = record(rawChunk)
      if (!chunk) return { reason: 'result_malformed' }
      const content = chunk.content
      if (content === undefined || content === null)
        return { reason: 'result_malformed' }
      if (typeof content !== 'string') return { reason: 'result_malformed' }
      if (!content.trim()) continue
      passages.push(content)
    }
  }
  return { passages }
}

function findPrivateUrl(passage) {
  for (const match of passage.matchAll(/https?:\/\/[^\s/?#]+/gi)) {
    let hostname
    try {
      const url = new URL(match[0])
      if (url.username || url.password) return true
      hostname = url.hostname
    } catch {
      continue
    }
    const normalized = hostname.toLowerCase().replace(/\.$/, '')
    if (
      PRIVATE_HOSTNAME_RE.test(normalized) ||
      PRIVATE_HOST_SUFFIX_RE.test(normalized) ||
      /^169\.254\./.test(normalized) ||
      /^\[(?:f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:|::ffff:)/i.test(normalized)
    ) {
      return true
    }
  }
  return false
}

export function assertPassageSafe(passage) {
  if (
    URL_WITH_CREDENTIALS_RE.test(passage) ||
    findPrivateUrl(passage) ||
    CREDENTIAL_ASSIGNMENT_RE.test(passage) ||
    JWT_RE.test(passage) ||
    PRIVATE_KEY_RE.test(passage)
  ) {
    throw evidenceError('evidence_content_unsafe')
  }
}

/**
 * Builds the schema-v1 capture for one completed turn without touching the
 * filesystem. Structural document problems become `incomplete`; unsafe
 * passage content throws so the caller fails the opted-in run.
 */
export function evaluatePersistedEvidence({
  responseId,
  runId,
  question,
  answer,
  mode,
  requestedModel,
  persistedModel,
  content,
}) {
  const base = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    response_id: responseId,
    run_id: runId,
    mode,
    requested_model: requestedModel,
    persisted_model: persistedModel,
    question_sha256: sha256Hex(String(question).trim()),
    answer_sha256: sha256Hex(answer),
  }
  const incomplete = (reason) => ({ ...base, status: 'incomplete', reason })

  const parts = Array.isArray(content) ? content : []
  const passages = []
  let recognized = false
  for (const part of parts) {
    if (!record(part) || part.type !== 'tool-call') continue
    if (!isDocQueryToolName(part.toolName)) continue
    recognized = true
    if (part.isError === true) return incomplete('tool_call_failed')
    if (part.result === undefined || part.result === null) {
      return incomplete('result_unknown')
    }
    const bytes = serializedBytes(part.result)
    if (bytes === undefined) return incomplete('result_malformed')
    if (bytes > MAX_EVIDENCE_SERIALIZED_BYTES) {
      return incomplete('input_bytes_exceeded')
    }
    const decoded = decodeResult(part.result)
    if (decoded.failed) return incomplete('result_failed')
    if (decoded.unknown) return incomplete('result_unknown')
    if (decoded.malformed) return incomplete('result_malformed')
    if (decoded.conflict) return incomplete('result_representations_conflict')
    const collected = collectPassages(decoded.payload)
    if (collected.reason) return incomplete(collected.reason)
    passages.push(...collected.passages)
  }

  if (!recognized) return { ...base, status: 'no_calls' }
  if (passages.length === 0) return { ...base, status: 'empty' }
  if (passages.length > MAX_EVIDENCE_PASSAGES) {
    return incomplete('passage_count_exceeded')
  }
  const totalBytes = passages.reduce(
    (sum, passage) => sum + Buffer.byteLength(passage, 'utf8'),
    0
  )
  if (totalBytes > MAX_EVIDENCE_TEXT_BYTES) {
    return incomplete('passage_bytes_exceeded')
  }
  for (const passage of passages) assertPassageSafe(passage)
  return { ...base, status: 'complete', passages }
}

function serializeCapture(capture) {
  return `${JSON.stringify(capture)}\n`
}

export async function ensurePrivateDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw evidenceError('evidence_directory_unsafe')
  }
  const target = resolve(directory)
  let stats
  try {
    stats = await lstat(target)
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw evidenceError('evidence_directory_unsafe')
    }
    try {
      await mkdir(target, { recursive: true, mode: 0o700 })
    } catch {
      throw evidenceError('evidence_directory_unsafe')
    }
    stats = await lstat(target).catch(() => undefined)
  }
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) {
    throw evidenceError('evidence_directory_unsafe')
  }
  if ((stats.mode & 0o077) !== 0) {
    throw evidenceError('evidence_directory_permissions')
  }
  return target
}

/**
 * Writes one capture as `<response_id>.json` with exclusive creation, mode
 * 0600, inside a private non-symlink directory. Any path, permission,
 * overwrite or IO problem throws so the opted-in run fails instead of
 * continuing without evidence.
 */
export async function writeEvidenceCapture({ directory, capture }) {
  const target = await ensurePrivateDirectory(directory)
  const responseId = capture?.response_id
  if (typeof responseId !== 'string' || !SAFE_ID_RE.test(responseId)) {
    throw evidenceError('evidence_response_id_unsafe')
  }
  const serialized = serializeCapture(capture)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_EVIDENCE_SERIALIZED_BYTES) {
    throw evidenceError('evidence_capture_too_large')
  }
  const filePath = join(target, `${responseId}.json`)
  let handle
  try {
    handle = await open(filePath, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') throw evidenceError('evidence_file_exists')
    throw evidenceError('evidence_write_failed')
  }
  try {
    await handle.writeFile(serialized, 'utf8')
    const stats = await handle.stat()
    if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
      throw evidenceError('evidence_file_insecure')
    }
  } catch (error) {
    throw error?.code ? error : evidenceError('evidence_write_failed')
  } finally {
    await handle.close().catch(() => {})
  }
  return filePath
}

// Captures come from a private directory; bound each read before JSON parsing.
export async function readEvidenceCaptureFile(filePath) {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stats = await handle.stat()
    if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
      throw evidenceError('evidence_file_insecure')
    }
    if (stats.size > MAX_EVIDENCE_SERIALIZED_BYTES) {
      throw evidenceError('evidence_capture_too_large')
    }
    const buffer = Buffer.alloc(MAX_EVIDENCE_SERIALIZED_BYTES + 1)
    let total = 0
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        total,
        buffer.length - total,
        total
      )
      if (bytesRead === 0) break
      total += bytesRead
    }
    if (total > MAX_EVIDENCE_SERIALIZED_BYTES) {
      throw evidenceError('evidence_capture_too_large')
    }
    return buffer.toString('utf8', 0, total)
  } finally {
    await handle.close()
  }
}
