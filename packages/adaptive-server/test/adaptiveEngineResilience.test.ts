import { once } from 'node:events'
import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ADAPTIVE_VALIDATION_CACHE_MAX_ENTRIES,
  ADAPTIVE_VALIDATION_CACHE_TTL_MS,
  adaptiveValidationCacheSize,
  clearAdaptiveValidationCache,
  validateAdaptiveRuntimeOnce,
} from '../src/services/adaptiveEngineValidationCache.js'
import {
  advanceLoadedAdaptiveRuntime,
  prepareLoadedAdaptiveEstimator,
} from '../src/services/adaptivePracticeQuizEstimatorVersions.js'

const token = 'synthetic-host-adaptive-token-0000000000'
const estimate = {
  theta: 0,
  standardError: 1,
  responseCount: 0,
  levelId: null,
  stopReason: null,
}

type FakeReply = { status: number; body: unknown }
type FakeEngine = {
  server: Server
  calls: Record<'validate' | 'decide', number>
  replies: Record<'validate' | 'decide', FakeReply[]>
}

const okValidation: FakeReply = {
  status: 200,
  body: { contractVersion: 1, measurementVersion: 'IRT_V1', valid: true },
}
const okDecision: FakeReply = {
  status: 200,
  body: {
    contractVersion: 1,
    measurementVersion: 'IRT_V1',
    nextPoolItemId: 1,
    stopReason: null,
    estimates: {
      overall: { ...estimate, nodeKind: 'OVERALL', nodeId: null },
      nodes: [
        { ...estimate, nodeKind: 'COMPETENCE', nodeId: 1 },
        { ...estimate, nodeKind: 'SUBCOMPETENCE', nodeId: 2 },
      ],
    },
  },
}
// The reference engine's answer when all calculation workers are busy.
const busy: FakeReply = {
  status: 503,
  body: { code: 'ADAPTIVE_ENGINE_COMPUTATION_FAILED' },
}
const invalid: FakeReply = {
  status: 400,
  body: { code: 'ADAPTIVE_ENGINE_INVALID_REQUEST' },
}

let engine: FakeEngine

beforeEach(async () => {
  clearAdaptiveValidationCache()
  const calls = { validate: 0, decide: 0 }
  const replies: FakeEngine['replies'] = { validate: [], decide: [] }
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Drain the request body.
    }
    const operation = request.url?.endsWith('/validate') ? 'validate' : 'decide'
    const queue = replies[operation]
    calls[operation]++
    const reply =
      queue.length > 1
        ? queue.shift()!
        : (queue[0] ?? (operation === 'validate' ? okValidation : okDecision))
    response.statusCode = reply.status
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(reply.body))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing test listener')
  vi.stubEnv('ADAPTIVE_ENGINE_URL', `http://127.0.0.1:${address.port}`)
  vi.stubEnv('ADAPTIVE_ENGINE_TOKEN', token)
  vi.stubEnv('ADAPTIVE_ENGINE_REVISION', 'engine-a')
  engine = { server, calls, replies }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await new Promise<void>((resolve, reject) =>
    engine.server.close((error) => (error ? reject(error) : resolve()))
  )
})

function runtimeInput(difficulty = 0) {
  return {
    measurementVersion: 'IRT_V1' as const,
    nodes: [
      {
        id: 1,
        parentId: null,
        kind: 'COMPETENCE' as const,
        depth: 1,
        order: 0,
        enabled: true,
        weight: 1,
        questionCap: null,
      },
      {
        id: 2,
        parentId: 1,
        kind: 'SUBCOMPETENCE' as const,
        depth: 2,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
    ],
    levels: [
      { id: 1, label: 'A', order: 0 },
      { id: 2, label: 'B', order: 1 },
    ],
    pool: [
      {
        id: 1,
        leafNodeId: 2,
        nodePath: [1, 2],
        levelId: 1,
        discrimination: 1.2,
        difficulty,
        guessing: 0.25,
        sourceAssignmentId: 1,
        elementId: 1,
        elementVersion: 1,
        elementType: 'SC' as const,
        elementName: 'Synthetic item',
        nodeNamePath: ['Competence', 'Subcompetence'],
        levelLabel: 'A',
        levelOrder: 0,
        enablePercentInput: false,
      },
    ],
    settings: {
      totalQuestionCap: 10,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.96,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST' as const,
      thetaRange: { min: -3, max: 3 },
    },
  }
}

it('validates a published bank once and revalidates on republish or engine upgrade', async () => {
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  expect(engine.calls.validate).toBe(1)

  // A new publication, a changed snapshot or a new engine build revalidates.
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p2' })
  await prepareLoadedAdaptiveEstimator(runtimeInput(0.5), {
    publicationId: 'p1',
  })
  vi.stubEnv('ADAPTIVE_ENGINE_REVISION', 'engine-b')
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  expect(engine.calls.validate).toBe(4)
})

it('shares one validation across a burst of cold starts', async () => {
  await Promise.all(
    Array.from({ length: 8 }, () =>
      prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
    )
  )
  expect(engine.calls.validate).toBe(1)
})

it('never caches a failed validation', async () => {
  engine.replies.validate.push(invalid, okValidation)
  await expect(
    prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  ).rejects.toMatchObject({
    extensions: { code: 'ADAPTIVE_ENGINE_UNAVAILABLE' },
  })
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  await prepareLoadedAdaptiveEstimator(runtimeInput(), { publicationId: 'p1' })
  // The 400 is not retried; the next call validates again and is cached.
  expect(engine.calls.validate).toBe(2)
})

it('rides out short engine overload on validation and decisions', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  engine.replies.validate.push(busy, okValidation)
  engine.replies.decide.push(busy, busy, okDecision)
  const runtime = await prepareLoadedAdaptiveEstimator(runtimeInput(), {
    publicationId: 'p1',
  })
  const decision = await advanceLoadedAdaptiveRuntime({
    attemptId: '11111111-1111-4111-8111-111111111111',
    runtime,
    responses: [],
  })
  expect(decision.decision.nextPoolItem?.id).toBe(1)
  expect(engine.calls).toEqual({ validate: 2, decide: 3 })
  const retries = info.mock.calls
    .map(([line]) => JSON.parse(String(line)))
    .filter(({ event }) => event === 'adaptive_engine_retry')
  expect(retries).toEqual([
    {
      event: 'adaptive_engine_retry',
      operation: 'VALIDATE',
      outcome: 'RETRYING',
      reason: 'OVERLOADED',
      retryNumber: 1,
    },
    ...[1, 2].map((retryNumber) => ({
      event: 'adaptive_engine_retry',
      operation: 'DECIDE',
      outcome: 'RETRYING',
      reason: 'OVERLOADED',
      retryNumber,
    })),
  ])
  info.mockRestore()
})

