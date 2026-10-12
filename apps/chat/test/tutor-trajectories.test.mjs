import { strict as assert } from 'node:assert'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import {
  acquireBudgetLock,
  fingerprint,
  initializeBudget,
  MAX_PROVIDER_MICRO_USD,
  MAX_SUBMITTED_TURNS,
  readBudgetLedger,
  reserveProviderSpend,
} from '../scripts/evaluation-budget.mjs'
import { requestReservation } from '../scripts/evaluation-spend-guard.mjs'
import {
  DEFAULT_CHATBOT_ID,
  KlickerEvaluationTarget,
} from '../scripts/klicker-evaluation-target.mjs'
import {
  parseArguments,
  runTutorTrajectories,
} from '../scripts/run-tutor-trajectories.mjs'
import {
  calculateTutorReference,
  compareTutorNumericClaim,
  validateNumericSidecar,
} from '../scripts/tutor-numeric-reference.mjs'
import {
  buildSourceReceipt,
  EXPECTED_DOC_QUERY_TOOL,
  runTrajectory,
  validateTrajectoryCorpus,
} from '../scripts/tutor-trajectory.mjs'
import { withModelCitationIndices } from '../src/lib/server/citationInstructions'

test('numerical references use annual compounding and decimal returns', () => {
  assert.ok(
    Math.abs(
      calculateTutorReference('presentValue', {
        amount: 1210,
        rate: 0.1,
        years: 2,
      }) - 1000
    ) < 1e-10
  )
  assert.equal(
    calculateTutorReference('futureValue', {
      amount: 100,
      rate: 0.05,
      years: 1,
    }),
    105
  )
  assert.equal(
    calculateTutorReference('presentValue', {
      amount: -100,
      rate: 0,
      years: 0,
    }),
    -100
  )
  assert.ok(
    Math.abs(
      calculateTutorReference('capm', {
        riskFreeRate: 0.02,
        beta: 1.5,
        marketReturn: 0.06,
      }) - 0.08
    ) < 1e-12
  )
})

test('coupon bond cash-flow sum agrees with an independent annuity formula', () => {
  for (const yieldRate of [0, 0.04, -0.02]) {
    const years = 3
    const faceValue = 1000
    const couponRate = 0.05
    const discount = (1 + yieldRate) ** -years
    const annuity = yieldRate === 0 ? years : (1 - discount) / yieldRate
    const closedForm = faceValue * (couponRate * annuity + discount)
    const actual = calculateTutorReference('couponBond', {
      faceValue,
      couponRate,
      yieldRate,
      years,
    })
    assert.ok(Math.abs(actual - closedForm) < 1e-9)
  }
})

test('numerical comparison separates missing evidence, rounding and errors', () => {
  const reference = {
    formula: 'couponBond',
    inputs: { faceValue: 1000, couponRate: 0.05, yieldRate: 0.04, years: 3 },
    tolerance: 0.01,
  }
  assert.equal(
    compareTutorNumericClaim({ ...reference, claim: 1027.75 }).status,
    'pass'
  )
  assert.equal(
    compareTutorNumericClaim({ ...reference, claim: 1020 }).status,
    'fail'
  )
  assert.equal(
    compareTutorNumericClaim({ ...reference, claim: null }).status,
    'unassessed'
  )
  assert.equal(compareTutorNumericClaim(reference).status, 'unassessed')
  for (const claim of [NaN, Infinity, '1027.75']) {
    assert.throws(() => compareTutorNumericClaim({ ...reference, claim }))
  }
  for (const tolerance of [-1, NaN, Infinity]) {
    assert.throws(() =>
      compareTutorNumericClaim({ ...reference, tolerance, claim: 1027.75 })
    )
  }
})

test('numerical references reject unsupported or ambiguous inputs', () => {
  const valid = { amount: 100, rate: 0.05, years: 2 }
  for (const inputs of [
    null,
    { ...valid, rate: -1 },
    { ...valid, amount: Infinity },
    { ...valid, years: 1.5 },
    { ...valid, years: -1 },
    { ...valid, years: 1001 },
    { ...valid, frequency: 2 },
    { ...valid, amount: 1e308, rate: 10 },
  ]) {
    assert.throws(() => calculateTutorReference('futureValue', inputs))
  }
  assert.throws(() => calculateTutorReference('unknown', valid))
  assert.throws(() =>
    calculateTutorReference('couponBond', {
      faceValue: 1000,
      couponRate: 0.05,
      yieldRate: 0.04,
      years: 0,
    })
  )
})

