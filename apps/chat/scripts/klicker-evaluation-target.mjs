#!/usr/bin/env node

import { randomUUID, timingSafeEqual } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
export const DEFAULT_MODEL_ID = 'gpt-5.6-luna'
export const DEFAULT_MAX_STREAM_BYTES = 8 * 1024 * 1024
export const DEFAULT_POLL_INTERVAL_MS = 250
export const DEFAULT_POLL_TIMEOUT_MS = 60_000
export const DEFAULT_REQUEST_TIMEOUT_MS = 75_000

// The first turn requires a completed, non-error result from this retrieval
// tool. Follow-up turns may use the already retrieved conversation context. The
// local chatbot exposes a single KB server, so no disambiguation suffix is
// expected; a suffixed name fails closed rather than silently passing.
export const EXPECTED_DOC_QUERY_TOOL = 'KB_doc_query'

export const TRAJECTORY_GROUPS = ['development', 'reserved', 'control']
export const TRAJECTORY_LANGUAGES = ['en', 'de']
export const TRAJECTORY_MODES = ['tutor', 'quizzer']

const TRAJECTORY_MAX_SOURCES = 12
const TRAJECTORY_CASE_FIELDS = new Set([
  'id',
  'group',
  'language',
  'mode',
  'support',
  'rubric',
  'assessmentTurns',
  'turns',
])
const TRAJECTORY_TURN_FIELDS = new Set(['message', 'repeatPrevious', 'suffix'])

const LOGIN_MUTATION = `
  mutation LoginParticipant($usernameOrEmail: String!, $password: String!) {
    loginParticipant(
      usernameOrEmail: $usernameOrEmail
      password: $password
    )
  }
`

const RESPONSE_TIMEOUT_CLEANUP = Symbol('responseTimeoutCleanup')

export function evaluationError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  )
}

export function validateLocalOrigin(value, name) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw evaluationError(`${name}_invalid`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw evaluationError(`${name}_protocol`)
  }
  if (!isLocalHostname(url.hostname)) {
    throw evaluationError(`${name}_non_local`)
  }

  url.search = ''
  url.hash = ''
  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  return url.origin + pathname
}

function urlFor(origin, pathname) {
  return new URL(pathname, `${origin}/`).toString()
}

function yamlScalar(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        throw evaluationError('ground_truth_invalid_scalar')
      }
    }
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }
  return trimmed
}

export function parseGroundTruthFrontmatter(text, filePath = 'unknown') {
  const normalized = text.replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) {
    throw evaluationError(
      `ground_truth_frontmatter_missing:${basename(filePath)}`
    )
  }

  const end = normalized.indexOf('\n---', 4)
  if (end < 0) {
    throw evaluationError(
      `ground_truth_frontmatter_unclosed:${basename(filePath)}`
    )
  }

  const values = new Map()
  for (const line of normalized.slice(4, end).split('\n')) {
    const match = /^(question|mode):\s*(.*)$/.exec(line)
    if (!match) continue
    if (values.has(match[1])) {
      throw evaluationError(
        `ground_truth_duplicate_field:${basename(filePath)}`
      )
    }
    values.set(match[1], yamlScalar(match[2]))
  }

  const question = values.get('question')
  const mode = values.get('mode')?.toLowerCase()
  if (!question || !mode) {
    throw evaluationError(`ground_truth_fields_missing:${basename(filePath)}`)
  }
  if (!['tutor', 'explainer'].includes(mode)) {
    throw evaluationError(`ground_truth_mode_invalid:${basename(filePath)}`)
  }

  return { question, mode, source: 'fineco', filePath }
}

export async function buildGroundTruthIndex(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const index = new Map()
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const filePath = resolve(directory, entry.name)
    const metadata = parseGroundTruthFrontmatter(
      await readFile(filePath, 'utf8'),
      filePath
    )
    if (index.has(metadata.question)) {
      throw evaluationError(`ground_truth_question_duplicate:${entry.name}`)
    }
    index.set(metadata.question, metadata)
  }
  if (index.size === 0) throw evaluationError('ground_truth_empty')
  return index
}

export async function loadCanaryFixture(filePath) {
  const fixture = JSON.parse(await readFile(filePath, 'utf8'))
  if (
    !fixture ||
    fixture.source !== 'canary' ||
    typeof fixture.question !== 'string' ||
    !['tutor', 'explainer'].includes(fixture.mode) ||
    typeof fixture.expectedTool !== 'string'
  ) {
    throw evaluationError('canary_fixture_invalid')
  }
  if (
    !Number.isInteger(fixture.maxStreamBytes) ||
    fixture.maxStreamBytes <= 0
  ) {
    throw evaluationError('canary_fixture_max_stream_invalid')
  }
  return {
    question: fixture.question,
    mode: fixture.mode,
    source: 'canary',
    expectedTool: fixture.expectedTool,
    maxStreamBytes: fixture.maxStreamBytes,
    filePath,
  }
}

