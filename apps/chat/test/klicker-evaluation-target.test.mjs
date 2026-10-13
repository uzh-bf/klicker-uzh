import { strict as assert } from 'node:assert'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import {
  assertBudgetCanStart,
  fingerprint,
  initializeBudget,
  readBudgetLedger,
  reserveProviderSpend,
} from '../../../evaluation/evaluation-budget.mjs'
import { requestReservation } from '../../../evaluation/evaluation-spend-guard.mjs'
import {
  buildGroundTruthIndex,
  createEvaluationServer,
  DEFAULT_CHATBOT_ID,
  extractAssistantMessage,
  KlickerEvaluationTarget,
  parseGroundTruthFrontmatter,
  validateLocalOrigin,
} from '../scripts/klicker-evaluation-target.mjs'

// Pinned so the synthetic target and its mocks agree even as the application
// default model changes; the target is constructed with this id explicitly.
const TEST_MODEL = 'gpt-6-luna'

// Synthetic operator pricing policy and private provider base for the guarded
// target. Values are fixed test inputs, never a copied tariff.
const SYNTHETIC_UPSTREAM = 'https://synthetic.example/v1'
const SYNTHETIC_POLICY = {
  version: 1,
  provider: 'synthetic',
  qualification: 'synthetic-guard',
  upstreamOrigin: SYNTHETIC_UPSTREAM,
  models: {
    [TEST_MODEL]: {
      contextTokens: 1_000,
      maxOutputTokens: 100,
      inputMicroUsdPerMillion: 1_000_000,
      outputMicroUsdPerMillion: 2_000_000,
      outputIncludesReasoning: true,
    },
  },
}
const SYNTHETIC_POLICY_HASH = fingerprint(SYNTHETIC_POLICY)
const SYNTHETIC_RESERVATION = requestReservation(
  SYNTHETIC_POLICY,
  '/v1/chat/completions',
  {
    model: TEST_MODEL,
    messages: [{ role: 'user', content: 'synthetic' }],
    max_completion_tokens: 100,
  }
)
const GUARD_ORIGIN = 'http://127.0.0.1:9'
const GUARD_KEY = 'synthetic-guard-key'

test('frontmatter projection contains only target-safe question metadata', () => {
  const metadata = parseGroundTruthFrontmatter(
    `---
question: What is CAPM?
mode: tutor
expected_tools_by_profile:
  catalog_expert_v1: [EXPERT_df_fineco_expert]
---

Expected answer must never be projected.
`,
    'fixture.md'
  )

  assert.deepEqual(metadata, {
    question: 'What is CAPM?',
    mode: 'tutor',
    source: 'fineco',
    filePath: 'fixture.md',
  })
})

test('ground-truth index rejects duplicate questions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evaluation-'))
  try {
    const fixture = '---\nquestion: Duplicate\nmode: tutor\n---\n'
    await writeFile(join(directory, 'one.md'), fixture)
    await writeFile(join(directory, 'two.md'), fixture)
    await assert.rejects(buildGroundTruthIndex(directory), {
      code: 'ground_truth_question_duplicate:two.md',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('local origin validation rejects non-local target routes', () => {
  assert.equal(
    validateLocalOrigin('https://chat.klicker.worktree.localhost/', 'chat'),
    'https://chat.klicker.worktree.localhost'
  )
  assert.throws(() => validateLocalOrigin('https://example.test', 'chat'), {
    code: 'chat_non_local',
  })
})

test('persisted assistant content converts to answer and tool names', () => {
  assert.deepEqual(
    extractAssistantMessage({
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'hidden reasoning' },
        {
          type: 'tool-call',
          toolCallId: 'tool-1',
          toolName: 'EXPERT_df_fineco_expert',
          args: { query: 'do not return args' },
        },
        { type: 'text', text: 'The answer.' },
      ],
    }),
    {
      answer: 'The answer.',
      toolCalls: [{ name: 'EXPERT_df_fineco_expert' }],
    }
  )
  assert.throws(
    () =>
      extractAssistantMessage({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-1',
            toolName: 'KB_doc_query',
            isError: true,
          },
        ],
      }),
    { code: 'tool_call_failed' }
  )
})