test('numerical sidecar obligations must reference corpus assessment turns', async () => {
  const dataDirectory = new URL(
    '../../../evaluation/data/trajectories/',
    import.meta.url
  )
  const corpus = validateTrajectoryCorpus(
    JSON.parse(
      await readFile(new URL('tutor-attribution-v2.json', dataDirectory))
    )
  )
  const sidecar = JSON.parse(
    await readFile(new URL('tutor-attribution-v2-numeric.json', dataDirectory))
  )
  const obligations = validateNumericSidecar(sidecar, corpus)
  assert.equal(obligations.length, sidecar.assessments.length)
  assert.ok(obligations.every((entry) => Number.isFinite(entry.expected)))

  const [first] = sidecar.assessments
  for (const mismatch of [
    { ...first, caseId: 'missing-case' },
    { ...first, turn: 99 },
    { ...first, unit: 'EUR' },
    { ...first, claim: 1 },
  ]) {
    assert.throws(() =>
      validateNumericSidecar({ version: 1, assessments: [mismatch] }, corpus)
    )
  }
})

// Pinned so the mock and the target agree even when the application default
// model changes; the target is always constructed with this id explicitly.
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

// Operator-qualified pricing policy and canonical upstream base for the
// synthetic guard placement. The provider base and prices are fixed test
// inputs, never a copied tariff.
const SYNTHETIC_UPSTREAM = 'https://synthetic.example/v1'
const SYNTHETIC_POLICY = {
  version: 1,
  provider: 'synthetic',
  qualification: 'synthetic-guard',
  upstreamOrigin: SYNTHETIC_UPSTREAM,
  models: {
    [SYNTHETIC_MODEL]: {
      contextTokens: 1_000,
      maxOutputTokens: 100,
      inputMicroUsdPerMillion: 1_000_000,
      outputMicroUsdPerMillion: 2_000_000,
      outputIncludesReasoning: true,
    },
  },
}
const SYNTHETIC_POLICY_HASH = fingerprint(SYNTHETIC_POLICY)
// The guard reserves the full qualified input context plus the output ceiling
// before dispatch; the synthetic application issues one such call per turn.
const SYNTHETIC_RESERVATION = requestReservation(
  SYNTHETIC_POLICY,
  '/v1/chat/completions',
  {
    model: SYNTHETIC_MODEL,
    messages: [{ role: 'user', content: 'synthetic' }],
    max_completion_tokens: 100,
  }
)
const GUARD_ORIGIN = 'http://127.0.0.1:9'
const GUARD_KEY = 'synthetic-guard-key'

// The version-2 ledger identity receipt covers the immutable fields only, so a
// test may patch mutable lifecycle state without breaking the identity check.
async function seedLedger(path, patch) {
  const ledger = JSON.parse(await readFile(path, 'utf8'))
  await writeFile(path, JSON.stringify({ ...ledger, ...patch }) + '\n')
}