// Trajectory corpora are authored data. Reject unknown fields as well as
// wrong types so a typo (for example `messages:` for `message:`) fails the
// whole run before any login instead of silently dropping a learner turn.
function requireTrajectoryText(value, code) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw evaluationError(code)
  }
  return value
}

function validateTrajectoryTurnInput(turn, index) {
  if (!turn || typeof turn !== 'object' || Array.isArray(turn)) {
    throw evaluationError('trajectory_turn_invalid')
  }
  for (const key of Object.keys(turn)) {
    if (!TRAJECTORY_TURN_FIELDS.has(key)) {
      throw evaluationError('trajectory_turn_unknown_field')
    }
  }
  if (typeof turn.message === 'string') {
    if ('repeatPrevious' in turn || 'suffix' in turn) {
      throw evaluationError('trajectory_turn_invalid')
    }
    return {
      message: requireTrajectoryText(turn.message, 'trajectory_turn_invalid'),
    }
  }
  if (turn.repeatPrevious === true) {
    if (typeof turn.suffix !== 'string') {
      throw evaluationError('trajectory_turn_invalid')
    }
    if (index === 0) throw evaluationError('trajectory_repeat_unavailable')
    return { repeatPrevious: true, suffix: turn.suffix }
  }
  throw evaluationError('trajectory_turn_invalid')
}

export function validateTrajectoryCase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw evaluationError('trajectory_case_invalid')
  }
  for (const key of Object.keys(value)) {
    if (!TRAJECTORY_CASE_FIELDS.has(key)) {
      throw evaluationError('trajectory_case_unknown_field')
    }
  }
  const id = requireTrajectoryText(value.id, 'trajectory_case_id_invalid')
  if (!TRAJECTORY_GROUPS.includes(value.group)) {
    throw evaluationError('trajectory_case_group_invalid')
  }
  if (!TRAJECTORY_LANGUAGES.includes(value.language)) {
    throw evaluationError('trajectory_case_language_invalid')
  }
  if (!TRAJECTORY_MODES.includes(value.mode)) {
    throw evaluationError('trajectory_case_mode_invalid')
  }
  const support = requireTrajectoryText(
    value.support,
    'trajectory_case_support_invalid'
  )
  if (!Array.isArray(value.rubric) || value.rubric.length === 0) {
    throw evaluationError('trajectory_case_rubric_invalid')
  }
  const rubric = value.rubric.map((entry) =>
    requireTrajectoryText(entry, 'trajectory_case_rubric_invalid')
  )
  if (!Array.isArray(value.turns) || value.turns.length === 0) {
    throw evaluationError('trajectory_case_turns_invalid')
  }
  const turns = value.turns.map((turn, index) =>
    validateTrajectoryTurnInput(turn, index)
  )
  if (!Array.isArray(value.assessmentTurns)) {
    throw evaluationError('trajectory_case_assessment_turns_invalid')
  }
  const assessmentTurns = []
  for (const entry of value.assessmentTurns) {
    if (
      !Number.isInteger(entry) ||
      entry < 1 ||
      entry > turns.length ||
      assessmentTurns.includes(entry)
    ) {
      throw evaluationError('trajectory_case_assessment_turns_invalid')
    }
    assessmentTurns.push(entry)
  }
  assessmentTurns.sort((left, right) => left - right)

  return {
    id,
    group: value.group,
    language: value.language,
    mode: value.mode,
    support,
    rubric,
    assessmentTurns,
    turns,
  }
}

export function validateTrajectoryCorpus(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw evaluationError('corpus_invalid')
  }
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'cases') {
      throw evaluationError('corpus_unknown_field')
    }
  }
  if (value.version !== 1) throw evaluationError('corpus_version_unsupported')
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    throw evaluationError('corpus_cases_invalid')
  }

  const seenIds = new Set()
  const cases = value.cases.map((entry) => {
    const caseDefinition = validateTrajectoryCase(entry)
    if (seenIds.has(caseDefinition.id)) {
      throw evaluationError('corpus_case_duplicate')
    }
    seenIds.add(caseDefinition.id)
    return caseDefinition
  })

  return { version: 1, cases }
}

function bearerToken(request) {
  const header = request.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

function tokenMatches(actual, expected) {
  if (typeof actual !== 'string' || actual.length === 0) return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

function responseJson(response, payload, status = 200, headers = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  response.end(body)
}

function safeStatusError(prefix, response) {
  return evaluationError(`${prefix}_http_${response.status}`)
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: controller.signal,
    })
    response[RESPONSE_TIMEOUT_CLEANUP] = () => clearTimeout(timeout)
    return response
  } catch (error) {
    if (error?.name === 'AbortError') throw evaluationError('request_timeout')
    throw evaluationError('request_failed')
  } finally {
    if (!response) clearTimeout(timeout)
  }
}

