import { strict as assert } from 'node:assert'
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import {
  evaluatePersistedEvidence,
  sha256Hex,
  writeEvidenceCapture,
} from '../scripts/klicker-evaluation-evidence.mjs'

import {
  buildGroundTruthIndex,
  createEvaluationServer,
  extractAssistantMessage,
  KlickerEvaluationTarget,
  parseGroundTruthFrontmatter,
  validateLocalOrigin,
} from '../scripts/klicker-evaluation-target.mjs'

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
      assert.equal(payload.selectedModel, 'gpt-5.6-luna')
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
          modelId: 'gpt-5.6-luna',
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
      pollTimeoutMs: 1000,
      pollIntervalMs: 1,
      requestTimeoutMs: 1000,
    })
    await target.initialize()
    const result = await target.complete({
      model: 'gpt-5.6-luna',
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
    modelId: 'gpt-5.6-luna',
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
    modelId: 'gpt-5.6-luna',
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
    modelId: 'gpt-5.6-luna',
    async complete(body) {
      assert.equal(body.model, 'gpt-5.6-luna')
      return {
        source: 'canary',
        payload: {
          id: 'response-1',
          object: 'chat.completion',
          model: 'gpt-5.6-luna',
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
    assert.deepEqual((await models.json()).data[0].id, 'gpt-5.6-luna')

    const completion = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
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

function documentsEnvelope(passages) {
  const payload = {
    answer: 'synthetic tool answer',
    mode: 'documents',
    summary: { count: passages.length },
    sources: passages.map((content, index) => ({
      reference: `synthetic-source-${index}`,
      title: 'Synthetic source title',
      chunks: [{ content, page_number: index + 1 }],
    })),
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
  }
}

function docQueryCall(result, extra = {}) {
  return {
    type: 'tool-call',
    toolCallId: 'tool-doc',
    toolName: 'KB_doc_query',
    args: { query: 'synthetic retrieval arguments' },
    result,
    ...extra,
  }
}

function evidenceInput(content, overrides = {}) {
  return {
    responseId: 'klicker-evaluation-synthetic',
    runId: 'synthetic-run',
    question: 'Synthetic question',
    answer: 'Synthetic answer',
    mode: 'tutor',
    requestedModel: 'gpt-5.6-luna',
    persistedModel: 'gpt-5.6-luna',
    content,
    ...overrides,
  }
}

function syntheticCapture(passages) {
  return evaluatePersistedEvidence(
    evidenceInput([docQueryCall(documentsEnvelope(passages))])
  )
}

function canaryTarget({ directory, content }) {
  const target = new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    groundTruthDirectory: '/tmp/unused-ground-truth',
    canaryFixture: '/tmp/unused-canary.json',
    evidenceDirectory: directory,
    evidenceRunId: 'synthetic-run',
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
    modelId: 'gpt-5.6-luna',
    content,
  })
  return target
}

test('evidence capture exports only ordered document passages', () => {
  const capture = evaluatePersistedEvidence(
    evidenceInput([
      { type: 'reasoning', text: 'synthetic hidden reasoning' },
      docQueryCall(documentsEnvelope(['alpha', 'alpha', 'beta'])),
      {
        type: 'tool-call',
        toolCallId: 'tool-expert',
        toolName: 'EXPERT_df_fineco_expert',
        args: { query: 'synthetic expert query' },
        result: { private: 'synthetic expert output' },
      },
      { type: 'text', text: 'Synthetic answer' },
    ])
  )

  assert.equal(capture.schema_version, 1)
  assert.equal(capture.status, 'complete')
  assert.deepEqual(capture.passages, ['alpha', 'alpha', 'beta'])
  assert.equal(capture.response_id, 'klicker-evaluation-synthetic')
  assert.equal(capture.run_id, 'synthetic-run')
  assert.equal(capture.mode, 'tutor')
  assert.equal(capture.requested_model, 'gpt-5.6-luna')
  assert.equal(capture.persisted_model, 'gpt-5.6-luna')
  assert.equal(capture.question_sha256, sha256Hex('Synthetic question'))
  assert.equal(capture.answer_sha256, sha256Hex('Synthetic answer'))

  const serialized = JSON.stringify(capture)
  for (const leaked of [
    'synthetic retrieval arguments',
    'synthetic hidden reasoning',
    'synthetic-source-0',
    'Synthetic source title',
    'synthetic expert output',
    'page_number',
  ]) {
    assert.equal(serialized.includes(leaked), false, leaked)
  }
})

test('evidence capture distinguishes empty from absent document calls', () => {
  assert.equal(syntheticCapture([]).status, 'empty')
  assert.equal(syntheticCapture([]).passages, undefined)

  const absent = evaluatePersistedEvidence(
    evidenceInput([
      {
        type: 'tool-call',
        toolName: 'EXPERT_df_fineco_expert',
        result: { sources: [{ chunks: [{ content: 'not a document call' }] }] },
      },
      { type: 'text', text: 'Synthetic answer' },
    ])
  )
  assert.equal(absent.status, 'no_calls')

  const trimmed = evaluatePersistedEvidence(
    evidenceInput([docQueryCall(documentsEnvelope(['alpha']))], {
      question: '  Synthetic question  ',
    })
  )
  assert.equal(trimmed.question_sha256, sha256Hex('Synthetic question'))
})

test('evidence capture recognizes only knowledge-base doc query tools', () => {
  const withName = (toolName) =>
    evaluatePersistedEvidence(
      evidenceInput([
        {
          type: 'tool-call',
          toolName,
          result: {
            mode: 'documents',
            sources: [{ chunks: [{ content: 'alpha' }] }],
          },
        },
        { type: 'text', text: 'Synthetic answer' },
      ])
    )

  assert.equal(withName('KB_doc_query').status, 'complete')
  assert.equal(withName(`KB_doc_query_${'a'.repeat(16)}`).status, 'complete')
  assert.equal(withName('doc_query').status, 'no_calls')
  assert.equal(withName('other_doc_query').status, 'no_calls')
  assert.equal(withName('KB_doc_query_2').status, 'no_calls')
})

test('evidence capture marks unusable document results incomplete', () => {
  const documents = (overrides = {}) => ({
    mode: 'documents',
    sources: [{ chunks: [{ content: 'alpha' }] }],
    ...overrides,
  })
  const cases = [
    [
      'failed result',
      docQueryCall({ isError: true, content: [] }),
      'result_failed',
    ],
    ['unknown envelope', docQueryCall({ foo: 'bar' }), 'result_unknown'],
    [
      'missing chunk text',
      docQueryCall(documents({ sources: [{ chunks: [{}] }] })),
      'result_malformed',
    ],
    [
      'invalid content sibling',
      docQueryCall({ structuredContent: documents(), content: 7 }),
      'result_malformed',
    ],
    [
      'nested conflicting representations',
      docQueryCall({
        result: {
          structuredContent: documents(),
          content: [
            { type: 'text', text: JSON.stringify(documents({ sources: [] })) },
          ],
        },
      }),
      'result_representations_conflict',
    ],
    [
      'broken text representation',
      docQueryCall({ content: [{ type: 'text', text: 'not json' }] }),
      'result_malformed',
    ],
    [
      'broken sibling of valid structured content',
      docQueryCall({
        structuredContent: documents(),
        content: [{ type: 'text', text: 'not json' }],
      }),
      'result_malformed',
    ],
    [
      'mixed-media sibling of valid structured content',
      docQueryCall({
        structuredContent: documents(),
        content: [{ type: 'image', data: 'synthetic-image' }],
      }),
      'result_malformed',
    ],
    [
      'malformed sources',
      docQueryCall({ mode: 'documents', sources: [{ chunks: 'nope' }] }),
      'result_malformed',
    ],
    [
      'conflicting representations',
      docQueryCall({
        structuredContent: documents(),
        content: [
          {
            type: 'text',
            text: JSON.stringify(documents({ answer: 'different' })),
          },
        ],
      }),
      'result_representations_conflict',
    ],
    [
      'non-document mode',
      docQueryCall(documents({ mode: 'answer' })),
      'result_mode_not_documents',
    ],
    [
      'failed tool call part',
      docQueryCall(documents(), { isError: true }),
      'tool_call_failed',
    ],
  ]

  for (const [name, part, reason] of cases) {
    const capture = evaluatePersistedEvidence(evidenceInput([part]))
    assert.equal(capture.status, 'incomplete', name)
    assert.equal(capture.reason, reason, name)
    assert.equal(capture.passages, undefined, name)
  }

  const mixed = evaluatePersistedEvidence(
    evidenceInput([
      docQueryCall(documents()),
      docQueryCall({ content: [{ type: 'text', text: 'truncated' }] }),
    ])
  )
  assert.equal(mixed.status, 'incomplete')
  assert.equal(mixed.passages, undefined)
})

test('evidence capture fails the run on unsafe passage content', () => {
  const unsafe = [
    'https://user:secret@example.test/report',
    'https://secret@example.test/report',
    'http://169.254.169.254/metadata',
    'http://[fc00::1]/private',
    'see http://localhost:3000/internal notes',
    'api_key = synthetic-value',
    'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0' +
      '.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    '-----BEGIN RSA PRIVATE KEY-----',
  ]

  for (const content of unsafe) {
    assert.throws(
      () =>
        evaluatePersistedEvidence(
          evidenceInput([docQueryCall(documentsEnvelope([content]))])
        ),
      { code: 'evidence_content_unsafe' },
      content
    )
  }
})

test('evidence capture bounds passages without truncating them', () => {
  const tooMany = Array.from({ length: 65 }, (_, index) => `p${index}`)
  const countCapture = evaluatePersistedEvidence(
    evidenceInput([docQueryCall(documentsEnvelope(tooMany))])
  )
  assert.equal(countCapture.status, 'incomplete')
  assert.equal(countCapture.reason, 'passage_count_exceeded')
  assert.equal(countCapture.passages, undefined)

  const oversized = 'x'.repeat(256 * 1024 + 1)
  const byteCapture = evaluatePersistedEvidence(
    evidenceInput([docQueryCall(documentsEnvelope([oversized]))])
  )
  assert.equal(byteCapture.status, 'incomplete')
  assert.equal(byteCapture.reason, 'passage_bytes_exceeded')
  assert.equal(byteCapture.passages, undefined)
})

test('evidence capture rejects envelopes deeper than its bound', () => {
  let nested = documentsEnvelope(['alpha'])
  for (let index = 0; index < 7; index += 1) nested = { result: nested }
  const capture = evaluatePersistedEvidence(
    evidenceInput([docQueryCall(nested)])
  )
  assert.equal(capture.status, 'incomplete')
  assert.equal(capture.reason, 'result_malformed')
})

test('evidence capture writes one exclusive private file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evidence-'))
  try {
    const capture = syntheticCapture(['alpha'])
    const filePath = await writeEvidenceCapture({ directory, capture })
    assert.equal(filePath, join(directory, `${capture.response_id}.json`))
    assert.equal((await stat(filePath)).mode & 0o077, 0)
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')).passages, [
      'alpha',
    ])
    await assert.rejects(writeEvidenceCapture({ directory, capture }), {
      code: 'evidence_file_exists',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('evidence capture rejects insecure and symlinked directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'klicker-evidence-'))
  try {
    const capture = syntheticCapture(['alpha'])
    const shared = join(root, 'shared')
    await mkdir(shared, { mode: 0o755 })
    await chmod(shared, 0o755)
    await assert.rejects(writeEvidenceCapture({ directory: shared, capture }), {
      code: 'evidence_directory_permissions',
    })

    const linked = join(root, 'linked')
    await symlink(shared, linked)
    await assert.rejects(writeEvidenceCapture({ directory: linked, capture }), {
      code: 'evidence_directory_unsafe',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('target requires an evidence directory and run id together', () => {
  const base = {
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
  }
  assert.throws(
    () =>
      new KlickerEvaluationTarget({
        ...base,
        evidenceDirectory: '/tmp/synthetic-evidence',
      }),
    { code: 'evidence_run_id_missing' }
  )
  assert.throws(
    () =>
      new KlickerEvaluationTarget({
        ...base,
        evidenceRunId: 'synthetic-run',
      }),
    { code: 'evidence_directory_missing' }
  )
})

test('opted-in target captures evidence bound to the completion id', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evidence-'))
  try {
    const target = canaryTarget({
      directory,
      content: [
        docQueryCall(documentsEnvelope(['alpha'])),
        { type: 'text', text: 'Synthetic canary answer.' },
      ],
    })
    const result = await target.complete({
      model: 'gpt-5.6-luna',
      stream: false,
      messages: [{ role: 'user', content: 'Synthetic canary' }],
    })

    const filePath = join(directory, `${result.payload.id}.json`)
    const written = JSON.parse(await readFile(filePath, 'utf8'))
    assert.equal(written.response_id, result.payload.id)
    assert.equal(written.run_id, 'synthetic-run')
    assert.equal(written.status, 'complete')
    assert.deepEqual(written.passages, ['alpha'])
    assert.equal(written.answer_sha256, sha256Hex('Synthetic canary answer.'))
    assert.equal((await stat(filePath)).mode & 0o077, 0)
    assert.deepEqual(await readdir(directory), [`${result.payload.id}.json`])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('an unsafe passage fails the opted-in run without evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-evidence-'))
  try {
    const target = canaryTarget({
      directory,
      content: [
        docQueryCall(
          documentsEnvelope(['https://user:secret@example.test/report'])
        ),
        { type: 'text', text: 'Synthetic canary answer.' },
      ],
    })
    await assert.rejects(
      target.complete({
        model: 'gpt-5.6-luna',
        stream: false,
        messages: [{ role: 'user', content: 'Synthetic canary' }],
      }),
      { code: 'evidence_content_unsafe' }
    )
    assert.deepEqual(await readdir(directory), [])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
