'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { spawn } = require('node:child_process')
const { EventEmitter } = require('node:events')

const {
  MISTRAL_URL,
  MISTRAL_MODEL,
  normalizeMistralResponse,
  translateMistralRequest,
  createHistoryStore,
  startAdapter,
  callMistral,
} = require('./ocr-mistral-adapter.cjs')

const ADAPTER = path.join(__dirname, 'ocr-mistral-adapter.cjs')
const CHAT_PATH = '/v1/chat/completions'
const SHUTDOWN_PATH = '/shutdown'

function completion(message, finishReason = 'stop') {
  return {
    id: 'cmpl-test',
    object: 'chat.completion',
    created: 1,
    model: MISTRAL_MODEL,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
  }
}

function jsonResponse(status, payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return new Response(text, { status })
}

// Records every upstream call and delegates the reply to the handler.
function upstream(handler) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    const record = { url, init, body }
    calls.push(record)
    return handler(record, calls.length)
  }
  fetchImpl.calls = calls
  return fetchImpl
}

async function postJson(adapter, body, options = {}) {
  const headers = { 'content-type': 'application/json' }
  const token = options.token ?? adapter.token
  if (token) headers.authorization = `Bearer ${token}`
  const payload =
    options.raw ?? (typeof body === 'string' ? body : JSON.stringify(body))
  const response = await fetch(`${adapter.url}${options.path ?? CHAT_PATH}`, {
    method: 'POST',
    headers,
    body: payload,
  })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  return { status: response.status, text, json }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() > deadline) return undefined
    await delay(50)
  }
}

// Polls until the loopback listener stops accepting connections.
async function waitForListenerClose(url) {
  const deadline = Date.now() + 6000
  for (;;) {
    try {
      const response = await fetch(`${url}${CHAT_PATH}`, {
        method: 'POST',
        body: '{}',
      })
      await response.text().catch(() => undefined)
    } catch {
      return true
    }
    if (Date.now() > deadline) return false
    await delay(50)
  }
}

// Runs the CLI in a child with a bounded lifetime. A wedged child is asked to
// stop with SIGTERM and then SIGKILL, and the promise always settles so a hung
// invocation surfaces as a normal assertion instead of a hung test run.
function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ADAPTER, ...args], {
      env: { ...process.env, ...env },
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let termTimer
    let killTimer
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(termTimer)
      clearTimeout(killTimer)
      resolve(result)
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('exit', (code, signal) => finish({ code, signal, stdout, stderr }))
    child.on('error', (error) =>
      finish({ code: null, signal: null, stdout, stderr, error })
    )
    termTimer = setTimeout(() => {
      child.kill('SIGTERM')
      killTimer = setTimeout(() => {
        child.kill('SIGKILL')
        killTimer = setTimeout(
          () => finish({ code: null, signal: 'SIGKILL', stdout, stderr }),
          2000
        )
      }, 2000)
    }, 15000)
  })
}

// Loads the production readRequestBody in an isolated context so body
// settlement can be exercised without exporting internals or standing up a
// listener. The appended line is test-only; the adapter source is unchanged.
function loadReadRequestBody() {
  const source = fs.readFileSync(ADAPTER, 'utf8').replace(/^#!.*\n/, '')
  const sandboxModule = { exports: {} }
  const context = vm.createContext({
    require,
    module: sandboxModule,
    exports: sandboxModule.exports,
    process,
    Buffer,
  })
  vm.runInContext(
    `${source}\nmodule.exports.__readRequestBody = readRequestBody\n`,
    context
  )
  return sandboxModule.exports.__readRequestBody
}

test('normalizeMistralResponse keeps plain text and drops no data', () => {
  const normalized = normalizeMistralResponse(
    completion({ role: 'assistant', content: 'plain answer' })
  )
  assert.equal(normalized.model, MISTRAL_MODEL)
  assert.equal(normalized.choices[0].message.content, 'plain answer')
  assert.equal(normalized.choices[0].message.reasoning_content, undefined)
  assert.equal(normalized.choices[0].finish_reason, 'stop')
  assert.deepEqual(normalized.usage, {
    prompt_tokens: 3,
    completion_tokens: 4,
    total_tokens: 7,
  })
})

test('normalizeMistralResponse flattens text chunks and concatenates thinking', () => {
  const normalized = normalizeMistralResponse(
    completion({
      role: 'assistant',
      content: [{ type: 'text', text: 'answer ' }, 'tail'],
      reasoning_content: [
        { type: 'thinking', thinking: 'why ' },
        { text: 'more' },
      ],
    })
  )
  const message = normalized.choices[0].message
  assert.equal(message.content, 'answer tail')
  assert.equal(message.reasoning_content, 'why more')
})

test('normalizeMistralResponse rejects an unknown chunk shape', () => {
  assert.throws(
    () =>
      normalizeMistralResponse(
        completion({
          role: 'assistant',
          content: [{ type: 'image', url: 'x' }],
        })
      ),
    (error) => error.code === 'malformed_response'
  )
})

test('normalizeMistralResponse rejects an unexpected upstream model', () => {
  const payload = completion({ role: 'assistant', content: 'x' })
  payload.model = 'mistral-large-latest'
  assert.throws(
    () => normalizeMistralResponse(payload),
    (error) => error.code === 'response_model_mismatch'
  )
})

test('content thinking and reasoning_content concatenate deterministically', () => {
  const normalized = normalizeMistralResponse(
    completion({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: [{ type: 'text', text: 'a' }] },
        { type: 'text', text: 'b' },
      ],
      reasoning_content: 'c',
    })
  )
  const message = normalized.choices[0].message
  assert.equal(message.content, 'b')
  assert.equal(message.reasoning_content, 'ac')
})

