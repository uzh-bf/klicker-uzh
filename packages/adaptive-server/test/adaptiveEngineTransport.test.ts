import { once } from 'node:events'
import { createServer } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import {
  advanceLoadedAdaptiveRuntime,
  prepareLoadedAdaptiveEstimator,
} from '../src/services/adaptivePracticeQuizEstimatorVersions.js'

const token = 'synthetic-host-adaptive-token-0000000000'
afterEach(() => vi.unstubAllEnvs())

it('sends only scored metadata and hydrates the selected item from the host snapshot', async () => {
  const pool = [1, 2].map((id) => ({
    id,
    leafNodeId: 2,
    nodePath: [1, 2],
    levelId: 1,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0.25,
    sourceAssignmentId: id,
    elementId: id,
    elementVersion: 1,
    elementType: 'SC' as const,
    elementName: 'PRIVATE_QUESTION_TITLE',
    nodeNamePath: ['PRIVATE_COMPETENCE_NAME', 'PRIVATE_SUBCOMPETENCE_NAME'],
    levelLabel: 'A',
    levelOrder: 0,
    enablePercentInput: false,
  }))
  let received: string | undefined
  let authorized = false
  const estimate = {
    theta: 0,
    standardError: 1,
    responseCount: 1,
    levelId: null,
    stopReason: null,
  }
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    received = Buffer.concat(chunks).toString('utf8')
    if (request.url === '/adaptive/v1/validate') {
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          contractVersion: 1,
          measurementVersion: 'IRT_V1',
          valid: true,
        })
      )
      return
    }
    authorized = request.headers.authorization === `Bearer ${token}`
    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        contractVersion: 1,
        measurementVersion: 'IRT_V1',
        nextPoolItemId: 2,
        stopReason: null,
        estimates: {
          overall: { ...estimate, nodeKind: 'OVERALL', nodeId: null },
          nodes: [
            { ...estimate, nodeKind: 'COMPETENCE', nodeId: 1 },
            { ...estimate, nodeKind: 'SUBCOMPETENCE', nodeId: 2 },
          ],
        },
      })
    )
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing test listener')
  vi.stubEnv('ADAPTIVE_ENGINE_URL', `http://127.0.0.1:${address.port}`)
  vi.stubEnv('ADAPTIVE_ENGINE_TOKEN', token)
  try {
    const runtime = await prepareLoadedAdaptiveEstimator({
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
        { id: 1, label: 'PRIVATE_LEVEL_'.repeat(20), order: 0 },
        { id: 2, label: 'B', order: 1 },
      ],
      pool,
      settings: {
        totalQuestionCap: 70,
        perLeafQuestionCap: null,
        minQuestionsPerLeaf: 4,
        classificationZ: 1.96,
        topInformationRatio: 0.8,
        levelMappingRule: 'NEAREST',
        thetaRange: { min: -3, max: 3 },
      },
    })
    const result = await advanceLoadedAdaptiveRuntime({
      attemptId: '11111111-1111-4111-8111-111111111111',
      runtime,
      responses: [
        { order: 1, poolItemId: 1, correct: true, poolItem: pool[0]! },
      ],
    })
    expect(authorized).toBe(true)
    expect(received).not.toContain('PRIVATE_')
    expect(JSON.parse(received!).levels[0].label).toBe('level-0')
    expect(JSON.parse(received!).responses).toEqual([
      { order: 1, poolItemId: 1, correct: true },
    ])
    expect(result.decision.nextPoolItem).toBe(pool[1])
    expect(result.decision.estimates.nodes.get(2)?.responseCount).toBe(1)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