function trajectoryEnv(overrides = {}) {
  return {
    KLICKER_EVAL_API_ORIGIN: 'https://api.klicker.localhost',
    KLICKER_EVAL_CHAT_ORIGIN: 'https://chat.klicker.localhost',
    KLICKER_EVAL_PARTICIPANT_USERNAME: 'synthetic-participant',
    KLICKER_EVAL_PARTICIPANT_PASSWORD: 'synthetic-password',
    KLICKER_EVAL_POLL_INTERVAL_MS: '1',
    KLICKER_EVAL_POLL_TIMEOUT_MS: '1000',
    KLICKER_EVAL_REQUEST_TIMEOUT_MS: '1000',
    KLICKER_EVAL_QUALIFICATION_FILE: '/tmp/unused-qualification.json',
    KLICKER_EVAL_GUARD_ORIGIN: GUARD_ORIGIN,
    KLICKER_EVAL_GUARD_KEY: GUARD_KEY,
    KLICKER_EVAL_UPSTREAM_ORIGIN: SYNTHETIC_UPSTREAM,
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
      maxSources: 12,
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
  const part = (toolCallId, result) => ({
    type: 'tool-call',
    toolCallId,
    toolName: EXPECTED_DOC_QUERY_TOOL,
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
      })
    ),
    part('call-c', {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            documents(
              ...Array.from({ length: 12 }, (_, index) => ({
                reference: 'urn:c' + index,
                title: 'Doc ' + index,
                chunks: [{ content: 'chunk ' + index, page_number: index + 1 }],
              }))
            )
          ),
        },
      ],
    }),
  ]

  const receipt = buildSourceReceipt(parts)
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

  const applicationEntries = []
  withModelCitationIndices(messages, steps).forEach((message, index) => {
    const payload = JSON.parse(message.content[0].output.value)
    payload.sources.forEach((source, position) => {
      applicationEntries.push({
        toolCallId: parts[index].toolCallId,
        sourcePosition: position + 1,
        citationIndex: Number.isInteger(source.citation_index)
          ? source.citation_index
          : null,
      })
    })
  })
  assert.deepEqual(
    receipt.sources.map(({ toolCallId, sourcePosition, citationIndex }) => ({
      toolCallId,
      sourcePosition,
      citationIndex,
    })),
    applicationEntries
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
  assert.equal(callC.length, 12)
  assert.deepEqual(
    callC.map((entry) => entry.citationIndex),
    [4, 5, 6, 7, 8, 9, 10, 11, 12, null, null, null]
  )
  assert.ok(
    callC
      .slice(9)
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

test('runner argument validation fails closed before any file or network use', () => {
  assert.equal(
    parseArguments([
      '--corpus',
      'a',
      '--output',
      'b',
      '--budget-file',
      'c',
      '--arm',
      'baseline',
    ]).repeats,
    2
  )
  assert.throws(() => parseArguments([]), { code: 'corpus_argument_missing' })
  assert.throws(
    () =>
      parseArguments([
        '--corpus',
        'a',
        '--output',
        'b',
        '--budget-file',
        'c',
        '--arm',
        'experimental',
      ]),
    { code: 'arm_invalid' }
  )
  assert.throws(
    () =>
      parseArguments([
        '--corpus',
        'a',
        '--output',
        'b',
        '--budget-file',
        'c',
        '--arm',
        'baseline',
        '--group',
        'pilot',
      ]),
    { code: 'group_invalid' }
  )
  assert.throws(
    () =>
      parseArguments([
        '--corpus',
        'a',
        '--output',
        'b',
        '--budget-file',
        'c',
        '--arm',
        'baseline',
        '--repeats',
        '0',
      ]),
    { code: 'repeats_invalid' }
  )
  assert.throws(() => parseArguments(['--unknown', 'value']), {
    code: 'arguments_invalid',
  })
  assert.throws(() => parseArguments(['--corpus', '--output']), {
    code: 'arguments_invalid',
  })
  assert.throws(
    () =>
      parseArguments([
        '--corpus',
        'a',
        '--corpus',
        'b',
        '--output',
        'c',
        '--budget-file',
        'd',
        '--arm',
        'baseline',
      ]),
    { code: 'arguments_invalid' }
  )
})

test('runner validates corpus and shared budget before any network effect', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-tutor-run-'))
  const corpusPath = join(directory, 'corpus.json')
  const budgetPath = join(directory, 'budget.json')
  const outputPath = join(directory, 'output.jsonl')
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('network use is not expected')
  }

  const env = trajectoryEnv({
    KLICKER_EVAL_QUALIFICATION_FILE: join(directory, 'qualification.json'),
  })
  const argv = [
    '--corpus',
    corpusPath,
    '--output',
    outputPath,
    '--arm',
    'baseline',
    '--budget-file',
    budgetPath,
  ]

  try {
    await writeFile(
      corpusPath,
      JSON.stringify({
        version: 1,
        cases: [trajectoryCase({ mode: 'quizzer' })],
      })
    )
    await assert.rejects(
      runTutorTrajectories({
        argv: [...argv, '--group', 'reserved'],
        env,
        log: () => {},
      }),
      { code: 'group_selection_empty' }
    )

    await writeFile(
      corpusPath,
      JSON.stringify({ version: 2, cases: [trajectoryCase()] })
    )
    await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
      code: 'corpus_version_unsupported',
    })

    await writeFile(
      corpusPath,
      JSON.stringify({ version: 1, cases: [trajectoryCase()] })
    )

    // Auto model routing has no qualified finite price and is refused before
    // the ledger or any transport is read.
    await assert.rejects(
      runTutorTrajectories({
        argv,
        env: { ...env, KLICKER_EVAL_MODEL_ID: 'auto' },
        log: () => {},
      }),
      { code: 'provider_model_unqualified' }
    )

    // A missing ledger fails closed.
    await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
      code: 'budget_missing',
    })

    // A legacy ledger fails with a migration code instead of becoming spend
    // evidence under the version-2 schema.
    await writeFile(
      budgetPath,
      JSON.stringify({
        version: 1,
        maxSubmittedTurns: 120,
        maxApplicationCredits: 3,
        submittedTurns: 0,
        creditsUsed: 0,
        uncertain: false,
      })
    )
    await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
      code: 'budget_version_unsupported',
    })

    // A malformed version-2 ledger is rejected before its identity is read.
    await writeFile(
      budgetPath,
      JSON.stringify({
        version: 2,
        experimentId: 'synthetic-experiment',
        policyHash: SYNTHETIC_POLICY_HASH,
        maxSubmittedTurns: 120,
        maxProviderMicroUsd: MAX_PROVIDER_MICRO_USD,
        submittedTurns: 0,
        reservedProviderMicroUsd: 0,
        creditsUsed: -1,
        uncertain: false,
        activeTurn: null,
      })
    )
    await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
      code: 'budget_invalid',
    })

    // An interrupted active turn, exhausted turns and exhausted spend all stop
    // the run before login while the ledger identity receipt stays intact.
    for (const [code, limits, patch] of [
      [
        'budget_uncertain',
        { maxSubmittedTurns: 1, maxProviderMicroUsd: MAX_PROVIDER_MICRO_USD },
        {
          submittedTurns: 1,
          uncertain: true,
          activeTurn: 'synthetic-interrupted-turn',
        },
      ],
      [
        'budget_turns_exhausted',
        { maxSubmittedTurns: 1, maxProviderMicroUsd: MAX_PROVIDER_MICRO_USD },
        { submittedTurns: 1 },
      ],
      [
        'budget_spend_exhausted',
        { maxSubmittedTurns: MAX_SUBMITTED_TURNS, maxProviderMicroUsd: 1000 },
        { reservedProviderMicroUsd: 1000 },
      ],
    ]) {
      await rm(budgetPath, { force: true })
      await rm(budgetPath + '.identity', { force: true })
      await initializeBudget(budgetPath, SYNTHETIC_POLICY_HASH, limits)
      await seedLedger(budgetPath, patch)
      await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
        code,
      })
    }

    assert.equal(fetchCalls, 0)
    await assert.rejects(readFile(outputPath, 'utf8'), { code: 'ENOENT' })
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})

