import { strict as assert } from 'node:assert'
import { test } from 'vitest'
import { KlickerEvaluationTarget } from '../scripts/klicker-evaluation-target.mjs'
import {
  buildSourceReceipt,
  EXPECTED_DOC_QUERY_TOOL,
  runTrajectory,
  validateTrajectoryCorpus,
} from '../scripts/tutor-trajectory.mjs'
import { withModelCitationIndices } from '../src/lib/server/citationInstructions'
import { mapAssistantStepContent } from '../src/lib/server/persistedAssistantContent'
import { MAX_SOURCES } from '../src/lib/sources/normalizeSources'

const SYNTHETIC_MODEL = 'gpt-6-luna'

const TURN_RECEIPT_FIELDS = [
  'arm',
  'assistantMessageId',
  'assistantText',
  'caseId',
  'creditsUsed',
  'group',
  'language',
  'latencyMs',
  'mode',
  'model',
  'parentId',
  'recordedAt',
  'receiptVersion',
  'repeat',
  'sourceMapping',
  'sources',
  'support',
  'threadId',
  'toolName',
  'toolStatus',
  'turn',
  'type',
  'userMessageId',
  'userText',
].sort()

function trajectoryCase(overrides = {}) {
  return {
    id: 'synthetic-case',
    group: 'development',
    language: 'en',
    mode: 'tutor',
    support: 'copied explanation',
    rubric: ['Synthetic rubric dimension'],
    assessmentTurns: [1],
    turns: [{ message: 'Synthetic question one' }],
    ...overrides,
  }
}

function sseStream(events) {
  return (
    events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join('') +
    'data: [DONE]\n\n'
  )
}

// Minimal in-memory stand-in for the chat app: it persists a parent-linked
// user/assistant pair per submitted turn, streams a UI message stream, and
// serves the persisted thread back the way the real messages route does.
function syntheticChatFetch({ turnConfig = () => ({}) } = {}) {
  const threads = new Map()
  const calls = []
  let threadCount = 0

  const fetchImpl = async (url, options = {}) => {
    assert.equal(options.redirect, 'error')
    const requestUrl = String(url)
    const method = options.method || 'GET'
    const body = typeof options.body === 'string' ? options.body : ''
    calls.push({ requestUrl, method, body, headers: options.headers || {} })

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
      const threadId = 'thread-' + threadCount
      threads.set(threadId, [])
      return Response.json({ id: threadId })
    }
    if (requestUrl.endsWith('/chat') && method === 'POST') {
      const payload = JSON.parse(body)
      const thread = threads.get(payload.threadId)
      const lastUser = payload.messages[payload.messages.length - 1]
      const turn =
        thread.filter((message) => message.role === 'user').length + 1
      const config = turnConfig({ payload, turn, thread }) || {}
      if (typeof config.mutateThread === 'function') config.mutateThread(thread)

      thread.push({
        id: lastUser.id,
        threadId: payload.threadId,
        role: 'user',
        content: [{ type: 'text', text: lastUser.content }],
        chatMode: payload.selectedMode,
        modelId: SYNTHETIC_MODEL,
        reasoningEffort: 'low',
        creditsUsed: null,
        parentId:
          config.userParentId !== undefined
            ? config.userParentId
            : payload.parentId || null,
        createdAt: new Date().toISOString(),
      })

      const answerText = config.answerText ?? 'Synthetic answer ' + turn + '.'
      const content = [
        ...(config.omitTool
          ? []
          : [
              {
                type: 'tool-call',
                toolCallId: 'tool-1',
                toolName: config.toolName ?? EXPECTED_DOC_QUERY_TOOL,
                args: { query: 'private tool arguments' },
                result: config.toolError
                  ? undefined
                  : (config.toolResult ?? {
                      mode: 'answer',
                      sources: [
                        {
                          display_name: 'Synthetic source title',
                          file_name: 'synthetic-source.pdf',
                          page_number: 3,
                          excerpt: 'private excerpt',
                          source_url:
                            'https://private.example.internal/synthetic.pdf',
                        },
                      ],
                    }),
                ...(config.toolError ? { isError: true } : {}),
              },
            ]),
        { type: 'reasoning', text: 'private reasoning' },
        { type: 'text', text: config.persistedText ?? answerText },
      ]

      thread.push({
        id: payload.assistantMessageId,
        threadId: payload.threadId,
        role: 'assistant',
        content,
        chatMode: payload.selectedMode,
        modelId: SYNTHETIC_MODEL,
        reasoningEffort: 'low',
        creditsUsed:
          config.creditsAccounted === false
            ? null
            : (config.creditsUsed ?? 0.25),
        parentId:
          config.assistantParentId !== undefined
            ? config.assistantParentId
            : lastUser.id,
        createdAt: new Date().toISOString(),
      })

      const events = config.stream ?? [
        { type: 'start' },
        {
          type: 'tool-input-start',
          toolCallId: 'tool-1',
          toolName: config.toolName ?? EXPECTED_DOC_QUERY_TOOL,
        },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-1',
          input: { query: 'private tool arguments' },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-1',
          output: { private: 'retrieval output' },
        },
        { type: 'text-delta', delta: config.streamText ?? answerText },
        {
          type: 'finish',
          messageMetadata: {
            finishReason: 'stop',
            chatMode: payload.selectedMode,
            modelId: SYNTHETIC_MODEL,
            ...(config.creditsAccounted === false
              ? {}
              : { creditsUsed: config.creditsUsed ?? 0.25 }),
            reasoningContent: 'private reasoning',
          },
        },
      ]

      return new Response(sseStream(events), {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }
    if (requestUrl.endsWith('/messages') && method === 'GET') {
      const threadId = requestUrl.split('/threads/')[1].split('/')[0]
      return Response.json(threads.get(threadId) || [])
    }
    throw new Error('Unexpected mock request: ' + method + ' ' + requestUrl)
  }

  return { fetchImpl, calls, threads }
}