test('target uses participant gates and reads back one persisted turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evaluation-'))
  const groundTruthFile = join(directory, 'fixture.md')
  const canaryFile = join(directory, 'canary.json')
  const expectedAnswer = 'This answer must never be sent to the target.'
  await writeFile(
    groundTruthFile,
    `---\nquestion: What is CAPM?\nmode: tutor\nexpected_tools_by_profile:\n  catalog_expert_v1: [EXPERT_df_fineco_expert]\n---\n${expectedAnswer}\n`
  )
  await writeFile(
    canaryFile,
    JSON.stringify({
      source: 'canary',
      question: 'Synthetic canary',
      mode: 'tutor',
      expectedTool: 'KB_doc_query',
      maxStreamBytes: 1000,
    })
  )

  const originalFetch = globalThis.fetch
  const requests = []
  let assistantMessageId
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    const method = options.method || 'GET'
    const body = typeof options.body === 'string' ? options.body : ''
    assert.equal(options.redirect, 'error')
    requests.push({ requestUrl, method, body, headers: options.headers || {} })

    if (requestUrl.endsWith('/api/graphql')) {
      return new Response(
        JSON.stringify({ data: { loginParticipant: 'participant-jwt' } }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'participant_token=participant-jwt; Path=/; HttpOnly',
          },
        }
      )
    }
    if (requestUrl.endsWith('/disclaimer') && method === 'GET') {
      return Response.json({
        disclaimer: { id: 'disclaimer-1' },
        status: {
          required: true,
          accepted: false,
          disclaimerId: 'disclaimer-1',
        },
      })
    }
    if (requestUrl.endsWith('/disclaimer') && method === 'POST') {
      assert.deepEqual(JSON.parse(body), {
        action: 'accept',
        disclaimerId: 'disclaimer-1',
      })
      return Response.json({ success: true })
    }
    if (requestUrl.endsWith('/threads') && method === 'POST') {
      assert.deepEqual(JSON.parse(body), { title: null })
      return Response.json({ id: 'thread-1' })
    }
    if (requestUrl.endsWith('/chat') && method === 'POST') {
      const payload = JSON.parse(body)
      assistantMessageId = payload.assistantMessageId
      assert.equal(payload.selectedModel, TEST_MODEL)
      assert.equal(payload.selectedMode, 'tutor')
      assert.equal(payload.messages[0].content, 'What is CAPM?')
      assert.equal(body.includes(expectedAnswer), false)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"type":"start"}\n\n' +
                  'data: {"type":"finish"}\n\n' +
                  'data: [DONE]\n\n'
              )
            )
            controller.close()
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    }
    if (requestUrl.endsWith('/messages') && method === 'GET') {
      return Response.json([
        {
          id: assistantMessageId,
          role: 'assistant',
          chatMode: 'tutor',
          modelId: TEST_MODEL,
          content: [
            { type: 'reasoning', text: 'not exposed' },
            {
              type: 'tool-call',
              toolCallId: 'tool-1',
              toolName: 'EXPERT_df_fineco_expert',
              args: { query: 'private retrieval arguments' },
              result: { private: 'retrieval output' },
            },
            { type: 'text', text: 'CAPM answer.' },
          ],
        },
      ])
    }
    throw new Error(`Unexpected mock request: ${method} ${requestUrl}`)
  }

  try {
    const target = new KlickerEvaluationTarget({
      apiOrigin: 'https://api.klicker.localhost',
      chatOrigin: 'https://chat.klicker.localhost',
      apiKey: 'target-key',
      participantUsername: 'synthetic-participant',
      participantPassword: 'synthetic-password',
      groundTruthDirectory: directory,
      canaryFixture: canaryFile,
      modelId: TEST_MODEL,
      pollTimeoutMs: 1000,
      pollIntervalMs: 1,
      requestTimeoutMs: 1000,
    })
    await target.initialize()
    const result = await target.complete({
      model: TEST_MODEL,
      stream: false,
      messages: [{ role: 'user', content: 'What is CAPM?' }],
    })

    assert.equal(result.source, 'fineco')
    assert.equal(result.payload.choices[0].message.content, 'CAPM answer.')
    assert.deepEqual(result.payload.choices[0].message.tool_calls, [
      {
        id: 'klicker-tool-call-0',
        type: 'function',
        function: { name: 'EXPERT_df_fineco_expert', arguments: '{}' },
      },
    ])
    assert.equal(requests[0].method, 'POST')
    assert.equal(
      requests.filter(({ requestUrl }) => requestUrl.endsWith('/chat')).length,
      1
    )
    assert.equal(
      requests.every(({ body }) => !body.includes(expectedAnswer)),
      true
    )
    assert.equal(
      requests
        .filter(({ requestUrl }) => !requestUrl.endsWith('/api/graphql'))
        .every(
          ({ headers }) =>
            headers.Cookie === 'participant_token=participant-jwt'
        ),
      true
    )
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})