test('thinking-in-content replays the exact native message', async () => {
  const native = {
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: [{ type: 'text', text: 'reason' }] },
      { type: 'text', text: 'answer' },
    ],
  }
  const fetchImpl = upstream((record) =>
    jsonResponse(
      200,
      record.body.messages.at(-1).role === 'user'
        ? completion(native)
        : completion({ role: 'assistant', content: 'done' })
    )
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const first = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(first.json.choices[0].message.content, 'answer')
    assert.equal(first.json.choices[0].message.reasoning_content, 'reason')
    const second = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: 'u' },
        first.json.choices[0].message,
        { role: 'user', content: 'again' },
      ],
    })
    assert.equal(second.status, 200)
    assert.deepEqual(fetchImpl.calls[1].body.messages[1], native)
  } finally {
    await adapter.close()
  }
})

test('an unmapped assistant replay fails closed with or without reasoning', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    for (const assistant of [
      { role: 'assistant', content: 'earlier answer' },
      {
        role: 'assistant',
        content: 'earlier answer',
        reasoning_content: 'unretained reasoning',
        tool_calls: [
          {
            id: 'call_unknown',
            type: 'function',
            function: { name: 'read', arguments: '{}' },
          },
        ],
      },
    ]) {
      const result = await postJson(adapter, {
        model: MISTRAL_MODEL,
        messages: [
          { role: 'system', content: 's' },
          { role: 'user', content: 'u' },
          assistant,
          { role: 'user', content: 'again' },
        ],
      })
      assert.equal(result.status, 409)
      assert.equal(result.json.error.code, 'history_missing')
      assert.equal(fetchImpl.calls.length, 0)
    }
  } finally {
    await adapter.close()
  }
})

test('a three-turn native chain restores every replayed assistant turn', async () => {
  const nativeA = {
    role: 'assistant',
    content: 'A',
    reasoning_content: 'ra',
    tool_calls: [
      {
        id: 'call_a',
        type: 'function',
        function: { name: 'read', arguments: '{}' },
      },
    ],
  }
  const nativeB = {
    role: 'assistant',
    content: 'B',
    reasoning_content: 'rb',
    tool_calls: [
      {
        id: 'call_b',
        type: 'function',
        function: { name: 'read', arguments: '{}' },
      },
    ],
  }
  const fetchImpl = upstream((_record, count) => {
    if (count === 1) return jsonResponse(200, completion(nativeA, 'tool_calls'))
    if (count === 2) return jsonResponse(200, completion(nativeB, 'tool_calls'))
    return jsonResponse(200, completion({ role: 'assistant', content: 'C' }))
  })
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const base = [
      { role: 'system', content: 's' },
      { role: 'user', content: 'u' },
    ]
    const turn1 = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: base,
    })
    const a = turn1.json.choices[0].message
    // The SDK omits reasoning_content on the echoed turns.
    const echoA = {
      role: 'assistant',
      content: a.content,
      tool_calls: a.tool_calls,
    }
    const turn2Messages = [
      ...base,
      echoA,
      { role: 'tool', tool_call_id: 'call_a', content: 'ra1' },
    ]
    const turn2 = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: turn2Messages,
    })
    const b = turn2.json.choices[0].message
    const echoB = {
      role: 'assistant',
      content: b.content,
      tool_calls: b.tool_calls,
    }
    const turn3 = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        ...turn2Messages,
        echoB,
        { role: 'tool', tool_call_id: 'call_b', content: 'rb1' },
      ],
    })
    assert.equal(turn3.status, 200)
    const forwarded = fetchImpl.calls[2].body.messages
    assert.deepEqual(forwarded[2], nativeA)
    assert.deepEqual(forwarded[4], nativeB)
    assert.equal(turn3.json.choices[0].message.content, 'C')
  } finally {
    await adapter.close()
  }
})

test('native thinking chunks keep final text parseable structured output', () => {
  const normalized = normalizeMistralResponse(
    completion({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: [{ type: 'text', text: 'private ' }] },
        { type: 'text', text: '{"findings":[]}' },
      ],
    })
  )
  const message = normalized.choices[0].message
  // Strict topology JSON must parse straight from the OCR-facing content.
  assert.deepEqual(JSON.parse(message.content), { findings: [] })
  // The private thinking is retained separately, not mixed into the content.
  assert.equal(message.reasoning_content, 'private ')
  assert.doesNotMatch(message.content, /private/)
})

test('normalizeMistralResponse stringifies object tool arguments', () => {
  const normalized = normalizeMistralResponse(
    completion(
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'read', arguments: { path: 'a' } },
          },
        ],
      },
      'tool_calls'
    )
  )
  assert.equal(
    normalized.choices[0].message.tool_calls[0].function.arguments,
    '{"path":"a"}'
  )
  assert.equal(normalized.choices[0].finish_reason, 'tool_calls')
})