async function readJsonResponse(response, errorPrefix) {
  try {
    if (!response.ok) throw safeStatusError(errorPrefix, response)
    return await response.json()
  } catch (error) {
    if (!response.ok) throw error
    if (error?.name === 'AbortError') throw evaluationError('request_timeout')
    throw evaluationError(`${errorPrefix}_invalid_json`)
  } finally {
    response[RESPONSE_TIMEOUT_CLEANUP]?.()
  }
}

function participantCookie(headers) {
  const values =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') || '']
  for (const value of values) {
    const match = /(?:^|,\s*)(participant_token=[^;,]+)/.exec(value)
    if (match) return match[1]
  }
  throw evaluationError('participant_cookie_missing')
}

async function readRequestBody(request, maxBytes = 256 * 1024) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > maxBytes) throw evaluationError('request_body_too_large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw evaluationError('request_body_invalid_json')
  }
}

function requestHeaders(cookie) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Cookie: cookie,
  }
}

function finiteCredits(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null
}

async function drainResponse(response, maxBytes) {
  try {
    if (!response.body) throw evaluationError('chat_stream_missing')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const streamState = { done: false, events: 0, finished: false }
    const visible = {
      text: '',
      toolCalls: [],
      creditsUsed: null,
      chatMode: null,
      modelId: null,
      finishReason: null,
    }
    let bytes = 0
    let buffer = ''
    let completed = false

    const inspectLine = (line) => {
      const normalized = line.endsWith('\r') ? line.slice(0, -1) : line
      if (!normalized) return
      if (normalized.startsWith(':')) return
      if (streamState.done) throw evaluationError('chat_stream_invalid')
      if (normalized === 'data: [DONE]') {
        streamState.done = true
        return
      }
      if (!normalized.startsWith('data: ')) {
        throw evaluationError('chat_stream_invalid')
      }
      let event
      try {
        event = JSON.parse(normalized.slice('data: '.length))
      } catch {
        throw evaluationError('chat_stream_invalid')
      }
      if (
        !event ||
        typeof event !== 'object' ||
        typeof event.type !== 'string'
      ) {
        throw evaluationError('chat_stream_invalid')
      }
      if (event.type === 'finish') streamState.finished = true
      if (['abort', 'error', 'tool-output-error'].includes(event.type)) {
        throw evaluationError('chat_stream_error')
      }
      if (event.type === 'text-delta' && typeof event.delta === 'string') {
        visible.text += event.delta
      } else if (
        event.type === 'tool-input-start' &&
        typeof event.toolName === 'string'
      ) {
        visible.toolCalls.push({
          toolCallId:
            typeof event.toolCallId === 'string' ? event.toolCallId : null,
          toolName: event.toolName,
          output: false,
        })
      } else if (event.type === 'tool-output-available') {
        const toolCall = visible.toolCalls.find(
          (call) =>
            call.toolCallId !== null && call.toolCallId === event.toolCallId
        )
        if (toolCall) toolCall.output = true
      } else if (
        event.type === 'finish' &&
        event.messageMetadata &&
        typeof event.messageMetadata === 'object'
      ) {
        const metadata = event.messageMetadata
        visible.creditsUsed = finiteCredits(metadata.creditsUsed)
        visible.chatMode =
          typeof metadata.chatMode === 'string' ? metadata.chatMode : null
        visible.modelId =
          typeof metadata.modelId === 'string' ? metadata.modelId : null
        visible.finishReason =
          typeof metadata.finishReason === 'string'
            ? metadata.finishReason
            : null
      }
      streamState.events += 1
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode()
          if (buffer) inspectLine(buffer)
          if (
            !streamState.done ||
            !streamState.finished ||
            streamState.events === 0
          ) {
            throw evaluationError('chat_stream_incomplete')
          }
          completed = true
          return { ...visible, bytes }
        }
        bytes += value?.byteLength || 0
        if (bytes > maxBytes) {
          await reader.cancel()
          throw evaluationError('chat_stream_too_large')
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) inspectLine(line)
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw evaluationError('request_timeout')
      throw error
    } finally {
      if (!completed) await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } finally {
    response[RESPONSE_TIMEOUT_CLEANUP]?.()
  }
}

export function extractAssistantMessage(message) {
  if (!message || message.role !== 'assistant') {
    throw evaluationError('assistant_message_invalid')
  }

  const parts = Array.isArray(message.content) ? message.content : []
  const text = []
  const toolCalls = []
  for (const part of parts) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      text.push(part.text)
      continue
    }
    if (part?.type !== 'tool-call') continue
    if (typeof part.toolName !== 'string' || !part.toolName) {
      throw evaluationError('tool_call_invalid')
    }
    if (part.isError === true) throw evaluationError('tool_call_failed')
    toolCalls.push({ name: part.toolName })
  }

  const answer = text.join('').trim()
  if (!answer) throw evaluationError('assistant_answer_empty')
  return { answer, toolCalls }
}