// The synthetic application mirrors the production placement
// (application -> local guard -> qualified upstream). An authenticated status
// read reflects the durable ledger, and every model call reserves the full
// qualified cost from the guard before the fake chat result is produced.
function syntheticGuardFetch({
  app,
  budgetPath,
  policyHash = SYNTHETIC_POLICY_HASH,
  statusPolicyHash = policyHash,
}) {
  return async (url, options = {}) => {
    const requestUrl = String(url)
    if (requestUrl.startsWith(GUARD_ORIGIN)) {
      if (!requestUrl.endsWith('/status'))
        throw new Error('Unexpected guard request: ' + requestUrl)
      assert.equal(options.headers?.Authorization, 'Bearer ' + GUARD_KEY)
      const ledger = await readBudgetLedger(budgetPath)
      return Response.json({
        experimentId: ledger.experimentId,
        policyHash: statusPolicyHash,
        upstreamOrigin: SYNTHETIC_UPSTREAM,
        maxSubmittedTurns: ledger.maxSubmittedTurns,
        maxProviderMicroUsd: ledger.maxProviderMicroUsd,
        reservedProviderMicroUsd: ledger.reservedProviderMicroUsd,
      })
    }
    if (requestUrl.endsWith('/chat') && (options.method || 'GET') === 'POST') {
      try {
        await reserveProviderSpend(
          budgetPath,
          policyHash,
          SYNTHETIC_RESERVATION
        )
      } catch (error) {
        if (
          error?.code === 'budget_spend_exhausted' ||
          error?.code === 'budget_busy'
        ) {
          return new Response(JSON.stringify({ error: error.code }), {
            status: 429,
          })
        }
        throw error
      }
    }
    return app(url, options)
  }
}