test('normalization rejects a response with no completion status', () => {
  const payload = completion({ role: 'assistant', content: '{"comments":[]}' })
  delete payload.choices[0].finish_reason
  assert.throws(() => normalizeMistralResponse(payload), {
    code: 'malformed_response',
  })
})

test('translateMistralRequest converts fields and defaults reasoning to max', () => {
  const translated = translateMistralRequest(
    {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      max_completion_tokens: 123,
      reasoning: { effort: 'high' },
      provider: { order: ['x'] },
      thinking: { type: 'enabled' },
      stream_options: { include_usage: true },
      stream: false,
      temperature: 0.2,
    },
    createHistoryStore()
  )
  assert.equal(translated.model, MISTRAL_MODEL)
  assert.equal(translated.reasoning_effort, 'max')
  assert.equal(translated.max_tokens, 123)
  assert.equal(translated.temperature, 0.2)
  for (const dropped of [
    'max_completion_tokens',
    'reasoning',
    'provider',
    'thinking',
    'stream_options',
    'stream',
  ]) {
    assert.equal(translated[dropped], undefined, `${dropped} should be dropped`)
  }
})

test('loopback enforces high or max reasoning before calling upstream', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'done' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk-synthetic', fetchImpl })
  const body = {
    model: MISTRAL_MODEL,
    messages: [{ role: 'user', content: 'synthetic review' }],
  }
  try {
    for (const effort of ['low', 'medium', 'none', '', 'MAX', 1, {}]) {
      const response = await postJson(adapter, {
        ...body,
        reasoning_effort: effort,
      })
      assert.equal(response.status, 400)
      assert.equal(response.json.error.code, 'invalid_request')
      assert.equal(fetchImpl.calls.length, 0)
    }
    for (const effort of [undefined, 'high', 'max']) {
      const response = await postJson(adapter, {
        ...body,
        reasoning_effort: effort,
      })
      assert.equal(response.status, 200)
      assert.equal(
        fetchImpl.calls.at(-1).body.reasoning_effort,
        effort ?? 'max'
      )
    }
  } finally {
    await adapter.close()
  }
})

test('OCR completion conversations require tools; auxiliary requests retain their choice', () => {
  const tools = [{ type: 'function', function: { name: 'task_done' } }]
  const request = { messages: [{ role: 'user', content: 'synthetic' }], tools }
  for (const tool_choice of [undefined, 'auto', 'required', 'none']) {
    assert.equal(
      translateMistralRequest({ ...request, tool_choice }).tool_choice,
      'any'
    )
  }
  const explicit = { type: 'function', function: { name: 'task_done' } }
  assert.deepEqual(
    translateMistralRequest({ ...request, tool_choice: explicit }).tool_choice,
    explicit
  )
  assert.equal(
    translateMistralRequest({ ...request, tools: [] }).tool_choice,
    undefined
  )
  assert.equal(
    translateMistralRequest({ ...request, tools: [], tool_choice: 'none' })
      .tool_choice,
    'none'
  )
})

test('a provider ignoring required tool use fails without entering OCR prose retries', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(
      200,
      completion(
        {
          role: 'assistant',
          content: 'private synthetic response',
          reasoning_content: 'private synthetic reasoning',
        },
        'length'
      )
    )
  )
  const adapter = await startAdapter({
    apiKey: 'private synthetic key',
    fetchImpl,
  })
  try {
    const result = await postJson(adapter, {
      messages: [{ role: 'user', content: 'private synthetic prompt' }],
      tools: [{ type: 'function', function: { name: 'task_done' } }],
    })
    assert.equal(fetchImpl.calls[0].body.tool_choice, 'any')
    assert.equal(result.status, 422)
    assert.equal(result.json.error.code, 'required_tool_call_missing')
    const receipt = adapter.diagnostics()
    assert.equal(receipt.upstream_attempts, 1)
    assert.equal(receipt.main_no_tool_responses, 1)
    assert.equal(receipt.length_finishes, 1)
    assert.equal(receipt.prompt_tokens, 3)
    assert.equal(receipt.completion_tokens, 4)
    assert.ok(receipt.max_request_bytes > 0)
    assert.doesNotMatch(JSON.stringify(receipt), /private synthetic/)
    assert.doesNotMatch(result.text, /private synthetic/)
  } finally {
    await adapter.close()
  }
})