// Receipts may carry source references and titles only. A persisted tool
// result still holds raw retrieval payloads (arguments, chunks, excerpts and
// potentially internal URLs), so this projection picks the two fields a
// reviewer needs and never forwards the raw result itself.
function cleanMetadataString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return null
  return trimmed
}

function parseMetadataObject(raw) {
  if (typeof raw !== 'string') return undefined
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : undefined
  } catch {
    return undefined
  }
}

function docQueryPayload(raw) {
  if (typeof raw === 'string') return parseMetadataObject(raw)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  if (Array.isArray(raw.content)) {
    if (
      raw.structuredContent &&
      typeof raw.structuredContent === 'object' &&
      !Array.isArray(raw.structuredContent)
    ) {
      return docQueryPayload(raw.structuredContent) ?? raw.structuredContent
    }
    const textItem = raw.content.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        item.type === 'text' &&
        typeof item.text === 'string'
    )
    return textItem ? parseMetadataObject(textItem.text) : undefined
  }
  return raw
}

function sourceMetadataKey(reference, title) {
  return (reference ?? '') + '|' + (title ?? '')
}

function docQuerySourceMetadata(raw) {
  const payload = docQueryPayload(raw)
  const entries =
    payload && Array.isArray(payload.sources) ? payload.sources : []
  const sources = []
  const seen = new Set()
  for (const entry of entries) {
    if (sources.length >= TRAJECTORY_MAX_SOURCES) break
    if (!entry || typeof entry !== 'object') continue
    const reference =
      cleanMetadataString(entry.reference) ??
      cleanMetadataString(entry.file_name)
    const title =
      cleanMetadataString(entry.title) ??
      cleanMetadataString(entry.display_name) ??
      cleanMetadataString(entry.file_name) ??
      reference
    if (!reference && !title) continue
    const key = sourceMetadataKey(reference, title)
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({ ref: reference ?? title, title: title ?? reference })
  }
  return sources
}

function extractVisibleText(message, role) {
  if (!message || message.role !== role) {
    throw evaluationError('trajectory_message_invalid')
  }
  const parts = Array.isArray(message.content) ? message.content : []
  return parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

// The MCP transport reports a failed tool call in the tool result envelope
// (`isError: true`) as well as on the part, so both levels have to be clean.
function isCompletedDocQueryPart(part) {
  if (part.isError === true) return false
  if (part.result === undefined || part.result === null) return false
  if (typeof part.result === 'object' && part.result.isError === true) {
    return false
  }
  return true
}

// Retrieval is required on the first turn. Later turns may acknowledge a
// pause or discuss earlier work without another retrieval call.
function extractTrajectoryTurn(message, requireRetrieval) {
  if (!message || message.role !== 'assistant') {
    throw evaluationError('assistant_message_invalid')
  }
  const parts = Array.isArray(message.content) ? message.content : []
  const text = []
  const docQueryParts = []
  for (const part of parts) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      text.push(part.text)
      continue
    }
    if (
      part?.type === 'tool-call' &&
      part.toolName === EXPECTED_DOC_QUERY_TOOL
    ) {
      docQueryParts.push(part)
    }
  }
  const answer = text.join('').trim()
  if (!answer) throw evaluationError('assistant_answer_empty')
  if (requireRetrieval && docQueryParts.length === 0)
    throw evaluationError('trajectory_tool_missing')

  const completed = docQueryParts.filter(isCompletedDocQueryPart)
  if (completed.length !== docQueryParts.length)
    throw evaluationError('trajectory_tool_error')

  const sources = []
  const seen = new Set()
  for (const part of completed) {
    for (const source of docQuerySourceMetadata(part.result)) {
      if (sources.length >= TRAJECTORY_MAX_SOURCES) break
      const key = sourceMetadataKey(source.ref, source.title)
      if (seen.has(key)) continue
      seen.add(key)
      sources.push(source)
    }
  }

  return {
    answer,
    toolName: docQueryParts.length ? EXPECTED_DOC_QUERY_TOOL : null,
    toolStatus: docQueryParts.length ? 'completed' : 'not_called',
    sources,
  }
}

