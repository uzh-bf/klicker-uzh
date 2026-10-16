#!/usr/bin/env node
'use strict'

// Runner-local loopback adapter that exposes an OpenAI-compatible chat
// completions endpoint backed by one fixed Mistral upstream. OpenCodeReview
// talks to this process over loopback with a short-lived capability token; the
// real upstream key never leaves the adapter. Native Mistral assistant
// messages are retained in bounded process memory and restored when OCR
// replays a conversation, because the flattened OpenAI transcript loses the
// reasoning chunks the reasoning model needs to continue.

const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { StringDecoder } = require('node:string_decoder')

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL = 'zai-glm-5-3'
const MISTRAL_EFFORT = 'max'

// USD per million tokens, checked 2026-10-16 against the provider's model page.
const MISTRAL_PRICING = {
  date: '2026-10-16',
  source: 'https://docs.mistral.ai/models/zai-glm-5-3',
  input: 1.4,
  cachedInput: 0.14,
  output: 4.4,
}
const COST_STAGES = ['adapter', 'preflight', 'topology']
const COST_USAGE_FIELDS = [
  'prompt_tokens',
  'completion_tokens',
  'cached_prompt_tokens',
  'uncached_prompt_tokens',
  'responses',
  'upstream_attempts',
  'missing_usage',
  'cache_usage_responses',
  'missing_cache_usage',
  'invalid_cache_usage',
  'unfinished_requests',
]

const MAX_REQUEST_BYTES = 2 * 1024 * 1024
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000
const DEFAULT_MAX_LIFETIME_MS = 50 * 60 * 1000
const DEFAULT_MAX_HISTORY_ENTRIES = 2000
const DEFAULT_MAX_HISTORY_BYTES = 128 * 1024 * 1024
const STARTUP_TIMEOUT_MS = 5000
const SHUTDOWN_TIMEOUT_MS = 5000
const SHUTDOWN_DRAIN_TIMEOUT_MS = 1000
const MAX_DIAGNOSTIC_CONVERSATIONS = 256

const LOOPBACK_HOST = '127.0.0.1'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const CHAT_PATH = '/v1/chat/completions'
const SHUTDOWN_PATH = '/shutdown'

// Only explicitly supported OpenAI-compatible fields reach Mistral. Anything else
// in the incoming body (reasoning, provider, thinking, stream_options, ...) is
// dropped by omission rather than copied and filtered.
const PASSTHROUGH_FIELDS = [
  'temperature',
  'top_p',
  'top_k',
  'n',
  'stop',
  'presence_penalty',
  'frequency_penalty',
  'random_seed',
  'seed',
  'response_format',
  'logprobs',
  'top_logprobs',
  'parallel_tool_calls',
  'prediction',
  'prompt_mode',
  'tools',
  'tool_choice',
]

const CLIENT_ERROR_CODES = new Set([
  'invalid_request',
  'invalid_json',
  'malformed_chunk',
  'malformed_tool_calls',
  'model_mismatch',
  'stream_unsupported',
])

class AdapterError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'AdapterError'
    this.code = code
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flattenText(content) {
  if (content === undefined || content === null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk
        if (
          isPlainObject(chunk) &&
          typeof chunk.text === 'string' &&
          (chunk.type === undefined || chunk.type === 'text')
        ) {
          return chunk.text
        }
        throw new AdapterError(
          'malformed_chunk',
          'unrecognized response chunk shape'
        )
      })
      .join('')
  }
  throw new AdapterError('malformed_chunk', 'unrecognized response content')
}

// Thinking may nest: a thinking chunk can carry an array of text parts, or a
// deeper thinking chunk. The extraction is order preserving and deterministic
// so the same value can be reused as part of the conversation identity.
function extractThinkingChunk(chunk) {
  if (typeof chunk === 'string') return chunk
  if (isPlainObject(chunk)) {
    if (typeof chunk.thinking === 'string') return chunk.thinking
    if (chunk.thinking !== undefined) return extractThinking(chunk.thinking)
    if (typeof chunk.text === 'string') return chunk.text
  }
  throw new AdapterError(
    'malformed_chunk',
    'unrecognized reasoning chunk shape'
  )
}

function extractThinking(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    let out = ''
    for (const chunk of value) out += extractThinkingChunk(chunk)
    return out
  }
  throw new AdapterError('malformed_chunk', 'unrecognized reasoning shape')
}

// reasoning_content is either a plain string or a list of nested thinking and
// text parts.
function extractReasoning(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return extractThinking(value)
  throw new AdapterError('malformed_chunk', 'unrecognized reasoning shape')
}

// The upstream can return thinking chunks inside message.content alongside the
// answer text. Only text chunks contribute to the OCR-facing answer; thinking
// chunks are concatenated into reasoning_content. The native chunks are never
// mutated, they are retained verbatim in adapter memory.
function splitContent(content) {
  if (content === undefined || content === null) {
    return { text: '', thinking: '' }
  }
  if (typeof content === 'string') return { text: content, thinking: '' }
  if (!Array.isArray(content)) {
    throw new AdapterError('malformed_chunk', 'unrecognized response content')
  }
  let text = ''
  let thinking = ''
  for (const chunk of content) {
    if (typeof chunk === 'string') {
      text += chunk
      continue
    }
    if (isPlainObject(chunk)) {
      if (
        typeof chunk.text === 'string' &&
        (chunk.type === undefined || chunk.type === 'text')
      ) {
        text += chunk.text
        continue
      }
      if (chunk.type === 'thinking' || chunk.thinking !== undefined) {
        if (chunk.thinking !== undefined) {
          thinking += extractThinking(chunk.thinking)
        } else if (typeof chunk.text === 'string') {
          thinking += chunk.text
        } else {
          throw new AdapterError(
            'malformed_chunk',
            'unrecognized response chunk shape'
          )
        }
        continue
      }
    }
    throw new AdapterError(
      'malformed_chunk',
      'unrecognized response chunk shape'
    )
  }
  return { text, thinking }
}