test('compression restores only exact reasoned turns, retaining native thinking and bounds', () => {
  const history = createHistoryStore({ maxEntries: 3 })
  const prefix = [
    { role: 'system', content: 's' },
    { role: 'user', content: 'original' },
  ]
  const native = {
    role: 'assistant',
    index: 0,
    content: [
      { type: 'thinking', thinking: [{ type: 'text', text: 'reasoning' }] },
    ],
    tool_calls: [
      {
        id: 'id1',
        type: 'function',
        function: { name: 'file_read', arguments: '{"file_path":"a.ts"}' },
      },
    ],
  }
  history.remember(prefix, native)
  const turn = normalizeMistralResponse(completion(native, 'tool_calls'))
    .choices[0].message
  const compressed = [
    prefix[0],
    { role: 'user', content: 'compressed summary' },
  ]
  const expected = { ...native }
  delete expected.index
  assert.deepEqual(
    history.restoreMessages([...compressed, turn]).at(-1),
    expected
  )
  assert.equal(history.diagnostics().compressed_hits, 1)
  assert.equal(history.entryCount(), 1)
  for (const altered of [
    { ...turn, reasoning_content: undefined },
    { ...turn, reasoning_content: 'different' },
    { ...turn, content: 'different' },
    { ...turn, tool_calls: [{ ...turn.tool_calls[0], id: 'id2' }] },
    {
      ...turn,
      tool_calls: [
        {
          ...turn.tool_calls[0],
          function: { name: 'file_read', arguments: '{"file_path":"b.ts"}' },
        },
      ],
    },
  ])
    assert.throws(
      () => history.restoreMessages([...compressed, altered]),
      /unavailable/
    )
  const secondPrefix = [prefix[0], { role: 'user', content: 'another group' }]
  history.remember(secondPrefix, { ...native, index: 1 })
  assert.deepEqual(
    history.restoreMessages([...compressed, turn]).at(-1),
    expected
  )
  history.remember([{ role: 'user', content: 'third group' }], {
    ...native,
    content: [{ ...native.content[0], signature: 'different native state' }],
  })
  assert.deepEqual(history.restoreMessages([...prefix, turn]).at(-1), expected)
  assert.throws(
    () => history.restoreMessages([...compressed, turn]),
    /ambiguous/
  )
  assert.throws(
    () => history.remember([{ role: 'user', content: 'fourth group' }], native),
    /bound/
  )
})

test('request conversion and native replay work over the loopback listener', async () => {
  const native = {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        thinking: [{ type: 'text', text: 'think ' }],
        signature: 'synthetic-signature',
        closed: true,
      },
      { type: 'text', text: 'checking' },
    ],
    tool_calls: [
      {
        id: 'call_a',
        index: 0,
        type: 'function',
        function: { name: 'read', arguments: '{"path":"a"}' },
      },
    ],
  }
  const fetchImpl = upstream((record) => {
    const last = record.body.messages.at(-1)
    return jsonResponse(
      200,
      last.role === 'user'
        ? completion({ ...native, index: 0 }, 'tool_calls')
        : completion({ role: 'assistant', content: 'done' })
    )
  })
  const adapter = await startAdapter({ apiKey: 'sk-synthetic', fetchImpl })
  try {
    const first = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'u' },
      ],
      max_completion_tokens: 55,
      reasoning: { effort: 'high' },
      provider: { order: ['x'] },
      thinking: { type: 'enabled' },
      stream_options: { include_usage: true },
      reasoning_effort: 'high',
      stream: false,
      temperature: 0.1,
    })
    assert.equal(first.status, 200)
    const forwarded = fetchImpl.calls[0]
    assert.equal(forwarded.body.model, MISTRAL_MODEL)
    assert.equal(forwarded.body.reasoning_effort, 'high')
    assert.equal(forwarded.body.max_tokens, 55)
    assert.equal(forwarded.body.temperature, 0.1)
    for (const dropped of [
      'max_completion_tokens',
      'reasoning',
      'provider',
      'thinking',
      'stream_options',
      'stream',
    ]) {
      assert.equal(forwarded.body[dropped], undefined)
    }
    assert.equal(forwarded.init.headers.authorization, 'Bearer sk-synthetic')
    assert.equal(forwarded.init.redirect, 'error')
    assert.notEqual(
      forwarded.init.headers.authorization,
      `Bearer ${adapter.token}`
    )

    const echoed = first.json.choices[0].message
    assert.equal(echoed.content, 'checking')
    assert.equal(echoed.reasoning_content, 'think ')
    assert.equal(echoed.tool_calls[0].function.arguments, '{"path":"a"}')

    const second = await postJson(adapter, {
      model: MISTRAL_MODEL,
      reasoning_effort: 'high',
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'u' },
        echoed,
        { role: 'tool', tool_call_id: 'call_a', content: 'file' },
      ],
    })
    assert.equal(second.status, 200)
    assert.equal(fetchImpl.calls[1].body.reasoning_effort, 'high')
    const restored = fetchImpl.calls[1].body.messages[2]
    assert.deepEqual(restored, native)
  } finally {
    await adapter.close()
  }
})

test('native memory keeps concurrent groups with reused tool-call ids apart', async () => {
  const make = (marker) => ({
    role: 'assistant',
    content: `${marker}-text`,
    reasoning_content: `${marker}-think`,
    tool_calls: [
      {
        id: 'call_shared',
        type: 'function',
        function: { name: 'read', arguments: '{}' },
      },
    ],
  })
  const fetchImpl = upstream((record) => {
    const messages = record.body.messages
    if (messages.at(-1).role === 'user') {
      return jsonResponse(
        200,
        completion(make(messages[0].content), 'tool_calls')
      )
    }
    return jsonResponse(200, completion({ role: 'assistant', content: 'done' }))
  })
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const alpha = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'alpha' }],
    })
    const beta = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'beta' }],
    })
    assert.equal(alpha.json.choices[0].message.reasoning_content, 'alpha-think')
    assert.equal(beta.json.choices[0].message.reasoning_content, 'beta-think')

    const replayAlpha = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: 'alpha' },
        alpha.json.choices[0].message,
        { role: 'tool', tool_call_id: 'call_shared', content: 'r' },
      ],
    })
    const replayBeta = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: 'beta' },
        beta.json.choices[0].message,
        { role: 'tool', tool_call_id: 'call_shared', content: 'r' },
      ],
    })
    assert.equal(replayAlpha.status, 200)
    assert.equal(replayBeta.status, 200)
    assert.equal(
      fetchImpl.calls[2].body.messages[1].reasoning_content,
      'alpha-think'
    )
    assert.equal(
      fetchImpl.calls[3].body.messages[1].reasoning_content,
      'beta-think'
    )
  } finally {
    await adapter.close()
  }
})