// Verifies the persisted thread before the next learner turn can be built:
// every message of the fresh thread must belong to the expected chain, every
// parent link, mode and model must match what was requested, previously
// verified ancestors must still read the same, and the stream must have
// carried the expected completed tool output itself.
function verifyTrajectoryTurn({ messages, chain, mode, modelId, stream }) {
  if (messages.length !== chain.length * 2) {
    throw evaluationError('trajectory_ancestry_mismatch')
  }
  const byId = new Map()
  for (const message of messages) {
    if (!message || typeof message.id !== 'string') {
      throw evaluationError('trajectory_message_invalid')
    }
    byId.set(message.id, message)
  }

  let previousAssistantId = null
  let persistedUserText = null
  let persistedAssistant = null
  for (const entry of chain) {
    const user = byId.get(entry.userMessageId)
    const assistant = byId.get(entry.assistantMessageId)
    if (!user || user.role !== 'user') {
      throw evaluationError('trajectory_user_message_missing')
    }
    if (!assistant || assistant.role !== 'assistant') {
      throw evaluationError('trajectory_assistant_message_missing')
    }
    if ((user.parentId ?? null) !== previousAssistantId) {
      throw evaluationError('trajectory_ancestry_mismatch')
    }
    if ((assistant.parentId ?? null) !== entry.userMessageId) {
      throw evaluationError('trajectory_ancestry_mismatch')
    }
    if (user.chatMode !== mode || assistant.chatMode !== mode) {
      throw evaluationError('chat_mode_mismatch')
    }
    if (user.modelId !== modelId || assistant.modelId !== modelId) {
      throw evaluationError('chat_model_mismatch')
    }
    const userText = extractVisibleText(user, 'user')
    if (userText !== entry.userText) {
      throw evaluationError('trajectory_user_text_mismatch')
    }
    const assistantText = extractVisibleText(assistant, 'assistant')
    if (
      entry.assistantText !== undefined &&
      assistantText.trim() !== entry.assistantText
    ) {
      throw evaluationError('trajectory_ancestor_text_mismatch')
    }
    previousAssistantId = entry.assistantMessageId
    persistedUserText = userText
    persistedAssistant = assistant
  }

  const streamText = typeof stream?.text === 'string' ? stream.text : ''
  const streamToolCompleted = Array.isArray(stream?.toolCalls)
    ? stream.toolCalls.some(
        (call) =>
          call.toolName === EXPECTED_DOC_QUERY_TOOL && call.output === true
      )
    : false
  const requireRetrieval = chain.length === 1
  const hasPersistedTool = persistedAssistant.content?.some(
    (part) =>
      part?.type === 'tool-call' && part.toolName === EXPECTED_DOC_QUERY_TOOL
  )
  if ((requireRetrieval || hasPersistedTool) && !streamToolCompleted) {
    throw evaluationError('trajectory_stream_tool_missing')
  }

  const extracted = extractTrajectoryTurn(persistedAssistant, requireRetrieval)
  if (streamToolCompleted && extracted.toolStatus === 'not_called') {
    throw evaluationError('trajectory_tool_missing')
  }
  if (extracted.answer !== streamText.trim()) {
    throw evaluationError('trajectory_text_mismatch')
  }

  return {
    userText: persistedUserText,
    assistantText: extracted.answer,
    sources: extracted.sources,
    toolName: extracted.toolName,
    toolStatus: extracted.toolStatus,
    creditsUsed: finiteCredits(persistedAssistant.creditsUsed),
  }
}

