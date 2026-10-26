'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { spawn } = require('node:child_process')
const { EventEmitter } = require('node:events')

const {
  MISTRAL_URL,
  MISTRAL_MODEL,
  MISTRAL_FLASH_MODEL,
  normalizeMistralResponse,
  translateMistralRequest,
  createHistoryStore,
  startAdapter,
  callMistral,
  estimateCost,
  buildCostReport,
  createProgressFilter,
  createProgressReporter,
} = require('./ocr-mistral-adapter.cjs')

const ADAPTER = path.join(__dirname, 'ocr-mistral-adapter.cjs')
const CHAT_PATH = '/v1/chat/completions'
const SHUTDOWN_PATH = '/shutdown'

test('Mistral Flash fixes the draft model and max effort while preserving native tool requests', () => {
  const body = {
    model: MISTRAL_FLASH_MODEL,
    messages: [{ role: 'user', content: 'synthetic' }],
    reasoning_effort: 'max',
    reasoning: { effort: 'none' },
    provider: { only: ['untrusted'] },
    max_completion_tokens: 16384,
    prompt_cache_key: 'synthetic-session',
    tools: [{ type: 'function', function: { name: 'task_done' } }],
  }
  const translated = translateMistralRequest(body, undefined, 'mistral-flash')
  assert.equal(translated.model, MISTRAL_FLASH_MODEL)
  assert.equal(translated.reasoning_effort, 'max')
  assert.equal(translated.reasoning, undefined)
  assert.equal(translated.provider, undefined)
  assert.equal(translated.max_tokens, 16384)
  assert.equal(translated.prompt_cache_key, 'synthetic-session')
  assert.equal(translated.tool_choice, 'any')
  for (const [change, code] of [
    [{ reasoning_effort: 'high' }, 'invalid_request'],
    [{ model: MISTRAL_MODEL }, 'model_mismatch'],
  ])
    assert.throws(
      () =>
        translateMistralRequest(
          { ...body, ...change },
          undefined,
          'mistral-flash'
        ),
      { code }
    )
  assert.throws(
    () =>
      normalizeMistralResponse(
        completion({ role: 'assistant', content: 'ok' }),
        'mistral-flash'
      ),
    { code: 'response_model_mismatch' }
  )
})

test('Flash cost receipts use their model prices and reject mixed or unidentified models', () => {
  const row = {
    ...costReceipt(),
    provider: 'mistral-flash',
    model: MISTRAL_FLASH_MODEL,
  }
  const estimate = estimateCost(JSON.stringify(row), 'mistral-flash')
  assert.ok(Math.abs(estimate.withCache - 0.11) < 1e-10)
  assert.ok(Math.abs(estimate.withoutCache - 0.2) < 1e-10)
  assert.ok(Math.abs(estimate.savings - 0.09) < 1e-10)
  for (const bad of [
    costReceipt(),
    { ...row, model: MISTRAL_MODEL },
    { ...row, provider: 'mistral' },
  ]) {
    const report = buildCostReport(
      `${JSON.stringify(row)}\n${JSON.stringify({ ...bad, upstream_attempts: 2 })}`,
      { adapter: 2 },
      'mistral-flash'
    )
    assert.equal(report.estimate, null)
    assert.equal(report.reportedResponseEstimate, null)
    assert.ok(report.reasons.includes('provider_mismatch'))
  }
  assert.ok(estimateCost(JSON.stringify(costReceipt())))
  for (const bad of [
    row,
    { ...row, provider: 'mistral' },
    { ...costReceipt(), provider: 'mistral' },
  ])
    assert.equal(estimateCost(JSON.stringify(bad)), null)
})

test('draft routing uses the exact OpenRouter snapshot and max reasoning without accepting route overrides', () => {
  const body = {
    model: 'deepseek/deepseek-v4.1-flash-1017',
    messages: [{ role: 'user', content: 'synthetic' }],
    reasoning_effort: 'max',
    reasoning: { effort: 'none' },
    provider: { only: ['untrusted'] },
    prompt_cache_key: 'synthetic-session',
    max_completion_tokens: 16384,
    tools: [{ type: 'function', function: { name: 'task_done' } }],
  }
  const translated = translateMistralRequest(body, undefined, 'openrouter')
  assert.equal(translated.model, body.model)
  assert.deepEqual(translated.reasoning, { effort: 'max' })
  assert.equal(translated.reasoning_effort, undefined)
  assert.equal(translated.provider, undefined)
  assert.equal(translated.max_tokens, 16384)
  assert.equal(translated.prompt_cache_key, body.prompt_cache_key)
  assert.equal(translated.tool_choice, 'required')
  for (const [change, code] of [
    [{ reasoning_effort: 'high' }, 'invalid_request'],
    [{ model: MISTRAL_MODEL }, 'model_mismatch'],
    [{ stream: true }, 'stream_unsupported'],
  ])
    assert.throws(
      () =>
        translateMistralRequest(
          { ...body, ...change },
          undefined,
          'openrouter'
        ),
      { code }
    )
  assert.throws(() => translateMistralRequest(body, undefined, 'unknown'), {
    code: 'invalid_provider',
  })
})

test('OpenRouter native reasoning survives prefix and compressed replay with unchanged OCR token accounting', async () => {
  const model = 'deepseek/deepseek-v4.1-flash-1017'
  const native = {
    role: 'assistant',
    content: null,
    reasoning: 'private-reasoning',
    reasoning_details: [
      { type: 'reasoning.text', text: 'private-reasoning', index: 0 },
      { type: 'reasoning.encrypted', data: 'private-signature', index: 1 },
    ],
    tool_calls: [
      {
        id: 'call-read',
        type: 'function',
        function: { name: 'file_read', arguments: '{"path":"synthetic.cjs"}' },
      },
    ],
  }
  const payload = {
    ...completion(native, 'tool_calls'),
    model: 'deepseek/deepseek-v4.1-flash-20261017',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 8,
      total_tokens: 108,
      prompt_tokens_details: { cached_tokens: 40 },
    },
  }
  const fetchImpl = upstream(() => jsonResponse(200, payload))
  const adapter = await startAdapter({
    provider: 'openrouter',
    apiKey: 'synthetic-router-key',
    fetchImpl,
  })
  try {
    const prefix = [{ role: 'user', content: 'synthetic' }]
    const tools = [{ type: 'function', function: { name: 'task_done' } }]
    const prompt_cache_key = 'synthetic-main-task'
    const first = await postJson(adapter, {
      model,
      messages: prefix,
      tools,
      prompt_cache_key,
    })
    assert.equal(first.status, 200)
    const normalized = first.json.choices[0].message
    assert.equal(normalized.content, '')
    assert.equal(normalized.reasoning_content, native.reasoning)
    assert.equal(normalized.reasoning_details, undefined)
    assert.deepEqual(first.json.usage, {
      prompt_tokens: 60,
      completion_tokens: 8,
      total_tokens: 68,
    })
    for (const [replayPrefix, assistant] of [
      [prefix, normalized],
      [[{ role: 'user', content: 'compressed' }], normalized],
      [
        [{ role: 'user', content: 'compressed without echo' }],
        { ...normalized, reasoning_content: undefined },
      ],
    ]) {
      const replay = await postJson(adapter, {
        model,
        tools,
        prompt_cache_key,
        messages: [
          ...replayPrefix,
          assistant,
          {
            role: 'tool',
            tool_call_id: 'call-read',
            content: 'synthetic result',
          },
        ],
      })
      assert.equal(replay.status, 200)
      assert.deepEqual(fetchImpl.calls.at(-1).body.messages[1], native)
    }
    assert.equal(
      fetchImpl.calls[0].url,
      'https://openrouter.ai/api/v1/chat/completions'
    )
    assert.deepEqual(fetchImpl.calls[0].body.reasoning, { effort: 'max' })
    assert.equal(adapter.diagnostics().history.prefix_hits, 1)
    assert.equal(adapter.diagnostics().history.compressed_hits, 2)
    assert.equal(adapter.diagnostics().provider, 'openrouter')
    assert.doesNotMatch(
      JSON.stringify(adapter.diagnostics()),
      /private-|synthetic-router-key/
    )
    const detailsOnly = { ...native, reasoning: null }
    assert.equal(
      normalizeMistralResponse(
        {
          ...payload,
          choices: [{ ...payload.choices[0], message: detailsOnly }],
        },
        'openrouter'
      ).choices[0].message.reasoning_content,
      native.reasoning
    )
    const history = createHistoryStore({ provider: 'openrouter' })
    history.remember(prefix, detailsOnly)
    assert.deepEqual(
      history.restoreMessages([
        { role: 'user', content: 'compressed' },
        normalized,
      ])[1],
      detailsOnly
    )
    history.remember([{ role: 'user', content: 'other' }], {
      ...detailsOnly,
      reasoning_details: [
        detailsOnly.reasoning_details[0],
        { type: 'reasoning.encrypted', data: 'other-signature', index: 1 },
      ],
    })
    assert.throws(
      () =>
        history.restoreMessages([
          { role: 'user', content: 'compressed' },
          normalized,
        ]),
      { code: 'history_collision' }
    )
    assert.deepEqual(
      history.restoreMessages([...prefix, normalized])[1],
      detailsOnly
    )
  } finally {
    await adapter.close()
  }
})

test('OpenRouter retains truncated task completion rejection and refuses another snapshot', async () => {
  const payload = {
    ...completion(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'done',
            type: 'function',
            function: { name: 'task_done', arguments: '{}' },
          },
        ],
      },
      'length'
    ),
    model: 'deepseek/deepseek-v4.1-flash-1017',
  }
  const adapter = await startAdapter({
    provider: 'openrouter',
    apiKey: 'synthetic',
    fetchImpl: upstream(() => jsonResponse(200, payload)),
  })
  try {
    const response = await postJson(adapter, {
      model: payload.model,
      messages: [{ role: 'user', content: 'synthetic' }],
      tools: [{ type: 'function', function: { name: 'task_done' } }],
    })
    assert.equal(response.json.error.code, 'truncated_completion')
    assert.equal(adapter.diagnostics().history.prefix_hits, 0)
    assert.equal(adapter.diagnostics().truncated_completions, 1)
    assert.equal(adapter.diagnostics().accepted_responses, 0)
    assert.throws(
      () =>
        normalizeMistralResponse(
          { ...payload, model: 'deepseek/deepseek-v4.1-flash' },
          'openrouter'
        ),
      { code: 'response_model_mismatch' }
    )
  } finally {
    await adapter.close()
  }
})