test('native memory restores assistant turns without tool calls', async () => {
  const native = {
    role: 'assistant',
    content: [
      { type: 'text', text: 'part1' },
      { type: 'text', text: 'part2' },
    ],
    reasoning_content: 'why',
  }
  const fetchImpl = upstream((record) => {
    const last = record.body.messages.at(-1)
    return jsonResponse(
      200,
      last.role === 'user'
        ? completion(native)
        : completion({ role: 'assistant', content: 'done' })
    )
  })
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const first = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(first.json.choices[0].message.content, 'part1part2')
    assert.equal(first.json.choices[0].message.reasoning_content, 'why')
    const second = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: 'u' },
        first.json.choices[0].message,
        { role: 'user', content: 'again' },
      ],
    })
    assert.equal(second.status, 200)
    assert.deepEqual(fetchImpl.calls[1].body.messages[1].content, [
      { type: 'text', text: 'part1' },
      { type: 'text', text: 'part2' },
    ])
    assert.equal(fetchImpl.calls[1].body.messages[1].reasoning_content, 'why')
  } finally {
    await adapter.close()
  }
})

test('a conflicting native for an identical turn is a collision', async () => {
  const fetchImpl = upstream((_record, count) =>
    jsonResponse(
      200,
      completion(
        count === 1
          ? { role: 'assistant', content: 'same' }
          : { role: 'assistant', content: [{ type: 'text', text: 'same' }] }
      )
    )
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const first = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(first.status, 200)
    const second = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(second.status, 502)
    assert.equal(second.json.error.code, 'history_collision')
  } finally {
    await adapter.close()
  }
})

test('a rejected response is never cached, so a valid retry replays natively', async () => {
  const wrongModel = completion({ role: 'assistant', content: 'answer' })
  wrongModel.model = 'mistral-large-latest'
  const missingFinish = completion({ role: 'assistant', content: 'answer' })
  delete missingFinish.choices[0].finish_reason
  const badPayloads = [
    { code: 'response_model_mismatch', payload: wrongModel },
    { code: 'malformed_response', payload: missingFinish },
  ]
  for (const { code, payload } of badPayloads) {
    // The retry answers the same normalized turn with a different native
    // representation, so caching the rejected reply would collide and fail
    // closed on the second request.
    const native = {
      role: 'assistant',
      content: [{ type: 'text', text: 'answer' }],
    }
    const fetchImpl = upstream((_record, count) =>
      jsonResponse(200, count === 1 ? payload : completion(native))
    )
    const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
    try {
      const rejected = await postJson(adapter, {
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: 'u' }],
      })
      assert.equal(rejected.status, 502)
      assert.equal(rejected.json.error.code, code)

      const retry = await postJson(adapter, {
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: 'u' }],
      })
      assert.equal(retry.status, 200)
      assert.equal(retry.json.choices[0].message.content, 'answer')

      const replay = await postJson(adapter, {
        model: MISTRAL_MODEL,
        messages: [
          { role: 'user', content: 'u' },
          retry.json.choices[0].message,
          { role: 'user', content: 'again' },
        ],
      })
      assert.equal(replay.status, 200)
      assert.deepEqual(fetchImpl.calls[2].body.messages[1], native)
    } finally {
      await adapter.close()
    }
  }
})

test('native memory fails closed when its bound is exceeded', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({
    apiKey: 'sk',
    fetchImpl,
    maxHistoryEntries: 1,
  })
  try {
    const first = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'a' }],
    })
    assert.equal(first.status, 200)
    const second = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'b' }],
    })
    assert.equal(second.status, 502)
    assert.equal(second.json.error.code, 'history_exhausted')
  } finally {
    await adapter.close()
  }
})

test('every request needs the capability and only known routes exist', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const noToken = await fetch(`${adapter.url}${CHAT_PATH}`, {
      method: 'POST',
      body: '{}',
    })
    assert.equal(noToken.status, 401)
    await noToken.text()
    const wrongToken = await fetch(`${adapter.url}${CHAT_PATH}`, {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
      body: '{}',
    })
    assert.equal(wrongToken.status, 401)
    await wrongToken.text()
    const unknown = await postJson(adapter, {}, { path: '/v1/models' })
    assert.equal(unknown.status, 404)
    assert.equal(fetchImpl.calls.length, 0)
  } finally {
    await adapter.close()
  }
})

test('caller headers are ignored and never forwarded upstream', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk-upstream', fetchImpl })
  try {
    const response = await fetch(`${adapter.url}${CHAT_PATH}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adapter.token}`,
        'x-forward-me': 'secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: 'u' }],
      }),
    })
    await response.text()
    assert.equal(fetchImpl.calls.length, 1)
    assert.equal(fetchImpl.calls[0].init.headers['x-forward-me'], undefined)
    assert.equal(
      fetchImpl.calls[0].init.headers.authorization,
      'Bearer sk-upstream'
    )
  } finally {
    await adapter.close()
  }
})