function completionPayload(model, result) {
  return {
    id: `klicker-evaluation-${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.answer,
          ...(result.toolCalls.length > 0
            ? {
                tool_calls: result.toolCalls.map((call, index) => ({
                  id: `klicker-tool-call-${index}`,
                  type: 'function',
                  function: { name: call.name, arguments: '{}' },
                })),
              }
            : {}),
        },
        finish_reason: 'stop',
      },
    ],
  }
}

export class KlickerEvaluationTarget {
  constructor({
    apiOrigin,
    chatOrigin,
    apiKey,
    participantUsername,
    participantPassword,
    chatbotId = DEFAULT_CHATBOT_ID,
    modelId = DEFAULT_MODEL_ID,
    groundTruthDirectory,
    canaryFixture,
    maxStreamBytes = DEFAULT_MAX_STREAM_BYTES,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }) {
    if (!apiKey) throw evaluationError('target_key_missing')
    if (!participantUsername || !participantPassword) {
      throw evaluationError('participant_credentials_missing')
    }
    this.apiOrigin = validateLocalOrigin(apiOrigin, 'api_origin')
    this.chatOrigin = validateLocalOrigin(chatOrigin, 'chat_origin')
    this.participantUsername = participantUsername
    this.participantPassword = participantPassword
    this.chatbotId = chatbotId
    this.modelId = modelId
    this.groundTruthDirectory = groundTruthDirectory
    this.canaryFixture = canaryFixture
    this.maxStreamBytes = maxStreamBytes
    this.pollIntervalMs = pollIntervalMs
    this.pollTimeoutMs = pollTimeoutMs
    this.requestTimeoutMs = requestTimeoutMs
    this.cookie = null
    this.groundTruthIndex = null
    this.canary = null
    this.sessionPromise = null
  }

  async initialize() {
    this.groundTruthIndex = await buildGroundTruthIndex(
      this.groundTruthDirectory
    )
    this.canary = await loadCanaryFixture(this.canaryFixture)
  }

  async resolveQuestion(question) {
    if (!this.groundTruthIndex || !this.canary) {
      throw evaluationError('target_not_initialized')
    }
    const fineco = this.groundTruthIndex.get(question)
    const canary = this.canary.question === question ? this.canary : null
    if (fineco && canary) throw evaluationError('question_ambiguous')
    if (!fineco && !canary) throw evaluationError('question_unknown')
    return fineco || canary
  }

  async ensureSession() {
    if (this.cookie) return
    if (this.sessionPromise) return this.sessionPromise
    this.sessionPromise = this.loginAndAcceptDisclaimer().finally(() => {
      this.sessionPromise = null
    })
    await this.sessionPromise
  }

  async loginAndAcceptDisclaimer() {
    const loginResponse = await fetchWithTimeout(
      urlFor(this.apiOrigin, '/api/graphql'),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-graphql-yoga-csrf': '1',
        },
        body: JSON.stringify({
          operationName: 'LoginParticipant',
          query: LOGIN_MUTATION,
          variables: {
            usernameOrEmail: this.participantUsername,
            password: this.participantPassword,
          },
        }),
      },
      this.requestTimeoutMs
    )
    const loginBody = await readJsonResponse(loginResponse, 'participant_login')
    if (Array.isArray(loginBody.errors) && loginBody.errors.length > 0) {
      throw evaluationError('participant_login_rejected')
    }
    if (!loginBody?.data?.loginParticipant) {
      throw evaluationError('participant_login_rejected')
    }
    const cookie = participantCookie(loginResponse.headers)

    const disclaimerResponse = await fetchWithTimeout(
      urlFor(this.chatOrigin, `/api/chatbots/${this.chatbotId}/disclaimer`),
      { headers: requestHeaders(cookie) },
      this.requestTimeoutMs
    )
    const disclaimerBody = await readJsonResponse(
      disclaimerResponse,
      'disclaimer_read'
    )
    const status = disclaimerBody?.status
    if (
      typeof status?.required !== 'boolean' ||
      typeof status.accepted !== 'boolean'
    ) {
      throw evaluationError('disclaimer_status_invalid')
    }
    if (status?.required && !status.accepted) {
      const disclaimerId = status.disclaimerId || disclaimerBody?.disclaimer?.id
      if (!disclaimerId) throw evaluationError('disclaimer_id_missing')
      const acceptResponse = await fetchWithTimeout(
        urlFor(this.chatOrigin, `/api/chatbots/${this.chatbotId}/disclaimer`),
        {
          method: 'POST',
          headers: requestHeaders(cookie),
          body: JSON.stringify({ action: 'accept', disclaimerId }),
        },
        this.requestTimeoutMs
      )
      const acceptBody = await readJsonResponse(
        acceptResponse,
        'disclaimer_accept'
      )
      if (acceptBody?.success !== true) {
        throw evaluationError('disclaimer_accept_rejected')
      }
    }
    this.cookie = cookie
  }

  async createThread() {
    const response = await fetchWithTimeout(
      urlFor(this.chatOrigin, `/api/chatbots/${this.chatbotId}/threads`),
      {
        method: 'POST',
        headers: requestHeaders(this.cookie),
        body: JSON.stringify({ title: null }),
      },
      this.requestTimeoutMs
    )
    const body = await readJsonResponse(response, 'thread_create')
    if (typeof body?.id !== 'string' || !body.id) {
      throw evaluationError('thread_id_missing')
    }
    return body.id
  }

  async submitTurn({
    question,
    mode,
    threadId,
    userMessageId,
    assistantMessageId,
    maxStreamBytes,
    history = [],
    parentId = null,
  }) {
    const response = await fetchWithTimeout(
      urlFor(this.chatOrigin, `/api/chatbots/${this.chatbotId}/chat`),
      {
        method: 'POST',
        headers: {
          ...requestHeaders(this.cookie),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: [
            ...history,
            { id: userMessageId, role: 'user', content: question },
          ],
          threadId,
          selectedModel: this.modelId,
          selectedMode: mode,
          reasoningEffort: 'low',
          parentId,
          assistantMessageId,
          images: [],
        }),
      },
      this.requestTimeoutMs
    )
    if (!response.ok) {
      response[RESPONSE_TIMEOUT_CLEANUP]?.()
      throw safeStatusError('chat_submit', response)
    }
    return drainResponse(response, maxStreamBytes)
  }

  async pollThreadMessages(threadId, messageId) {
    const deadline = Date.now() + this.pollTimeoutMs
    while (Date.now() < deadline) {
      const response = await fetchWithTimeout(
        urlFor(
          this.chatOrigin,
          `/api/chatbots/${this.chatbotId}/threads/${threadId}/messages`
        ),
        { headers: requestHeaders(this.cookie) },
        Math.min(
          this.requestTimeoutMs,
          10_000,
          Math.max(1, deadline - Date.now())
        )
      )
      const body = await readJsonResponse(response, 'message_read')
      if (
        Array.isArray(body) &&
        body.some((candidate) => candidate?.id === messageId)
      ) {
        return body
      }
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, this.pollIntervalMs)
      )
    }
    throw evaluationError('assistant_message_timeout')
  }

  async readCompletedMessage(threadId, assistantMessageId, mode) {
    const messages = await this.pollThreadMessages(threadId, assistantMessageId)
    const message = messages.find(
      (candidate) => candidate?.id === assistantMessageId
    )
    if (!message) throw evaluationError('assistant_message_timeout')
    if (message.chatMode !== mode) throw evaluationError('chat_mode_mismatch')
    if (message.modelId !== this.modelId) {
      throw evaluationError('chat_model_mismatch')
    }
    return message
  }

  async runQuestion(question) {
    const metadata = await this.resolveQuestion(question)
    await this.ensureSession()
    const threadId = await this.createThread()
    const userMessageId = randomUUID()
    const assistantMessageId = randomUUID()
    await this.submitTurn({
      question: metadata.question,
      mode: metadata.mode,
      threadId,
      userMessageId,
      assistantMessageId,
      maxStreamBytes: metadata.maxStreamBytes || this.maxStreamBytes,
    })
    const message = await this.readCompletedMessage(
      threadId,
      assistantMessageId,
      metadata.mode
    )
    const result = extractAssistantMessage(message)
    if (
      metadata.source === 'canary' &&
      !result.toolCalls.some((call) => call.name === metadata.expectedTool)
    ) {
      throw evaluationError('canary_tool_missing')
    }
    return { metadata, ...result }
  }

  // Drives one synthetic trajectory: every turn is submitted with the full
  // persisted history and the previous assistant message as parent, and the
  // persisted thread is re-read and verified before the next learner turn is
  // built. `beforeTurn` runs immediately before a turn is submitted (the CLI
  // counts the request there); `onTurn` receives the sanitized receipt after
  // verification.
  async runTrajectory(definition, options = {}) {
    const plan = validateTrajectoryCase(definition)
    const { arm = null, repeat = 0, beforeTurn, onTurn } = options ?? {}

    await this.ensureSession()
    const threadId = await this.createThread()

    const history = []
    const chain = []
    const receipts = []
    let previousAssistantId = null
    let lastVisibleAnswer = null

    for (let index = 0; index < plan.turns.length; index += 1) {
      const turn = plan.turns[index]
      const turnNumber = index + 1
      let userText
      if (turn.repeatPrevious === true) {
        if (lastVisibleAnswer === null) {
          throw evaluationError('trajectory_repeat_unavailable')
        }
        userText = lastVisibleAnswer + turn.suffix
      } else {
        userText = turn.message
      }

      if (typeof beforeTurn === 'function') {
        await beforeTurn({ caseId: plan.id, turn: turnNumber, mode: plan.mode })
      }

      const entry = {
        turn: turnNumber,
        userMessageId: randomUUID(),
        assistantMessageId: randomUUID(),
        parentId: previousAssistantId,
        userText,
      }
      const startedAt = Date.now()
      const stream = await this.submitTurn({
        question: userText,
        mode: plan.mode,
        threadId,
        userMessageId: entry.userMessageId,
        assistantMessageId: entry.assistantMessageId,
        maxStreamBytes: this.maxStreamBytes,
        history,
        parentId: previousAssistantId,
      })
      const messages = await this.pollThreadMessages(
        threadId,
        entry.assistantMessageId
      )
      const verified = verifyTrajectoryTurn({
        messages,
        chain: [...chain, entry],
        mode: plan.mode,
        modelId: this.modelId,
        stream,
      })

      const receipt = {
        type: 'turn',
        arm,
        caseId: plan.id,
        group: plan.group,
        language: plan.language,
        mode: plan.mode,
        support: plan.support,
        repeat,
        turn: turnNumber,
        threadId,
        userMessageId: entry.userMessageId,
        assistantMessageId: entry.assistantMessageId,
        parentId: previousAssistantId,
        model: this.modelId,
        userText: verified.userText,
        assistantText: verified.assistantText,
        sources: verified.sources,
        toolName: verified.toolName,
        toolStatus: verified.toolStatus,
        latencyMs: Date.now() - startedAt,
        creditsUsed: finiteCredits(stream?.creditsUsed) ?? verified.creditsUsed,
        recordedAt: new Date().toISOString(),
      }

      entry.assistantText = verified.assistantText
      chain.push(entry)
      history.push({
        id: entry.userMessageId,
        role: 'user',
        content: verified.userText,
      })
      history.push({
        id: entry.assistantMessageId,
        role: 'assistant',
        content: verified.assistantText,
      })
      previousAssistantId = entry.assistantMessageId
      lastVisibleAnswer = verified.assistantText
      receipts.push(receipt)

      if (typeof onTurn === 'function') await onTurn(receipt)
    }

    return { caseId: plan.id, threadId, receipts }
  }

  async complete(body) {
    if (!body || typeof body !== 'object')
      throw evaluationError('request_invalid')
    if (body.model !== this.modelId) throw evaluationError('model_mismatch')
    if (body.stream === true) throw evaluationError('stream_must_be_false')
    if (!Array.isArray(body.messages) || body.messages.length !== 1) {
      throw evaluationError('single_user_message_required')
    }
    const [message] = body.messages
    if (message?.role !== 'user' || typeof message.content !== 'string') {
      throw evaluationError('single_user_message_required')
    }
    const question = message.content.trim()
    if (!question) throw evaluationError('question_empty')
    const result = await this.runQuestion(question)
    return {
      payload: completionPayload(this.modelId, result),
      source: result.metadata.source,
    }
  }
}

function errorStatus(error) {
  if (
    [
      'request_invalid',
      'model_mismatch',
      'stream_must_be_false',
      'single_user_message_required',
      'question_empty',
      'question_unknown',
      'question_ambiguous',
      'request_body_invalid_json',
      'request_body_too_large',
    ].includes(error?.code)
  ) {
    return 400
  }
  if (error?.code === 'busy') return 429
  return 502
}

export function createEvaluationServer({ target, apiKey }) {
  if (!target || !apiKey) throw evaluationError('server_configuration_missing')
  let inFlight = false

  return createServer(async (request, response) => {
    let pathname
    try {
      pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname
    } catch {
      responseJson(response, { error: 'request_invalid' }, 400)
      return
    }
    if (pathname === '/healthz' && request.method === 'GET') {
      responseJson(response, { ok: true })
      return
    }

    if (!tokenMatches(bearerToken(request), apiKey)) {
      responseJson(response, { error: 'unauthorized' }, 401)
      return
    }

    if (pathname === '/v1/models' && request.method === 'GET') {
      responseJson(response, {
        object: 'list',
        data: [
          { id: target.modelId, object: 'model', owned_by: 'klicker-local' },
        ],
      })
      return
    }

    if (pathname !== '/v1/chat/completions' || request.method !== 'POST') {
      responseJson(response, { error: 'not_found' }, 404)
      return
    }
    if (inFlight) {
      responseJson(response, { error: 'busy' }, 429)
      return
    }

    inFlight = true
    try {
      const body = await readRequestBody(request)
      const result = await target.complete(body)
      responseJson(response, result.payload, 200, {
        'X-Klicker-Evaluation-Source': result.source,
      })
    } catch (error) {
      responseJson(
        response,
        { error: error?.code || 'target_failed' },
        errorStatus(error)
      )
    } finally {
      inFlight = false
    }
  })
}

export async function createTargetFromEnvironment(env = process.env) {
  const target = new KlickerEvaluationTarget({
    apiOrigin: env.KLICKER_EVAL_API_ORIGIN,
    chatOrigin: env.KLICKER_EVAL_CHAT_ORIGIN,
    apiKey: env.KLICKER_EVAL_TARGET_KEY,
    participantUsername: env.KLICKER_EVAL_PARTICIPANT_USERNAME,
    participantPassword: env.KLICKER_EVAL_PARTICIPANT_PASSWORD,
    chatbotId: env.KLICKER_EVAL_CHATBOT_ID || DEFAULT_CHATBOT_ID,
    modelId: env.KLICKER_EVAL_MODEL_ID || DEFAULT_MODEL_ID,
    groundTruthDirectory: env.KLICKER_EVAL_GT_DIR,
    canaryFixture: env.KLICKER_EVAL_CANARY_FILE,
    maxStreamBytes:
      Number(env.KLICKER_EVAL_MAX_STREAM_BYTES) || DEFAULT_MAX_STREAM_BYTES,
    pollIntervalMs:
      Number(env.KLICKER_EVAL_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
    pollTimeoutMs:
      Number(env.KLICKER_EVAL_POLL_TIMEOUT_MS) || DEFAULT_POLL_TIMEOUT_MS,
    requestTimeoutMs:
      Number(env.KLICKER_EVAL_REQUEST_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS,
  })
  if (!target.groundTruthDirectory || !target.canaryFixture) {
    throw evaluationError('target_fixture_paths_missing')
  }
  await target.initialize()
  return target
}

export async function main() {
  const target = await createTargetFromEnvironment()
  const server = createEvaluationServer({
    target,
    apiKey: process.env.KLICKER_EVAL_TARGET_KEY,
  })
  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      process.exitCode = 1
      return
    }
    process.stdout.write(`KLICKER_EVAL_TARGET_PORT=${address.port}\n`)
  })
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `klicker-evaluation-target: ${error?.code || 'startup_failed'}\n`
    )
    process.exitCode = 1
  })
}