// Runner scenarios share one lifecycle: a scratch directory with corpus,
// budget, qualification and output paths, a scripted fetch replacement,
// cleanup, and JSONL receipt reads. Each scenario keeps its own inputs and
// assertions.
async function withRunnerScenario(
  {
    cases,
    arm = 'baseline',
    fetchImpl,
    spendLimit = MAX_PROVIDER_MICRO_USD,
    turnsLimit = MAX_SUBMITTED_TURNS,
    policyHash = SYNTHETIC_POLICY_HASH,
    statusPolicyHash = policyHash,
    holdRunLock = false,
    qualificationOverrides = {},
  },
  body
) {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-tutor-run-'))
  const paths = {
    corpus: join(directory, 'corpus.json'),
    budget: join(directory, 'budget.json'),
    qualification: join(directory, 'qualification.json'),
    output: join(directory, 'output.jsonl'),
    secondOutput: join(directory, 'output-2.jsonl'),
  }
  const argvFor = (output = paths.output, runArm = arm) => [
    '--corpus',
    paths.corpus,
    '--output',
    output,
    '--arm',
    runArm,
    '--budget-file',
    paths.budget,
    '--repeats',
    '1',
  ]
  const readReceipts = async () =>
    (await readFile(paths.output, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

  const originalFetch = globalThis.fetch
  try {
    await writeFile(paths.corpus, JSON.stringify({ version: 1, cases }))
    const ledger = await initializeBudget(paths.budget, policyHash, {
      maxSubmittedTurns: turnsLimit,
      maxProviderMicroUsd: spendLimit,
    })
    await writeFile(
      paths.qualification,
      JSON.stringify({
        version: 1,
        experimentId: ledger.experimentId,
        policyHash,
        guardOrigin: GUARD_ORIGIN,
        chatOrigin: 'https://chat.klicker.localhost',
        upstreamOrigin: SYNTHETIC_UPSTREAM,
        chatbotId: DEFAULT_CHATBOT_ID,
        modelId: SYNTHETIC_MODEL,
        allBillableEgressGuarded: true,
        evidence: 'synthetic qualification evidence',
        ...qualificationOverrides,
      })
    )
    globalThis.fetch = syntheticGuardFetch({
      app: fetchImpl,
      budgetPath: paths.budget,
      policyHash,
      statusPolicyHash,
    })
    if (holdRunLock) await acquireBudgetLock(paths.budget, '.run')
    await body({
      argv: argvFor(),
      argvFor,
      env: trajectoryEnv({
        KLICKER_EVAL_QUALIFICATION_FILE: paths.qualification,
      }),
      paths,
      ledger,
      readReceipts,
    })
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
}

test('runner writes one verified receipt per turn and keeps the ledger honest', async () => {
  const progress = []
  const app = syntheticChatFetch({
    turnConfig: ({ turn }) => ({
      answerText: 'Synthetic answer ' + turn + '.',
      creditsUsed: 0.5,
    }),
  })
  await withRunnerScenario(
    {
      fetchImpl: app.fetchImpl,
      cases: [
        trajectoryCase({
          turns: [
            { message: 'Synthetic question one' },
            { repeatPrevious: true, suffix: ' Synthetic suffix.' },
          ],
        }),
      ],
    },
    async ({ argv, env, paths, readReceipts }) => {
      const summary = await runTutorTrajectories({
        argv,
        env,
        log: (line) => progress.push(line),
      })

      assert.equal(summary.status, 'completed')
      assert.equal(summary.stopCode, null)
      assert.equal(summary.completedTurns, 2)
      assert.equal(summary.runSubmittedTurns, 2)
      assert.equal(summary.submittedTurns, 2)
      assert.equal(summary.creditsUsed, 1)
      assert.equal(summary.reservedProviderMicroUsd, 2 * SYNTHETIC_RESERVATION)
      assert.equal(summary.uncertain, false)
      assert.equal(summary.model, SYNTHETIC_MODEL)

      const ledger = await readBudgetLedger(paths.budget)
      assert.equal(ledger.submittedTurns, 2)
      assert.equal(ledger.creditsUsed, 1)
      assert.equal(ledger.reservedProviderMicroUsd, 2 * SYNTHETIC_RESERVATION)
      assert.equal(ledger.uncertain, false)
      assert.equal(ledger.activeTurn, null)

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['turn', 'turn', 'summary']
      )
      assert.equal(lines[0].userText, 'Synthetic question one')
      assert.equal(lines[0].assistantText, 'Synthetic answer 1.')
      assert.equal(lines[0].repeat, 0)
      assert.equal(lines[1].userText, 'Synthetic answer 1. Synthetic suffix.')
      assert.equal(lines[1].assistantText, 'Synthetic answer 2.')
      assert.equal(lines[1].parentId, lines[0].assistantMessageId)
      assert.equal(lines[2].status, 'completed')
      assert.equal(JSON.stringify(lines).includes('private reasoning'), false)
      assert.equal(JSON.stringify(lines).includes('participant_token'), false)

      assert.equal(progress.length, 2)
      assert.equal(
        progress.every(
          (line) =>
            line.startsWith('klicker-tutor-trajectories ') &&
            !line.includes('Synthetic answer') &&
            line.includes('reservedMicroUsd=')
        ),
        true
      )

      await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
        code: 'output_exists',
      })
    }
  )
})