test('closing the adapter terminates a stalled request body', async () => {
  const adapter = await startAdapter({ apiKey: 'synthetic-only' })
  const url = new URL(adapter.url)
  const socket = require('node:net').connect(Number(url.port), url.hostname)
  socket.on('error', () => {})
  let timer
  try {
    await new Promise((resolve) => socket.once('connect', resolve))
    socket.write(
      'POST /v1/chat/completions HTTP/1.1\r\n' +
        'Host: 127.0.0.1\r\n' +
        `Authorization: Bearer ${adapter.token}\r\n` +
        'Content-Length: 100\r\n\r\n{'
    )
    await new Promise(setImmediate)
    await Promise.race([
      adapter.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('shutdown stalled')), 1000)
      }),
    ])
    await assert.rejects(fetch(adapter.url + CHAT_PATH, { method: 'POST' }))
  } finally {
    clearTimeout(timer)
    socket.destroy()
    await adapter.close()
  }
})

test('an oversized request body settles once the socket is torn down', async () => {
  const readRequestBody = loadReadRequestBody()
  const limit = 8
  const req = new EventEmitter()
  req.complete = false
  let destroyed = false
  req.destroy = () => {
    destroyed = true
    req.emit('close')
  }
  const settled = readRequestBody(req, limit)
  req.emit('data', Buffer.alloc(limit + 4, 1))
  req.emit('data', Buffer.alloc(limit * 4, 1))
  assert.equal(destroyed, true)
  await assert.rejects(settled, (error) => error.code === 'request_too_large')
})

test('a request body closed before completion rejects as invalid', async () => {
  const readRequestBody = loadReadRequestBody()
  const req = new EventEmitter()
  req.complete = false
  req.destroy = () => {}
  const settled = readRequestBody(req, 1024)
  req.emit('data', Buffer.from('{'))
  req.emit('close')
  await assert.rejects(settled, (error) => error.code === 'invalid_request')
})

test('upstream failures are redacted to a fixed safe error', async () => {
  const secret = 'sk-synthetic-upstream-secret'
  const fetchImpl = upstream(() =>
    jsonResponse(500, {
      error: { message: `boom ${secret}`, code: 'internal' },
      echo: secret,
    })
  )
  const adapter = await startAdapter({ apiKey: secret, fetchImpl })
  try {
    const result = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(result.status, 502)
    assert.equal(result.json.error.code, 'upstream_error')
    assert.doesNotMatch(result.text, /sk-synthetic-upstream-secret/)
    assert.doesNotMatch(result.text, /boom/)
  } finally {
    await adapter.close()
  }
})

test('malformed upstream content fails closed as 502, malformed requests as 400', async () => {
  const badMessages = [
    { role: 'assistant', content: [{ type: 'image', url: 'x' }] },
    { role: 'assistant', content: 'x', tool_calls: 'not-an-array' },
  ]
  for (const message of badMessages) {
    const fetchImpl = upstream(() => jsonResponse(200, completion(message)))
    const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
    try {
      const result = await postJson(adapter, {
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: 'u' }],
      })
      assert.equal(result.status, 502)
      assert.equal(result.json.error.code, 'malformed_response')
    } finally {
      await adapter.close()
    }
  }

  // The same client faults stay 400 because they are request-side, not an
  // upstream response that failed validation.
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const badContent = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'assistant', content: [{ type: 'image', url: 'x' }] },
        { role: 'user', content: 'u' },
      ],
    })
    assert.equal(badContent.status, 400)
    assert.equal(badContent.json.error.code, 'malformed_chunk')
    const badTools = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'a', tool_calls: 'not-an-array' },
      ],
    })
    assert.equal(badTools.status, 400)
    assert.equal(badTools.json.error.code, 'malformed_tool_calls')
    assert.equal(fetchImpl.calls.length, 0)
  } finally {
    await adapter.close()
  }
})

test('a non-streaming upstream response fails closed without calling text()', async () => {
  let textCalls = 0
  const fetchImpl = async () => ({
    status: 200,
    ok: true,
    body: null,
    async text() {
      textCalls += 1
      return JSON.stringify(completion({ role: 'assistant', content: 'ok' }))
    },
  })
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const result = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(result.status, 502)
    assert.equal(result.json.error.code, 'upstream_error')
    assert.equal(textCalls, 0)
  } finally {
    await adapter.close()
  }
})

test('request and response sizes are bounded', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  // A small explicit limit keeps the oversize case hermetic: the body stays
  // inside the hard-stop window so the socket is not torn down before the 413.
  const adapter = await startAdapter({
    apiKey: 'sk',
    fetchImpl,
    maxRequestBytes: 1024,
  })
  try {
    const oversized = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'x'.repeat(2048) }],
    })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.json.error.code, 'request_too_large')
    assert.equal(fetchImpl.calls.length, 0)
  } finally {
    await adapter.close()
  }

  const bigFetch = upstream(() =>
    jsonResponse(
      200,
      completion({ role: 'assistant', content: 'y'.repeat(2000) })
    )
  )
  const bounded = await startAdapter({
    apiKey: 'sk',
    fetchImpl: bigFetch,
    maxResponseBytes: 128,
  })
  try {
    const result = await postJson(bounded, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(result.status, 502)
    assert.equal(result.json.error.code, 'response_too_large')
  } finally {
    await bounded.close()
  }
})