test('failed disclaimer setup does not poison a later session retry', async () => {
  const target = new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    groundTruthDirectory: '/tmp/unused-ground-truth',
    canaryFixture: '/tmp/unused-canary.json',
    requestTimeoutMs: 1000,
  })
  const originalFetch = globalThis.fetch
  let loginCalls = 0
  let disclaimerReads = 0
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.redirect, 'error')
    const requestUrl = String(url)
    const method = options.method || 'GET'
    if (requestUrl.endsWith('/api/graphql')) {
      loginCalls += 1
      return new Response(
        JSON.stringify({ data: { loginParticipant: 'participant-jwt' } }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'participant_token=participant-jwt; Path=/; HttpOnly',
          },
        }
      )
    }
    if (requestUrl.endsWith('/disclaimer') && method === 'GET') {
      disclaimerReads += 1
      if (disclaimerReads === 1) return new Response('{}', { status: 500 })
      return Response.json({
        status: { required: false, accepted: true },
      })
    }
    throw new Error('Unexpected mock request: ' + method + ' ' + requestUrl)
  }

  try {
    await assert.rejects(target.ensureSession(), {
      code: 'disclaimer_read_http_500',
    })
    await target.ensureSession()
    assert.equal(loginCalls, 2)
    assert.equal(target.cookie, 'participant_token=participant-jwt')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('target rejects malformed and incomplete UI streams', async () => {
  const target = new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    groundTruthDirectory: '/tmp/unused-ground-truth',
    canaryFixture: '/tmp/unused-canary.json',
    requestTimeoutMs: 1000,
  })
  target.cookie = 'participant_token=participant-jwt'
  const originalFetch = globalThis.fetch

  try {
    for (const [stream, code] of [
      ['not-an-sse-stream', 'chat_stream_invalid'],
      ['data: {"type":"start"}\n\n', 'chat_stream_incomplete'],
    ]) {
      globalThis.fetch = async () =>
        new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      await assert.rejects(
        target.submitTurn({
          question: 'Synthetic question',
          mode: 'tutor',
          threadId: 'thread-1',
          userMessageId: 'user-1',
          assistantMessageId: 'assistant-1',
          maxStreamBytes: 1000,
        }),
        { code }
      )
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('target cancels an open stream after an SSE error', async () => {
  const target = new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    groundTruthDirectory: '/tmp/unused-ground-truth',
    canaryFixture: '/tmp/unused-canary.json',
    requestTimeoutMs: 1000,
  })
  target.cookie = 'participant_token=participant-jwt'
  const originalFetch = globalThis.fetch
  let cancelled = false
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"type":"error"}\n\n')
          )
        },
        cancel() {
          cancelled = true
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )

  try {
    await assert.rejects(
      target.submitTurn({
        question: 'Synthetic question',
        mode: 'tutor',
        threadId: 'thread-1',
        userMessageId: 'user-1',
        assistantMessageId: 'assistant-1',
        maxStreamBytes: 1000,
      }),
      { code: 'chat_stream_error' }
    )
    assert.equal(cancelled, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('canary requires its configured tool', async () => {
  const target = new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    groundTruthDirectory: '/tmp/unused-ground-truth',
    canaryFixture: '/tmp/unused-canary.json',
  })
  target.groundTruthIndex = new Map()
  target.canary = {
    question: 'Synthetic canary',
    mode: 'tutor',
    source: 'canary',
    expectedTool: 'KB_doc_query',
    maxStreamBytes: 1000,
  }
  target.ensureSession = async () => {}
  target.createThread = async () => 'thread-1'
  target.submitTurn = async () => {}
  target.readCompletedMessage = async () => ({
    id: 'assistant-1',
    role: 'assistant',
    chatMode: 'tutor',
    modelId: TEST_MODEL,
    content: [
      { type: 'tool-call', toolName: 'KB_doc_query' },
      { type: 'text', text: 'KLICKER_LOCAL_MCP_OK' },
    ],
  })

  const success = await target.runQuestion('Synthetic canary')
  assert.equal(success.toolCalls[0].name, 'KB_doc_query')

  target.readCompletedMessage = async () => ({
    id: 'assistant-2',
    role: 'assistant',
    chatMode: 'tutor',
    modelId: TEST_MODEL,
    content: [
      { type: 'tool-call', toolName: 'wrong_tool' },
      { type: 'text', text: 'KLICKER_LOCAL_MCP_OK' },
    ],
  })
  await assert.rejects(target.runQuestion('Synthetic canary'), {
    code: 'canary_tool_missing',
  })
})