function serializeToolArguments(value) {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return '{}'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeToolCalls(toolCalls) {
  if (toolCalls === undefined || toolCalls === null) return undefined
  if (!Array.isArray(toolCalls)) {
    throw new AdapterError(
      'malformed_tool_calls',
      'tool_calls must be an array'
    )
  }
  return toolCalls.map((call, index) => {
    if (!isPlainObject(call)) {
      throw new AdapterError('malformed_tool_calls', 'tool call is malformed')
    }
    const fn = call.function
    if (!isPlainObject(fn) || typeof fn.name !== 'string') {
      throw new AdapterError(
        'malformed_tool_calls',
        'tool call function is malformed'
      )
    }
    return {
      id: typeof call.id === 'string' ? call.id : `call_${index}`,
      type: 'function',
      function: {
        name: fn.name,
        arguments: serializeToolArguments(fn.arguments),
      },
    }
  })
}

function normalizeAssistantMessage(message) {
  if (!isPlainObject(message)) {
    throw new AdapterError('malformed_response', 'response message is missing')
  }
  try {
    const { text, thinking } = splitContent(message.content)
    const reasoning = thinking + extractReasoning(message.reasoning_content)
    const toolCalls = normalizeToolCalls(message.tool_calls)
    // The OCR-facing content is the final text only: strict topology JSON must
    // parse and private thinking must never be mixed into review content. The
    // thinking is retained separately in reasoning_content.
    const normalized = { role: 'assistant', content: text }
    if (reasoning) normalized.reasoning_content = reasoning
    if (toolCalls) normalized.tool_calls = toolCalls
    return normalized
  } catch (error) {
    if (
      error instanceof AdapterError &&
      (error.code === 'malformed_chunk' ||
        error.code === 'malformed_tool_calls')
    ) {
      throw new AdapterError('malformed_response', 'invalid assistant response')
    }
    throw error
  }
}

function normalizeUsage(usage) {
  if (!isPlainObject(usage)) return undefined
  const normalized = {}
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    if (Number.isFinite(usage[key])) normalized[key] = usage[key]
  }
  const cached = usage.prompt_tokens_details?.cached_tokens
  if (
    Number.isSafeInteger(cached) &&
    cached >= 0 &&
    Number.isSafeInteger(normalized.prompt_tokens) &&
    cached <= normalized.prompt_tokens
  ) {
    normalized.prompt_tokens_details = { cached_tokens: cached }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

// OCR budgets, reports and resumes on the usage it receives. Cache reads cost a
// tenth of uncached input, so OCR sees billable usage: uncached prompt plus
// completion tokens. Without a valid cache report or completion count the usage
// passes through unchanged and the full prompt counts.
// Adapter diagnostics keep the raw provider usage.
function billableUsage(usage) {
  const cached = usage?.prompt_tokens_details?.cached_tokens
  if (cached === undefined || !Number.isSafeInteger(usage.completion_tokens)) {
    return usage
  }
  const promptTokens = usage.prompt_tokens - cached
  return {
    prompt_tokens: promptTokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: promptTokens + usage.completion_tokens,
  }
}

// The OCR-facing content is the final text only so strict topology JSON still
// parses and private thinking never reaches review content; the concatenated
// thinking is kept separately in reasoning_content.
function normalizeMistralResponse(payload) {
  if (!isPlainObject(payload)) {
    throw new AdapterError('malformed_response', 'response must be an object')
  }
  // The fixed upstream must answer for the fixed model; a different model in
  // the payload means the request was routed somewhere unexpected.
  if (payload.model !== MISTRAL_MODEL) {
    throw new AdapterError(
      'response_model_mismatch',
      'upstream model does not match the fixed adapter model'
    )
  }
  const choices = payload.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AdapterError('malformed_response', 'response has no choices')
  }
  const choice = choices[0]
  if (!isPlainObject(choice)) {
    throw new AdapterError('malformed_response', 'response choice is malformed')
  }
  const message = normalizeAssistantMessage(choice.message)
  if (typeof choice.finish_reason !== 'string') {
    throw new AdapterError('malformed_response', 'completion status is missing')
  }
  const finishReason = choice.finish_reason
  const normalized = {
    id:
      typeof payload.id === 'string'
        ? payload.id
        : `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Number.isInteger(payload.created)
      ? payload.created
      : Math.floor(Date.now() / 1000),
    model: MISTRAL_MODEL,
    choices: [{ index: 0, message, finish_reason: finishReason }],
  }
  const usage = normalizeUsage(payload.usage)
  if (usage) normalized.usage = usage
  return normalized
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isPlainObject(value)) {
    const ordered = {}
    for (const key of Object.keys(value).sort()) {
      ordered[key] = canonicalize(value[key])
    }
    return ordered
  }
  return value === undefined ? null : value
}

function hashIdentity(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

function contentIdentity(content) {
  if (content === undefined || content === null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return flattenText(content)
  throw new AdapterError('invalid_request', 'unsupported message content')
}

// A turn identity is the message fields OCR can echo back, never the tool-call
// id alone: concurrent review groups can reuse ids, so the full turn plus the
// preceding history disambiguates them. reasoning_content is excluded because
// the CLI may accept but not echo that field, so a replay identity must match
// on the actual final text even when the thinking is omitted.
function messageIdentity(message) {
  if (!isPlainObject(message)) {
    throw new AdapterError('invalid_request', 'message must be an object')
  }
  const identity = {
    role: typeof message.role === 'string' ? message.role : null,
    content: contentIdentity(message.content),
  }
  if (message.role === 'assistant') {
    const toolCalls = normalizeToolCalls(message.tool_calls)
    if (toolCalls) identity.tool_calls = toolCalls
  } else {
    if (typeof message.tool_call_id === 'string') {
      identity.tool_call_id = message.tool_call_id
    }
    if (typeof message.name === 'string') identity.name = message.name
  }
  return identity
}

function normalizeMessage(message) {
  if (!isPlainObject(message)) {
    throw new AdapterError('invalid_request', 'message must be an object')
  }
  const normalized = { role: message.role }
  normalized.content = contentIdentity(message.content)
  if (message.role === 'assistant') {
    const reasoning = extractReasoning(message.reasoning_content)
    if (reasoning) normalized.reasoning_content = reasoning
    const toolCalls = normalizeToolCalls(message.tool_calls)
    if (toolCalls) normalized.tool_calls = toolCalls
  } else {
    if (typeof message.tool_call_id === 'string') {
      normalized.tool_call_id = message.tool_call_id
    }
    if (typeof message.name === 'string') normalized.name = message.name
  }
  return normalized
}

// Bounded per-listener memory of native assistant turns. Entries are keyed by
// the normalized assistant turn together with the preceding history. A second
// store of the same turn is fine; a conflicting native for the same identity, a
// bound overflow, or a replay that cannot be matched fails closed instead of
// silently forwarding the flattened transcript.
function createHistoryStore(options = {}) {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_HISTORY_ENTRIES
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_HISTORY_BYTES
  const native = new Map()
  const reasonedTurns = new Map()
  const diagnostics = {
    prefix_hits: 0,
    compressed_hits: 0,
    misses: 0,
    replay_bytes: 0,
  }
  let entries = 0
  let bytes = 0

  function keyFor(prefixIdentities, assistantIdentity) {
    return hashIdentity({
      prefix: prefixIdentities,
      assistant: assistantIdentity,
    })
  }

  function reasonedKey(message) {
    const reasoning = extractReasoning(message.reasoning_content)
    if (!reasoning) return undefined
    return hashIdentity({ assistant: messageIdentity(message), reasoning })
  }

  function remember(prefixMessages, nativeMessage) {
    const normalized = normalizeAssistantMessage(nativeMessage)
    const prefix = prefixMessages.map(messageIdentity)
    const identity = messageIdentity(normalized)
    const key = keyFor(prefix, identity)
    const serialized = JSON.stringify(nativeMessage)
    const size = Buffer.byteLength(serialized, 'utf8')
    const existing = native.get(key)
    if (existing) {
      if (existing.serialized !== serialized) {
        throw new AdapterError(
          'history_collision',
          'conflicting native reasoning for an identical turn'
        )
      }
      return
    }
    if (entries + 1 > maxEntries || bytes + size > maxBytes) {
      throw new AdapterError(
        'history_exhausted',
        'native reasoning history bound exceeded'
      )
    }
    const restorable = { ...nativeMessage }
    delete restorable.index
    const entry = { serialized, size, digest: hashIdentity(restorable) }
    native.set(key, entry)
    const turnKey = reasonedKey(normalized)
    if (turnKey) {
      // Compression rewrites the prefix. Only an exact reasoned turn with one
      // distinct native payload can be restored independently of that prefix.
      const prior = reasonedTurns.get(turnKey)
      if (!reasonedTurns.has(turnKey)) reasonedTurns.set(turnKey, entry)
      else if (prior?.digest !== entry.digest) reasonedTurns.set(turnKey, null)
    }
    entries += 1
    bytes += size
  }

  function restoreAssistant(prefixMessages, message) {
    const normalized = normalizeMessage(message)
    const prefix = prefixMessages.map(messageIdentity)
    const identity = messageIdentity(normalized)
    const key = keyFor(prefix, identity)
    let existing = native.get(key)
    if (existing) diagnostics.prefix_hits += 1
    else {
      const turnKey = reasonedKey(normalized)
      existing = turnKey ? reasonedTurns.get(turnKey) : undefined
      if (existing === null) {
        diagnostics.misses += 1
        throw new AdapterError('history_collision', 'ambiguous compressed turn')
      }
      if (existing) diagnostics.compressed_hits += 1
    }
    if (!existing) {
      // Every replayed assistant turn must be one this adapter produced and
      // retained. A miss means flattening would silently lose the native
      // reasoning, so it fails closed even when the SDK omitted
      // reasoning_content, rather than falling back to the flattened turn. The
      // binary's first request carries no assistant messages.
      diagnostics.misses += 1
      throw new AdapterError(
        'history_missing',
        'native assistant state is unavailable for a replayed turn'
      )
    }
    const nativeMessage = JSON.parse(existing.serialized)
    diagnostics.replay_bytes += existing.size
    // Mistral returns a message index but rejects it in request messages.
    delete nativeMessage.index
    return nativeMessage
  }

  function restoreMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new AdapterError('invalid_request', 'request must include messages')
    }
    return messages.map((message, index) => {
      if (message?.role === 'assistant') {
        return restoreAssistant(messages.slice(0, index), message)
      }
      return normalizeMessage(message)
    })
  }

  return {
    remember,
    restoreMessages,
    entryCount: () => entries,
    byteCount: () => bytes,
    diagnostics: () => ({ ...diagnostics }),
  }
}

function translateMistralRequest(body, history = createHistoryStore()) {
  if (!isPlainObject(body)) {
    throw new AdapterError('invalid_request', 'request body must be an object')
  }
  if (body.stream === true) {
    throw new AdapterError(
      'stream_unsupported',
      'streaming responses are not supported'
    )
  }
  if (
    body.model !== undefined &&
    body.model !== null &&
    body.model !== MISTRAL_MODEL
  ) {
    throw new AdapterError(
      'model_mismatch',
      'requested model is not the fixed adapter model'
    )
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new AdapterError('invalid_request', 'request must include messages')
  }
  const effort = body.reasoning_effort ?? MISTRAL_EFFORT
  if (effort !== 'high' && effort !== 'max') {
    throw new AdapterError(
      'invalid_request',
      'reasoning effort must be high or max'
    )
  }

  const translated = {
    model: MISTRAL_MODEL,
    messages: history.restoreMessages(body.messages),
    reasoning_effort: effort,
  }
  if (body.prompt_cache_key !== undefined) {
    if (
      typeof body.prompt_cache_key !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(body.prompt_cache_key)
    ) {
      throw new AdapterError('invalid_request', 'invalid prompt cache key')
    }
    translated.prompt_cache_key = body.prompt_cache_key
  }
  for (const field of PASSTHROUGH_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      translated[field] = body[field]
    }
  }
  const maxTokens =
    body.max_completion_tokens !== undefined &&
    body.max_completion_tokens !== null
      ? body.max_completion_tokens
      : body.max_tokens
  if (maxTokens !== undefined && maxTokens !== null) {
    translated.max_tokens = maxTokens
  }
  if (hasCompletionTool(body) && typeof translated.tool_choice !== 'object') {
    // OCR completes through task_done. Optional tool use lets a prose answer
    // enter its zero-tool retry path, which replays the growing history.
    translated.tool_choice = 'any'
  }
  return translated
}

function hasCompletionTool(body) {
  return (
    Array.isArray(body.tools) &&
    body.tools.some(
      (tool) => tool?.type === 'function' && tool.function?.name === 'task_done'
    )
  )
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function isAuthorized(headers, token) {
  const header = headers.authorization
  if (typeof header !== 'string') return false
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) return false
  return timingSafeEqual(match[1], token)
}

function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return
  const body = JSON.stringify(payload)
  try {
    res.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  } catch {
    // The caller disconnected; there is nothing to report upstream.
  }
}

function statusForErrorCode(code) {
  if (
    code === 'required_tool_call_missing' ||
    code === 'truncated_completion'
  ) {
    return 422
  }
  if (code === 'request_too_large') return 413
  if (code === 'upstream_timeout') return 504
  if (code === 'history_missing') return 409
  if (code === 'history_collision' || code === 'history_exhausted') return 502
  if (CLIENT_ERROR_CODES.has(code)) return 400
  return 502
}

function sendAdapterError(res, error) {
  const code = error instanceof AdapterError ? error.code : 'internal_error'
  sendJson(res, statusForErrorCode(code), {
    error: { message: 'adapter request failed', code },
  })
}

function readRequestBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let received = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      received += chunk.length
      if (tooLarge) {
        if (received > limit * 4) {
          reject(
            new AdapterError('request_too_large', 'request body too large')
          )
          req.destroy()
        }
        return
      }
      if (received > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        reject(new AdapterError('request_too_large', 'request body too large'))
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
    req.on('close', () => {
      if (!req.complete) {
        reject(new AdapterError('invalid_request', 'request body incomplete'))
      }
    })
  })
}

async function readBoundedBody(response, limit) {
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > limit) {
        try {
          await reader.cancel()
        } catch {
          // Ignore cancellation errors while failing closed on size.
        }
        throw new AdapterError(
          'response_too_large',
          'upstream response too large'
        )
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks).toString('utf8')
  }
  throw new AdapterError(
    'upstream_error',
    'upstream returned no streaming body'
  )
}

async function drain(response, limit) {
  try {
    await readBoundedBody(response, limit)
  } catch {
    // The diagnostic body is discarded on purpose.
  }
}

function createExecutionCounters() {
  return {
    requests: 0,
    upstream_attempts: 0,
    responses: 0,
    missing_usage: 0,
    main_no_tool_responses: 0,
    length_finishes: 0,
    truncated_completions: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cached_prompt_tokens: 0,
    uncached_prompt_tokens: 0,
    cache_usage_responses: 0,
    missing_cache_usage: 0,
    invalid_cache_usage: 0,
    max_request_bytes: 0,
    request_bytes: 0,
    response_bytes: 0,
    request_duration_ms: 0,
  }
}

function recordResponseUsage(counter, usage, rawUsage) {
  counter.responses += 1
  let incompleteUsage = false
  for (const field of ['prompt_tokens', 'completion_tokens']) {
    const value = usage?.[field]
    if (Number.isSafeInteger(value) && value >= 0) counter[field] += value
    else incompleteUsage = true
  }
  if (incompleteUsage) counter.missing_usage += 1
  const cached = usage?.prompt_tokens_details?.cached_tokens
  if (cached !== undefined) {
    counter.cache_usage_responses += 1
    counter.cached_prompt_tokens += cached
    counter.uncached_prompt_tokens += usage.prompt_tokens - cached
  } else if (rawUsage?.prompt_tokens_details?.cached_tokens !== undefined) {
    counter.invalid_cache_usage += 1
  } else counter.missing_cache_usage += 1
}

async function startAdapter(options = {}) {
  const apiKey = options.apiKey
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxLifetimeMs = options.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS
  const maxRequestBytes = options.maxRequestBytes ?? MAX_REQUEST_BYTES
  const maxResponseBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES

  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new AdapterError('missing_api_key', 'an upstream API key is required')
  }
  if (typeof fetchImpl !== 'function') {
    throw new AdapterError(
      'missing_fetch',
      'a fetch implementation is required'
    )
  }

  const token = crypto.randomBytes(32).toString('hex')
  const history = createHistoryStore({
    maxEntries: options.maxHistoryEntries,
    maxBytes: options.maxHistoryBytes,
  })
  const diagnostics = {
    ...createExecutionCounters(),
    main_requests: 0,
    auxiliary_requests: 0,
    unattributed_requests: 0,
    omitted_conversation_requests: 0,
    unfinished_requests: 0,
  }
  const requestTypes = {
    main: createExecutionCounters(),
    auxiliary: createExecutionCounters(),
  }
  const conversationSalt = crypto.randomBytes(32)
  const conversations = new Map()
  const pendingRequests = new Set()
  const active = new Set()
  const sockets = new Set()
  let closing = null
  let resolveClosed
  const closed = new Promise((resolve) => {
    resolveClosed = resolve
  })

  function close() {
    if (closing) return closing
    closing = (async () => {
      clearTimeout(lifetime)
      for (const controller of active) {
        try {
          controller.abort()
        } catch {
          // Best effort: the request is already failing.
        }
      }
      active.clear()
      for (const socket of sockets) {
        socket.destroy()
      }
      let drainTimer
      try {
        await Promise.race([
          Promise.allSettled([...pendingRequests]),
          new Promise((resolve) => {
            drainTimer = setTimeout(resolve, SHUTDOWN_DRAIN_TIMEOUT_MS)
          }),
        ])
      } finally {
        clearTimeout(drainTimer)
      }
      diagnostics.unfinished_requests = pendingRequests.size
      try {
        options.onClose?.(snapshot())
      } catch {
        process.stderr.write('OCR adapter execution counters unavailable\n')
      }
      // Listener closure is the stop command's receipt. Persist diagnostics
      // first, while new work is refused, so artifact upload cannot race it.
      await new Promise((resolve) => {
        server.close(resolve)
        for (const socket of sockets) socket.destroy()
      })
      resolveClosed()
    })()
    return closing
  }

  function handleShutdown(res) {
    // The acknowledgement is written first so the caller observes a receipt;
    // the listener closes only after that response is flushed.
    sendJson(res, 200, { ok: true, closed: true })
    res.on('finish', () => {
      close()
    })
  }

  async function handleChat(req, res) {
    let raw
    try {
      raw = await readRequestBody(req, maxRequestBytes)
    } catch (error) {
      sendAdapterError(res, error)
      return
    }
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      sendJson(res, 400, {
        error: { message: 'adapter request failed', code: 'invalid_json' },
      })
      return
    }

    let mistralBody
    try {
      mistralBody = translateMistralRequest(body, history)
    } catch (error) {
      sendAdapterError(res, error)
      return
    }

    const main = hasCompletionTool(body)
    const kind = main ? 'main' : 'auxiliary'
    const counters = [diagnostics, requestTypes[kind]]
    if (mistralBody.prompt_cache_key) {
      const id = crypto
        .createHmac('sha256', conversationSalt)
        .update(`${kind}:${mistralBody.prompt_cache_key}`)
        .digest('hex')
        .slice(0, 32)
      if (
        !conversations.has(id) &&
        conversations.size < MAX_DIAGNOSTIC_CONVERSATIONS
      ) {
        conversations.set(id, { id, kind, ...createExecutionCounters() })
      }
      if (conversations.has(id)) counters.push(conversations.get(id))
      else diagnostics.omitted_conversation_requests += 1
    } else diagnostics.unattributed_requests += 1
    diagnostics[main ? 'main_requests' : 'auxiliary_requests'] += 1
    const startedAt = performance.now()
    const requestBody = JSON.stringify(mistralBody)
    const requestBytes = Buffer.byteLength(requestBody)
    for (const counter of counters) {
      counter.requests += 1
      counter.request_bytes += requestBytes
      counter.max_request_bytes = Math.max(
        counter.max_request_bytes,
        requestBytes
      )
    }

    const controller = new AbortController()
    active.add(controller)
    const abort = () => {
      try {
        controller.abort()
      } catch {
        // Already aborted.
      }
    }
    req.on('aborted', abort)
    res.on('close', () => {
      if (!res.writableEnded) abort()
    })
    const timer = setTimeout(() => {
      abort()
      sendAdapterError(res, new AdapterError('upstream_timeout', 'timeout'))
    }, timeoutMs)

    try {
      for (const counter of counters) counter.upstream_attempts += 1
      const upstream = await fetchImpl(MISTRAL_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        signal: controller.signal,
        redirect: 'error',
      })
      if (!upstream || typeof upstream.status !== 'number') {
        throw new AdapterError('upstream_error', 'invalid upstream response')
      }
      if (!upstream.ok) {
        await drain(upstream, maxResponseBytes)
        sendAdapterError(res, new AdapterError('upstream_error', 'status'))
        return
      }
      const text = await readBoundedBody(upstream, maxResponseBytes)
      let payload
      try {
        payload = JSON.parse(text)
      } catch {
        throw new AdapterError('malformed_response', 'invalid upstream JSON')
      }
      const normalized = normalizeMistralResponse(payload)
      const choice = normalized.choices[0]
      const responseBytes = Buffer.byteLength(text)
      for (const counter of counters) {
        recordResponseUsage(counter, normalized.usage, payload.usage)
        counter.response_bytes += responseBytes
        if (choice.finish_reason === 'length') counter.length_finishes += 1
      }
      if (
        main &&
        choice.finish_reason === 'length' &&
        choice.message.tool_calls?.some(
          (call) => call.function.name === 'task_done'
        )
      ) {
        for (const counter of counters) counter.truncated_completions += 1
        throw new AdapterError(
          'truncated_completion',
          'completion was truncated'
        )
      }
      if (main && !choice.message.tool_calls?.length) {
        for (const counter of counters) counter.main_no_tool_responses += 1
        // OCR can continue an interrupted native turn without treating it as
        // complete. Permit this once per replayed chain; repeated tool-free
        // answers still fail instead of entering an open-ended prose retry.
        const canContinue =
          choice.finish_reason === 'length' &&
          !body.messages.some(
            (message) =>
              message.role === 'assistant' && !message.tool_calls?.length
          )
        if (!canContinue) {
          throw new AdapterError(
            'required_tool_call_missing',
            'review requires a tool call'
          )
        }
      }
      const message = payload.choices[0].message
      history.remember(body.messages, message)
      if (normalized.usage) normalized.usage = billableUsage(normalized.usage)
      sendJson(res, 200, normalized)
    } catch (error) {
      sendAdapterError(res, error)
    } finally {
      const duration = Math.max(0, Math.round(performance.now() - startedAt))
      for (const counter of counters) counter.request_duration_ms += duration
      clearTimeout(timer)
      active.delete(controller)
    }
  }

  async function handleRequest(req, res) {
    if (!isAuthorized(req.headers, token)) {
      sendJson(res, 401, {
        error: { message: 'adapter request failed', code: 'unauthorized' },
      })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 404, {
        error: { message: 'adapter request failed', code: 'not_found' },
      })
      return
    }
    const pathname = new URL(req.url ?? '/', baseUrl).pathname
    if (pathname === SHUTDOWN_PATH) {
      handleShutdown(res)
      return
    }
    if (pathname === CHAT_PATH) {
      await handleChat(req, res)
      return
    }
    sendJson(res, 404, {
      error: { message: 'adapter request failed', code: 'not_found' },
    })
  }

  const server = http.createServer((req, res) => {
    if (closing) {
      sendJson(res, 503, {
        error: { message: 'adapter request failed', code: 'adapter_closing' },
      })
      return
    }
    const request = handleRequest(req, res).catch(() => {
      sendAdapterError(res, new AdapterError('internal_error', 'internal'))
    })
    pendingRequests.add(request)
    request.then(() => pendingRequests.delete(request))
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.requestTimeout = timeoutMs + 5000

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, LOOPBACK_HOST, resolve)
  })

  const baseUrl = `http://${LOOPBACK_HOST}:${server.address().port}`
  const lifetime = setTimeout(() => {
    close()
  }, maxLifetimeMs)
  if (typeof lifetime.unref === 'function') lifetime.unref()

  function snapshot() {
    return {
      schema_version: 1,
      ...diagnostics,
      request_types: {
        main: { ...requestTypes.main },
        auxiliary: { ...requestTypes.auxiliary },
      },
      conversations: [...conversations.values()].map((counter) => ({
        ...counter,
      })),
      history: history.diagnostics(),
    }
  }

  return {
    url: baseUrl,
    token,
    close,
    closed,
    diagnostics: snapshot,
  }
}

async function callMistral(options = {}) {
  const apiKey = options.apiKey
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxResponseBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES

  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new AdapterError('missing_api_key', 'an upstream API key is required')
  }
  if (typeof fetchImpl !== 'function') {
    throw new AdapterError(
      'missing_fetch',
      'a fetch implementation is required'
    )
  }

  const mistralBody = translateMistralRequest(
    options.body,
    createHistoryStore()
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const diagnostics = {
    schema_version: 1,
    stage: options.diagnosticsStage,
    ...createExecutionCounters(),
    unfinished_requests: 0,
  }
  try {
    diagnostics.requests += 1
    diagnostics.upstream_attempts += 1
    const response = await fetchImpl(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(mistralBody),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response || typeof response.status !== 'number') {
      throw new AdapterError('upstream_error', 'invalid upstream response')
    }
    if (!response.ok) {
      await drain(response, maxResponseBytes)
      // Only the numeric status is surfaced; the upstream body is discarded.
      const failure = new AdapterError(
        'upstream_error',
        `upstream status ${response.status}`
      )
      failure.status = response.status
      throw failure
    }
    const text = await readBoundedBody(response, maxResponseBytes)
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new AdapterError('malformed_response', 'invalid upstream JSON')
    }
    const normalized = normalizeMistralResponse(payload)
    recordResponseUsage(diagnostics, normalized.usage, payload.usage)
    return normalized
  } catch (error) {
    if (error instanceof AdapterError) throw error
    // A raw fetch error is never surfaced; a bounded status error is enough.
    throw new AdapterError('upstream_error', 'upstream request failed')
  } finally {
    clearTimeout(timer)
    if (['preflight', 'topology'].includes(options.diagnosticsStage)) {
      writeDiagnostics({
        schema_version: 1,
        stage: options.diagnosticsStage,
        requests: diagnostics.requests,
        ...Object.fromEntries(
          COST_USAGE_FIELDS.map((field) => [field, diagnostics[field]])
        ),
      })
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireEnv(name) {
  const value = process.env[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdapterError('missing_env', `${name} is not set`)
  }
  return value
}

// State lives only under the runner temporary directory; any other path is
// refused so the adapter cannot write outside its scratch space.
function resolveStatePath(statePath) {
  if (typeof statePath !== 'string' || statePath.length === 0) {
    throw new AdapterError('invalid_state_path', 'a state path is required')
  }
  const runnerTemp = process.env.RUNNER_TEMP
  if (typeof runnerTemp !== 'string' || runnerTemp.length === 0) {
    throw new AdapterError('invalid_state_path', 'RUNNER_TEMP is not set')
  }
  const root = path.resolve(runnerTemp)
  const target = path.resolve(statePath)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new AdapterError(
      'invalid_state_path',
      'state path must be inside RUNNER_TEMP'
    )
  }
  return target
}

function isLoopbackUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return LOOPBACK_HOSTS.has(parsed.hostname)
}

function writeState(statePath, state) {
  const temporary = `${statePath}.${process.pid}.tmp`
  fs.writeFileSync(
    temporary,
    JSON.stringify({ url: state.url, token: state.token }),
    {
      mode: 0o600,
    }
  )
  fs.renameSync(temporary, statePath)
  fs.chmodSync(statePath, 0o600)
}

function removeState(statePath) {
  try {
    fs.rmSync(statePath, { force: true })
  } catch {
    // The state file is already gone.
  }
}

async function waitForState(statePath, deadlineMs) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      if (
        typeof parsed?.url === 'string' &&
        typeof parsed?.token === 'string'
      ) {
        return parsed
      }
    } catch {
      // Not written yet.
    }
    if (Date.now() > deadline) {
      throw new AdapterError('startup_timeout', 'adapter did not become ready')
    }
    await delay(50)
  }
}