test('streaming and model mismatch are rejected before any upstream call', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const streaming = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'u' }],
      stream: true,
    })
    assert.equal(streaming.status, 400)
    assert.equal(streaming.json.error.code, 'stream_unsupported')
    const mismatch = await postJson(adapter, {
      model: 'other-model',
      messages: [{ role: 'user', content: 'u' }],
    })
    assert.equal(mismatch.status, 400)
    assert.equal(mismatch.json.error.code, 'model_mismatch')
    const empty = await postJson(adapter, {
      model: MISTRAL_MODEL,
      messages: [],
    })
    assert.equal(empty.status, 400)
    assert.equal(empty.json.error.code, 'invalid_request')
    assert.equal(fetchImpl.calls.length, 0)
  } finally {
    await adapter.close()
  }
})

test('shutdown acknowledges then stops the listener', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'ok' }))
  )
  const adapter = await startAdapter({ apiKey: 'sk', fetchImpl })
  try {
    const response = await fetch(`${adapter.url}${SHUTDOWN_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adapter.token}` },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, closed: true })
    await waitForListenerClose(adapter.url)
    let refused = false
    try {
      await fetch(`${adapter.url}${CHAT_PATH}`, { method: 'POST', body: '{}' })
    } catch {
      refused = true
    }
    assert.equal(refused, true)
  } finally {
    await adapter.close()
  }
})

test('callMistral normalizes a direct canary request', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'pong' }))
  )
  const result = await callMistral({
    apiKey: 'sk-direct',
    fetchImpl,
    body: {
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: 'ping' }],
      max_completion_tokens: 9,
      reasoning: { effort: 'high' },
    },
  })
  assert.equal(result.choices[0].message.content, 'pong')
  assert.equal(fetchImpl.calls[0].url, MISTRAL_URL)
  assert.equal(fetchImpl.calls[0].init.redirect, 'error')
  assert.equal(fetchImpl.calls[0].body.max_tokens, 9)
  assert.equal(fetchImpl.calls[0].body.reasoning_effort, 'max')
  assert.equal(fetchImpl.calls[0].body.reasoning, undefined)
  assert.equal(
    fetchImpl.calls[0].init.headers.authorization,
    'Bearer sk-direct'
  )
})

test('callMistral rejects a non-2xx upstream with a sanitized status', async () => {
  const fetchImpl = async () =>
    new Response('leaked upstream secret body', { status: 429 })
  await assert.rejects(
    () =>
      callMistral({
        apiKey: 'sk-direct',
        fetchImpl,
        body: {
          model: MISTRAL_MODEL,
          messages: [{ role: 'user', content: 'ping' }],
        },
      }),
    (error) => {
      assert.equal(error.code, 'upstream_error')
      assert.equal(error.status, 429)
      assert.match(error.message, /429/)
      assert.doesNotMatch(error.message, /leaked upstream secret/)
      return true
    }
  )
})

test('callMistral wraps raw fetch failures instead of leaking them', async () => {
  const fetchImpl = async () => {
    throw new TypeError('fetch failed: ECONNREFUSED 10.0.0.1')
  }
  await assert.rejects(
    () =>
      callMistral({
        apiKey: 'sk-direct',
        fetchImpl,
        body: {
          model: MISTRAL_MODEL,
          messages: [{ role: 'user', content: 'ping' }],
        },
      }),
    (error) => {
      assert.equal(error.code, 'upstream_error')
      assert.doesNotMatch(error.message, /ECONNREFUSED/)
      return true
    }
  )
})

const RUN_SCRIPT =
  'process.stdout.write(JSON.stringify({' +
  ' key: process.env.MISTRAL_API_KEY ?? null,' +
  ' url: process.env.OCR_LLM_URL ?? null,' +
  ' token: process.env.OCR_LLM_TOKEN != null,' +
  ' model: process.env.OCR_LLM_MODEL ?? null,' +
  ' protocol: process.env.OCR_LLM_PROTOCOL ?? null,' +
  ' anthropic: process.env.OCR_USE_ANTHROPIC ?? null,' +
  ' home: process.env.HOME ?? null }))'

test('run strips the upstream key and injects the OCR environment', async () => {
  const result = await runCli(
    ['run', '--', process.execPath, '-e', RUN_SCRIPT],
    { MISTRAL_API_KEY: 'sk-synthetic-run' }
  )
  assert.equal(result.code, 0)
  const seen = JSON.parse(result.stdout)
  assert.equal(seen.key, null)
  assert.match(seen.url, /^http:\/\/127\.0\.0\.1:\d+\/v1\/chat\/completions$/)
  assert.equal(seen.token, true)
  assert.equal(seen.model, 'zai-glm-5-3')
  assert.equal(seen.protocol, 'openai')
  assert.equal(seen.anthropic, 'false')
  assert.equal(seen.home, process.env.HOME)
})