test('adapter requires bearer auth and exposes only the configured model', async () => {
  const target = {
    modelId: TEST_MODEL,
    async complete(body) {
      assert.equal(body.model, TEST_MODEL)
      return {
        source: 'canary',
        payload: {
          id: 'response-1',
          object: 'chat.completion',
          model: TEST_MODEL,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'ok' },
              finish_reason: 'stop',
            },
          ],
        },
      }
    },
  }
  const server = createEvaluationServer({ target, apiKey: 'test-key' })
  await new Promise((resolvePromise) =>
    server.listen(0, '127.0.0.1', resolvePromise)
  )
  const address = server.address()
  assert.notEqual(typeof address, 'string')
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    const unauthorized = await fetch(`${baseUrl}/v1/models`)
    assert.equal(unauthorized.status, 401)

    const models = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: 'Bearer test-key' },
    })
    assert.equal(models.status, 200)
    assert.deepEqual((await models.json()).data[0].id, TEST_MODEL)

    const completion = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEST_MODEL,
        stream: false,
        messages: [{ role: 'user', content: 'synthetic' }],
      }),
    })
    assert.equal(completion.status, 200)
    assert.equal(
      completion.headers.get('x-klicker-evaluation-source'),
      'canary'
    )
    assert.equal((await completion.json()).choices[0].message.content, 'ok')
  } finally {
    await new Promise((resolvePromise, rejectPromise) =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
    )
  }
})