// The state file is only written after the listener is bound; one authenticated
// probe then confirms the capability wiring without touching upstream.
async function probeReadiness(state, deadlineMs) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    try {
      const response = await fetch(`${state.url}${CHAT_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${state.token}`,
        },
        body: '{}',
      })
      await response.arrayBuffer().catch(() => undefined)
      if (response.status === 400) return
    } catch {
      // Still starting.
    }
    if (Date.now() > deadline) {
      throw new AdapterError(
        'startup_timeout',
        'adapter readiness probe failed'
      )
    }
    await delay(50)
  }
}

async function waitForClosed(url, deadlineMs) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    try {
      const response = await fetch(`${url}${CHAT_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      await response.arrayBuffer().catch(() => undefined)
    } catch {
      return
    }
    if (Date.now() > deadline) {
      throw new AdapterError('shutdown_timeout', 'listener did not close')
    }
    await delay(50)
  }
}

function writeDiagnostics(snapshot) {
  const diagnosticsPath = process.env.OCR_ADAPTER_DIAGNOSTICS_PATH
  if (!diagnosticsPath) return
  try {
    fs.appendFileSync(diagnosticsPath, `${JSON.stringify(snapshot)}\n`, {
      mode: 0o600,
    })
  } catch {
    try {
      fs.writeSync(2, 'OCR adapter execution counters unavailable\n')
    } catch {
      // Diagnostics must not change the provider call or cleanup outcome.
    }
  }
}

function costFromTotals(totals) {
  const output = (totals.completion_tokens * MISTRAL_PRICING.output) / 1e6
  const withoutCache =
    (totals.prompt_tokens * MISTRAL_PRICING.input) / 1e6 + output
  const savings =
    (totals.cached_prompt_tokens *
      (MISTRAL_PRICING.input - MISTRAL_PRICING.cachedInput)) /
    1e6
  return {
    ...totals,
    withCache: withoutCache - savings,
    withoutCache,
    savings,
    savingsPercent: withoutCache === 0 ? 0 : (savings / withoutCache) * 100,
  }
}

function assessCostRows(rows) {
  const totals = Object.fromEntries(
    COST_USAGE_FIELDS.map((field) => [field, 0])
  )
  const reasons = new Set()
  for (const row of rows) {
    if (row?.schema_version !== 1) {
      reasons.add('unsupported_schema')
      continue
    }
    if (
      Object.keys(totals).some(
        (field) => !Number.isSafeInteger(row[field]) || row[field] < 0
      )
    ) {
      reasons.add('invalid_counters')
      continue
    }
    for (const field of [
      'missing_usage',
      'missing_cache_usage',
      'invalid_cache_usage',
      'unfinished_requests',
    ]) {
      if (row[field]) reasons.add(field)
    }
    if (row.responses !== row.upstream_attempts)
      reasons.add('unaccounted_attempts')
    if (row.cache_usage_responses !== row.responses)
      reasons.add('incomplete_cache_coverage')
    if (
      row.cached_prompt_tokens + row.uncached_prompt_tokens !==
      row.prompt_tokens
    )
      reasons.add('inconsistent_counters')
    // Each row is one invocation. Nested counters repeat the same usage.
    for (const field of Object.keys(totals)) {
      const sum = totals[field] + row[field]
      if (Number.isSafeInteger(sum)) totals[field] = sum
      else reasons.add('counter_overflow')
    }
  }
  return {
    totals,
    reasons: [...reasons],
    estimate: reasons.size ? null : costFromTotals(totals),
  }
}

function estimateCost(diagnosticsText) {
  const rows = diagnosticsText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse)
  if (!rows.length) return null
  return assessCostRows(rows).estimate
}

function buildCostReport(diagnosticsText, expected = { adapter: 1 }) {
  if (
    !expected ||
    !Object.keys(expected).length ||
    Object.entries(expected).some(
      ([stage, count]) =>
        !COST_STAGES.includes(stage) ||
        !Number.isSafeInteger(count) ||
        count < 0
    )
  )
    return { estimate: null, stages: [], reasons: ['invalid_expectations'] }
  const groups = Object.fromEntries(COST_STAGES.map((stage) => [stage, []]))
  const reasons = new Set()
  const lines = diagnosticsText.trim().split('\n').filter(Boolean)
  if (!lines.length && Object.values(expected).some((count) => count > 0))
    reasons.add('empty_receipt')
  for (const line of lines) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      reasons.add('malformed_receipt')
      continue
    }
    const stage = row?.stage === undefined ? 'adapter' : row.stage
    if (!COST_STAGES.includes(stage)) {
      reasons.add('invalid_stage')
      continue
    }
    groups[stage].push(row)
    if (!Object.hasOwn(expected, stage)) reasons.add('unexpected_stage')
  }
  const stages = COST_STAGES.filter(
    (stage) => Object.hasOwn(expected, stage) || groups[stage].length
  ).map((stage) => {
    const rows = groups[stage]
    const report = assessCostRows(rows)
    if (rows.length !== expected[stage]) {
      report.reasons.push('receipt_count_mismatch')
      report.estimate = null
    }
    for (const reason of report.reasons) reasons.add(reason)
    return {
      stage,
      expected: expected[stage] ?? 0,
      observed: rows.length,
      ...report,
    }
  })
  const combined = assessCostRows(Object.values(groups).flat())
  for (const reason of combined.reasons) reasons.add(reason)
  return {
    stages,
    reasons: [...reasons],
    estimate: reasons.size ? null : combined.estimate,
  }
}

function commandSummary(args) {
  let expected = { adapter: 1 }
  if (args.length > 1) {
    expected = {}
    for (const arg of args.slice(1)) {
      const match = /^(adapter|preflight|topology)=(\d{1,16})$/.exec(arg)
      if (!match || Object.hasOwn(expected, match[1])) {
        expected = null
        break
      }
      expected[match[1]] = Number(match[2])
    }
  }
  let report
  try {
    report = buildCostReport(fs.readFileSync(args[0], 'utf8'), expected)
  } catch (error) {
    // Missing or malformed receipts cannot establish zero spend.
    report = {
      estimate: null,
      stages: [],
      reasons: [
        error.code === 'ENOENT' ? 'missing_receipt' : 'unreadable_receipt',
      ],
    }
  }
  const estimate = report.estimate
  const pricing = MISTRAL_PRICING
  const summary = [
    '### OCR estimated cost and caching savings',
    '',
    `Mistral \`${MISTRAL_MODEL}\`; [list pricing](${pricing.source}) checked ${pricing.date}: ` +
      `$${pricing.input.toFixed(2)} input / $${pricing.cachedInput.toFixed(2)} cached input / $${pricing.output.toFixed(2)} output per million tokens (USD).`,
    '',
  ]
  if (estimate) {
    summary.push(
      '| Estimate | USD |',
      '| --- | ---: |',
      `| With reported caching | $${estimate.withCache.toFixed(4)} |`,
      `| Same tokens without caching | $${estimate.withoutCache.toFixed(4)} |`,
      `| Caching savings (${estimate.savingsPercent.toFixed(1)}%) | $${estimate.savings.toFixed(4)} |`,
      '',
      `${estimate.prompt_tokens} input tokens (${estimate.cached_prompt_tokens} cached), ${estimate.completion_tokens} output tokens; ${estimate.responses} provider responses.`
    )
  } else {
    summary.push(
      'Estimate unavailable: diagnostics are missing, invalid, or have incomplete usage/cache coverage. Unknown usage is not treated as zero.'
    )
  }
  summary.push(
    '',
    '| Stage | With caching (USD) | Without caching (USD) |',
    '| --- | ---: | ---: |'
  )
  for (const stage of report.stages) {
    const cost = stage.estimate
    summary.push(
      cost
        ? `| ${stage.stage} | $${cost.withCache.toFixed(4)} | $${cost.withoutCache.toFixed(4)} |`
        : `| ${stage.stage} | unavailable | unavailable |`
    )
  }
  for (const stage of report.stages) {
    const cost = stage.estimate
    const coverage = Object.entries(stage.totals)
      .map(([field, count]) => `${field}=${count}`)
      .join(' ')
    summary.push(
      '',
      `OCR cost stage=${stage.stage} status=${cost ? (stage.expected ? 'complete' : 'not_run') : 'unavailable'} reasons=${stage.reasons.join(',') || 'none'} expected_receipts=${stage.expected} observed_receipts=${stage.observed} ${coverage}`,
      ''
    )
  }
  summary.push(
    `OCR cost status=${estimate ? 'complete' : 'unavailable'} reasons=${report.reasons.join(',') || 'none'}`
  )
  summary.push(
    '',
    'Estimate covers recorded invocations in the expected stages only. Missing receipts prevent a complete total. Excludes taxes, account discounts and runner costs. Prices are pinned to the date above.',
    ''
  )
  const output = summary.join('\n')
  try {
    const buffer = Buffer.from(output)
    let offset = 0
    while (offset < buffer.length) {
      const written = fs.writeSync(1, buffer, offset)
      if (written === 0) break
      offset += written
    }
  } catch {
    // A closed log stream must not prevent the job summary or fail the review.
  }
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output)
  } catch {
    process.stderr.write('OCR cost summary unavailable\n')
  }
  return 0
}