function createTrajectoryTarget(overrides = {}) {
  return new KlickerEvaluationTarget({
    apiOrigin: 'https://api.klicker.localhost',
    chatOrigin: 'https://chat.klicker.localhost',
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    pollTimeoutMs: 1000,
    pollIntervalMs: 1,
    requestTimeoutMs: 1000,
    modelId: SYNTHETIC_MODEL,
    ...overrides,
  })
}

test('trajectory chains persisted ancestry and repeats only the visible answer', async () => {
  const app = syntheticChatFetch({
    turnConfig: ({ turn }) => ({
      answerText: 'Synthetic answer ' + turn + '.',
      creditsUsed: 0.25,
    }),
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = app.fetchImpl

  try {
    const target = createTrajectoryTarget()
    const receipts = []
    const result = await runTrajectory(
      target,
      trajectoryCase({
        assessmentTurns: [1, 2],
        turns: [
          { message: 'Synthetic question one' },
          { repeatPrevious: true, suffix: ' Synthetic suffix.' },
        ],
      }),
      {
        arm: 'baseline',
        repeat: 0,
        onTurn: (receipt) => receipts.push(receipt),
      }
    )

    assert.equal(result.threadId, 'thread-1')
    assert.equal(receipts.length, 2)
    assert.deepEqual(Object.keys(receipts[0]).sort(), TURN_RECEIPT_FIELDS)
    assert.equal(receipts[0].receiptVersion, 2)
    assert.deepEqual(receipts[0].sourceMapping, {
      version: 1,
      maxSources: MAX_SOURCES,
      fingerprint: receipts[0].sourceMapping.fingerprint,
    })
    assert.match(receipts[0].sourceMapping.fingerprint, /^[0-9a-f]{64}$/)
    assert.equal(receipts[0].sources.length, 1)
    const [sourceEntry] = receipts[0].sources
    assert.match(sourceEntry.identityHash, /^[0-9a-f]{64}$/)
    assert.deepEqual(
      { ...sourceEntry, identityHash: '<hash>' },
      {
        toolCallId: 'tool-1',
        sourcePosition: 1,
        citationIndex: 1,
        identityHash: '<hash>',
        type: 'document',
        page: 3,
        startSec: null,
        endSec: null,
      }
    )
    assert.equal(receipts[0].toolName, EXPECTED_DOC_QUERY_TOOL)
    assert.equal(receipts[0].toolStatus, 'completed')
    assert.equal(receipts[0].creditsUsed, 0.25)
    assert.equal(receipts[0].userText, 'Synthetic question one')
    assert.equal(receipts[0].assistantText, 'Synthetic answer 1.')
    assert.equal(receipts[0].parentId, null)
    assert.equal(receipts[1].parentId, receipts[0].assistantMessageId)
    assert.equal(receipts[1].userText, 'Synthetic answer 1. Synthetic suffix.')
    assert.equal(typeof receipts[0].latencyMs, 'number')
    assert.equal(receipts[0].mode, 'tutor')
    assert.equal(receipts[0].model, SYNTHETIC_MODEL)

    const chatCalls = app.calls.filter(({ requestUrl }) =>
      requestUrl.endsWith('/chat')
    )
    assert.equal(chatCalls.length, 2)
    const first = JSON.parse(chatCalls[0].body)
    assert.equal(first.parentId, null)
    assert.deepEqual(first.messages, [
      {
        id: receipts[0].userMessageId,
        role: 'user',
        content: 'Synthetic question one',
      },
    ])
    const second = JSON.parse(chatCalls[1].body)
    assert.equal(second.parentId, receipts[0].assistantMessageId)
    assert.deepEqual(second.messages, [
      {
        id: receipts[0].userMessageId,
        role: 'user',
        content: 'Synthetic question one',
      },
      {
        id: receipts[0].assistantMessageId,
        role: 'assistant',
        content: 'Synthetic answer 1.',
      },
      {
        id: receipts[1].userMessageId,
        role: 'user',
        content: 'Synthetic answer 1. Synthetic suffix.',
      },
    ])

    const serialized = JSON.stringify(receipts)
    for (const forbidden of [
      'private reasoning',
      'private tool arguments',
      'retrieval output',
      'private excerpt',
      'Synthetic source title',
      'synthetic-source.pdf',
      'private.example.internal',
      'reasoningContent',
      'participant_token',
    ]) {
      assert.equal(serialized.includes(forbidden), false)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory rejects broken ancestor links and rewritten ancestors', async () => {
  const brokenLink = syntheticChatFetch({
    turnConfig: ({ turn }) =>
      turn === 2 ? { userParentId: 'foreign-parent' } : {},
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = brokenLink.fetchImpl

  const twoTurnCase = trajectoryCase({
    turns: [
      { message: 'Synthetic question one' },
      { repeatPrevious: true, suffix: ' Synthetic suffix.' },
    ],
  })

  try {
    const receipts = []
    await assert.rejects(
      runTrajectory(createTrajectoryTarget(), twoTurnCase, {
        onTurn: (receipt) => receipts.push(receipt),
      }),
      { code: 'trajectory_ancestry_mismatch' }
    )
    assert.equal(receipts.length, 1)
  } finally {
    globalThis.fetch = originalFetch
  }

  const rewrittenAncestor = syntheticChatFetch({
    turnConfig: ({ turn }) =>
      turn === 2
        ? {
            mutateThread: (thread) => {
              const ancestor = thread.find(
                (message) => message.role === 'assistant'
              )
              ancestor.content = [{ type: 'text', text: 'Rewritten ancestor.' }]
            },
          }
        : {},
  })
  globalThis.fetch = rewrittenAncestor.fetchImpl
  try {
    await assert.rejects(runTrajectory(createTrajectoryTarget(), twoTurnCase), {
      code: 'trajectory_ancestor_text_mismatch',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory rejects streamed text that differs from the saved answer', async () => {
  const app = syntheticChatFetch({
    turnConfig: () => ({ streamText: 'Streamed text that is not persisted.' }),
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = app.fetchImpl

  try {
    const receipts = []
    await assert.rejects(
      runTrajectory(createTrajectoryTarget(), trajectoryCase(), {
        onTurn: (receipt) => receipts.push(receipt),
      }),
      { code: 'trajectory_text_mismatch' }
    )
    assert.equal(receipts.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory requires a completed non-error retrieval result', async () => {
  const originalFetch = globalThis.fetch

  for (const [config, code] of [
    [{ omitTool: true }, 'trajectory_tool_missing'],
    [{ toolError: true }, 'trajectory_tool_error'],
    [
      {
        toolResult: {
          content: [{ type: 'text', text: 'private retrieval error' }],
          isError: true,
        },
      },
      'trajectory_tool_error',
    ],
  ]) {
    const app = syntheticChatFetch({ turnConfig: () => config })
    globalThis.fetch = app.fetchImpl
    try {
      await assert.rejects(
        runTrajectory(createTrajectoryTarget(), trajectoryCase()),
        { code }
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  }
})

test('trajectory accepts Explainer with the same stream and persistence checks', async () => {
  const app = syntheticChatFetch({
    turnConfig: ({ turn }) => ({
      answerText: 'Synthetic explainer answer ' + turn + '.',
    }),
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = app.fetchImpl
  try {
    const result = await runTrajectory(
      createTrajectoryTarget(),
      trajectoryCase({
        mode: 'explainer',
        turns: [{ message: 'Explain synthetic topic' }],
      })
    )
    assert.equal(result.receipts.length, 1)
    assert.equal(result.receipts[0].mode, 'explainer')
    assert.equal(result.receipts[0].toolStatus, 'completed')
    assert.equal(
      result.receipts[0].assistantText,
      'Synthetic explainer answer 1.'
    )
    assert.equal(result.receipts[0].sources.length, 1)
    assert.equal(result.receipts[0].sources[0].citationIndex, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// The evaluator reconstructs the application's per-call citation mapping
// instead of reimplementing it. This proves parity with the application
// projection (withModelCitationIndices) across multiple calls, cross-call
// deduplication, page and video positions, an MCP text envelope, capacity
// overflow and a suppressed private URL.
test('source receipts match the application citation projection and suppress raw sources', () => {
  const documents = (...sources) => ({ mode: 'documents', sources })
  const answer = (...sources) => ({ mode: 'answer', sources })
  const part = (toolCallId, result, toolName = EXPECTED_DOC_QUERY_TOOL) => ({
    type: 'tool-call',
    toolCallId,
    toolName,
    result,
  })
  const alphaChunk = {
    reference: 'urn:alpha',
    title: 'Alpha',
    chunks: [{ content: 'passage one', page_number: 1 }],
  }
  const parts = [
    part(
      'call-a',
      documents(
        alphaChunk,
        {
          reference: 'urn:video',
          source_type: 'video',
          title: 'Beta',
          chunks: [
            {
              content: 'passage two',
              page_number: 2,
              start_sec: 10,
              end_sec: 20,
            },
          ],
        },
        alphaChunk
      )
    ),
    part(
      'call-b',
      answer({
        display_name: 'Private Doc',
        page_number: 5,
        source_url: 'https://private.example.internal/secret.pdf',
        excerpt: 'private-chunk-text',
      }),
      'COURSE_doc_query'
    ),
    part(
      'call-c',
      {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              documents(
                ...Array.from({ length: MAX_SOURCES }, (_, index) => ({
                  reference: 'urn:c' + index,
                  title: 'Doc ' + index,
                  chunks: [
                    { content: 'chunk ' + index, page_number: index + 1 },
                  ],
                }))
              )
            ),
          },
        ],
      },
      'COURSE_doc_query_01234567'
    ),
  ]

  parts.push(part('call-error', { ...documents(alphaChunk), isError: true }))
  const steps = parts.map((entry) => ({
    content: [
      {
        type: 'tool-call',
        toolCallId: entry.toolCallId,
        toolName: entry.toolName,
        input: {},
      },
      {
        type: 'tool-result',
        toolCallId: entry.toolCallId,
        toolName: entry.toolName,
        output: entry.result,
      },
    ],
  }))
  const messages = parts.map((entry) => ({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: entry.toolCallId,
        toolName: entry.toolName,
        output: { type: 'text', value: '{}' },
      },
    ],
  }))

  const receipt = buildSourceReceipt(mapAssistantStepContent(steps))
  const applicationEntries = []
  withModelCitationIndices(messages, steps).forEach((message, index) => {
    const payload = JSON.parse(message.content[0].output.value)
    ;(payload.sources ?? []).forEach((source, position) => {
      applicationEntries.push({
        toolCallId: parts[index].toolCallId,
        sourcePosition: position + 1,
        citationIndex: Number.isInteger(source.citation_index)
          ? source.citation_index
          : null,
      })
    })
  })
  const expectedEntries = [
    ...[1, 2, 1].map((citationIndex, index) => ({
      toolCallId: 'call-a',
      sourcePosition: index + 1,
      citationIndex,
    })),
    { toolCallId: 'call-b', sourcePosition: 1, citationIndex: 3 },
    ...Array.from({ length: MAX_SOURCES }, (_, index) => ({
      toolCallId: 'call-c',
      sourcePosition: index + 1,
      citationIndex: index + 4 <= MAX_SOURCES ? index + 4 : null,
    })),
  ]
  assert.deepEqual(applicationEntries, expectedEntries)
  for (const toolCallId of [undefined, null, 123, '']) {
    assert.throws(
      () =>
        buildSourceReceipt([
          part(toolCallId, documents(alphaChunk), 'COURSE_doc_query_01234567'),
        ]),
      { code: 'trajectory_tool_identity_mismatch' }
    )
  }
  assert.deepEqual(
    receipt.sources.map(({ toolCallId, sourcePosition, citationIndex }) => ({
      toolCallId,
      sourcePosition,
      citationIndex,
    })),
    expectedEntries
  )

  // Deduplication keeps the first-appearance index across calls.
  const callA = receipt.sources.filter((entry) => entry.toolCallId === 'call-a')
  assert.deepEqual(
    callA.map((entry) => entry.citationIndex),
    [1, 2, 1]
  )
  // Video positions stay numeric and the type is the normalized one.
  assert.deepEqual(
    { ...callA[1], identityHash: '<hash>' },
    {
      toolCallId: 'call-a',
      sourcePosition: 2,
      citationIndex: 2,
      identityHash: '<hash>',
      type: 'video',
      page: 2,
      startSec: 10,
      endSec: 20,
    }
  )
  // Capacity overflow past the application constant yields explicit nulls.
  const callC = receipt.sources.filter((entry) => entry.toolCallId === 'call-c')
  assert.equal(callC.length, MAX_SOURCES)
  assert.deepEqual(
    callC.map((entry) => entry.citationIndex),
    Array.from({ length: MAX_SOURCES }, (_, index) =>
      index + 4 <= MAX_SOURCES ? index + 4 : null
    )
  )
  assert.ok(
    callC
      .slice(MAX_SOURCES - 3)
      .every(
        (entry) => entry.type === 'document' && entry.identityHash !== null
      )
  )

  // Raw references, titles, URLs, chunks and excerpts never reach the receipt.
  const serialized = JSON.stringify(receipt)
  for (const forbidden of [
    'urn:alpha',
    'urn:video',
    'Alpha',
    'Beta',
    'Private Doc',
    'private.example.internal',
    'secret.pdf',
    'private-chunk-text',
    'passage one',
  ]) {
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('trajectory requires completed tool evidence in the stream itself', async () => {
  const originalFetch = globalThis.fetch
  const baseEvents = [
    { type: 'start' },
    { type: 'text-delta', delta: 'Synthetic answer 1.' },
    {
      type: 'finish',
      messageMetadata: {
        finishReason: 'stop',
        chatMode: 'tutor',
        modelId: SYNTHETIC_MODEL,
        creditsUsed: 0.25,
      },
    },
  ]

  globalThis.fetch = syntheticChatFetch({
    turnConfig: () => ({ stream: baseEvents }),
  }).fetchImpl
  try {
    await assert.rejects(
      runTrajectory(createTrajectoryTarget(), trajectoryCase()),
      { code: 'trajectory_stream_tool_missing' }
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  globalThis.fetch = syntheticChatFetch({
    turnConfig: () => ({
      stream: [
        { type: 'start' },
        {
          type: 'tool-input-start',
          toolCallId: 'tool-1',
          toolName: EXPECTED_DOC_QUERY_TOOL,
        },
        {
          type: 'tool-output-error',
          toolCallId: 'tool-1',
          errorText: 'private retrieval error',
        },
        ...baseEvents,
      ],
    }),
  }).fetchImpl
  try {
    await assert.rejects(
      runTrajectory(createTrajectoryTarget(), trajectoryCase()),
      { code: 'chat_stream_error' }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory fails closed on an incomplete stream', async () => {
  const app = syntheticChatFetch({
    turnConfig: () => ({
      stream: [
        { type: 'start' },
        { type: 'text-delta', delta: 'Synthetic partial answer.' },
      ],
    }),
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = app.fetchImpl

  try {
    const receipts = []
    await assert.rejects(
      runTrajectory(createTrajectoryTarget(), trajectoryCase(), {
        onTurn: (receipt) => receipts.push(receipt),
      }),
      { code: 'chat_stream_incomplete' }
    )
    assert.equal(receipts.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory corpus validation rejects invalid shapes', () => {
  const valid = { version: 1, cases: [trajectoryCase()] }
  const normalized = validateTrajectoryCorpus(valid)
  assert.equal(normalized.cases.length, 1)
  assert.deepEqual(normalized.cases[0].turns, [
    { message: 'Synthetic question one' },
  ])
  assert.deepEqual(normalized.cases[0].assessmentTurns, [1])

  for (const [corpus, code] of [
    [{ ...valid, notes: 'unexpected' }, 'corpus_unknown_field'],
    [{ ...valid, version: true }, 'corpus_version_unsupported'],
    [{ version: 2, cases: [trajectoryCase()] }, 'corpus_version_unsupported'],
    [{ version: 1, cases: [] }, 'corpus_cases_invalid'],
    [
      { version: 1, cases: [trajectoryCase(), trajectoryCase()] },
      'corpus_case_duplicate',
    ],
    [
      { version: 1, cases: [trajectoryCase({ mode: 'summarizer' })] },
      'trajectory_case_mode_invalid',
    ],
    [
      { version: 1, cases: [trajectoryCase({ notes: 'unexpected' })] },
      'trajectory_case_unknown_field',
    ],
    [
      {
        version: 1,
        cases: [
          trajectoryCase({
            turns: [{ repeatPrevious: true, suffix: ' Synthetic suffix.' }],
          }),
        ],
      },
      'trajectory_repeat_unavailable',
    ],
    [
      { version: 1, cases: [trajectoryCase({ assessmentTurns: [2] })] },
      'trajectory_case_assessment_turns_invalid',
    ],
    ...[[], [1, 1], [0], [true], [1.5], ['1']].map((assessmentTurns) => [
      { version: 1, cases: [trajectoryCase({ assessmentTurns })] },
      'trajectory_case_assessment_turns_invalid',
    ]),
    ...[null, false, 7].map((message) => [
      {
        version: 1,
        cases: [
          trajectoryCase({
            turns: [
              { message: 'Synthetic question one' },
              { message, repeatPrevious: true, suffix: '' },
            ],
          }),
        ],
      },
      'trajectory_turn_invalid',
    ]),
    [
      {
        version: 1,
        cases: [
          trajectoryCase({
            turns: [
              { message: 'Synthetic question one', repeatPrevious: true },
            ],
          }),
        ],
      },
      'trajectory_turn_invalid',
    ],
  ]) {
    assert.throws(() => validateTrajectoryCorpus(corpus), { code })
  }
})

test('corpus normalization preserves authored text without mutating input', () => {
  const corpus = {
    version: 1,
    cases: [
      trajectoryCase({
        id: ' exact-id ',
        assessmentTurns: [2, 1],
        turns: [
          { message: ' Exact question.\n' },
          { repeatPrevious: true, suffix: '' },
        ],
      }),
    ],
  }
  const original = structuredClone(corpus)
  const [normalized] = validateTrajectoryCorpus(corpus).cases
  assert.deepEqual(normalized.assessmentTurns, [1, 2])
  assert.equal(normalized.id, original.cases[0].id)
  assert.deepEqual(normalized.turns, original.cases[0].turns)
  assert.deepEqual(corpus, original)
})

test('trajectory accepts a pause without fresh retrieval after a grounded first turn', async () => {
  const originalFetch = globalThis.fetch
  const app = syntheticChatFetch({
    turnConfig: ({ turn }) =>
      turn === 1
        ? {}
        : {
            omitTool: true,
            stream: [
              { type: 'start' },
              { type: 'text-delta', delta: 'Synthetic answer 2.' },
              { type: 'finish', messageMetadata: { creditsUsed: 0.25 } },
            ],
          },
  })
  globalThis.fetch = app.fetchImpl
  try {
    const result = await runTrajectory(
      createTrajectoryTarget(),
      trajectoryCase({
        turns: [{ message: 'Synthetic question' }, { message: 'Pause' }],
      })
    )
    assert.equal(result.receipts.length, 2)
    assert.equal(result.receipts[1].toolName, null)
    assert.equal(result.receipts[1].toolStatus, 'not_called')
    assert.deepEqual(result.receipts[1].sources, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('trajectory rejects disagreement in accounting or retrieval call identity', async () => {
  const originalFetch = globalThis.fetch
  for (const [streamId, streamCredits, code] of [
    ['tool-1', 0, 'credits_mismatch'],
    ['different-call', 0.25, 'trajectory_tool_identity_mismatch'],
  ]) {
    globalThis.fetch = syntheticChatFetch({
      turnConfig: () => ({
        stream: [
          { type: 'start' },
          {
            type: 'tool-input-start',
            toolCallId: streamId,
            toolName: EXPECTED_DOC_QUERY_TOOL,
          },
          { type: 'tool-output-available', toolCallId: streamId, output: {} },
          { type: 'text-delta', delta: 'Synthetic answer 1.' },
          { type: 'finish', messageMetadata: { creditsUsed: streamCredits } },
        ],
      }),
    }).fetchImpl
    try {
      await assert.rejects(
        runTrajectory(createTrajectoryTarget(), trajectoryCase()),
        { code }
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  }
})