test('OpenRouter cost receipts use matching reference prices and preserve incomplete-attempt eligibility', async () => {
  const row = costReceipt({
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4.1-flash-1017',
    prompt_tokens: 1000000,
    cached_prompt_tokens: 750000,
    uncached_prompt_tokens: 250000,
    completion_tokens: 100000,
  })
  const estimate = estimateCost(JSON.stringify(row), 'openrouter')
  assert.ok(Math.abs(estimate.withCache - 0.09975) < 1e-12)
  assert.ok(Math.abs(estimate.withoutCache - 0.21) < 1e-12)
  assert.ok(Math.abs(estimate.savings - 0.11025) < 1e-12)
  const partial = buildCostReport(
    JSON.stringify({ ...row, upstream_attempts: row.responses + 1 }),
    { adapter: 1 },
    'openrouter'
  )
  assert.equal(partial.estimate, null)
  assert.equal(partial.reportedResponseEstimate.unpriced_attempts, 1)
  assert.equal(partial.reportedResponseEstimate.withCache, estimate.withCache)
  for (const [receipt, provider] of [
    [row, 'mistral'],
    [costReceipt(), 'openrouter'],
  ]) {
    const report = buildCostReport(
      JSON.stringify(receipt),
      { adapter: 1 },
      provider
    )
    assert.equal(report.estimate, null)
    assert.equal(report.reportedResponseEstimate, null)
    assert.ok(report.reasons.includes('provider_mismatch'))
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-router-cost-'))
  try {
    const receipt = path.join(directory, 'receipt.jsonl')
    const summary = path.join(directory, 'summary.md')
    fs.writeFileSync(receipt, JSON.stringify(row))
    const result = await runCli(['summary', receipt], {
      OCR_ADAPTER_PROVIDER: 'openrouter',
      GITHUB_STEP_SUMMARY: summary,
    })
    assert.equal(result.code, 0)
    assert.equal(result.stdout, fs.readFileSync(summary, 'utf8'))
    assert.match(result.stdout, /\$0\.003\b/)
    assert.match(result.stdout, /OCR cost status=complete reasons=none/)
    assert.ok(result.stdout.includes(`$${estimate.withCache.toFixed(4)}`))
    assert.doesNotMatch(result.stdout, /zai-glm|\$1\.40/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('draft startup fails closed on an unknown profile or missing selected credential', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-router-start-'))
  try {
    const state = path.join(directory, 'adapter.json')
    for (const [provider, code] of [
      ['unknown', 'invalid_provider'],
      ['openrouter', 'missing_env'],
    ]) {
      const result = await runCli(['start', state], {
        RUNNER_TEMP: directory,
        OCR_ADAPTER_PROVIDER: provider,
        OPENROUTER_API_KEY: '',
        MISTRAL_API_KEY: 'synthetic-unselected-key',
      })
      assert.notEqual(result.code, 0)
      assert.match(result.stderr, new RegExp(code))
      assert.equal(fs.existsSync(state), false)
      assert.doesNotMatch(result.stderr, /synthetic-unselected-key/)
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('progress reconstructs known events without reflecting private fields or workflow commands', () => {
  const records = []
  const progress = createProgressFilter((line) => records.push(line))
  const raw =
    [
      '[ocr] 8 file(s) changed, reviewing 5 in /OCR_PRIVATE_SENTINEL',
      '[ocr]   ▶ file_read "OCR_PRIVATE_SENTINEL"',
      '[ocr]   ✔ file_read (3ms)',
      '[ocr]   ✘ code_search failed: OCR_PRIVATE_SENTINEL',
      '[ocr]   ▶ lookup_library_docs "OCR_PRIVATE_SENTINEL"',
      '[ocr]   ✔ lookup_library_docs (3ms)',
      '[ocr]   ✘ lookup_library_docs failed: OCR_PRIVATE_SENTINEL',
      '[ocr] Plan completed for group "OCR_PRIVATE_SENTINEL"',
      '[ocr] Review filter removed 2 comment(s) for group "OCR_PRIVATE_SENTINEL"',
      '[ocr] token budget reached (used 3M + group est 2M) OCR_PRIVATE_SENTINEL',
      '[ocr] Summary: 5 file(s) reviewed, 2 comment(s), ~1234 token(s) used, 1s elapsed',
      '[ocr] Session: OCR_PRIVATE_SENTINEL',
      '[ocr]   ▶ OCR_PRIVATE_SENTINEL "unknown-tool"',
      '[ocr] Review filter: failed to parse LLM response, raw: OCR_PRIVATE_SENTINEL',
      '::error::OCR_PRIVATE_SENTINEL',
      'reasoning: OCR_PRIVATE_SENTINEL',
      'Error: review failed (timeout): OCR_PRIVATE_SENTINEL https://provider.invalid/v1 OCR_PRIVATE_TOKEN',
      '[ocr]   Error: MCP transport failed: OCR_PRIVATE_SENTINEL',
      '  Error: review failed (provider): OCR_PRIVATE_SENTINEL',
      'continuation Error: review failed (budget): OCR_PRIVATE_SENTINEL',
      'Error: review failed (provider): OCR_PRIVATE_SENTINEL',
      'Error: OCR_PRIVATE_SENTINEL',
    ].join('\r\n') + '\n'
  for (const byte of Buffer.from(raw)) progress.write(Buffer.from([byte]))
  progress.end()
  assert.deepEqual(records, [
    'OCR progress event=review_started changed_files=8 reviewing_files=5\n',
    'OCR progress event=tool_started tool=file_read\n',
    'OCR progress event=tool_completed tool=file_read\n',
    'OCR progress event=tool_failed tool=code_search\n',
    'OCR progress event=tool_started tool=lookup_library_docs\n',
    'OCR progress event=tool_completed tool=lookup_library_docs\n',
    'OCR progress event=tool_failed tool=lookup_library_docs\n',
    'OCR progress event=phase_completed phase=planning\n',
    'OCR progress event=phase_completed phase=filtering\n',
    'OCR progress event=budget_reached\n',
    'OCR progress event=review_finished files=5 findings=2 tokens=1234\n',
    'OCR progress event=cli_error code=review_failed classification=timeout\n',
  ])
  assert.doesNotMatch(records.join(''), /OCR_PRIVATE_SENTINEL|::/)
})

test('progress drops whole overlong records, resumes at newline and safely flushes a final fragment', () => {
  const records = []
  const progress = createProgressFilter((line) => records.push(line))
  progress.write('[ocr]   ▶ file_read ' + 'x'.repeat(4096))
  progress.write('[ocr]   ✔ file_find (1ms)')
  assert.equal(records.length, 0)
  progress.write(
    '\n[ocr] 9999999999999999 file(s) changed, reviewing 1 in private\n'
  )
  progress.write('[ocr]   ✔ file_find (1ms)')
  assert.equal(records.length, 0)
  progress.end()
  progress.end()
  assert.deepEqual(records, [
    'OCR progress event=tool_completed tool=file_find\n',
  ])
  const bounded = createProgressFilter((line) => records.push(line))
  bounded.write('Error: ' + 'x'.repeat(4096))
  bounded.write('\n')
  assert.deepEqual(records.slice(1), [])
  bounded.write('Error: review fail')
  bounded.write('ed (provider): OCR_PRIVATE_SENTINEL')
  bounded.end()
  assert.deepEqual(records.slice(1), [
    'OCR progress event=cli_error code=review_failed classification=provider\n',
  ])
  assert.doesNotMatch(records.join(''), /SENTINEL/)
  const failed = createProgressFilter(() => {
    throw new Error('synthetic log sink unavailable')
  })
  assert.doesNotThrow(() => {
    failed.write('[ocr]   ✔ file_read (1ms)\n')
    failed.end()
  })
})

test('progress classifies fatal CLI roots with fixed tokens and refuses non-root lookalikes', () => {
  const cases = [
    [
      'Error: review failed (budget): OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=review_failed classification=budget\n',
    ],
    [
      'Error: review failed (capacity): OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=review_failed classification=unknown\n',
    ],
    [
      'Error: review failed: load diffs: get diffs: git diff failed: OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=review_failed classification=git_diff\n',
    ],
    [
      'Error: review failed: load diffs: get diffs: cannot find merge-base between OCR_PRIVATE_SENTINEL and OCR_PRIVATE_TOKEN\n',
      'OCR progress event=cli_error code=review_failed classification=merge_base\n',
    ],
    [
      'Error: review failed: OCR_PRIVATE_SENTINEL git diff failed: ::error::OCR_PRIVATE_TOKEN\n',
      'OCR progress event=cli_error code=review_failed classification=unknown\n',
    ],
    [
      'Error: review failed without a marker: OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=cli_failed classification=unknown\n',
    ],
    [
      'Error: review failed (timeout) trailing text: OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=review_failed classification=unknown\n',
    ],
    [
      'Error: OCR_PRIVATE_SENTINEL\n',
      'OCR progress event=cli_error code=cli_failed classification=unknown\n',
    ],
    ['[ocr]   Error: review failed (timeout): OCR_PRIVATE_SENTINEL\n', ''],
    [
      '  Error: review failed: load diffs: get diffs: git diff failed: OCR_PRIVATE_SENTINEL\n',
      '',
    ],
  ]
  for (const [line, expected] of cases) {
    const records = []
    const progress = createProgressFilter((record) => records.push(record))
    for (const byte of Buffer.from(line)) progress.write(Buffer.from([byte]))
    progress.end()
    assert.deepEqual(records, expected ? [expected] : [], line)
    assert.doesNotMatch(records.join(''), /SENTINEL|::/)
  }
})

test('progress heartbeats reflect quiet time and finish clears the timer exactly once', () => {
  const records = []
  let time = 100
  let tick
  let unrefs = 0
  let clears = 0
  const timer = { unref: () => unrefs++ }
  const progress = createProgressReporter((line) => records.push(line), {
    now: () => time,
    setInterval(callback, ms) {
      assert.equal(ms, 60000)
      tick = callback
      return timer
    },
    clearInterval(value) {
      assert.equal(value, timer)
      clears++
    },
  })
  assert.equal(unrefs, 1)
  time += 59999
  tick()
  assert.deepEqual(records, [])
  time++
  tick()
  tick()
  assert.deepEqual(records, [
    'OCR progress event=heartbeat elapsed_ms=60000 idle_ms=60000\n',
  ])
  time += 30000
  progress.write('[ocr]   ▶ file_read "OCR_PRIVATE_SENTINEL"\n')
  time += 30000
  progress.write('::error::OCR_PRIVATE_SENTINEL\n')
  tick()
  assert.equal(records.length, 2)
  time += 30000
  tick()
  assert.equal(
    records[2],
    'OCR progress event=heartbeat elapsed_ms=150000 idle_ms=60000\n'
  )
  progress.write('[ocr]   ✔ file_read (1ms)')
  progress.finish({ code: 0 })
  const finished = records.slice()
  assert.match(
    records.at(-1),
    /event=process_exited exit_code=0 signaled=false spawn_failed=false elapsed_ms=150000\n$/
  )
  progress.finish({ code: 7 })
  progress.end()
  progress.write('[ocr]   ✔ code_search (1ms)\n')
  time += 60000
  tick()
  assert.deepEqual(records, finished)
  assert.equal(clears, 1)
  assert.equal(
    records.filter((line) => line.includes('tool_completed')).length,
    1
  )
  assert.doesNotMatch(records.join(''), /SENTINEL|::/)
})

test('compression telemetry records bounded snapshots and rejects incomplete or untrusted records', () => {
  const marker = '[ocr] compression_telemetry version=1\n'
  const start = '[ocr] compression_started before_estimated_tokens=200\n'
  const end =
    '[ocr] compression_finished outcome=rebuilt before_estimated_tokens=200 after_estimated_tokens=50\n'
  const records = []
  let time = 0
  let tick
  const progress = createProgressReporter((line) => records.push(line), {
    now: () => time,
    setInterval(callback) {
      tick = callback
      return { unref() {} }
    },
    clearInterval() {},
  })
  progress.write(marker + start + start)
  assert.equal(progress.compression().complete, false)
  time = 60000
  tick()
  assert.match(records.at(-1), /event=heartbeat elapsed_ms=60000 idle_ms=60000/)
  progress.write(end.slice(0, 45))
  progress.write(end.slice(45))
  progress.write(
    '[ocr] compression_finished outcome=cancelled before_estimated_tokens=200 after_estimated_tokens=200\n'
  )
  progress.finish({ code: 7 })
  assert.deepEqual(progress.compression(), {
    schema_version: 1,
    complete: true,
    started: 2,
    rebuilt: 1,
    unchanged: 0,
    failed: 0,
    cancelled: 1,
    rebuilt_before_estimated_tokens: 200,
    rebuilt_after_estimated_tokens: 50,
  })
  assert.match(records.join(''), /event=compression_finished outcome=rebuilt/)
  const snapshot = progress.compression()
  snapshot.started = 999
  assert.equal(progress.compression().started, 2)
  for (const [text, drained] of [
    ['', true],
    [marker + start, true],
    [marker + end, true],
    [start + end, true],
    [marker + start + end.trimEnd(), true],
    [marker + start + end, false],
    [
      marker +
        '[ocr] compression_started before_estimated_tokens=1000000000000\n',
      true,
    ],
    [marker + '[ocr] compression_finished outcome=PRIVATE_SENTINEL\n', true],
    [
      marker + '[ocr] compression_' + 'PRIVATE_SENTINEL'.repeat(400) + '\n',
      true,
    ],
    [
      marker +
        '[ocr] compression_finished outcome=failed before_estimated_tokens=2 after_estimated_tokens=1\n',
      true,
    ],
  ]) {
    const live = []
    const reporter = createProgressReporter((line) => live.push(line))
    reporter.write(text)
    reporter.finish({ code: 0, stderrComplete: drained })
    assert.equal(reporter.compression().complete, false)
    assert.doesNotMatch(live.join(''), /PRIVATE_SENTINEL|::/)
  }
  const zero = createProgressReporter(() => {
    throw new Error('synthetic sink failure')
  })
  zero.write(marker)
  zero.finish({ code: 0 })
  assert.equal(zero.compression().complete, true)
  assert.equal(zero.compression().started, 0)
})

test('heartbeat and terminal sink failures preserve lifecycle cleanup', () => {
  let time = 0
  let tick
  let cleared = false
  const progress = createProgressReporter(
    () => {
      throw new Error('OCR_PRIVATE_SENTINEL')
    },
    {
      now: () => time,
      setInterval(callback) {
        tick = callback
        return { unref() {} }
      },
      clearInterval() {
        cleared = true
      },
    }
  )
  assert.doesNotThrow(() => {
    time = 60000
    tick()
    progress.write('[ocr]   ✔ file_read (1ms)\n')
    progress.finish({ failed: true })
  })
  assert.equal(cleared, true)
})

function costReceipt(overrides = {}) {
  return {
    schema_version: 1,
    responses: 1,
    upstream_attempts: 1,
    missing_usage: 0,
    cache_usage_responses: 1,
    missing_cache_usage: 0,
    invalid_cache_usage: 0,
    unfinished_requests: 0,
    prompt_tokens: 1000000,
    completion_tokens: 100000,
    cached_prompt_tokens: 750000,
    uncached_prompt_tokens: 250000,
    ...overrides,
  }
}

test('cost estimates aggregate lifetimes once and keep output cost in the no-cache baseline', () => {
  const row = costReceipt({
    request_types: { main: costReceipt() },
    conversations: [costReceipt()],
  })
  const estimate = estimateCost(
    `${JSON.stringify(row)}\n${JSON.stringify(row)}\n`
  )
  assert.equal(estimate.prompt_tokens, 2000000)
  assert.equal(estimate.cached_prompt_tokens, 1500000)
  assert.equal(estimate.responses, 2)
  assert.ok(Math.abs(estimate.withCache - 1.79) < 1e-12)
  assert.ok(Math.abs(estimate.withoutCache - 3.68) < 1e-12)
  assert.ok(Math.abs(estimate.savings - 1.89) < 1e-12)
  assert.ok(Math.abs(estimate.savingsPercent - (100 * 1.89) / 3.68) < 1e-12)
  const uncached = estimateCost(
    JSON.stringify(
      costReceipt({ cached_prompt_tokens: 0, uncached_prompt_tokens: 1000000 })
    )
  )
  assert.equal(uncached.withCache, uncached.withoutCache)
  assert.equal(uncached.savings, 0)
})

test('cost estimates refuse incomplete, inconsistent or unsupported receipts', () => {
  assert.equal(estimateCost(''), null)
  for (const overrides of [
    { schema_version: 2 },
    { missing_usage: 1 },
    { missing_cache_usage: 1 },
    { invalid_cache_usage: 1 },
    { unfinished_requests: 1 },
    { upstream_attempts: 2 },
    { cache_usage_responses: 0 },
    { cached_prompt_tokens: 1000001 },
    { completion_tokens: -1 },
    { completion_tokens: 0.5 },
    { completion_tokens: undefined },
    { prompt_tokens: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const row = costReceipt(overrides)
    assert.equal(estimateCost(JSON.stringify(row)), null)
    assert.equal(
      estimateCost(`${JSON.stringify(costReceipt())}\n${JSON.stringify(row)}`),
      null
    )
  }
})

test('stage cost totals reconcile every invocation and retain complete stages when another receipt is missing', () => {
  const rows = [
    costReceipt({ stage: 'preflight' }),
    costReceipt(),
    costReceipt(),
    costReceipt({ stage: 'topology' }),
  ]
  const expected = { preflight: 1, adapter: 2, topology: 1 }
  const report = buildCostReport(rows.map(JSON.stringify).join('\n'), expected)
  assert.deepEqual(report.reasons, [])
  assert.equal(report.estimate.prompt_tokens, 4000000)
  assert.ok(Math.abs(report.estimate.withCache - 3.58) < 1e-12)
  assert.ok(Math.abs(report.estimate.withoutCache - 7.36) < 1e-12)
  assert.deepEqual(
    report.stages.map((stage) => stage.observed),
    [2, 1, 1]
  )
  rows.splice(1, 1)
  const partial = buildCostReport(rows.map(JSON.stringify).join('\n'), expected)
  assert.equal(partial.estimate, null)
  assert.deepEqual(partial.reasons, ['receipt_count_mismatch'])
  assert.equal(partial.stages[0].estimate, null)
  assert.equal(partial.stages[1].estimate.responses, 1)
  assert.equal(partial.stages[2].estimate.responses, 1)
})

test('cost reporting names incomplete coverage and distinguishes skipped stages from missing receipts', () => {
  for (const [overrides, reason] of [
    [{ schema_version: 2 }, 'unsupported_schema'],
    [{ completion_tokens: -1 }, 'invalid_counters'],
    [{ missing_usage: 1 }, 'missing_usage'],
    [{ missing_cache_usage: 1 }, 'missing_cache_usage'],
    [{ invalid_cache_usage: 1 }, 'invalid_cache_usage'],
    [{ unfinished_requests: 1 }, 'unfinished_requests'],
    [{ upstream_attempts: 2 }, 'unaccounted_attempts'],
    [{ cache_usage_responses: 0 }, 'incomplete_cache_coverage'],
    [{ cached_prompt_tokens: 1000001 }, 'inconsistent_counters'],
  ]) {
    const report = buildCostReport(JSON.stringify(costReceipt(overrides)))
    assert.equal(report.estimate, null)
    assert.ok(report.reasons.includes(reason))
  }
  const missing = buildCostReport(JSON.stringify(costReceipt()), {
    adapter: 1,
    preflight: 1,
  })
  assert.equal(missing.estimate, null)
  assert.equal(missing.stages[1].observed, 0)
  const failedPreflight = buildCostReport(
    JSON.stringify(costReceipt({ stage: 'preflight', upstream_attempts: 2 })),
    { preflight: 1, adapter: 0, topology: 0 }
  )
  assert.equal(failedPreflight.estimate, null)
  assert.ok(failedPreflight.reasons.includes('unaccounted_attempts'))
  assert.equal(failedPreflight.stages[0].estimate.responses, 0)
  assert.equal(failedPreflight.stages[2].estimate.withCache, 0)
  for (const [text, reason] of [
    ['', 'empty_receipt'],
    ['{::error::private-source-marker', 'malformed_receipt'],
    [
      JSON.stringify(costReceipt({ stage: '::error::private-source-marker' })),
      'invalid_stage',
    ],
  ]) {
    const report = buildCostReport(text)
    assert.equal(report.estimate, null)
    assert.ok(report.reasons.includes(reason))
    assert.doesNotMatch(JSON.stringify(report), /private-source-marker/)
  }
  assert.deepEqual(buildCostReport('', { adapter: -1 }).reasons, [
    'invalid_expectations',
  ])
})

test('reported-response cost preserves strict totals and refuses every other coverage gap', async () => {
  const row = costReceipt({
    upstream_attempts: 2,
    accepted_responses: 0,
    request_types: { main: costReceipt() },
    conversations: [costReceipt()],
  })
  const expected = { adapter: 2, preflight: 1 }
  const rows = [row, row, costReceipt({ stage: 'preflight' })]
  const text = rows.map(JSON.stringify).join('\n')
  const report = buildCostReport(text, expected)
  assert.equal(report.estimate, null)
  assert.equal(estimateCost(text), null)
  assert.deepEqual(report.reasons, ['unaccounted_attempts'])
  const partial = report.reportedResponseEstimate
  assert.equal(partial.responses, 3)
  assert.equal(partial.unpriced_attempts, 2)
  assert.equal(partial.prompt_tokens, 3000000)
  assert.ok(Math.abs(partial.withCache - 2.685) < 1e-12)
  assert.ok(Math.abs(partial.withoutCache - 5.52) < 1e-12)
  assert.ok(Math.abs(partial.savings - 2.835) < 1e-12)
  assert.equal(report.stages[0].estimate, null)
  assert.ok(report.stages[1].estimate)
  const unpriced = buildCostReport(
    JSON.stringify(
      costReceipt({
        upstream_attempts: 1,
        responses: 0,
        cache_usage_responses: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cached_prompt_tokens: 0,
        uncached_prompt_tokens: 0,
      })
    )
  )
  assert.equal(unpriced.estimate, null)
  assert.equal(unpriced.reportedResponseEstimate.responses, 0)
  assert.equal(unpriced.reportedResponseEstimate.unpriced_attempts, 1)
  assert.equal(unpriced.reportedResponseEstimate.withCache, 0)
  assert.equal(
    buildCostReport(JSON.stringify(costReceipt())).reportedResponseEstimate,
    null
  )
  for (const change of [
    { schema_version: 2 },
    { missing_usage: 1 },
    { missing_cache_usage: 1 },
    { invalid_cache_usage: 1 },
    { unfinished_requests: 1 },
    { cache_usage_responses: 0 },
    { completion_tokens: -1 },
    { prompt_tokens: Number.MAX_SAFE_INTEGER + 1 },
    { cached_prompt_tokens: 1000001 },
    { upstream_attempts: 0 },
  ]) {
    assert.equal(
      buildCostReport(JSON.stringify({ ...row, ...change }))
        .reportedResponseEstimate,
      null
    )
  }
  for (const [input, counts] of [
    [text, { ...expected, adapter: 3 }],
    [`${text}\nnull`, expected],
    [`${text}\n{PRIVATE_SENTINEL`, expected],
    [
      `${text}\n${JSON.stringify(costReceipt({ stage: 'PRIVATE_SENTINEL' }))}`,
      expected,
    ],
    [JSON.stringify(row), { adapter: -1 }],
    [
      [row, costReceipt({ upstream_attempts: 0 })]
        .map(JSON.stringify)
        .join('\n'),
      { adapter: 2 },
    ],
    [
      [{ ...row, upstream_attempts: Number.MAX_SAFE_INTEGER }, row]
        .map(JSON.stringify)
        .join('\n'),
      { adapter: 2 },
    ],
  ]) {
    const invalid = buildCostReport(input, counts)
    assert.equal(invalid.estimate, null)
    assert.equal(invalid.reportedResponseEstimate, null)
    assert.doesNotMatch(JSON.stringify(invalid), /PRIVATE_SENTINEL/)
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-partial-cost-'))
  try {
    const receiptPath = path.join(directory, 'receipts.jsonl')
    const summaryPath = path.join(directory, 'summary.md')
    fs.writeFileSync(receiptPath, text)
    const result = await runCli(
      ['summary', receiptPath, 'adapter=2', 'preflight=1'],
      { GITHUB_STEP_SUMMARY: summaryPath }
    )
    assert.equal(result.code, 0)
    assert.equal(result.stdout, fs.readFileSync(summaryPath, 'utf8'))
    assert.match(
      result.stdout,
      /^OCR cost status=unavailable reasons=unaccounted_attempts$/m
    )
    assert.match(
      result.stdout,
      /^OCR cost scope=reported_responses status=partial responses=3 unpriced_attempts=2 estimated_with_cache_usd=2\.6850 estimated_without_cache_usd=5\.5200 estimated_savings_usd=2\.8350 savings_percent=51\.4$/m
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('manual workflows reconcile shared stage receipts against independent step outputs', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../workflows/check-ocr-final-review.yml'),
    'utf8'
  )
  for (const [job, stepId, stageArgs] of [
    ['review', 'run_review', ['preflight', 'adapter']],
    ['review_stack', 'code_review', ['preflight', 'adapter', 'topology']],
  ]) {
    const block = source.match(
      new RegExp(`\\n  ${job}:\\n([\\s\\S]*?)(?=\\n  [a-z][\\w-]*:\\n|$)`)
    )[1]
    const steps = block.split(/^      - name: /m).slice(1)
    const preflight = steps.find((step) => step.includes('id: preflight'))
    const execution = steps.find((step) => step.includes(`id: ${stepId}`))
    const summary = steps.find((step) =>
      step.includes('ocr-mistral-adapter.cjs summary')
    )
    const receiptPath = execution.match(/OCR_ADAPTER_DIAGNOSTICS_PATH: (.+)/)[1]
    assert.equal(
      preflight.match(/OCR_ADAPTER_DIAGNOSTICS_PATH: (.+)/)[1],
      receiptPath
    )
    assert.equal(summary.match(/DIAGNOSTICS_PATH: (.+)/)[1], receiptPath)
    assert.ok(summary.includes(`steps.${stepId}.outputs.adapter_lifetimes`))
    assert.ok(summary.includes("steps.preflight.outcome == 'skipped'"))
    for (const stage of stageArgs) assert.ok(summary.includes(`"${stage}=\${`))
    if (job === 'review_stack') {
      const topology = steps.find((step) =>
        step.includes('id: topology_review')
      )
      assert.equal(
        topology.match(/OCR_ADAPTER_DIAGNOSTICS_PATH: (.+)/)[1],
        receiptPath
      )
      assert.ok(summary.includes("steps.topology_review.outcome == 'skipped'"))
    }
  }
})

test('failure summary emits only complete allowlisted counters without changing cost availability', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-failure-summary-')
  )
  const receiptPath = path.join(directory, 'receipt.jsonl')
  const adapter = await startAdapter({
    apiKey: 'synthetic',
    fetchImpl: () => new Response('private-provider-error', { status: 429 }),
  })
  try {
    await postJson(adapter, {
      messages: [{ role: 'user', content: 'private-prompt' }],
    })
    await adapter.close()
    const receipt = adapter.diagnostics()
    receipt.failures['::error::private-key'] = 99
    for (const [value, status] of [
      [receipt, 'complete'],
      [{ ...receipt, failures: { upstream_throttled: 1 } }, 'unavailable'],
    ]) {
      fs.writeFileSync(receiptPath, JSON.stringify(value))
      const result = await runCli(['summary', receiptPath], {
        GITHUB_STEP_SUMMARY: path.join(directory, 'summary.md'),
      })
      assert.equal(result.code, 0)
      const line = result.stdout
        .split('\n')
        .find((line) => line.startsWith('OCR failures '))
      assert.match(line, new RegExp(`^OCR failures status=${status}`))
      if (status === 'complete') assert.match(line, /upstream_throttled=1/)
      else assert.equal(line, 'OCR failures status=unavailable')
      assert.doesNotMatch(result.stdout, /private-/)
      assert.match(result.stdout, /OCR cost status=unavailable/)
    }
  } finally {
    await adapter.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('upstream error summaries validate fields and retain the final non-null rejection', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-upstream-summary-')
  )
  const file = path.join(directory, 'receipt.jsonl')
  const row = (last_upstream_error) => ({
    schema_version: 1,
    last_upstream_error,
  })
  const first = row({ http_status: 401, code: 401 })
  const last = row({
    http_status: 402,
    code: 402,
    reason: 'key_budget_exhausted',
  })
  const cases = [
    [[], 'status=unavailable'],
    [[{ schema_version: 1 }], 'status=unavailable'],
    [[row(null)], 'status=none'],
    [
      [first, last, row(null)],
      'status=complete stage=adapter http_status=402 code=402 reason=key_budget_exhausted',
    ],
    [
      [row({ http_status: 404, code: 'unknown' })],
      'status=complete stage=adapter http_status=404 code=unknown reason=unknown',
    ],
    [
      [row({ http_status: null, code: 'unknown' })],
      'status=complete stage=adapter http_status=unknown code=unknown reason=unknown',
    ],
    ...[
      'PRIVATE_PROVIDER_SENTINEL',
      { http_status: '401', code: 401 },
      { http_status: 999, code: 401 },
      { http_status: 401, code: 'PRIVATE_PROVIDER_SENTINEL' },
      { http_status: 401, code: 418 },
      { http_status: 403, code: 403, reason: 'PRIVATE_PROVIDER_SENTINEL' },
      { http_status: 403, code: 403, reason: null },
    ].map((value) => [[first, row(value)], 'status=unknown']),
  ]
  try {
    for (const [rows, expected] of cases) {
      fs.writeFileSync(file, rows.map(JSON.stringify).join('\n'))
      const summaryPath = path.join(directory, 'summary.md')
      fs.writeFileSync(summaryPath, '')
      const result = await runCli(['summary', file], {
        GITHUB_STEP_SUMMARY: summaryPath,
      })
      assert.equal(result.code, 0)
      const line = result.stdout
        .split('\n')
        .find((line) => line.startsWith('OCR upstream_error '))
      assert.ok(line.startsWith('OCR upstream_error ' + expected), line)
      assert.ok(fs.readFileSync(summaryPath, 'utf8').includes(line))
      assert.doesNotMatch(result.stdout, /PRIVATE_PROVIDER_SENTINEL/)
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('execution summary validates new timing and history independently of legacy cost coverage', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-execution-summary-')
  )
  const adapter = await startAdapter({
    apiKey: 'synthetic',
    fetchImpl: upstream(() => {
      const payload = completion({ role: 'assistant', content: 'synthetic' })
      payload.usage.prompt_tokens_details = { cached_tokens: 1 }
      return jsonResponse(200, payload)
    }),
  })
  try {
    assert.equal(
      (
        await postJson(adapter, {
          messages: [{ role: 'user', content: 'synthetic' }],
        })
      ).status,
      200
    )
    await adapter.close()
    const receipt = adapter.diagnostics()
    Object.assign(receipt, {
      request_duration_ms: 300001,
      max_request_duration_ms: 300001,
      max_accepted_response_duration_ms: 300001,
      accepted_responses_over_300s: 1,
      private_field: '::error::PRIVATE_SENTINEL',
    })
    Object.assign(receipt.history, {
      misses: 3,
      miss_no_reasoning: 1,
      miss_unknown_turn: 1,
      miss_ambiguous_turn: 1,
    })
    receipt.compression = {
      schema_version: 1,
      complete: true,
      started: 2,
      rebuilt: 1,
      unchanged: 1,
      failed: 0,
      cancelled: 0,
      rebuilt_before_estimated_tokens: 200,
      rebuilt_after_estimated_tokens: 50,
    }
    const receiptPath = path.join(directory, 'receipt.jsonl')
    const summaryPath = path.join(directory, 'summary.md')
    fs.writeFileSync(
      receiptPath,
      [receipt, receipt].map(JSON.stringify).join('\n')
    )
    let result = await runCli(['summary', receiptPath, 'adapter=2'], {
      GITHUB_STEP_SUMMARY: summaryPath,
    })
    assert.equal(result.code, 0)
    assert.equal(result.stdout, fs.readFileSync(summaryPath, 'utf8'))
    assert.match(
      result.stdout,
      /^OCR timing status=complete stage=adapter request_duration_ms=600002 max_request_duration_ms=300001 accepted_responses=2 max_accepted_response_duration_ms=300001 accepted_responses_over_300s=2$/m
    )
    assert.match(
      result.stdout,
      /^OCR history status=complete stage=adapter misses=6 miss_no_reasoning=2 miss_unknown_turn=2 miss_ambiguous_turn=2$/m
    )
    assert.doesNotMatch(result.stdout, /PRIVATE_SENTINEL/)
    assert.match(
      result.stdout,
      /^OCR compression status=complete stage=adapter started=4 rebuilt=2 unchanged=2 failed=0 cancelled=0 rebuilt_before_estimated_tokens=400 rebuilt_after_estimated_tokens=100$/m
    )
    for (const compression of [
      undefined,
      { ...receipt.compression, complete: false },
      { ...receipt.compression, started: 1 },
      {
        ...receipt.compression,
        rebuilt_before_estimated_tokens: 'PRIVATE_SENTINEL',
      },
      {
        ...receipt.compression,
        rebuilt_before_estimated_tokens: Number.MAX_SAFE_INTEGER,
      },
    ]) {
      const row = { ...receipt, compression }
      fs.writeFileSync(
        receiptPath,
        [receipt, row, row].map(JSON.stringify).join('\n')
      )
      result = await runCli(['summary', receiptPath, 'adapter=3'], {
        GITHUB_STEP_SUMMARY: summaryPath,
      })
      assert.equal(result.code, 0)
      assert.match(result.stdout, /^OCR compression status=unavailable$/m)
      assert.match(result.stdout, /^OCR cost status=complete reasons=none$/m)
      assert.doesNotMatch(result.stdout, /PRIVATE_SENTINEL/)
    }
    for (const variant of ['legacy', 'invalid', 'unfinished', 'usage']) {
      const row = structuredClone(receipt)
      if (variant === 'legacy') {
        delete row.max_request_duration_ms
        delete row.history.miss_no_reasoning
      } else if (variant === 'invalid') {
        row.accepted_responses_over_300s = 2
        row.history.miss_no_reasoning = '::error::PRIVATE_SENTINEL'
      } else if (variant === 'usage') row.missing_usage = 1
      else row.unfinished_requests = 1
      fs.writeFileSync(receiptPath, JSON.stringify(row))
      result = await runCli(['summary', receiptPath], {
        GITHUB_STEP_SUMMARY: summaryPath,
      })
      assert.equal(result.code, 0)
      if (variant === 'usage') {
        assert.match(result.stdout, /^OCR timing status=complete /m)
        assert.match(result.stdout, /^OCR cost status=unavailable /m)
      } else assert.match(result.stdout, /^OCR timing status=unavailable$/m)
      if (variant === 'legacy' || variant === 'invalid') {
        assert.match(result.stdout, /^OCR history status=unavailable$/m)
        assert.match(result.stdout, /^OCR cost status=complete reasons=none$/m)
      }
      assert.doesNotMatch(result.stdout, /PRIVATE_SENTINEL/)
    }
  } finally {
    await adapter.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('cost summary CLI logs and appends the same report, preserving success when either sink fails', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-cost-summary-'))
  try {
    const receiptPath = path.join(directory, 'receipt.jsonl')
    const summaryPath = path.join(directory, 'summary.md')
    const env = { GITHUB_STEP_SUMMARY: summaryPath }
    fs.writeFileSync(
      receiptPath,
      JSON.stringify(
        costReceipt({ private_field: '::error::private-source-marker' })
      )
    )
    let result = await runCli(['summary', receiptPath], env)
    assert.equal(result.code, 0)
    const summary = fs.readFileSync(summaryPath, 'utf8')
    assert.equal(result.stdout, summary)
    assert.match(summary, /\$0\.8950/)
    assert.match(summary, /\$1\.8400/)
    assert.match(summary, /\$0\.9450/)
    assert.doesNotMatch(summary, /private-source-marker/)
    for (const contents of [
      '',
      'null',
      '{private-source-marker',
      JSON.stringify(costReceipt({ missing_usage: 1 })),
    ]) {
      fs.writeFileSync(receiptPath, contents)
      const previous = fs.readFileSync(summaryPath, 'utf8')
      result = await runCli(['summary', receiptPath], env)
      assert.equal(result.code, 0)
      assert.equal(
        result.stdout,
        fs.readFileSync(summaryPath, 'utf8').slice(previous.length)
      )
      assert.doesNotMatch(result.stdout, /\$0\.8950/)
      assert.match(
        result.stdout,
        /OCR cost status=unavailable reasons=[a-z_,]+/
      )
    }
    result = await runCli(['summary', path.join(directory, 'absent')], env)
    assert.equal(result.code, 0)
    assert.ok(result.stdout.length > 0)
    assert.ok(fs.readFileSync(summaryPath, 'utf8').endsWith(result.stdout))
    assert.ok(fs.readFileSync(summaryPath, 'utf8').startsWith(summary))
    assert.doesNotMatch(
      fs.readFileSync(summaryPath, 'utf8'),
      /private-source-marker/
    )
    fs.writeFileSync(receiptPath, JSON.stringify(costReceipt()))
    result = await runCli(['summary', receiptPath], {
      GITHUB_STEP_SUMMARY: directory,
    })
    assert.equal(result.code, 0)
    assert.equal(result.stdout, summary)
    result = await runCli(
      ['summary', receiptPath, '::error::private-source-marker'],
      env
    )
    assert.equal(result.code, 0)
    assert.match(result.stdout, /reasons=invalid_expectations/)
    assert.doesNotMatch(result.stdout, /private-source-marker/)
    const previous = fs.readFileSync(summaryPath, 'utf8')
    result = await runCli(['summary', receiptPath], env, { closeStdout: true })
    assert.equal(result.code, 0)
    assert.equal(fs.readFileSync(summaryPath, 'utf8'), previous + summary)
    const shortWritesPath = path.join(directory, 'short-writes.cjs')
    fs.writeFileSync(
      shortWritesPath,
      `const fs = require('node:fs')
const writeSync = fs.writeSync
fs.writeSync = (...args) => {
  if (args[0] !== 1) return writeSync(...args)
  const buffer = Buffer.from(args[1])
  const offset = args[2] ?? 0
  return writeSync(1, buffer, offset, Math.min(32, buffer.length - offset))
}
`
    )
    result = await runCli(['summary', receiptPath], {
      ...env,
      NODE_OPTIONS: `--require=${JSON.stringify(shortWritesPath)}`,
    })
    assert.equal(result.code, 0)
    assert.equal(result.stdout, summary)
    const zero = costReceipt(
      Object.fromEntries(
        Object.keys(costReceipt())
          .filter((key) => key !== 'schema_version')
          .map((key) => [key, 0])
      )
    )
    const estimate = estimateCost(JSON.stringify(zero))
    assert.equal(estimate.withCache, 0)
    assert.equal(estimate.withoutCache, 0)
    assert.equal(estimate.savingsPercent, 0)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

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
function runCli(args, env, { closeStdout = false, liveProgress = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ADAPTER, ...args], {
      env: { ...process.env, ...env },
      stdio: liveProgress ? ['pipe', 'pipe', 'pipe', 'pipe'] : 'pipe',
    })
    if (closeStdout) child.stdout.destroy()
    let stdout = ''
    let stderr = ''
    let live = ''
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
    child.stdio[3]?.on('data', (chunk) => {
      live += chunk
    })
    child.on('close', (code, signal) =>
      finish({ code, signal, stdout, stderr, live })
    )
    child.on('error', (error) =>
      finish({ code: null, signal: null, stdout, stderr, live, error })
    )
    termTimer = setTimeout(() => {
      child.kill('SIGTERM')
      killTimer = setTimeout(() => {
        child.kill('SIGKILL')
        killTimer = setTimeout(
          () => finish({ code: null, signal: 'SIGKILL', stdout, stderr, live }),
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

async function loadLoopbackTransport(t, handler) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  const url = `http://127.0.0.1:${server.address().port}${CHAT_PATH}`
  const sandboxModule = { exports: {} }
  let attempts = 0
  let fetchCalls = 0
  const context = vm.createContext({
    require(name) {
      if (name !== 'node:https') return require(name)
      return {
        request(upstreamUrl, options, callback) {
          assert.equal(upstreamUrl, MISTRAL_URL)
          attempts++
          return http.request(url, options, callback)
        },
      }
    },
    module: sandboxModule,
    exports: sandboxModule.exports,
    process,
    Buffer,
    URL,
    AbortController,
    performance,
    setTimeout,
    clearTimeout,
    fetch() {
      fetchCalls++
      return Promise.reject(new Error('OCR_TRANSPORT_PRIVATE_SENTINEL'))
    },
  })
  vm.runInContext(fs.readFileSync(ADAPTER, 'utf8'), context)
  return {
    ...sandboxModule.exports,
    attempts: () => attempts,
    fetchCalls: () => fetchCalls,
  }
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

test('cache usage preserves total input and rejects invalid cache counters', () => {
  for (const cached of [0, 64, 128, -1, 129, 1.5, '64', null, NaN]) {
    const payload = completion({ role: 'assistant', content: 'answer' })
    payload.usage = {
      prompt_tokens: 128,
      completion_tokens: 4,
      total_tokens: 132,
      prompt_tokens_details: {
        cached_tokens: cached,
        private_field: 'private',
      },
    }
    const usage = normalizeMistralResponse(payload).usage
    const valid = Number.isSafeInteger(cached) && cached >= 0 && cached <= 128
    assert.deepEqual(usage, {
      prompt_tokens: 128,
      completion_tokens: 4,
      total_tokens: 132,
      ...(valid ? { prompt_tokens_details: { cached_tokens: cached } } : {}),
    })
  }
  for (const prompt of [undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const payload = completion({ role: 'assistant', content: 'answer' })
    payload.usage.prompt_tokens = prompt
    payload.usage.prompt_tokens_details = { cached_tokens: 0 }
    assert.equal(
      normalizeMistralResponse(payload).usage.prompt_tokens_details,
      undefined
    )
  }
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
    assert.equal(adapter.diagnostics().history.misses, 2)
    assert.equal(adapter.diagnostics().history.miss_no_reasoning, 1)
    assert.equal(adapter.diagnostics().history.miss_unknown_turn, 1)
    assert.equal(adapter.diagnostics().history.miss_ambiguous_turn, 0)
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

test('cache affinity is forwarded while malformed keys never reach upstream', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'answer' }))
  )
  const adapter = await startAdapter({ apiKey: 'synthetic-key', fetchImpl })
  try {
    for (const key of ['session-main-abc123', 'k'.repeat(64)]) {
      const response = await postJson(adapter, {
        messages: [{ role: 'user', content: 'synthetic' }],
        prompt_cache_key: key,
      })
      assert.equal(response.status, 200)
      assert.equal(fetchImpl.calls.at(-1).body.prompt_cache_key, key)
    }
    for (const key of [
      '',
      'k'.repeat(65),
      '{ocr_session_key}',
      'key\n',
      'path/file',
      {},
      null,
      42,
    ]) {
      const response = await postJson(adapter, {
        messages: [{ role: 'user', content: 'synthetic' }],
        prompt_cache_key: key,
      })
      assert.equal(response.status, 400)
      assert.equal(response.json.error.code, 'invalid_request')
    }
    assert.equal(fetchImpl.calls.length, 2)
    assert.doesNotMatch(
      JSON.stringify(adapter.diagnostics()),
      /session-main-abc123|synthetic-key/
    )
  } finally {
    await adapter.close()
  }
})

test('partial usage cannot produce an apparently complete cost estimate', async () => {
  for (const completionTokens of [undefined, -1, 0.5]) {
    const fetchImpl = upstream(() => {
      const payload = completion({ role: 'assistant', content: 'synthetic' })
      payload.usage = {
        prompt_tokens: 128,
        completion_tokens: completionTokens,
        prompt_tokens_details: { cached_tokens: 64 },
      }
      return jsonResponse(200, payload)
    })
    const adapter = await startAdapter({ apiKey: 'synthetic-key', fetchImpl })
    try {
      const response = await postJson(adapter, {
        messages: [{ role: 'user', content: 'synthetic' }],
      })
      assert.equal(response.status, 200)
      assert.equal(response.json.usage.completion_tokens, completionTokens)
      assert.equal(adapter.diagnostics().missing_usage, 1)
      assert.equal(adapter.diagnostics().prompt_tokens, 128)
      assert.equal(adapter.diagnostics().completion_tokens, 0)
      assert.equal(estimateCost(JSON.stringify(adapter.diagnostics())), null)
    } finally {
      await adapter.close()
    }
  }
})

test('OCR receives billable usage while diagnostics keep raw cache usage', async () => {
  const reports = [64, 0, undefined, -1, 129, null]
  const fetchImpl = upstream((_record, index) => {
    const payload = completion({ role: 'assistant', content: 'private-answer' })
    payload.usage = {
      prompt_tokens: 128,
      completion_tokens: 4,
      total_tokens: 132,
    }
    if (reports[index - 1] !== undefined) {
      payload.usage.prompt_tokens_details = {
        cached_tokens: reports[index - 1],
        private_field: 'private-provider-data',
      }
    }
    return jsonResponse(200, payload)
  })
  const adapter = await startAdapter({ apiKey: 'private-key', fetchImpl })
  try {
    for (const cached of reports) {
      const response = await postJson(adapter, {
        messages: [{ role: 'user', content: 'private-prompt' }],
        prompt_cache_key: 'private-cache-key',
      })
      assert.equal(response.status, 200)
      const billedCache = cached === 64 ? 64 : 0
      assert.deepEqual(response.json.usage, {
        prompt_tokens: 128 - billedCache,
        completion_tokens: 4,
        total_tokens: 132 - billedCache,
      })
      assert.doesNotMatch(response.text, /private-provider-data/)
    }
    const receipt = adapter.diagnostics()
    assert.equal(receipt.cache_usage_responses, 2)
    assert.equal(receipt.missing_cache_usage, 1)
    assert.equal(receipt.invalid_cache_usage, 3)
    assert.equal(receipt.cached_prompt_tokens, 64)
    assert.equal(receipt.uncached_prompt_tokens, 192)
    assert.equal(receipt.prompt_tokens, 768)
    assert.equal(receipt.completion_tokens, 24)
    assert.doesNotMatch(JSON.stringify(receipt), /private-/)
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

test('a finished response ignoring required tool use fails without entering OCR prose retries', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(
      200,
      completion(
        {
          role: 'assistant',
          content: 'private synthetic response',
          reasoning_content: 'private synthetic reasoning',
        },
        'stop'
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
    assert.equal(receipt.length_finishes, 0)
    assert.equal(receipt.failures.required_tool_call_missing, 1)
    assert.equal(receipt.prompt_tokens, 3)
    assert.equal(receipt.completion_tokens, 4)
    assert.ok(receipt.max_request_bytes > 0)
    assert.doesNotMatch(JSON.stringify(receipt), /private synthetic/)
    assert.doesNotMatch(result.text, /private synthetic/)
  } finally {
    await adapter.close()
  }
})

test('one length-limited tool-free turn can continue natively; a repeated failure stops', async () => {
  for (const recover of [true, false]) {
    const native = {
      role: 'assistant',
      content: 'private unfinished answer',
      reasoning_content: 'private unfinished reasoning',
    }
    const fetchImpl = upstream(({ body: { messages } }) =>
      jsonResponse(
        200,
        recover && messages.some((message) => message.role === 'assistant')
          ? completion(
              {
                role: 'assistant',
                content: '',
                tool_calls: [
                  {
                    id: 'done',
                    type: 'function',
                    function: {
                      name: 'task_done',
                      arguments: '{"state":"DONE"}',
                    },
                  },
                ],
              },
              'tool_calls'
            )
          : completion(native, 'length')
      )
    )
    const adapter = await startAdapter({ apiKey: 'synthetic-key', fetchImpl })
    const request = {
      messages: [{ role: 'user', content: 'synthetic input' }],
      tools: [{ type: 'function', function: { name: 'task_done' } }],
      max_completion_tokens: 55,
    }
    try {
      const first = await postJson(adapter, request)
      assert.equal(first.status, 200)
      assert.equal(first.json.choices[0].finish_reason, 'length')
      assert.equal(first.json.usage.completion_tokens, 4)
      const echoed = { ...first.json.choices[0].message }
      delete echoed.reasoning_content
      const next = await postJson(adapter, {
        ...request,
        messages: [
          ...request.messages,
          echoed,
          { role: 'user', content: 'continue' },
        ],
      })
      assert.equal(next.status, recover ? 200 : 422)
      if (recover) {
        assert.equal(
          next.json.choices[0].message.tool_calls[0].function.name,
          'task_done'
        )
      } else {
        assert.equal(next.json.error.code, 'required_tool_call_missing')
      }
      assert.equal(fetchImpl.calls.length, 2)
      assert.deepEqual(fetchImpl.calls[1].body.messages[1], native)
      assert.ok(fetchImpl.calls.every((call) => call.body.max_tokens === 55))
      const receipt = adapter.diagnostics()
      assert.equal(receipt.completion_tokens, 8)
      assert.equal(receipt.accepted_responses, recover ? 2 : 1)
      assert.equal(receipt.history.misses, 0)
      assert.equal(receipt.failures.length_no_tool, recover ? 0 : 1)
      assert.equal(receipt.failures.required_tool_call_missing, 0)
      assert.doesNotMatch(JSON.stringify(receipt), /private unfinished/)
    } finally {
      await adapter.close()
    }
  }
})

test('truncated completion is refused without retaining replay history or hiding usage', async () => {
  const message = {
    role: 'assistant',
    content: 'private-answer',
    reasoning_content: 'private-thinking',
    tool_calls: [
      {
        id: 'done',
        type: 'function',
        function: { name: 'task_done', arguments: '{"state":"DONE"}' },
      },
    ],
  }
  const fetchImpl = upstream((_record, callNumber) =>
    jsonResponse(200, completion(message, callNumber === 1 ? 'length' : 'stop'))
  )
  const adapter = await startAdapter({ apiKey: 'private-key', fetchImpl })
  const body = {
    messages: [{ role: 'user', content: 'private-prompt' }],
    prompt_cache_key: 'private-conversation',
    tools: [{ type: 'function', function: { name: 'task_done' } }],
  }
  try {
    const rejected = await postJson(adapter, body)
    assert.equal(rejected.status, 422)
    assert.equal(rejected.json.error.code, 'truncated_completion')
    assert.doesNotMatch(rejected.text, /private-/)
    const replay = await postJson(adapter, {
      ...body,
      messages: [
        ...body.messages,
        normalizeMistralResponse(completion(message, 'length')).choices[0]
          .message,
        { role: 'tool', tool_call_id: 'done', content: 'synthetic' },
      ],
    })
    assert.equal(replay.status, 409)
    assert.equal(replay.json.error.code, 'history_missing')
    assert.equal(fetchImpl.calls.length, 1)
    const accepted = await postJson(adapter, body)
    assert.equal(accepted.status, 200)
    const receipt = adapter.diagnostics()
    assert.equal(receipt.prompt_tokens, 6)
    assert.equal(receipt.completion_tokens, 8)
    assert.equal(receipt.length_finishes, 1)
    assert.equal(receipt.truncated_completions, 1)
    assert.equal(receipt.request_types.main.truncated_completions, 1)
    assert.equal(receipt.conversations[0].truncated_completions, 1)
  } finally {
    await adapter.close()
  }
})

test('diagnostics reconcile request types and opaque conversation counters', async () => {
  const fetchImpl = upstream(({ body }) => {
    const main = body.tools?.some((tool) => tool.function?.name === 'task_done')
    const message = main
      ? {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'done',
              type: 'function',
              function: { name: 'task_done', arguments: '{"state":"DONE"}' },
            },
          ],
        }
      : { role: 'assistant', content: 'private-answer' }
    const payload = completion(message)
    payload.usage = {
      prompt_tokens: 128,
      completion_tokens: 4,
      total_tokens: 132,
      prompt_tokens_details: { cached_tokens: 64 },
    }
    return jsonResponse(200, payload)
  })
  const adapter = await startAdapter({ apiKey: 'private-key', fetchImpl })
  try {
    for (const [kind, key] of [
      ['main', 'private-a'],
      ['main', 'private-a'],
      ['main', 'private-b'],
      ['auxiliary', 'private-a'],
      ['auxiliary', undefined],
    ]) {
      assert.equal(
        (
          await postJson(adapter, {
            messages: [{ role: 'user', content: 'private-prompt' }],
            ...(key ? { prompt_cache_key: key } : {}),
            ...(kind === 'main'
              ? {
                  tools: [
                    { type: 'function', function: { name: 'task_done' } },
                  ],
                }
              : {}),
          })
        ).status,
        200
      )
    }
    const receipt = adapter.diagnostics()
    assert.equal(receipt.conversations.length, 3)
    assert.deepEqual(
      receipt.conversations.map((entry) => entry.requests).sort(),
      [1, 1, 2]
    )
    assert.equal(
      new Set(receipt.conversations.map((entry) => entry.id)).size,
      3
    )
    assert.equal(receipt.unattributed_requests, 1)
    assert.equal(receipt.request_types.main.requests, 3)
    assert.equal(receipt.request_types.auxiliary.requests, 2)
    for (const metric of [
      'requests',
      'responses',
      'prompt_tokens',
      'completion_tokens',
      'cached_prompt_tokens',
      'uncached_prompt_tokens',
      'cache_usage_responses',
      'request_bytes',
      'response_bytes',
      'request_duration_ms',
    ]) {
      assert.equal(
        receipt[metric],
        receipt.request_types.main[metric] +
          receipt.request_types.auxiliary[metric]
      )
    }
    assert.equal(receipt.prompt_tokens, 640)
    assert.equal(receipt.cached_prompt_tokens, 320)
    assert.ok(receipt.response_bytes > 0)
    assert.ok(receipt.request_duration_ms >= 0)
    assert.doesNotMatch(JSON.stringify(receipt), /private-/)
  } finally {
    await adapter.close()
  }
})

test('timing separates concurrent maxima, accepted continuations and rejected usage', async () => {
  let clock = 0
  let ready
  const entered = new Promise((resolve) => {
    ready = resolve
  })
  const releases = []
  const fetchImpl = upstream((_request, index) => {
    if (index <= 3) {
      return new Promise((resolve) => {
        releases.push(() =>
          resolve(
            jsonResponse(
              200,
              completion({ role: 'assistant', content: 'synthetic' })
            )
          )
        )
        if (releases.length === 3) ready()
      })
    }
    clock += 300002
    return jsonResponse(
      200,
      completion(
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'done',
              type: 'function',
              function: { name: 'task_done', arguments: '{"state":"DONE"}' },
            },
          ],
        },
        'length'
      )
    )
  })
  const adapter = await startAdapter({
    apiKey: 'synthetic',
    fetchImpl,
    now: () => clock,
  })
  try {
    const request = {
      messages: [{ role: 'user', content: 'synthetic' }],
      prompt_cache_key: 'synthetic-affinity',
    }
    const pending = [
      postJson(adapter, request),
      postJson(adapter, request),
      postJson(adapter, request),
    ]
    await entered
    for (let index = 0; index < 3; index += 1) {
      clock = 299999 + index
      releases[index]()
      assert.equal((await pending[index]).status, 200)
    }
    const rejected = await postJson(adapter, {
      ...request,
      tools: [{ type: 'function', function: { name: 'task_done' } }],
    })
    assert.equal(rejected.status, 422)
    const receipt = adapter.diagnostics()
    assert.equal(receipt.responses, 4)
    assert.equal(receipt.request_duration_ms, 1200002)
    assert.equal(receipt.max_request_duration_ms, 300002)
    assert.equal(receipt.accepted_responses, 3)
    assert.equal(receipt.max_accepted_response_duration_ms, 300001)
    assert.equal(receipt.accepted_responses_over_300s, 1)
    assert.equal(receipt.request_types.main.accepted_responses, 0)
    assert.equal(receipt.request_types.auxiliary.accepted_responses, 3)
    for (const row of receipt.conversations) {
      assert.equal(row.accepted_responses, row.kind === 'main' ? 0 : 3)
      assert.equal(
        row.max_request_duration_ms,
        row.kind === 'main' ? 300002 : 300001
      )
    }
    assert.doesNotMatch(JSON.stringify(receipt), /synthetic-affinity/)
  } finally {
    await adapter.close()
  }
})

test('conversation diagnostics have a fixed bound without losing aggregate usage', async () => {
  const fetchImpl = upstream(() =>
    jsonResponse(200, completion({ role: 'assistant', content: 'synthetic' }))
  )
  const adapter = await startAdapter({ apiKey: 'synthetic-key', fetchImpl })
  try {
    for (let index = 0; index < 257; index += 1) {
      assert.equal(
        (
          await postJson(adapter, {
            messages: [{ role: 'user', content: 'synthetic' }],
            prompt_cache_key: `conversation-${index}`,
          })
        ).status,
        200
      )
    }
    const receipt = adapter.diagnostics()
    assert.equal(receipt.conversations.length, 256)
    assert.equal(receipt.omitted_conversation_requests, 1)
    assert.equal(receipt.requests, 257)
    assert.equal(receipt.request_types.auxiliary.requests, 257)
    assert.equal(receipt.prompt_tokens, 257 * 3)
  } finally {
    await adapter.close()
  }
})

test('close drains accounting and attempts diagnostics once before its closure receipt', async () => {
  let started
  const upstreamStarted = new Promise((resolve) => {
    started = resolve
  })
  const snapshots = []
  const fetchImpl = async (_url, init) => {
    started()
    await new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () =>
        setTimeout(() => reject(new Error('private-upstream-error')), 25)
      )
    })
  }
  const adapter = await startAdapter({
    apiKey: 'private-key',
    fetchImpl,
    onClose: (snapshot) => snapshots.push(snapshot),
  })
  const request = postJson(adapter, {
    messages: [{ role: 'user', content: 'private-prompt' }],
  }).catch(() => undefined)
  await upstreamStarted
  const closing = adapter.close()
  assert.equal(
    (
      await postJson(adapter, {
        messages: [{ role: 'user', content: 'synthetic' }],
      })
    ).status,
    503
  )
  await Promise.all([closing, adapter.close(), request])
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].unfinished_requests, 0)
  assert.equal(snapshots[0].requests, 1)
  assert.ok(snapshots[0].request_duration_ms >= 20)
  assert.doesNotMatch(JSON.stringify(snapshots), /private-/)
})

test('lifetime expiry uses the same single diagnostics callback', async () => {
  const snapshots = []
  const adapter = await startAdapter({
    apiKey: 'synthetic-key',
    maxLifetimeMs: 20,
    onClose: (snapshot) => snapshots.push(snapshot),
  })
  await adapter.closed
  await adapter.close()
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].unfinished_requests, 0)
})

test('close bounds an uncooperative request and marks its accounting incomplete', async () => {
  let started
  let release
  const upstreamStarted = new Promise((resolve) => {
    started = resolve
  })
  const snapshots = []
  const adapter = await startAdapter({
    apiKey: 'synthetic-key',
    fetchImpl: () =>
      new Promise((resolve) => {
        release = () =>
          resolve(
            jsonResponse(
              200,
              completion({ role: 'assistant', content: 'synthetic' })
            )
          )
        started()
      }),
    onClose: (snapshot) => snapshots.push(snapshot),
  })
  const request = postJson(adapter, {
    messages: [{ role: 'user', content: 'synthetic' }],
  }).catch(() => undefined)
  await upstreamStarted
  try {
    await adapter.close()
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0].unfinished_requests, 1)
    assert.equal(snapshots[0].upstream_attempts, 1)
    assert.equal(snapshots[0].responses, 0)
  } finally {
    release()
    await request
  }
})

for (const provider of ['mistral', 'mistral-flash'])
  test(`${provider}: compression restores only exact reasoned turns, retaining native thinking and bounds`, () => {
    const history = createHistoryStore({ maxEntries: 3, provider })
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
    assert.deepEqual(
      history.restoreMessages([...prefix, turn]).at(-1),
      expected
    )
    assert.throws(
      () => history.restoreMessages([...compressed, turn]),
      /ambiguous/
    )
    assert.throws(
      () =>
        history.remember([{ role: 'user', content: 'fourth group' }], native),
      /bound/
    )
    const misses = history.diagnostics()
    assert.equal(misses.miss_no_reasoning, 1)
    assert.equal(misses.miss_unknown_turn, 4)
    assert.equal(misses.miss_ambiguous_turn, 1)
    assert.equal(misses.misses, 6)
  })

for (const provider of ['mistral', 'mistral-flash'])
  test(`${provider}: compressed tool replay without echoed reasoning requires the same conversation and unique native state`, () => {
    const history = createHistoryStore({ maxEntries: 3, provider })
    const prefix = [{ role: 'user', content: 'original' }]
    const native = {
      role: 'assistant',
      content: '  <think></think>visible  ',
      reasoning_content: 'retained private state',
      tool_calls: [
        {
          id: 'shared-call',
          type: 'function',
          function: { name: 'file_read', arguments: '{"file_path":"a.ts"}' },
        },
      ],
    }
    const scope = 'synthetic-main-task'
    history.remember(prefix, native, scope)
    const echo = { ...native, content: 'visible' }
    delete echo.reasoning_content
    const compressed = [{ role: 'user', content: 'summary' }]
    assert.deepEqual(
      history.restoreMessages([...compressed, echo], scope).at(-1),
      native
    )
    assert.equal(history.diagnostics().compressed_hits, 1)
    for (const [turn, key] of [
      [echo, undefined],
      [echo, 'different-task'],
      [{ ...echo, content: 'changed' }, scope],
      [{ ...echo, reasoning_content: 'invented' }, scope],
      [
        { ...echo, tool_calls: [{ ...echo.tool_calls[0], id: 'different' }] },
        scope,
      ],
    ])
      assert.throws(() => history.restoreMessages([...compressed, turn], key), {
        code: 'history_missing',
      })
    history.remember(
      [{ role: 'user', content: 'another prefix' }],
      { ...native, reasoning_content: 'different private state' },
      scope
    )
    assert.throws(() => history.restoreMessages([...compressed, echo], scope), {
      code: 'history_collision',
    })
    assert.equal(history.entryCount(), 2)
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

for (const [provider, model] of [
  ['mistral', MISTRAL_MODEL],
  ['mistral-flash', MISTRAL_FLASH_MODEL],
])
  test(`${provider}: native memory keeps concurrent groups with reused tool-call ids apart`, async () => {
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
        return jsonResponse(200, {
          ...completion(make(messages[0].content), 'tool_calls'),
          model,
        })
      }
      return jsonResponse(200, {
        ...completion({ role: 'assistant', content: 'done' }),
        model,
      })
    })
    const adapter = await startAdapter({
      provider,
      apiKey: 'sk',
      fetchImpl,
    })
    try {
      const alpha = await postJson(adapter, {
        model,
        messages: [{ role: 'user', content: 'alpha' }],
      })
      const beta = await postJson(adapter, {
        model,
        messages: [{ role: 'user', content: 'beta' }],
      })
      assert.equal(
        alpha.json.choices[0].message.reasoning_content,
        'alpha-think'
      )
      assert.equal(beta.json.choices[0].message.reasoning_content, 'beta-think')

      const replayAlpha = await postJson(adapter, {
        model,
        messages: [
          { role: 'user', content: 'alpha' },
          alpha.json.choices[0].message,
          { role: 'tool', tool_call_id: 'call_shared', content: 'r' },
        ],
      })
      const replayBeta = await postJson(adapter, {
        model,
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

test('rejection diagnostics keep only HTTP status and allowlisted numeric codes', async () => {
  const secret = 'PRIVATE_PROVIDER_SENTINEL'
  const cases = [
    ...[400, 401, 402, 403, 408, 429, 502, 503].map((code) => [
      JSON.stringify({ error: { code, message: secret, metadata: secret } }),
      code,
    ]),
    ...['401', 418, null, { code: 401 }, secret].map((code) => [
      JSON.stringify({ error: { code, message: secret } }),
      'unknown',
    ]),
    [
      JSON.stringify({ code: 401, metadata: { error: { code: 401 } } }),
      'unknown',
    ],
    [`{"error":${secret}`, 'unknown'],
    ['', 'unknown'],
    [
      JSON.stringify({ error: { code: 401 }, padding: secret.repeat(2000) }),
      'unknown',
    ],
  ]
  for (const [body, expected] of cases) {
    const fetchImpl = upstream(() => new Response(body, { status: 401 }))
    const adapter = await startAdapter({ apiKey: secret, fetchImpl })
    try {
      const result = await postJson(adapter, {
        messages: [{ role: 'user', content: 'synthetic' }],
      })
      assert.equal(result.status, 502)
      assert.equal(result.json.error.code, 'upstream_error')
      const receipt = adapter.diagnostics()
      assert.deepEqual(receipt.last_upstream_error, {
        http_status: 401,
        code: expected,
        reason: 'unknown',
      })
      assert.equal(receipt.upstream_attempts, 1)
      assert.equal(receipt.responses, 0)
      assert.equal(receipt.failures.upstream_rejected, 1)
      assert.equal(estimateCost(JSON.stringify(receipt)), null)
      assert.doesNotMatch(
        JSON.stringify(receipt) + result.text,
        /PRIVATE_PROVIDER_SENTINEL/
      )
    } finally {
      await adapter.close()
    }
  }
  for (const response of [
    { status: 401, ok: false, body: null },
    {
      status: 401,
      ok: false,
      body: {
        getReader: () => ({
          read: async () => {
            throw Error(secret)
          },
        }),
      },
    },
    new Response('x'.repeat(65), { status: 401 }),
  ]) {
    const adapter = await startAdapter({
      apiKey: secret,
      maxResponseBytes: 64,
      fetchImpl: async () => response,
    })
    try {
      assert.equal(
        (
          await postJson(adapter, {
            messages: [{ role: 'user', content: 'synthetic' }],
          })
        ).status,
        502
      )
      assert.deepEqual(adapter.diagnostics().last_upstream_error, {
        http_status: 401,
        code: 'unknown',
        reason: 'unknown',
      })
      assert.equal(adapter.diagnostics().failures.upstream_rejected, 1)
    } finally {
      await adapter.close()
    }
  }
})

test('OpenRouter budget reasons are content-free, bounded and provider-scoped', async () => {
  const secret = 'PRIVATE_PROVIDER_SENTINEL'
  const legacy = `Key limit exceeded (daily limit). ${secret}`
  const metadata = (limit_source) => ({ limit_source, details: secret })
  const cases = [
    ...[
      ['openrouter_key_limit', 'key_budget_exhausted'],
      ['openrouter_guardrail_budget', 'guardrail_budget_exhausted'],
      ['openrouter_in_flight_budget', 'in_flight_budget_exhausted'],
      ['openrouter_credits', 'credits_insufficient'],
    ].flatMap(([source, reason]) =>
      [402, 403].map((status) => [
        status,
        { metadata: metadata(source) },
        reason,
      ])
    ),
    [403, { message: legacy }, 'key_budget_exhausted'],
    [
      403,
      { message: 'Key limit exceeded', metadata: {} },
      'key_budget_exhausted',
    ],
    [402, { message: legacy }, 'unknown'],
    [401, { metadata: metadata('openrouter_key_limit') }, 'unknown'],
    [
      403,
      { message: legacy, metadata: metadata('openrouter_credits') },
      'credits_insufficient',
    ],
    ...[
      null,
      [],
      metadata(null),
      metadata({}),
      metadata(secret),
      metadata('__proto__'),
    ].map((value) => [403, { message: legacy, metadata: value }, 'unknown']),
    ...[
      secret,
      `Not ${legacy}`,
      `${secret} ${legacy}`,
      'Key limit exceededly',
    ].map((message) => [403, { message }, 'unknown']),
    [403, {}, 'unknown'],
    [
      403,
      {
        metadata: metadata('openrouter_key_limit'),
        padding: secret.repeat(2000),
      },
      'unknown',
      'unknown',
    ],
  ]
  for (const provider of ['openrouter', 'mistral']) {
    for (const [status, error, reason, expectedCode = status] of cases) {
      const adapter = await startAdapter({
        provider,
        apiKey: secret,
        fetchImpl: upstream(() =>
          jsonResponse(status, { error: { code: status, ...error } })
        ),
      })
      try {
        const response = await postJson(adapter, {
          messages: [{ role: 'user', content: 'synthetic' }],
        })
        assert.equal(response.status, 502)
        assert.equal(response.json.error.code, 'upstream_error')
        const receipt = adapter.diagnostics()
        assert.deepEqual(receipt.last_upstream_error, {
          http_status: status,
          code: expectedCode,
          reason: provider === 'openrouter' ? reason : 'unknown',
        })
        assert.equal(receipt.upstream_attempts, 1)
        assert.equal(receipt.responses, 0)
        assert.equal(receipt.failures.upstream_rejected, 1)
        assert.equal(estimateCost(JSON.stringify(receipt)), null)
        assert.doesNotMatch(
          JSON.stringify(receipt) + response.text,
          /PRIVATE_PROVIDER_SENTINEL/
        )
      } finally {
        await adapter.close()
      }
    }
  }
})

test('late rejection bodies cannot overwrite a newer observed error or an earlier snapshot', async () => {
  const draining = Promise.withResolvers()
  const release = Promise.withResolvers()
  let read = false
  const fetchImpl = upstream((_request, index) =>
    index === 1
      ? {
          status: 403,
          ok: false,
          body: {
            getReader: () => ({
              read: async () => {
                if (read) return { done: true }
                read = true
                draining.resolve()
                return {
                  done: false,
                  value: Buffer.from(await release.promise),
                }
              },
            }),
          },
        }
      : jsonResponse(402, {
          error: {
            code: 402,
            metadata: { limit_source: 'openrouter_credits' },
          },
        })
  )
  const adapter = await startAdapter({
    provider: 'openrouter',
    apiKey: 'synthetic',
    fetchImpl,
  })
  const body = { messages: [{ role: 'user', content: 'synthetic' }] }
  const first = postJson(adapter, body)
  try {
    await draining.promise
    const snapshot = adapter.diagnostics()
    assert.equal((await postJson(adapter, body)).status, 502)
    release.resolve('{"error":{"code":403,"message":"Key limit exceeded"}}')
    assert.equal((await first).status, 502)
    assert.deepEqual(adapter.diagnostics().last_upstream_error, {
      http_status: 402,
      code: 402,
      reason: 'credits_insufficient',
    })
    assert.deepEqual(snapshot.last_upstream_error, {
      http_status: 403,
      code: 'unknown',
      reason: 'unknown',
    })
    assert.equal(adapter.diagnostics().upstream_attempts, 2)
    assert.equal(adapter.diagnostics().failures.upstream_rejected, 2)
  } finally {
    release.resolve('{}')
    await first
    await adapter.close()
  }
})

test('adapter classifies failures once without changing responses or accounting', async () => {
  const cases = [
    [
      'upstream_throttled',
      () => new Response('private-error', { status: 429 }),
      502,
      'upstream_error',
    ],
    [
      'upstream_rejected',
      () => new Response('private-error', { status: 403 }),
      502,
      'upstream_error',
    ],
    [
      'upstream_server_error',
      () => new Response('private-error', { status: 503 }),
      502,
      'upstream_error',
    ],
    [
      'transport_error',
      () => {
        throw new Error('private-error')
      },
      502,
      'internal_error',
    ],
    [
      'malformed_response',
      () => new Response('private-error', { status: 200 }),
      502,
      'malformed_response',
    ],
    [
      'upstream_timeout',
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () =>
            setTimeout(() => reject(new Error('private-error')), 5)
          )
        ),
      504,
      'upstream_timeout',
    ],
  ]
  for (const [category, fetchImpl, status, code] of cases) {
    const adapter = await startAdapter({
      apiKey: 'synthetic',
      fetchImpl,
      timeoutMs: category === 'upstream_timeout' ? 10 : 1000,
    })
    try {
      const response = await postJson(adapter, {
        messages: [{ role: 'user', content: 'private-prompt' }],
      })
      assert.equal(response.status, status, category)
      assert.equal(response.json.error.code, code, category)
      await adapter.close()
      const receipt = adapter.diagnostics()
      assert.equal(receipt.failures[category], 1, category)
      assert.equal(
        Object.values(receipt.failures).reduce((sum, n) => sum + n, 0),
        1,
        category
      )
      assert.equal(receipt.requests, 1)
      assert.equal(receipt.upstream_attempts, 1)
      assert.equal(receipt.responses, 0)
      assert.equal(receipt.accepted_responses, 0)
      assert.equal(receipt.request_types.auxiliary.failures[category], 1)
      assert.equal(estimateCost(JSON.stringify(receipt)), null)
      assert.doesNotMatch(JSON.stringify(receipt), /private-/)
    } finally {
      await adapter.close()
    }
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

test('default upstream transport completes delayed headers and streamed bodies at both callers', {
  timeout: 6000,
}, async (t) => {
  const requests = []
  const payload = Buffer.from(
    JSON.stringify(completion({ role: 'assistant', content: 'synthetic' }))
  )
  const transport = await loadLoopbackTransport(t, async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ method: req.method, body: JSON.parse(body) })
    await delay(20)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.write(payload.subarray(0, payload.length / 2))
    await delay(20)
    res.end(payload.subarray(payload.length / 2))
  })
  const options = { apiKey: 'synthetic-key', timeoutMs: 1000 }
  const body = {
    model: MISTRAL_MODEL,
    messages: [{ role: 'user', content: 'synthetic' }],
    max_completion_tokens: 9,
    reasoning: { effort: 'high' },
  }
  const adapter = await transport.startAdapter(options)
  t.after(() => adapter.close())
  const adapted = await postJson(adapter, body)
  assert.equal(adapted.status, 200)
  const direct = await transport.callMistral({ ...options, body })
  for (const response of [adapted.json, direct]) {
    assert.equal(response.model, MISTRAL_MODEL)
    assert.equal(response.choices[0].finish_reason, 'stop')
    assert.equal(response.usage.total_tokens, 7)
  }
  assert.equal(transport.attempts(), 2)
  assert.equal(transport.fetchCalls(), 0)
  assert.equal(requests.length, 2)
  for (const request of requests) {
    assert.equal(request.method, 'POST')
    assert.equal(request.body.max_tokens, 9)
    assert.equal(request.body.reasoning_effort, 'max')
    assert.notEqual(request.body.stream, true)
  }
  const receipt = adapter.diagnostics()
  assert.equal(receipt.upstream_attempts, 1)
  assert.equal(receipt.responses, 1)
  assert.equal(receipt.prompt_tokens, 3)
  assert.equal(receipt.completion_tokens, 4)
})

test('default upstream transport bounds stalled headers, bodies, size and redirects at both callers', {
  timeout: 6000,
}, async (t) => {
  for (const mode of ['headers', 'body', 'size', 'redirect']) {
    await t.test(mode, async (t) => {
      const closed = []
      const transport = await loadLoopbackTransport(t, (req, res) => {
        req.resume()
        closed.push(new Promise((resolve) => res.once('close', resolve)))
        if (mode === 'headers') return
        if (mode === 'redirect') {
          res.writeHead(307, { location: '/OCR_TRANSPORT_PRIVATE_SENTINEL' })
          res.flushHeaders()
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.write(
          mode === 'size'
            ? 'OCR_TRANSPORT_PRIVATE_SENTINEL'.repeat(16)
            : '{"partial":'
        )
      })
      const deadline = mode === 'headers' || mode === 'body'
      let expectedErrorCode = 'internal_error'
      let expectedFailureCategory = 'transport_error'
      if (deadline) {
        expectedErrorCode = 'upstream_timeout'
        expectedFailureCategory = 'upstream_timeout'
      } else if (mode === 'size') {
        expectedErrorCode = 'response_too_large'
        expectedFailureCategory = 'malformed_response'
      }
      const options = {
        apiKey: 'synthetic-key',
        timeoutMs: deadline ? 100 : 1000,
        maxResponseBytes: 128,
      }
      const body = { messages: [{ role: 'user', content: 'synthetic' }] }
      const adapter = await transport.startAdapter(options)
      t.after(() => adapter.close())
      const result = await postJson(adapter, body)
      assert.equal(result.status, deadline ? 504 : 502)
      assert.equal(result.json.error.code, expectedErrorCode)
      assert.doesNotMatch(result.text, /OCR_TRANSPORT_PRIVATE_SENTINEL/)
      await assert.rejects(
        transport.callMistral({ ...options, body }),
        (error) => {
          assert.equal(
            error.code,
            mode === 'size' ? 'response_too_large' : 'upstream_error'
          )
          assert.doesNotMatch(error.message, /OCR_TRANSPORT_PRIVATE_SENTINEL/)
          return true
        }
      )
      await Promise.all(closed)
      assert.equal(closed.length, 2)
      assert.equal(transport.attempts(), 2)
      assert.equal(transport.fetchCalls(), 0)
      const receipt = adapter.diagnostics()
      assert.equal(receipt.upstream_attempts, 1)
      assert.equal(receipt.responses, 0)
      assert.equal(receipt.failures[expectedFailureCategory], 1)
    })
  }
})

test('default upstream transport cancels an open response when the adapter client disconnects', {
  timeout: 6000,
}, async (t) => {
  const arrived = Promise.withResolvers()
  const disconnected = Promise.withResolvers()
  const transport = await loadLoopbackTransport(t, (req, res) => {
    req.resume()
    res.once('close', disconnected.resolve)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.write('{"partial":')
    arrived.resolve()
  })
  const adapter = await transport.startAdapter({
    apiKey: 'synthetic-key',
    timeoutMs: 1000,
  })
  t.after(() => adapter.close())
  const controller = new AbortController()
  const request = fetch(`${adapter.url}${CHAT_PATH}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adapter.token}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'synthetic' }],
    }),
    signal: controller.signal,
  })
  await Promise.race([
    arrived.promise,
    request.then(() => assert.fail('adapter settled before upstream arrival')),
  ])
  controller.abort()
  await assert.rejects(request, (error) => error.name === 'AbortError')
  await disconnected.promise
  await adapter.close()
  assert.equal(transport.attempts(), 1)
  assert.equal(transport.fetchCalls(), 0)
  const receipt = adapter.diagnostics()
  assert.equal(receipt.upstream_attempts, 1)
  assert.equal(receipt.responses, 0)
  assert.equal(receipt.failures.cancelled, 1)
  assert.equal(receipt.accepted_responses, 0)
  assert.equal(receipt.failures.upstream_timeout, 0)
})

test('rejection status survives stalled bodies and client cancellation under the existing deadline', {
  timeout: 6000,
}, async (t) => {
  for (const cancel of [false, true]) {
    await t.test(cancel ? 'cancelled' : 'deadline', async (t) => {
      const arrived = Promise.withResolvers()
      const disconnected = Promise.withResolvers()
      const transport = await loadLoopbackTransport(t, (req, res) => {
        req.resume()
        res.once('close', disconnected.resolve)
        res.writeHead(429, { 'content-type': 'application/json' })
        res.write('{"partial":')
        arrived.resolve()
      })
      const adapter = await transport.startAdapter({
        apiKey: 'synthetic',
        timeoutMs: cancel ? 1000 : 100,
      })
      t.after(() => adapter.close())
      const controller = new AbortController()
      const request = fetch(`${adapter.url}${CHAT_PATH}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${adapter.token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'synthetic' }],
        }),
        signal: controller.signal,
      })
      await arrived.promise
      if (cancel) {
        for (
          let attempt = 0;
          attempt < 100 && !adapter.diagnostics().last_upstream_error;
          attempt++
        )
          await delay(1)
        assert.equal(
          adapter.diagnostics().last_upstream_error?.http_status,
          429
        )
        controller.abort()
        await assert.rejects(request, (error) => error.name === 'AbortError')
      } else {
        const response = await request
        assert.equal(response.status, 504)
        assert.equal((await response.json()).error.code, 'upstream_timeout')
      }
      await disconnected.promise
      await adapter.close()
      const receipt = adapter.diagnostics()
      assert.equal(receipt.last_upstream_error.http_status, 429)
      assert.equal(receipt.last_upstream_error.code, 'unknown')
      assert.equal(receipt.last_upstream_error.reason, 'unknown')
      assert.equal(receipt.upstream_attempts, 1)
      assert.equal(receipt.responses, 0)
      assert.equal(receipt.failures.upstream_throttled, 1)
      assert.equal(
        Object.values(receipt.failures).reduce((a, b) => a + b),
        1
      )
      assert.equal(estimateCost(JSON.stringify(receipt)), null)
    })
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
  ' routerKey: process.env.OPENROUTER_API_KEY ?? null,' +
  ' url: process.env.OCR_LLM_URL ?? null,' +
  ' token: process.env.OCR_LLM_TOKEN != null,' +
  ' model: process.env.OCR_LLM_MODEL ?? null,' +
  ' protocol: process.env.OCR_LLM_PROTOCOL ?? null,' +
  ' anthropic: process.env.OCR_USE_ANTHROPIC ?? null,' +
  ' home: process.env.HOME ?? null }))'

test('run completes the existing OCR config per attempt and restores it on every child outcome', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-run-config-'))
  const configPath = path.join(directory, 'config.json')
  const original = `${JSON.stringify(
    {
      language: 'English',
      llm: {
        model: MISTRAL_MODEL,
        protocol: 'openai',
        extra_body: {
          reasoning_effort: 'max',
          prompt_cache_key: '{ocr_session_key}',
        },
        auth_token_cmd: 'printf "%s" "$OCR_LLM_TOKEN"',
      },
    },
    null,
    2
  )}\n`
  fs.writeFileSync(configPath, original, { mode: 0o600 })
  const urls = new Set()
  try {
    for (const code of [0, 7]) {
      const result = await runCli(
        [
          'run',
          '--ocr-config',
          configPath,
          '--',
          process.execPath,
          '-e',
          `
          const fs = require('node:fs')
          const config = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))
          process.stdout.write(JSON.stringify({config, url: process.env.OCR_LLM_URL,
            upstreamKey: process.env.MISTRAL_API_KEY ?? null,
            mode: fs.statSync(process.argv[1]).mode & 0o777}))
          process.exitCode = ${code}
        `,
          configPath,
        ],
        { MISTRAL_API_KEY: 'synthetic-config-key' }
      )
      assert.equal(result.code, code, result.stderr)
      const seen = JSON.parse(result.stdout)
      assert.equal(seen.config.llm.url, seen.url)
      urls.add(seen.url)
      delete seen.config.llm.url
      assert.deepEqual(seen.config, JSON.parse(original))
      assert.equal(seen.upstreamKey, null)
      assert.equal(seen.mode, 0o600)
      assert.equal(fs.readFileSync(configPath, 'utf8'), original)
      assert.equal(fs.statSync(configPath).mode & 0o777, 0o600)
    }
    assert.equal(urls.size, 2)
    const missing = await runCli(
      [
        'run',
        '--ocr-config',
        configPath,
        '--',
        'ocr-synthetic-executable-absent',
      ],
      { MISTRAL_API_KEY: 'synthetic-config-key' }
    )
    assert.equal(missing.code, 1)
    assert.equal(fs.readFileSync(configPath, 'utf8'), original)
    fs.chmodSync(configPath, 0o644)
    const unsafe = await runCli(
      [
        'run',
        '--ocr-config',
        configPath,
        '--',
        process.execPath,
        '-e',
        'process.exit(99)',
      ],
      { MISTRAL_API_KEY: 'synthetic-config-key' }
    )
    assert.equal(unsafe.code, 1)
    assert.equal(fs.readFileSync(configPath, 'utf8'), original)
    fs.chmodSync(configPath, 0o600)
    const restoration = await runCli(
      [
        'run',
        '--ocr-config',
        configPath,
        '--',
        process.execPath,
        '-e',
        `
        const fs = require('node:fs')
        fs.unlinkSync(process.argv[1])
        fs.mkdirSync(process.argv[1])
        process.stdout.write(process.env.OCR_LLM_URL)
      `,
        configPath,
      ],
      { MISTRAL_API_KEY: 'synthetic-config-key' }
    )
    assert.equal(restoration.code, 1)
    assert.equal(
      restoration.stderr,
      'ocr-mistral-adapter: ocr_config_restore_failed\n'
    )
    await assert.rejects(
      fetch(restoration.stdout, { method: 'POST', body: '{}' })
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run strips both upstream keys and injects only the selected loopback model', async () => {
  for (const [provider, model] of [
    [undefined, MISTRAL_MODEL],
    ['mistral-flash', MISTRAL_FLASH_MODEL],
    ['openrouter', 'deepseek/deepseek-v4.1-flash-1017'],
  ]) {
    const result = await runCli(
      ['run', '--', process.execPath, '-e', RUN_SCRIPT],
      {
        MISTRAL_API_KEY: 'sk-synthetic-run',
        OPENROUTER_API_KEY: 'sk-synthetic-router',
        OCR_ADAPTER_PROVIDER: provider,
      }
    )
    assert.equal(result.code, 0)
    const seen = JSON.parse(result.stdout)
    assert.equal(seen.key, null)
    assert.equal(seen.routerKey, null)
    assert.match(seen.url, /^http:\/\/127\.0\.0\.1:\d+\/v1\/chat\/completions$/)
    assert.equal(seen.token, true)
    assert.equal(seen.model, model)
    assert.equal(seen.protocol, 'openai')
    assert.equal(seen.anthropic, 'false')
    assert.equal(seen.home, process.env.HOME)
  }
})

test('run streams filtered progress before completion while preserving raw stderr, JSON and exit status', async (t) => {
  const rawLine = '[ocr]   ▶ file_read "OCR_PRIVATE_SENTINEL"\n'
  const finalLine = '[ocr]   ✔ file_read (1ms)'
  const fatalLine =
    'Error: review failed (timeout): OCR_PRIVATE_SENTINEL https://provider.invalid/v1\n'
  const script = `
    const fs = require('node:fs')
    const first = Buffer.from(${JSON.stringify(rawLine)})
    const split = first.indexOf(Buffer.from('▶')) + 1
    process.stderr.write(first.subarray(0, split))
    setImmediate(() => process.stderr.write(first.subarray(split)))
    process.stdin.once('data', () => {
      let inherited = false
      try { fs.writeSync(3, 'OCR_CHILD_FD_SENTINEL'); inherited = true } catch {}
      fs.writeSync(2, Buffer.from([255, 254, 10]))
      fs.writeSync(2, ${JSON.stringify(fatalLine)})
      fs.writeSync(2, ${JSON.stringify(finalLine)})
      fs.writeSync(1, JSON.stringify({
        ok: true, inherited,
        key: process.env.MISTRAL_API_KEY ?? null,
        progress: process.env.OCR_ADAPTER_PROGRESS_FD ?? null
      }))
      process.stdin.destroy()
      process.exitCode = 7
    })
  `
  const child = spawn(
    process.execPath,
    [ADAPTER, 'run', '--', process.execPath, '-e', script],
    {
      env: {
        ...process.env,
        MISTRAL_API_KEY: 'synthetic-upstream-key',
        OCR_ADAPTER_PROGRESS_FD: '3',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    }
  )
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL')
  })
  let stdout = ''
  const stderr = []
  let live = ''
  let observed
  const progressStarted = new Promise((resolve) => {
    observed = resolve
  })
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => stderr.push(chunk))
  child.stdio[3].on('data', (chunk) => {
    live += chunk
    if (live.includes('event=tool_started')) observed()
  })
  const closed = new Promise((resolve) =>
    child.once('close', (code, signal) => resolve({ code, signal }))
  )
  let timeout
  try {
    await Promise.race([
      progressStarted,
      closed.then(() => {
        throw new Error('child exited before live progress')
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('live progress not received')),
          6000
        )
      }),
    ])
    assert.equal(child.exitCode, null)
    assert.equal(stdout, '')
    child.stdin.end('finish\n')
    const result = await closed
    assert.equal(result.code, 7)
    assert.deepEqual(JSON.parse(stdout), {
      ok: true,
      inherited: false,
      key: null,
      progress: null,
    })
    assert.deepEqual(
      Buffer.concat(stderr),
      Buffer.concat([
        Buffer.from(rawLine),
        Buffer.from([255, 254, 10]),
        Buffer.from(fatalLine),
        Buffer.from(finalLine),
      ])
    )
    assert.match(
      live,
      /^OCR progress event=tool_started tool=file_read\nOCR progress event=cli_error code=review_failed classification=timeout\nOCR progress event=tool_completed tool=file_read\nOCR progress event=process_exited exit_code=7 signaled=false spawn_failed=false elapsed_ms=\d+\n$/
    )
    assert.doesNotMatch(live, /SENTINEL|::/)
  } finally {
    clearTimeout(timeout)
  }
})

test('live progress reports a quiet successful process and spawn failure without reflecting arguments', async () => {
  for (const [argv, code, failed] of [
    [
      [process.execPath, '-e', 'process.stdout.write(\'{"ok":true}\')'],
      0,
      false,
    ],
    [
      ['/OCR_PRIVATE_SENTINEL/absent', '::error::OCR_PRIVATE_SENTINEL'],
      1,
      true,
    ],
  ]) {
    const result = await runCli(
      ['run', '--', ...argv],
      {
        MISTRAL_API_KEY: 'synthetic-key',
        OCR_ADAPTER_PROGRESS_FD: '3',
      },
      { liveProgress: true }
    )
    assert.equal(result.code, code)
    assert.equal(result.stdout, failed ? '' : '{"ok":true}')
    assert.equal(
      result.stderr,
      failed ? 'ocr-mistral-adapter: child_spawn_failed\n' : ''
    )
    assert.match(
      result.live,
      new RegExp(
        `^OCR progress event=process_exited exit_code=${code} signaled=false spawn_failed=${failed} elapsed_ms=\\d+\\n$`
      )
    )
    assert.doesNotMatch(result.live, /SENTINEL|::/)
  }
})

test('a missing live-log descriptor never falls back into result or private stderr', async () => {
  const raw = '[ocr]   ✔ file_read (1ms)\n'
  const result = await runCli(
    [
      'run',
      '--',
      process.execPath,
      '-e',
      `process.stderr.write(${JSON.stringify(raw)}); process.stdout.write('{"ok":true}')`,
    ],
    { MISTRAL_API_KEY: 'synthetic-upstream-key', OCR_ADAPTER_PROGRESS_FD: '3' }
  )
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), { ok: true })
  assert.equal(result.stderr, raw)
})

test('live progress cleanup is bounded when a descendant keeps stderr open', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-drain-'))
  const diagnosticsPath = path.join(directory, 'diagnostics.jsonl')
  const script = `
    const { spawn } = require('node:child_process')
    const fs = require('node:fs')
    fs.writeSync(2, '[ocr] compression_telemetry version=1\\n')
    const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true, stdio: ['ignore', 'ignore', 'inherit']
    })
    descendant.unref()
    fs.writeSync(1, JSON.stringify({ pid: descendant.pid, url: process.env.OCR_LLM_URL }))
    process.exitCode = 7
  `
  const child = spawn(
    process.execPath,
    [ADAPTER, 'run', '--', process.execPath, '-e', script],
    {
      env: {
        ...process.env,
        MISTRAL_API_KEY: 'synthetic-upstream-key',
        OCR_ADAPTER_PROGRESS_FD: '3',
        OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
      },
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    }
  )
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.resume()
  child.stdio[3].resume()
  const exited = new Promise((resolve) =>
    child.once('exit', (code) => resolve(code))
  )
  t.after(() => {
    if (stdout) {
      try {
        process.kill(JSON.parse(stdout).pid, 'SIGKILL')
      } catch {}
    }
    if (child.exitCode === null) child.kill('SIGKILL')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  await waitFor(() => {
    try {
      return JSON.parse(stdout)
    } catch {
      return false
    }
  })
  let timer
  try {
    const code = await Promise.race([
      exited,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve('cleanup_timeout'), 6000)
      }),
    ])
    assert.equal(code, 7)
    const receipt = JSON.parse(stdout)
    assert.doesNotThrow(() => process.kill(receipt.pid, 0))
    await assert.rejects(fetch(receipt.url, { method: 'POST', body: '{}' }))
    const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'))
    assert.equal(diagnostics.compression.complete, false)
    assert.equal(diagnostics.compression.started, 0)
  } finally {
    clearTimeout(timer)
  }
})

test('run retains compression telemetry arriving after direct-child exit before persisting one receipt', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-late-stderr-'))
  const diagnosticsPath = path.join(directory, 'diagnostics.jsonl')
  const script = `
    const { spawn } = require('node:child_process')
    process.stderr.write('[ocr] compression_telemetry version=1\\n[ocr] compression_started before_estimated_tokens=200\\n')
    const descendant = spawn(process.execPath, ['-e',
      "setTimeout(() => process.stderr.write('[ocr] compression_finished outcome=rebuilt before_estimated_tokens=200 after_estimated_tokens=50\\\\n'), 100)"
    ], { detached: true, stdio: ['ignore', 'ignore', 'inherit'] })
    descendant.unref()
    process.exitCode = 7
  `
  try {
    const result = await runCli(
      ['run', '--', process.execPath, '-e', script],
      {
        MISTRAL_API_KEY: 'synthetic-upstream-key',
        OCR_ADAPTER_PROGRESS_FD: '3',
        OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
      },
      { liveProgress: true }
    )
    assert.equal(result.code, 7)
    const rows = fs.readFileSync(diagnosticsPath, 'utf8').trim().split('\n')
    assert.equal(rows.length, 1)
    const receipt = JSON.parse(rows[0])
    assert.equal(receipt.compression.complete, true)
    assert.equal(receipt.compression.started, 1)
    assert.equal(receipt.compression.rebuilt, 1)
    assert.equal(receipt.compression.rebuilt_after_estimated_tokens, 50)
    assert.equal(receipt.requests, 0)
    assert.match(result.live, /event=compression_finished outcome=rebuilt/)
    assert.match(result.live, /event=process_exited exit_code=7/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
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
  const diagnosticsPath = path.join(tmp, 'diagnostics.jsonl')
  fs.writeFileSync(outputPath, '')
  const env = {
    MISTRAL_API_KEY: 'sk-synthetic-start',
    RUNNER_TEMP: tmp,
    GITHUB_OUTPUT: outputPath,
    OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
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
  const diagnosticsText = fs.readFileSync(diagnosticsPath, 'utf8')
  assert.equal(diagnosticsText.trim().split('\n').length, 1)
  assert.equal(JSON.parse(diagnosticsText).unfinished_requests, 0)
  assert.equal(JSON.parse(diagnosticsText).failures.local_rejection, 1)
  assert.equal(fs.statSync(diagnosticsPath).mode & 0o777, 0o600)
  assert.doesNotMatch(diagnosticsText, /sk-synthetic-start/)
  assert.equal((await runCli(['stop', statePath], env)).code, 0)
  assert.equal(fs.readFileSync(diagnosticsPath, 'utf8'), diagnosticsText)

  let refused = false
  try {
    await fetch(`${state.url}${CHAT_PATH}`, { method: 'POST', body: '{}' })
  } catch {
    refused = true
  }
  assert.equal(refused, true)
})

test('detached server persists once on SIGTERM and safely handles an unwritable report', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-serve-signal-'))
  try {
    for (const writable of [true, false]) {
      const statePath = path.join(directory, `state-${writable}.json`)
      const diagnosticsPath = writable
        ? path.join(directory, 'diagnostics.jsonl')
        : path.join(directory, 'absent', 'diagnostics.jsonl')
      const child = spawn(process.execPath, [ADAPTER, 'serve', statePath], {
        env: {
          ...process.env,
          MISTRAL_API_KEY: 'sk-private-serve',
          RUNNER_TEMP: directory,
          OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
        },
      })
      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
      const exited = new Promise((resolve) => {
        child.on('exit', (code) => resolve(code))
        child.on('error', () => resolve(null))
      })
      try {
        assert.ok(
          await waitFor(() => fs.existsSync(statePath)),
          'serve must become ready'
        )
        child.kill('SIGTERM')
        assert.equal(await exited, 0, stderr)
        assert.equal(fs.existsSync(statePath), false)
        if (writable) {
          const lines = fs
            .readFileSync(diagnosticsPath, 'utf8')
            .trim()
            .split('\n')
          assert.equal(lines.length, 1)
          assert.equal(JSON.parse(lines[0]).unfinished_requests, 0)
        } else assert.match(stderr, /execution counters unavailable/)
        assert.doesNotMatch(stderr, /sk-private-serve|ENOENT|absent/)
      } finally {
        child.kill('SIGKILL')
        await exited
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
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

test('run with live progress terminates its listener on SIGTERM', async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ocr-signal-diagnostics-')
  )
  const diagnosticsPath = path.join(directory, 'diagnostics.jsonl')
  const configPath = path.join(directory, 'config.json')
  const original = JSON.stringify({ llm: { model: MISTRAL_MODEL } })
  fs.writeFileSync(configPath, original, { mode: 0o600 })
  const script =
    'process.stdout.write(process.env.OCR_LLM_URL + "\\n");' +
    ' setInterval(() => {}, 1000)'
  const child = spawn(
    process.execPath,
    [
      ADAPTER,
      'run',
      '--ocr-config',
      configPath,
      '--',
      process.execPath,
      '-e',
      script,
    ],
    {
      env: {
        ...process.env,
        MISTRAL_API_KEY: 'sk-synthetic-signal',
        OCR_ADAPTER_DIAGNOSTICS_PATH: diagnosticsPath,
        OCR_ADAPTER_PROGRESS_FD: '3',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    }
  )
  let stdout = ''
  let live = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.resume()
  child.stdio[3].on('data', (chunk) => {
    live += chunk
  })
  const exited = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }))
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
    assert.equal(result.code, 1)
    assert.equal(fs.readFileSync(configPath, 'utf8'), original)
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o600)
    assert.match(
      live,
      /^OCR progress event=process_exited exit_code=1 signaled=true spawn_failed=false elapsed_ms=\d+\n$/
    )
    assert.equal(
      fs.readFileSync(diagnosticsPath, 'utf8').trim().split('\n').length,
      1
    )
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
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
