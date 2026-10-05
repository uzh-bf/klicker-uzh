import { strict as assert } from 'node:assert'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'

import { KlickerEvaluationTarget } from '../scripts/klicker-evaluation-target.mjs'
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
  EXPECTED_DOC_QUERY_TOOL,
  runTrajectory,
  validateTrajectoryCorpus,
} from '../scripts/tutor-trajectory.mjs'

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

const SYNTHETIC_MODEL = 'gpt-5.6-luna'

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
  'repeat',
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

function budgetLedger(overrides = {}) {
  return {
    version: 1,
    maxSubmittedTurns: 160,
    maxApplicationCredits: 3,
    submittedTurns: 0,
    creditsUsed: 0,
    uncertain: false,
    ...overrides,
  }
}

function trajectoryEnv(overrides = {}) {
  return {
    KLICKER_EVAL_API_ORIGIN: 'https://api.klicker.localhost',
    KLICKER_EVAL_CHAT_ORIGIN: 'https://chat.klicker.localhost',
    KLICKER_EVAL_MODEL_ID: SYNTHETIC_MODEL,
    KLICKER_EVAL_PARTICIPANT_USERNAME: 'synthetic-participant',
    KLICKER_EVAL_PARTICIPANT_PASSWORD: 'synthetic-password',
    KLICKER_EVAL_POLL_INTERVAL_MS: '1',
    KLICKER_EVAL_POLL_TIMEOUT_MS: '1000',
    KLICKER_EVAL_REQUEST_TIMEOUT_MS: '1000',
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
                          reference: 'synthetic-source-ref',
                          title: 'Synthetic source title',
                          excerpt: 'private excerpt',
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
    modelId: SYNTHETIC_MODEL,
    apiKey: 'target-key',
    participantUsername: 'synthetic-participant',
    participantPassword: 'synthetic-password',
    pollTimeoutMs: 1000,
    pollIntervalMs: 1,
    requestTimeoutMs: 1000,
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
    assert.deepEqual(receipts[0].sources, [
      { ref: 'synthetic-source-ref', title: 'Synthetic source title' },
    ])
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
      { version: 1, cases: [trajectoryCase({ mode: 'explainer' })] },
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
        env: trajectoryEnv(),
        log: () => {},
      }),
      { code: 'group_selection_empty' }
    )

    await writeFile(
      corpusPath,
      JSON.stringify({ version: 2, cases: [trajectoryCase()] })
    )
    await assert.rejects(
      runTutorTrajectories({ argv, env: trajectoryEnv(), log: () => {} }),
      { code: 'corpus_version_unsupported' }
    )

    await writeFile(
      corpusPath,
      JSON.stringify({ version: 1, cases: [trajectoryCase()] })
    )
    for (const [ledger, code] of [
      [budgetLedger({ submittedTurns: 160 }), 'budget_turns_exhausted'],
      [budgetLedger({ creditsUsed: 3 }), 'budget_credits_exhausted'],
      [budgetLedger({ uncertain: true }), 'budget_uncertain'],
      [budgetLedger({ version: 2 }), 'budget_invalid'],
      [budgetLedger({ creditsUsed: -1 }), 'budget_invalid'],
      [budgetLedger({ unplanned: true }), 'budget_invalid'],
    ]) {
      await writeFile(budgetPath, JSON.stringify(ledger))
      await assert.rejects(
        runTutorTrajectories({ argv, env: trajectoryEnv(), log: () => {} }),
        { code }
      )
    }

    assert.equal(fetchCalls, 0)
    await assert.rejects(readFile(outputPath, 'utf8'), { code: 'ENOENT' })
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})

// Runner scenarios share one lifecycle: a scratch directory with corpus,
// budget and output paths, a scripted fetch replacement, cleanup, and JSONL
// receipt reads. Each scenario keeps its own inputs and assertions.
async function withRunnerScenario(
  { cases, budget = null, arm = 'baseline', fetchImpl },
  body
) {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-tutor-run-'))
  const paths = {
    corpus: join(directory, 'corpus.json'),
    budget: join(directory, 'budget.json'),
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
  globalThis.fetch = fetchImpl
  try {
    await writeFile(paths.corpus, JSON.stringify({ version: 1, cases }))
    if (budget !== null) {
      await writeFile(paths.budget, JSON.stringify(budget))
    }
    await body({
      argv: argvFor(),
      argvFor,
      env: trajectoryEnv(),
      paths,
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
      // The planned canary warmup already counted one submitted turn.
      budget: budgetLedger({ submittedTurns: 1, creditsUsed: 0.25 }),
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
      assert.equal(summary.submittedTurns, 3)
      assert.equal(summary.creditsUsed, 1.25)
      assert.equal(summary.uncertain, false)
      assert.equal(summary.model, 'gpt-5.6-luna')
      assert.deepEqual(
        JSON.parse(await readFile(paths.budget, 'utf8')),
        budgetLedger({ submittedTurns: 3, creditsUsed: 1.25 })
      )

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
            !line.includes('Synthetic answer')
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
      assert.equal(summary.completedTurns, 1)
      assert.equal(summary.runSubmittedTurns, 1)
      assert.equal(summary.uncertain, true)
      assert.deepEqual(
        JSON.parse(await readFile(paths.budget, 'utf8')),
        budgetLedger({ submittedTurns: 1, uncertain: true })
      )

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['turn', 'error', 'summary']
      )
      assert.equal(lines[1].code, 'credits_unaccounted')
      assert.equal(lines[1].turn, 1)
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

test('runner lets the crossing request finish and then stops at the credit ceiling', async () => {
  const app = syntheticChatFetch({
    turnConfig: () => ({ creditsUsed: 0.5 }),
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
      budget: budgetLedger({ creditsUsed: 2.9 }),
    },
    async ({ argv, env, paths, readReceipts }) => {
      const summary = await runTutorTrajectories({
        argv,
        env,
        log: () => {},
      })

      assert.equal(summary.status, 'stopped')
      assert.equal(summary.stopCode, 'budget_credits_exhausted')
      assert.equal(summary.completedTurns, 1)
      assert.equal(summary.runSubmittedTurns, 1)
      assert.equal(summary.creditsUsed, 3.4)

      const lines = await readReceipts()
      assert.deepEqual(
        lines.map((line) => line.type),
        ['turn', 'error', 'summary']
      )
      assert.deepEqual(
        JSON.parse(await readFile(paths.budget, 'utf8')),
        budgetLedger({ submittedTurns: 1, creditsUsed: 3.4 })
      )
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
      assert.deepEqual(
        JSON.parse(await readFile(paths.budget, 'utf8')),
        budgetLedger({ submittedTurns: 1, uncertain: true })
      )

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