test('runner stops on unaccounted credits and refuses every later call', async () => {
  const app = syntheticChatFetch({
    turnConfig: () => ({ creditsAccounted: false }),
  })
  await withRunnerScenario(
    {
      fetchImpl: app.fetchImpl,
      arm: 'candidate',
      cases: [
        trajectoryCase({
          turns: [
            { message: 'Synthetic question one' },
            { message: 'Synthetic question two' },
          ],
        }),
      ],
    },
    async ({ argv, argvFor, env, paths, readReceipts }) => {
      const summary = await runTutorTrajectories({
        argv,
        env,
        log: () => {},
      })

      assert.equal(summary.status, 'stopped')
      assert.equal(summary.stopCode, 'credits_unaccounted')
      assert.equal(summary.completedTurns, 0)
      assert.equal(summary.runSubmittedTurns, 1)
      assert.equal(summary.uncertain, true)
      assert.equal(summary.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)

      const ledger = await readBudgetLedger(paths.budget)
      assert.equal(ledger.submittedTurns, 1)
      assert.equal(ledger.creditsUsed, 0)
      assert.equal(ledger.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)
      assert.equal(ledger.uncertain, true)
      assert.notEqual(ledger.activeTurn, null)

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['error', 'summary']
      )
      assert.equal(lines[0].code, 'credits_unaccounted')
      assert.equal(lines[0].turn, 1)
      assert.equal(JSON.stringify(lines).includes('errorText'), false)

      const callsBefore = app.calls.length
      await assert.rejects(
        runTutorTrajectories({
          argv: argvFor(paths.secondOutput, 'auto'),
          env,
          log: () => {},
        }),
        { code: 'budget_uncertain' }
      )
      assert.equal(app.calls.length, callsBefore)
      await assert.rejects(readFile(paths.secondOutput, 'utf8'), {
        code: 'ENOENT',
      })
    }
  )
})

test('runner refuses dispatch when the guard cannot reserve the remaining spend', async () => {
  const app = syntheticChatFetch({
    turnConfig: () => ({ creditsUsed: 5 }),
  })
  await withRunnerScenario(
    {
      fetchImpl: app.fetchImpl,
      cases: [
        trajectoryCase({
          turns: [
            { message: 'Synthetic question one' },
            { message: 'Synthetic question two' },
          ],
        }),
      ],
      // Room for one turn's reservation but not a second. Credits are recorded
      // only and never admit or refuse a model call.
      spendLimit: SYNTHETIC_RESERVATION + 100,
    },
    async ({ argv, env, paths, readReceipts }) => {
      const summary = await runTutorTrajectories({
        argv,
        env,
        log: () => {},
      })

      assert.equal(summary.status, 'stopped')
      assert.equal(summary.stopCode, 'chat_submit_http_429')
      assert.equal(summary.completedTurns, 1)
      assert.equal(summary.runSubmittedTurns, 2)
      assert.equal(summary.creditsUsed, 5)
      assert.equal(summary.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)

      // A refused reservation was never taken, so the ledger still holds only
      // the earlier admitted reservation and never exceeds the cap.
      const ledger = await readBudgetLedger(paths.budget)
      assert.equal(ledger.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)
      assert.ok(ledger.reservedProviderMicroUsd <= ledger.maxProviderMicroUsd)
      assert.equal(ledger.creditsUsed, 5)
      assert.equal(ledger.uncertain, true)
      assert.notEqual(ledger.activeTurn, null)

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['turn', 'error', 'summary']
      )
      assert.equal(lines[1].code, 'chat_submit_http_429')
      assert.equal(lines[1].turn, 2)
    }
  )
})