// The guarded runQuestion again mirrors the production placement: an
// authenticated status read reflects the durable ledger, and the application
// reserves the full qualified cost before it can produce a chat result.
test('guarded runQuestion accounts completed failures and refuses an over-budget call', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evaluation-'))
  const budgetFile = join(directory, 'budget.json')
  const qualificationFile = join(directory, 'qualification.json')
  const question = 'What is CAPM?'
  const credits = 0.5

  const originalFetch = globalThis.fetch
  let statusReads = 0
  let dispatched = 0
  let threadCount = 0
  let assistantMessageId = null

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url)
    const method = options.method || 'GET'
    const body = typeof options.body === 'string' ? options.body : ''

    if (requestUrl.startsWith(GUARD_ORIGIN)) {
      assert.equal(options.headers?.Authorization, 'Bearer ' + GUARD_KEY)
      statusReads += 1
      const ledger = await readBudgetLedger(budgetFile)
      return Response.json({
        experimentId: ledger.experimentId,
        policyHash: ledger.policyHash,
        upstreamOrigin: SYNTHETIC_UPSTREAM,
        maxSubmittedTurns: ledger.maxSubmittedTurns,
        maxProviderMicroUsd: ledger.maxProviderMicroUsd,
        reservedProviderMicroUsd: ledger.reservedProviderMicroUsd,
      })
    }
    if (requestUrl.endsWith('/api/graphql')) {
      return new Response(
        JSON.stringify({ data: { loginParticipant: 'participant-jwt' } }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'participant_token=participant-jwt; Path=/; HttpOnly',
          },
        }
      )
    }
    if (requestUrl.endsWith('/disclaimer') && method === 'GET') {
      return Response.json({ status: { required: false, accepted: true } })
    }
    if (requestUrl.endsWith('/threads') && method === 'POST') {
      threadCount += 1
      return Response.json({ id: 'thread-' + threadCount })
    }
    if (requestUrl.endsWith('/chat') && method === 'POST') {
      try {
        await reserveProviderSpend(
          budgetFile,
          SYNTHETIC_POLICY_HASH,
          SYNTHETIC_RESERVATION
        )
      } catch (error) {
        if (error?.code === 'budget_spend_exhausted') {
          return new Response(JSON.stringify({ error: error.code }), {
            status: 429,
          })
        }
        throw error
      }
      dispatched += 1
      assistantMessageId = JSON.parse(body).assistantMessageId
      return new Response(
        'data: {"type":"start"}\n\n' +
          'data: {"type":"finish","messageMetadata":' +
          '{"chatMode":"tutor","modelId":"' +
          TEST_MODEL +
          '","creditsUsed":' +
          credits +
          '}}\n\n' +
          'data: [DONE]\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    }
    if (requestUrl.endsWith('/messages') && method === 'GET') {
      return Response.json([
        {
          id: assistantMessageId,
          role: 'assistant',
          chatMode: 'tutor',
          modelId: TEST_MODEL,
          creditsUsed: credits,
          content: [{ type: 'text', text: 'guarded answer' }],
        },
      ])
    }
    throw new Error('Unexpected mock request: ' + method + ' ' + requestUrl)
  }

  try {
    await initializeBudget(budgetFile, SYNTHETIC_POLICY_HASH, {
      maxProviderMicroUsd: 2 * SYNTHETIC_RESERVATION + 100,
    })
    const ledger = await readBudgetLedger(budgetFile)
    await writeFile(
      qualificationFile,
      JSON.stringify({
        version: 1,
        experimentId: ledger.experimentId,
        policyHash: SYNTHETIC_POLICY_HASH,
        guardOrigin: GUARD_ORIGIN,
        chatOrigin: 'https://chat.klicker.localhost',
        upstreamOrigin: SYNTHETIC_UPSTREAM,
        chatbotId: DEFAULT_CHATBOT_ID,
        modelId: TEST_MODEL,
        allBillableEgressGuarded: true,
        evidence: 'synthetic qualification evidence',
      })
    )

    const target = new KlickerEvaluationTarget({
      apiOrigin: 'https://api.klicker.localhost',
      chatOrigin: 'https://chat.klicker.localhost',
      apiKey: 'target-key',
      participantUsername: 'synthetic-participant',
      participantPassword: 'synthetic-password',
      modelId: TEST_MODEL,
      pollTimeoutMs: 1000,
      pollIntervalMs: 1,
      requestTimeoutMs: 1000,
      budgetFile,
      qualification: {
        filePath: qualificationFile,
        origin: GUARD_ORIGIN,
        key: GUARD_KEY,
      },
    })
    target.groundTruthIndex = new Map([
      [
        question,
        { question, mode: 'tutor', source: 'fineco', filePath: 'fixture.md' },
      ],
    ])
    target.canary = {
      question: 'Synthetic canary',
      mode: 'tutor',
      source: 'canary',
      expectedTool: 'KB_doc_query',
      maxStreamBytes: 1000,
    }

    await target.runQuestion(question)

    const afterTurn = await readBudgetLedger(budgetFile)
    assert.equal(afterTurn.submittedTurns, 1)
    assert.equal(afterTurn.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)
    assert.equal(afterTurn.creditsUsed, credits)
    assert.equal(afterTurn.uncertain, false)
    assert.equal(afterTurn.activeTurn, null)
    assert.equal(dispatched, 1)

    await assert.rejects(target.runQuestion(target.canary.question), {
      code: 'canary_tool_missing',
    })
    const afterCompletedFailure = await readBudgetLedger(budgetFile)
    assert.equal(afterCompletedFailure.submittedTurns, 2)
    assert.equal(
      afterCompletedFailure.reservedProviderMicroUsd,
      2 * SYNTHETIC_RESERVATION
    )
    assert.equal(afterCompletedFailure.creditsUsed, 2 * credits)
    assert.equal(afterCompletedFailure.uncertain, false)
    assert.equal(afterCompletedFailure.activeTurn, null)
    assert.doesNotThrow(() => assertBudgetCanStart(afterCompletedFailure))
    assert.equal(dispatched, 2)

    // Over budget: the guard refuses the reservation, so no further provider
    // call is dispatched and the interrupted turn stays uncertain.
    await assert.rejects(target.runQuestion(question), {
      code: 'chat_submit_http_429',
    })
    const afterRefusal = await readBudgetLedger(budgetFile)
    assert.equal(dispatched, 2)
    assert.equal(afterRefusal.submittedTurns, 3)
    assert.equal(
      afterRefusal.reservedProviderMicroUsd,
      2 * SYNTHETIC_RESERVATION
    )
    assert.equal(afterRefusal.creditsUsed, 2 * credits)
    assert.equal(afterRefusal.uncertain, true)
    assert.notEqual(afterRefusal.activeTurn, null)

    // A later run is refused before login by the preflight budget check.
    const statusReadsBefore = statusReads
    await assert.rejects(target.runQuestion(question), {
      code: 'budget_uncertain',
    })
    assert.equal(statusReads, statusReadsBefore)
    assert.equal(dispatched, 2)
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})