function createProgressFilter(write) {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  let dropping = false
  function flush() {
    const line = pending.replace(/\r$/, '')
    if (!dropping) {
      let event
      const tool =
        /^\[ocr\]   ([▶✔✘]) (task_done|code_comment|file_read_diff|file_read|file_find|code_search)(?: |$)/u.exec(
          line
        )
      const started =
        /^\[ocr\] (\d{1,12}) file\(s\) changed, reviewing (\d{1,12}) in /.exec(
          line
        )
      const finished =
        /^\[ocr\] Summary: (\d{1,12}) file\(s\) reviewed, (\d{1,12}) comment\(s\), ~(\d{1,12}) token\(s\) used(?:[ ,]|$)/.exec(
          line
        )
      if (tool) {
        const state = { '▶': 'started', '✔': 'completed', '✘': 'failed' }[
          tool[1]
        ]
        event = `event=tool_${state} tool=${tool[2]}`
      } else if (started) {
        event = `event=review_started changed_files=${Number(started[1])} reviewing_files=${Number(started[2])}`
      } else if (finished) {
        event = `event=review_finished files=${Number(finished[1])} findings=${Number(finished[2])} tokens=${Number(finished[3])}`
      } else if (line.startsWith('[ocr] Plan completed for group ')) {
        event = 'event=phase_completed phase=planning'
      } else if (
        /^\[ocr\] Review filter removed \d{1,12} comment\(s\) for group /.test(
          line
        )
      ) {
        event = 'event=phase_completed phase=filtering'
      } else if (
        /^\[ocr\] (?:token budget reached|Token budget exceeded) \(/.test(line)
      ) {
        event = 'event=budget_reached'
      }
      if (event) {
        try {
          write(`OCR progress ${event}\n`)
        } catch {
          // A live-log failure must not change the review result or its streams.
        }
      }
    }
    pending = ''
    dropping = false
  }
  function consume(text) {
    for (const part of text.split(/(\n)/)) {
      if (part === '\n') flush()
      else if (!dropping && pending.length + part.length <= 4096)
        pending += part
      else {
        pending = ''
        dropping = true
      }
    }
  }
  return {
    write(chunk) {
      consume(
        decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      )
    },
    end() {
      consume(decoder.end())
      flush()
    },
  }
}

function createProgressReporter(write, options = {}) {
  const now = options.now ?? (() => performance.now())
  const schedule = options.setInterval ?? setInterval
  const cancel = options.clearInterval ?? clearInterval
  const started = now()
  let lastProgress = started
  let lastOutput = started
  let finished = false
  function emit(line, time = now()) {
    lastOutput = time
    try {
      write(line)
    } catch {
      // Progress reporting must not change process results or private streams.
    }
  }
  const filter = createProgressFilter((line) => {
    lastProgress = now()
    emit(line, lastProgress)
  })
  const timer = schedule(() => {
    const time = now()
    if (!finished && time - lastOutput >= 60000) {
      emit(
        `OCR progress event=heartbeat elapsed_ms=${Math.floor(time - started)} idle_ms=${Math.floor(time - lastProgress)}\n`,
        time
      )
    }
  }, 60000)
  timer.unref?.()
  return {
    write(chunk) {
      if (!finished) filter.write(chunk)
    },
    end() {
      if (!finished) filter.end()
    },
    finish(result) {
      if (finished) return
      finished = true
      cancel(timer)
      filter.end()
      const code =
        Number.isInteger(result.code) && result.code >= 0 && result.code <= 255
          ? result.code
          : 1
      emit(
        `OCR progress event=process_exited exit_code=${code} signaled=${Boolean(result.signal)} spawn_failed=${Boolean(result.failed)} elapsed_ms=${Math.floor(now() - started)}\n`
      )
    },
  }
}

async function commandRun(args) {
  const argv = args[0] === '--' ? args.slice(1) : args
  if (argv.length === 0) {
    throw new AdapterError('missing_command', 'run requires an executable')
  }
  const apiKey = requireEnv('MISTRAL_API_KEY')
  const adapter = await startAdapter({ apiKey, onClose: writeDiagnostics })
  const childEnv = { ...process.env }
  delete childEnv.MISTRAL_API_KEY
  const liveProgress = childEnv.OCR_ADAPTER_PROGRESS_FD === '3'
  delete childEnv.OCR_ADAPTER_PROGRESS_FD
  childEnv.OCR_LLM_URL = `${adapter.url}${CHAT_PATH}`
  childEnv.OCR_LLM_TOKEN = adapter.token
  childEnv.OCR_LLM_MODEL = MISTRAL_MODEL
  childEnv.OCR_LLM_PROTOCOL = 'openai'
  childEnv.OCR_USE_ANTHROPIC = 'false'

  const child = spawn(argv[0], argv.slice(1), {
    stdio: liveProgress ? ['inherit', 'inherit', 'pipe'] : 'inherit',
    env: childEnv,
  })
  let progress
  let stderrClosed
  if (liveProgress) {
    // The workflow binds fd 3 to its console before redirecting fd 2 privately.
    // OCR receives neither this descriptor nor the option selecting it.
    progress = createProgressReporter((line) => fs.writeSync(3, line))
    stderrClosed = new Promise((resolve) => child.stderr.once('close', resolve))
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      progress.write(chunk)
    })
    child.stderr.on('end', progress.end)
  }
  const forward = (signal) => {
    try {
      child.kill(signal)
    } catch {
      // The child already exited.
    }
    const escalate = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // The child already exited.
      }
    }, 10000)
    if (typeof escalate.unref === 'function') escalate.unref()
  }
  process.on('SIGTERM', () => forward('SIGTERM'))
  process.on('SIGINT', () => forward('SIGINT'))

  const result = await new Promise((resolve) => {
    child.on('error', () => resolve({ failed: true }))
    child.on('exit', (code, signal) => resolve({ code, signal }))
  })
  try {
    await adapter.close()
    if (liveProgress) {
      // A descendant can retain stderr after the review process exits. Bound
      // the drain so that writer cannot hold the wrapper open indefinitely.
      let drainTimer
      try {
        await Promise.race([
          stderrClosed,
          new Promise((resolve) => {
            drainTimer = setTimeout(resolve, SHUTDOWN_DRAIN_TIMEOUT_MS)
          }),
        ])
      } finally {
        clearTimeout(drainTimer)
        child.stderr.destroy()
      }
    }
  } finally {
    progress?.finish(result)
  }
  if (result.failed) {
    throw new AdapterError(
      'child_spawn_failed',
      'child process failed to start'
    )
  }
  if (result.signal) return 1
  return typeof result.code === 'number' ? result.code : 1
}

