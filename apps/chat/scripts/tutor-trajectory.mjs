// Multi-turn trajectory support for the local Klicker evaluation target: the
// corpus schema, verification of each persisted turn against its stream, and
// the driver that chains real assistant replies into the next learner turn.
// Transport (login, thread creation, streaming, polling) stays in
// klicker-evaluation-target.mjs.

import { randomUUID } from 'node:crypto'

import { evaluationError, finiteCredits } from './klicker-evaluation-target.mjs'

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
  const streamedCalls = (stream?.toolCalls ?? []).filter(
    (call) => call.toolName === EXPECTED_DOC_QUERY_TOOL
  )
  const persistedCalls = (persistedAssistant.content ?? []).filter(
    (part) =>
      part?.type === 'tool-call' && part.toolName === EXPECTED_DOC_QUERY_TOOL
  )
  const streamedIds = streamedCalls.map((call) => call.toolCallId).sort()
  const persistedIds = persistedCalls.map((part) => part.toolCallId).sort()
  if (
    streamedCalls.some(
      (call) => !call.output || typeof call.toolCallId !== 'string'
    ) ||
    persistedCalls.some((part) => typeof part.toolCallId !== 'string') ||
    new Set(streamedIds).size !== streamedIds.length ||
    JSON.stringify(streamedIds) !== JSON.stringify(persistedIds)
  ) {
    throw evaluationError('trajectory_tool_identity_mismatch')
  }
  const streamCredits = finiteCredits(stream?.creditsUsed)
  const persistedCredits = finiteCredits(persistedAssistant.creditsUsed)
  if (
    streamCredits !== null &&
    persistedCredits !== null &&
    streamCredits !== persistedCredits
  ) {
    throw evaluationError('credits_mismatch')
  }

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

// Drives one synthetic trajectory: every turn is submitted with the full
// persisted history and the previous assistant message as parent, and the
// persisted thread is re-read and verified before the next learner turn is
// built. `beforeTurn` runs immediately before a turn is submitted (the CLI
// counts the request there); `onTurn` receives the sanitized receipt after
// verification.
export async function runTrajectory(target, definition, options = {}) {
  const plan = validateTrajectoryCase(definition)
  const { arm = null, repeat = 0, beforeTurn, onTurn } = options ?? {}

  await target.ensureSession()
  const threadId = await target.createThread()

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
    const stream = await target.submitTurn({
      question: userText,
      mode: plan.mode,
      threadId,
      userMessageId: entry.userMessageId,
      assistantMessageId: entry.assistantMessageId,
      maxStreamBytes: target.maxStreamBytes,
      history,
      parentId: previousAssistantId,
    })
    const messages = await target.pollThreadMessages(
      threadId,
      entry.assistantMessageId
    )
    const verified = verifyTrajectoryTurn({
      messages,
      chain: [...chain, entry],
      mode: plan.mode,
      modelId: target.modelId,
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
      model: target.modelId,
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