it('reports sustained overload as ADAPTIVE_ENGINE_BUSY without internals', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  engine.replies.validate.push(busy)
  const failure = await prepareLoadedAdaptiveEstimator(runtimeInput(), {
    publicationId: 'p1',
  }).catch((error: unknown) => error)
  expect(failure).toMatchObject({
    message:
      'The adaptive calculation service is busy. Please try again in a moment.',
    extensions: { code: 'ADAPTIVE_ENGINE_BUSY' },
  })
  expect(JSON.stringify(failure)).not.toContain('COMPUTATION_FAILED')
  expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual(
    expect.arrayContaining([
      {
        event: 'adaptive_engine_retry',
        operation: 'VALIDATE',
        outcome: 'EXHAUSTED',
        reason: 'OVERLOADED',
      },
    ])
  )
  expect(engine.calls.validate).toBe(4)

  engine.replies.validate.splice(0, Infinity, okValidation)
  engine.replies.decide.push(busy)
  const runtime = await prepareLoadedAdaptiveEstimator(runtimeInput(), {
    publicationId: 'p1',
  })
  await expect(
    advanceLoadedAdaptiveRuntime({
      attemptId: '11111111-1111-4111-8111-111111111111',
      runtime,
      responses: [],
    })
  ).rejects.toMatchObject({ extensions: { code: 'ADAPTIVE_ENGINE_BUSY' } })
  expect(engine.calls.decide).toBe(4)
})

it('does not retry an engine validation error on decisions', async () => {
  engine.replies.decide.push(invalid)
  const runtime = await prepareLoadedAdaptiveEstimator(runtimeInput(), {
    publicationId: 'p1',
  })
  await expect(
    advanceLoadedAdaptiveRuntime({
      attemptId: '11111111-1111-4111-8111-111111111111',
      runtime,
      responses: [],
    })
  ).rejects.toMatchObject({
    extensions: { code: 'ADAPTIVE_ENGINE_UNAVAILABLE' },
  })
  expect(engine.calls.decide).toBe(1)
})

it('expires validations after the TTL and bounds the cache size', async () => {
  let now = 0
  const validate = vi.fn(async () => undefined)
  await validateAdaptiveRuntimeOnce('k', validate, () => now)
  now = ADAPTIVE_VALIDATION_CACHE_TTL_MS - 1
  await validateAdaptiveRuntimeOnce('k', validate, () => now)
  expect(validate).toHaveBeenCalledTimes(1)
  now = ADAPTIVE_VALIDATION_CACHE_TTL_MS + 1
  await validateAdaptiveRuntimeOnce('k', validate, () => now)
  expect(validate).toHaveBeenCalledTimes(2)

  for (
    let index = 0;
    index < ADAPTIVE_VALIDATION_CACHE_MAX_ENTRIES + 10;
    index++
  )
    await validateAdaptiveRuntimeOnce(`key-${index}`, validate, () => now)
  expect(adaptiveValidationCacheSize()).toBe(
    ADAPTIVE_VALIDATION_CACHE_MAX_ENTRIES
  )
  // The least recently used entries were evicted first.
  validate.mockClear()
  await validateAdaptiveRuntimeOnce('key-0', validate, () => now)
  expect(validate).toHaveBeenCalledTimes(1)
})