async function commandStart(args) {
  const statePath = resolveStatePath(args[0])
  requireEnv('MISTRAL_API_KEY')
  const child = spawn(process.execPath, [__filename, 'serve', statePath], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()
  try {
    const state = await waitForState(statePath, STARTUP_TIMEOUT_MS)
    await probeReadiness(state, STARTUP_TIMEOUT_MS)
    process.stdout.write(`::add-mask::${state.token}\n`)
    const outputs = `url=${state.url}\ntoken=${state.token}\n`
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs)
    } else {
      process.stdout.write(outputs)
    }
  } catch (error) {
    try {
      child.kill('SIGTERM')
    } catch {
      // The child already exited.
    }
    throw error
  }
  return 0
}

async function commandServe(args) {
  const statePath = resolveStatePath(args[0])
  const apiKey = requireEnv('MISTRAL_API_KEY')
  const adapter = await startAdapter({ apiKey, onClose: writeDiagnostics })
  writeState(statePath, { url: adapter.url, token: adapter.token })
  const shutdown = () => {
    adapter.close()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  // The listener is closed by /shutdown or the bounded lifetime timer; wait for
  // that closure instead of closing it here.
  await adapter.closed
  removeState(statePath)
  return 0
}

async function commandStop(args) {
  const statePath = resolveStatePath(args[0])
  if (!fs.existsSync(statePath)) return 0
  let state
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    throw new AdapterError('invalid_state', 'state file is unreadable')
  }
  if (typeof state?.url !== 'string' || typeof state?.token !== 'string') {
    throw new AdapterError('invalid_state', 'state file is malformed')
  }
  if (!isLoopbackUrl(state.url)) {
    throw new AdapterError('invalid_state', 'state URL is not loopback')
  }
  try {
    const response = await fetch(`${state.url}${SHUTDOWN_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${state.token}` },
    })
    await response.text().catch(() => undefined)
  } catch {
    // The listener is already gone; treat that as a completed shutdown.
  }
  await waitForClosed(state.url, SHUTDOWN_TIMEOUT_MS)
  removeState(statePath)
  return 0
}

async function main(argv) {
  const [command, ...rest] = argv
  if (command === 'run') return commandRun(rest)
  if (command === 'start') return commandStart(rest)
  if (command === 'serve') return commandServe(rest)
  if (command === 'stop') return commandStop(rest)
  if (command === 'summary') return commandSummary(rest)
  process.stderr.write(
    'usage: ocr-mistral-adapter.cjs <run|start|serve|stop|summary> [args]\n'
  )
  return 2
}

module.exports = {
  MISTRAL_URL,
  MISTRAL_MODEL,
  MISTRAL_EFFORT,
  normalizeMistralResponse,
  translateMistralRequest,
  createHistoryStore,
  startAdapter,
  callMistral,
  estimateCost,
  buildCostReport,
  createProgressFilter,
  createProgressReporter,
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      if (typeof code === 'number') process.exitCode = code
    })
    .catch((error) => {
      // Only the fixed adapter code is ever printed; payloads and keys are not.
      const code =
        error instanceof AdapterError ? error.code : 'unexpected_error'
      process.stderr.write(`ocr-mistral-adapter: ${code}\n`)
      process.exitCode = 1
    })
}
