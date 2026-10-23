import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { createAdaptiveClient } from '@klicker-uzh/adaptive-client'
import {
  remapAdaptiveSeedEstimates,
  simulateAdaptiveSeedAttempt,
} from '../src/seed/simulateAdaptiveSeedAttempt.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.endsWith('.ts') &&
      specifier.startsWith('./') &&
      specifier.endsWith('.js')
    )
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
    return nextResolve(specifier, context)
  },
})

const { createAdaptiveSeed } = await import(
  '../src/seed/seedAdaptiveLearning.ts'
)

const token = 'synthetic-seed-engine-token-000000000000'
const received = []
const engineConfigured = Boolean(
  process.env.ADAPTIVE_ENGINE_URL && process.env.ADAPTIVE_ENGINE_TOKEN
)
const { buildAdaptiveSeedRuntime } = createAdaptiveSeed({
  COURSE_ID_TEST: 'course-test',
  COURSE_ID_TEST2: 'course-test-2',
  USER_ID_TEST: 'user-test',
  prepareQuestion: () => {
    throw new Error('The runtime builder must not prepare database elements.')
  },
})
const runtime = buildAdaptiveSeedRuntime()

function estimates(responseCount) {
  const estimate = (nodeKind, nodeId) => ({
    nodeKind,
    nodeId,
    theta: responseCount - 1,
    standardError: 1,
    responseCount,
    levelId: responseCount === 3 ? 2 : null,
    stopReason: responseCount === 3 ? 'TOTAL_QUESTION_CAP' : null,
  })
  return {
    overall: estimate('OVERALL', null),
    nodes: runtime.nodes.map(({ kind, id }) => estimate(kind, id)),
  }
}

test('precomputes synthetic evidence through numeric-only V1 service requests', async () => {
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const raw = Buffer.concat(chunks).toString('utf8')
    received.push({
      url: request.url,
      raw,
      authorization: request.headers.authorization,
    })
    const body = JSON.parse(raw)
    const responseCount = body.responses.length
    response.setHeader('content-type', 'application/json')
    if (request.url === '/adaptive/v1/estimates') {
      response.end(
        JSON.stringify({
          contractVersion: 1,
          measurementVersion: 'IRT_V1',
          estimates: estimates(responseCount),
        })
      )
      return
    }
    const nextPoolItemIds = [1, 7, 9]
    response.end(
      JSON.stringify({
        contractVersion: 1,
        measurementVersion: 'IRT_V1',
        nextPoolItemId: nextPoolItemIds[responseCount] ?? null,
        stopReason: responseCount === 3 ? 'TOTAL_QUESTION_CAP' : null,
        estimates: estimates(responseCount),
      })
    )
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing test listener')
  try {
    const client = createAdaptiveClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      token,
    })
    const results = []
    for (const participantIndex of [0, 1, 2, 2]) {
      results.push(
        await simulateAdaptiveSeedAttempt({
          attemptId: 'ad000000-0000-4000-8000-000000000003',
          participantIndex,
          runtime,
          client,
        })
      )
    }
    const [low, middle, high, repeatHigh] = results
    assert.equal(low.stopReason, 'TOTAL_QUESTION_CAP')
    assert.equal(high.history.length, 3)
    assert.deepEqual(Object.keys(runtime.settings).sort(), [
      'classificationZ',
      'levelMappingRule',
      'minQuestionsPerLeaf',
      'perLeafQuestionCap',
      'thetaRange',
      'topInformationRatio',
      'totalQuestionCap',
    ])
    assert.deepEqual(
      low.history.map(({ correct }) => correct),
      [false, false, false]
    )
    assert.deepEqual(
      middle.history.map(({ correct }) => correct),
      [true, true, false]
    )
    assert.deepEqual(
      high.history.map(({ correct }) => correct),
      [true, true, true]
    )
    assert.deepEqual(high.history[1].answer, { value: '20' })
    assert.deepEqual(high.history[2].answer, { value: 'because' })
    assert.equal(high.estimates.overall.responseCount, 3)
    assert.equal(high.estimates.nodes.get(2).responseCount, 3)
    assert.deepEqual(high, repeatHigh)
    assert.ok(received.some(({ url }) => url === '/adaptive/v1/estimates'))
    for (const request of received) {
      assert.equal(request.authorization, `Bearer ${token}`)
      assert.doesNotMatch(request.raw, /PRIVATE_|content|solution|participant/i)
      const body = JSON.parse(request.raw)
      assert.deepEqual(Object.keys(body.pool[0]).sort(), [
        'difficulty',
        'discrimination',
        'guessing',
        'id',
        'leafNodeId',
        'levelId',
        'nodePath',
      ])
      assert.match(body.levels[0].label, /^level-/)
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})

test('remaps every engine node and level ID to persisted IDs', () => {
  const estimate = ({ nodeKind, nodeId, levelId }) => ({
    nodeKind,
    nodeId,
    theta: 0,
    standardError: 1,
    responseCount: 3,
    levelId,
    stopReason: 'TOTAL_QUESTION_CAP',
  })
  const remapped = remapAdaptiveSeedEstimates({
    estimates: {
      overall: estimate({
        nodeKind: 'OVERALL',
        nodeId: null,
        levelId: 2,
      }),
      nodes: new Map([
        [1, estimate({ nodeKind: 'COMPETENCE', nodeId: 1, levelId: 1 })],
        [7, estimate({ nodeKind: 'SUBCOMPETENCE', nodeId: 7, levelId: 2 })],
      ]),
    },
    persistedNodeIdBySeedId: new Map([
      [1, 101],
      [7, 707],
    ]),
    persistedLevelIdBySeedId: new Map([
      [1, 1001],
      [2, 1002],
    ]),
  })
  assert.deepEqual(remapped.overall, {
    ...estimate({ nodeKind: 'OVERALL', nodeId: null, levelId: 2 }),
    levelId: 1002,
  })
  assert.deepEqual(remapped.nodes, [
    {
      ...estimate({ nodeKind: 'COMPETENCE', nodeId: 1, levelId: 1 }),
      nodeId: 101,
      levelId: 1001,
    },
    {
      ...estimate({ nodeKind: 'SUBCOMPETENCE', nodeId: 7, levelId: 2 }),
      nodeId: 707,
      levelId: 1002,
    },
  ])
})

test('real engine produces deterministic, divergent synthetic V1 evidence', {
  skip: !engineConfigured,
}, async () => {
  const client = createAdaptiveClient({
    baseUrl: process.env.ADAPTIVE_ENGINE_URL,
    token: process.env.ADAPTIVE_ENGINE_TOKEN,
  })
  const profiles = []
  for (const participantIndex of [0, 1, 2]) {
    profiles.push(
      await simulateAdaptiveSeedAttempt({
        attemptId: `ad000000-0000-4000-8000-${String(participantIndex + 1).padStart(12, '0')}`,
        participantIndex,
        runtime,
        client,
      })
    )
  }
  const repeatHigh = await simulateAdaptiveSeedAttempt({
    attemptId: 'ad000000-0000-4000-8000-000000000003',
    participantIndex: 2,
    runtime,
    client,
  })
  const [low, middle, high] = profiles
  assert.ok(
    low.history.length > 0 &&
      low.history.length <= runtime.settings.totalQuestionCap
  )
  assert.equal(low.estimates.overall.responseCount, low.history.length)
  assert.equal(middle.estimates.overall.responseCount, middle.history.length)
  assert.equal(high.estimates.overall.responseCount, high.history.length)
  assert.ok(low.estimates.overall.theta < high.estimates.overall.theta)
  assert.deepEqual(high, repeatHigh)
})
