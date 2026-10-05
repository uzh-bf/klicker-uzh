import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AdaptiveEngineUnavailableError,
  type BankAnalysisRequest,
  createAdaptiveClient,
  type DecisionRequest,
  type DecisionResponse,
  decisionRequestSchema,
  type PosteriorBatchRequest,
  type ValidationRequest,
} from '../index.js'

const token = 'synthetic-adaptive-client-token-00000000'
const request: DecisionRequest = {
  contractVersion: 1,
  routingSeed: '11111111-1111-4111-8111-111111111111',
  measurementVersion: 'IRT_V1',
  nodes: [
    {
      id: 1,
      parentId: null,
      kind: 'COMPETENCE',
      depth: 1,
      order: 0,
      enabled: true,
      weight: 1,
      questionCap: null,
    },
    {
      id: 2,
      parentId: 1,
      kind: 'SUBCOMPETENCE',
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
      discrimination: 1,
      difficulty: 0,
      guessing: 0.25,
    },
  ],
  settings: {
    totalQuestionCap: 70,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 4,
    classificationZ: 1.96,
    topInformationRatio: 0.8,
    levelMappingRule: 'NEAREST',
    thetaRange: { min: -3, max: 3 },
  },
  responses: [],
}
const estimate = {
  theta: null,
  standardError: null,
  responseCount: 0,
  levelId: null,
  stopReason: null,
}
const result = {
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
}
const validationRequest: ValidationRequest = {
  contractVersion: request.contractVersion,
  measurementVersion: request.measurementVersion,
  nodes: request.nodes,
  responses: [],
  levels: request.levels,
  pool: request.pool,
  settings: request.settings,
}
const posteriorRequest: PosteriorBatchRequest = {
  contractVersion: 1,
  measurementVersion: 'IRT_V2_EAP_GRID_1',
  credibleMass: 0.8,
  scale: {
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -3,
    gridMax: 3,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    levels: [
      {
        id: 1,
        label: 'A',
        order: 0,
        lowerBound: null,
        upperBound: 0,
        itemDifficultyPrior: -1,
      },
      {
        id: 2,
        label: 'B',
        order: 1,
        lowerBound: 0,
        upperBound: null,
        itemDifficultyPrior: 1,
      },
    ],
  },
  subjects: [
    {
      localId: 0,
      responses: [
        {
          item: {
            id: 1,
            itemType: 'SC',
            choiceCount: 4,
            model: 'THREE_PL_FIXED_C',
            calibrationId: 'cal-1',
            a: 1.2,
            b: 0,
            c: 0.25,
          },
          correct: true,
        },
      ],
    },
  ],
}
const posteriorResult = {
  contractVersion: 1,
  measurementVersion: 'IRT_V2_EAP_GRID_1',
  subjects: [
    {
      localId: 0,
      responseCount: 1,
      mean: 0.2,
      variance: 0.5,
      standardDeviation: Math.sqrt(0.5),
      credibleLower: -1,
      credibleUpper: 1,
      bandProbabilities: [
        { levelId: 1, probability: 0.4 },
        { levelId: 2, probability: 0.6 },
      ],
    },
  ],
}
function client(fetch: typeof globalThis.fetch) {
  return createAdaptiveClient({ baseUrl: 'http://adaptive.test', token, fetch })
}
test('sends only the strict scored DTO with authentication and a deadline', async () => {
  const api = client(async (url, init) => {
    assert.equal(String(url), 'http://adaptive.test/adaptive/v1/decide')
    assert.equal(init?.redirect, 'error')
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      `Bearer ${token}`
    )
    assert.ok(init?.signal)
    assert.deepEqual(JSON.parse(String(init?.body)), request)
    return Response.json(result)
  })
  assert.deepEqual(await api.decide(request), result)
})
test('sends bounded posterior batches and rejects invalid subject membership or probabilities', async () => {
  const api = client(async (url, init) => {
    assert.equal(String(url), 'http://adaptive.test/adaptive/v1/posteriors')
    assert.deepEqual(JSON.parse(String(init?.body)), posteriorRequest)
    return Response.json(posteriorResult)
  })
  assert.deepEqual(await api.posteriors(posteriorRequest), posteriorResult)
  for (const invalid of [
    {
      ...posteriorResult,
      subjects: [{ ...posteriorResult.subjects[0], localId: 999 }],
    },
    {
      ...posteriorResult,
      subjects: [
        {
          ...posteriorResult.subjects[0],
          bandProbabilities: [
            { levelId: 1, probability: 0.2 },
            { levelId: 2, probability: 0.2 },
          ],
        },
      ],
    },
    {
      ...posteriorResult,
      subjects: [
        { ...posteriorResult.subjects[0], mean: Number.POSITIVE_INFINITY },
      ],
    },
  ])
    await assert.rejects(
      client(async () => Response.json(invalid)).posteriors(posteriorRequest),
      AdaptiveEngineUnavailableError
    )
  await assert.rejects(
    api.posteriors({
      ...posteriorRequest,
      subjects: [{ ...posteriorRequest.subjects[0], pseudonym: 'synthetic' }],
    } as unknown as PosteriorBatchRequest)
  )
})
test('validates a strict response-free runtime snapshot', async () => {
  const api = client(async (url, init) => {
    assert.equal(String(url), 'http://adaptive.test/adaptive/v1/validate')
    assert.deepEqual(JSON.parse(String(init?.body)), validationRequest)
    return Response.json({
      contractVersion: 1,
      measurementVersion: 'IRT_V1',
      valid: true,
    })
  })
  assert.deepEqual(await api.validate(validationRequest), {
    contractVersion: 1,
    measurementVersion: 'IRT_V1',
    valid: true,
  })
  await assert.rejects(
    api.validate({
      ...validationRequest,
      routingSeed: request.routingSeed,
    } as unknown as ValidationRequest)
  )
})
test('uses numeric-only bank analysis transport DTO', async () => {
  const bank: BankAnalysisRequest = {
    contractVersion: 1,
    items: [{ localId: 1, a: 1, b: 0, c: 0.2 }],
    banks: [{ localId: 2, itemLocalIds: [1] }],
    thetaPoints: [0],
  }
  const api = client(async () =>
    Response.json({
      contractVersion: 1,
      items: [{ localId: 1, informationAtDifficulty: 0.1 }],
      banks: [{ localId: 2, information: [0.1], maximumInformation: [0.1] }],
    })
  )
  assert.equal((await api.analyzeBank(bank)).banks[0]!.localId, 2)
  await assert.rejects(
    api.analyzeBank({
      ...bank,
      participantName: 'synthetic',
    } as unknown as BankAnalysisRequest)
  )
})
test('rejects extra identity or content fields before making a network call', async () => {
  let calls = 0
  const api = client(async () => {
    calls++
    return Response.json(result)
  })
  await assert.rejects(
    api.decide({ ...request, participantName: 'synthetic' } as DecisionRequest)
  )
  assert.equal(calls, 0)
})
test('fails closed for wrong estimator, unknown item, repeated item and inconsistent terminal state', async () => {
  for (const invalid of [
    { ...result, measurementVersion: 'UNKNOWN' },
    { ...result, nextPoolItemId: 999 },
    { ...result, nextPoolItemId: null },
    {
      ...result,
      estimates: {
        ...result.estimates,
        overall: { ...result.estimates.overall, theta: 'invalid' },
      },
    },
  ]) {
    await assert.rejects(
      client(async () => Response.json(invalid)).decide(request),
      AdaptiveEngineUnavailableError
    )
  }
  await assert.rejects(
    client(async () => Response.json(result)).decide({
      ...request,
      responses: [{ order: 1, poolItemId: 1, correct: true }],
    }),
    AdaptiveEngineUnavailableError
  )
})
function coverageStatusOf(response: DecisionResponse, index: number) {
  assert.equal(response.measurementVersion, 'IRT_V1')
  return response.measurementVersion === 'IRT_V1'
    ? response.estimates.nodes[index]!.coverageStatus
    : undefined
}
test('accepts IRT_V1 leaf coverage status from newer engines and its absence from older ones', async () => {
  // Older engines omit the field entirely.
  assert.equal(
    coverageStatusOf(
      await client(async () => Response.json(result)).decide(request),
      1
    ),
    undefined
  )
  for (const coverageStatus of [
    'COVERED',
    'OUT_OF_RANGE',
    'SAMPLED_PENDING',
    'NOT_SAMPLED',
  ] as const) {
    const withStatus = {
      ...result,
      estimates: {
        overall: { ...result.estimates.overall, coverageStatus: null },
        nodes: [
          { ...result.estimates.nodes[0]!, coverageStatus: null },
          { ...result.estimates.nodes[1]!, coverageStatus },
        ],
      },
    }
    const parsed = await client(async () => Response.json(withStatus)).decide(
      request
    )
    assert.equal(coverageStatusOf(parsed, 1), coverageStatus)
    assert.equal(coverageStatusOf(parsed, 0), null)
  }
})
test('rejects invalid or misplaced IRT_V1 leaf coverage status', async () => {
  const withNodes = (
    overall: Record<string, unknown>,
    competence: Record<string, unknown>,
    leaf: Record<string, unknown>
  ) => ({
    ...result,
    estimates: {
      overall: { ...result.estimates.overall, ...overall },
      nodes: [
        { ...result.estimates.nodes[0]!, ...competence },
        { ...result.estimates.nodes[1]!, ...leaf },
      ],
    },
  })
  for (const invalid of [
    withNodes({}, {}, { coverageStatus: 'UNKNOWN' }),
    withNodes({}, {}, { coverageStatus: 1 }),
    withNodes({}, { coverageStatus: 'COVERED' }, {}),
    withNodes({ coverageStatus: 'OUT_OF_RANGE' }, {}, {}),
  ]) {
    await assert.rejects(
      client(async () => Response.json(invalid)).decide(request),
      AdaptiveEngineUnavailableError
    )
  }
})
test('sends an IRT_V1 classification tolerance only within 0–5 and never for IRT v2', async () => {
  const withTolerance = {
    ...request,
    settings: { ...request.settings, classificationToleranceBands: 1 },
  } as DecisionRequest
  const api = client(async (_url, init) => {
    assert.equal(
      JSON.parse(String(init?.body)).settings.classificationToleranceBands,
      1
    )
    return Response.json(result)
  })
  await api.decide(withTolerance)
  for (const invalid of [-1, 6, 1.5])
    assert.equal(
      decisionRequestSchema.safeParse({
        ...request,
        settings: {
          ...request.settings,
          classificationToleranceBands: invalid,
        },
      }).success,
      false
    )
  const v2 = {
    contractVersion: 1,
    routingSeed: request.routingSeed,
    measurementVersion: 'IRT_V2_EAP_GRID_1',
    nodes: request.nodes,
    responses: [],
    scale: posteriorRequest.scale,
    pool: [
      {
        ...request.pool[0]!,
        itemType: 'SC',
        choiceCount: 4,
        model: 'THREE_PL_FIXED_C',
        calibrationId: 'cal-1',
        contributesToEstimate: true,
        role: 'SCORING',
      },
    ],
    settings: {
      ...request.settings,
      mode: 'DIAGNOSTIC',
      credibleMass: 0.8,
      classificationProbabilityThreshold: 0.8,
      minimumRootResponses: 4,
      researchPolicy: null,
    },
    selection: {
      eligiblePoolItemIds: [1],
      servedCounts: [],
      priorAttemptPoolItemIds: [],
    },
  }
  assert.equal(decisionRequestSchema.safeParse(v2).success, true)
  assert.equal(
    decisionRequestSchema.safeParse({
      ...v2,
      settings: { ...v2.settings, classificationToleranceBands: 1 },
    }).success,
    false
  )
})
test('does not leak upstream errors or use a local estimator on service failure', async () => {
  const api = client(async () => {
    throw new Error('secret endpoint or upstream payload')
  })
  await assert.rejects(api.decide(request), (error) => {
    assert.ok(error instanceof AdaptiveEngineUnavailableError)
    assert.equal(error.code, 'ADAPTIVE_ENGINE_UNAVAILABLE')
    assert.equal(error.message.includes('secret'), false)
    return true
  })
  await assert.rejects(
    client(async () => new Response('private error', { status: 503 })).decide(
      request
    ),
    AdaptiveEngineUnavailableError
  )
})
test('rejects non-JSON and oversized streamed responses', async () => {
  await assert.rejects(
    client(async () => new Response('not json')).decide(request),
    AdaptiveEngineUnavailableError
  )
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024))
    },
    cancel() {
      cancelled = true
    },
  })
  await assert.rejects(
    client(
      async () =>
        new Response(body, { headers: { 'content-type': 'application/json' } })
    ).decide(request),
    AdaptiveEngineUnavailableError
  )
  assert.equal(cancelled, true)
})
test('sends IRT_V1 additional leaves in the same root and rejects other roots locally', async () => {
  const node = request.nodes[1]!
  const multiLeaf: ValidationRequest = {
    ...validationRequest,
    nodes: [
      ...request.nodes,
      { ...node, id: 3, order: 1 },
      { ...request.nodes[0]!, id: 4, order: 1 },
      { ...node, id: 5, parentId: 4 },
    ],
    pool: [{ ...request.pool[0]!, additionalLeafNodeIds: [3] }],
  }
  let calls = 0
  const api = client(async (_url, init) => {
    calls++
    assert.deepEqual(
      JSON.parse(String(init?.body)).pool[0].additionalLeafNodeIds,
      [3]
    )
    return Response.json({
      contractVersion: 1,
      measurementVersion: 'IRT_V1',
      valid: true,
    })
  })
  assert.equal((await api.validate(multiLeaf)).valid, true)
  for (const additionalLeafNodeIds of [[5], [3, 3], [2]]) {
    await assert.rejects(
      api.validate({
        ...multiLeaf,
        pool: [{ ...multiLeaf.pool[0]!, additionalLeafNodeIds }],
      })
    )
  }
  assert.equal(calls, 1)
})