test('run propagates the child exit code', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-diagnostics-'))
  try {
    const diagnosticsPath = path.join(directory, 'diagnostics.jsonl')
    const result = await runCli(
      ['run', '--', process.execPath, '-e', 'process.exit(7)'],
      {
        MISTRAL_API_KEY: 'sk-synthetic-run',
        OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
      }
    )
    assert.equal(result.code, 7)
    const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'))
    assert.equal(diagnostics.schema_version, 1)
    assert.equal(diagnostics.upstream_attempts, 0)
    assert.doesNotMatch(JSON.stringify(diagnostics), /sk-synthetic-run/)
    const missing = await runCli(
      ['run', '--', process.execPath, '-e', 'process.exit(0)'],
      {
        MISTRAL_API_KEY: 'sk-synthetic-run',
        OCR_ADAPTER_DIAGNOSTICS_PATH: path.join(
          directory,
          'absent',
          'receipt.jsonl'
        ),
      }
    )
    assert.equal(missing.code, 0)
    assert.match(missing.stderr, /execution counters unavailable/)
    assert.doesNotMatch(missing.stderr, /ENOENT|absent|sk-synthetic-run/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('start/serve/stop own the listener lifecycle', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-adapter-lifecycle-'))
  const statePath = path.join(tmp, 'state.json')
  const outputPath = path.join(tmp, 'github-output.txt')
  fs.writeFileSync(outputPath, '')
  const env = {
    MISTRAL_API_KEY: 'sk-synthetic-start',
    RUNNER_TEMP: tmp,
    GITHUB_OUTPUT: outputPath,
  }

  // The detached serve outlives an assertion failure, so stop it no matter how
  // the test ends; stop is idempotent when the state file is already gone.
  t.after(async () => {
    await runCli(['stop', statePath], env)
  })

  const started = await runCli(['start', statePath], env)
  assert.equal(started.code, 0, started.stderr)
  assert.doesNotMatch(started.stdout, /sk-synthetic-start/)

  const outputs = fs.readFileSync(outputPath, 'utf8')
  const urlMatch = /^url=(http:\/\/127\.0\.0\.1:\d+)$/m.exec(outputs)
  const tokenMatch = /^token=([0-9a-f]{64})$/m.exec(outputs)
  assert.ok(urlMatch, 'url output')
  assert.ok(tokenMatch, 'token output')
  assert.match(started.stdout, new RegExp(`::add-mask::${tokenMatch[1]}`))

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  assert.equal(state.url, urlMatch[1])
  assert.equal(state.token, tokenMatch[1])
  assert.deepEqual(Object.keys(state).sort(), ['token', 'url'])
  assert.equal(fs.statSync(statePath).mode & 0o777, 0o600)

  const live = await fetch(`${state.url}${CHAT_PATH}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${state.token}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  assert.equal(live.status, 400)
  await live.text()

  const stopped = await runCli(['stop', statePath], env)
  assert.equal(stopped.code, 0, stopped.stderr)
  assert.equal(fs.existsSync(statePath), false)

  let refused = false
  try {
    await fetch(`${state.url}${CHAT_PATH}`, { method: 'POST', body: '{}' })
  } catch {
    refused = true
  }
  assert.equal(refused, true)
})

test('stop refuses a non-loopback state url', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-adapter-nonloop-'))
  const statePath = path.join(tmp, 'state.json')
  fs.writeFileSync(
    statePath,
    JSON.stringify({ url: 'http://example.com:9', token: 'abc' })
  )
  const result = await runCli(['stop', statePath], { RUNNER_TEMP: tmp })
  assert.notEqual(result.code, 0)
  assert.equal(fs.existsSync(statePath), true)
})

test('state paths outside RUNNER_TEMP are refused', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-adapter-guard-'))
  const outside = path.join(
    os.tmpdir(),
    `ocr-adapter-outside-${Date.now()}.json`
  )
  const result = await runCli(['start', outside], {
    MISTRAL_API_KEY: 'sk',
    RUNNER_TEMP: tmp,
  })
  assert.notEqual(result.code, 0)
  assert.equal(fs.existsSync(outside), false)
})

test('run terminates its listener on SIGTERM', async () => {
  const script =
    'process.stdout.write(process.env.OCR_LLM_URL + "\\n");' +
    ' setInterval(() => {}, 1000)'
  const child = spawn(
    process.execPath,
    [ADAPTER, 'run', '--', process.execPath, '-e', script],
    { env: { ...process.env, MISTRAL_API_KEY: 'sk-synthetic-signal' } }
  )
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }))
    child.on('error', () => resolve({ code: null, signal: null }))
  })
  let timer
  try {
    const url = await waitFor(() =>
      /(http:\/\/127\.0\.0\.1:\d+\/v1\/chat\/completions)/.exec(stdout)
    )
    assert.ok(url, 'listener url was not printed')
    child.kill('SIGTERM')
    const result = await Promise.race([
      exited,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ timeout: true }), 8000)
      }),
    ])
    assert.ok(!result.timeout, 'run did not exit after SIGTERM')
    let refused = false
    try {
      await fetch(url[1], { method: 'POST', body: '{}' })
    } catch {
      refused = true
    }
    assert.equal(refused, true)
  } finally {
    // Whatever happened above, the child must not survive the test.
    clearTimeout(timer)
    child.kill('SIGKILL')
    await exited
  }
})