test('runner rejects overlapping corpus, output and budget paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-tutor-run-'))
  const sharedPath = join(directory, 'shared.json')
  const outputPath = join(directory, 'output.jsonl')
  const corpus = JSON.stringify({ version: 1, cases: [trajectoryCase()] })
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('network use is not expected')
  }

  const argvFor = (overrides) => [
    '--corpus',
    overrides.corpus,
    '--output',
    overrides.output,
    '--arm',
    'baseline',
    '--budget-file',
    overrides.budgetFile,
  ]

  try {
    await writeFile(sharedPath, corpus)
    for (const overrides of [
      { corpus: sharedPath, output: outputPath, budgetFile: sharedPath },
      { corpus: sharedPath, output: sharedPath, budgetFile: outputPath },
      {
        corpus: sharedPath,
        output: outputPath,
        budgetFile: join(directory, '.', 'shared.json'),
      },
    ]) {
      await assert.rejects(
        runTutorTrajectories({
          argv: argvFor(overrides),
          env: trajectoryEnv(),
          log: () => {},
        }),
        { code: 'paths_must_differ' }
      )
    }

    assert.equal(fetchCalls, 0)
    assert.equal(await readFile(sharedPath, 'utf8'), corpus)
    await assert.rejects(readFile(outputPath, 'utf8'), { code: 'ENOENT' })
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})

test('runner keeps a failed request uncertain so a restart cannot spend again', async () => {
  const app = syntheticChatFetch()
  await withRunnerScenario(
    {
      fetchImpl: async (url, options) => {
        if (String(url).endsWith('/chat')) {
          throw new Error('synthetic transport failure')
        }
        return app.fetchImpl(url, options)
      },
      cases: [trajectoryCase()],
    },
    async ({ argv, argvFor, env, paths, readReceipts }) => {
      const summary = await runTutorTrajectories({
        argv,
        env,
        log: () => {},
      })

      assert.equal(summary.status, 'stopped')
      assert.equal(summary.stopCode, 'request_failed')
      assert.equal(summary.completedTurns, 0)
      assert.equal(summary.runSubmittedTurns, 1)
      assert.equal(summary.uncertain, true)
      assert.equal(summary.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)

      // The failed turn keeps its reservation and stays uncertain so a restart
      // cannot spend again.
      const ledger = await readBudgetLedger(paths.budget)
      assert.equal(ledger.submittedTurns, 1)
      assert.equal(ledger.creditsUsed, 0)
      assert.equal(ledger.reservedProviderMicroUsd, SYNTHETIC_RESERVATION)
      assert.equal(ledger.uncertain, true)
      assert.notEqual(ledger.activeTurn, null)

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['error', 'summary']
      )
      assert.equal(lines[0].code, 'request_failed')

      const callsBefore = app.calls.length
      await assert.rejects(
        runTutorTrajectories({
          argv: argvFor(paths.secondOutput),
          env,
          log: () => {},
        }),
        { code: 'budget_uncertain' }
      )
      assert.equal(app.calls.length, callsBefore)
      await assert.rejects(readFile(paths.secondOutput, 'utf8'), {
        code: 'ENOENT',
      })
    }
  )
})

test('runner fails closed on a held run lease and a drifted guard policy before login', async () => {
  const heldApp = syntheticChatFetch()
  await withRunnerScenario(
    {
      fetchImpl: heldApp.fetchImpl,
      cases: [trajectoryCase()],
      holdRunLock: true,
    },
    async ({ argv, env }) => {
      await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
        code: 'budget_busy',
      })
      assert.equal(heldApp.calls.length, 0)
    }
  )

  // A guard bound to a different canonical pricing policy cannot qualify the
  // ledger, so the run stops before login.
  const driftApp = syntheticChatFetch()
  await withRunnerScenario(
    {
      fetchImpl: driftApp.fetchImpl,
      cases: [trajectoryCase()],
      statusPolicyHash: 'f'.repeat(64),
    },
    async ({ argv, env }) => {
      await assert.rejects(runTutorTrajectories({ argv, env, log: () => {} }), {
        code: 'guard_qualification_invalid',
      })
      assert.equal(driftApp.calls.length, 0)
    }
  )
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
