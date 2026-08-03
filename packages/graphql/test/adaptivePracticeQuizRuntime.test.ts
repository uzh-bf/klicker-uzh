import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { performance } from 'node:perf_hooks'
import {
  computeAdaptiveEstimates,
  gradeAdaptiveResponse,
  normalizeRuntimeEstimateForChart,
  selectAdaptiveNextPoolItem,
  serializeAdaptiveParticipantElement,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse,
  type AdaptiveRuntimeRoutingPoolItem,
  type AdaptiveRuntimeSettings,
} from '../src/services/adaptivePracticeQuizRuntime.js'

const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Independent', order: 1 },
  { id: 3, label: 'Advanced', order: 2 },
]
const settings: AdaptiveRuntimeSettings = {
  totalQuestionCap: 20,
  perLeafQuestionCap: 10,
  minQuestionsPerLeaf: 1,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  levelMappingRule: DB.AdaptiveLevelMappingRule.NEAREST,
  thetaRange: { min: -3, max: 3 },
}

describe('adaptive practice quiz runtime', () => {
  it('serves every root before unrestricted selection and emits overall evidence afterwards', () => {
    const nodes = twoRootNodes()
    const pool = [
      poolItem(1, [1, 2], 2, 1, -2),
      poolItem(2, [3, 4], 4, 1, -2),
      poolItem(3, [1, 2], 2, 2, 0),
      poolItem(4, [3, 4], 4, 2, 0),
    ]
    const first = selectAdaptiveNextPoolItem({
      attemptId: 'attempt-a',
      nodes,
      levels,
      pool,
      responses: [],
      settings,
    })
    expect(first.nextPoolItem?.nodePath[0]).toBe(1)

    const firstResponse = responseFor(
      pool.find(({ id }) => id === first.nextPoolItem!.id)!,
      1,
      true
    )
    const second = selectAdaptiveNextPoolItem({
      attemptId: 'attempt-a',
      nodes,
      levels,
      pool,
      responses: [firstResponse],
      settings,
    })
    expect(second.nextPoolItem?.nodePath[0]).toBe(3)
    expect(second.estimates.overall.theta).toBeNull()

    const evidence = [
      firstResponse,
      responseFor(
        pool.find(({ id }) => id === second.nextPoolItem!.id)!,
        2,
        false
      ),
    ]
    const estimates = computeAdaptiveEstimates({
      nodes,
      levels,
      responses: evidence,
      settings,
    })
    expect(estimates.overall.theta).not.toBeNull()
    expect(estimates.overall.standardError).not.toBeNull()
    expect(estimates.overall.levelId).toBeNull()
  })

  it('keeps root and overall reporting invariant when an intermediate node is inserted', () => {
    const shallowNodes: AdaptiveRuntimeNode[] = [
      rootNode(1, 1),
      leafNode(2, 1, 1),
    ]
    const deepNodes: AdaptiveRuntimeNode[] = [
      rootNode(1, 1),
      leafNode(5, 1, 1),
      { ...leafNode(2, 5, 2), depth: 3 },
    ]
    const shallowPool = [
      poolItem(1, [1, 2], 2, 1, -2),
      poolItem(2, [1, 2], 2, 2, 0),
      poolItem(3, [1, 2], 2, 3, 2),
      poolItem(4, [1, 2], 2, 2, 0.5),
    ]
    const deepPool = shallowPool.map((item) => ({
      ...item,
      nodePath: [1, 5, 2],
      nodeNamePath: ['Root 1', 'Intermediate', 'Leaf 2'],
    }))
    const correctness = [true, false, true, true]
    const shallow = computeAdaptiveEstimates({
      nodes: shallowNodes,
      levels,
      responses: shallowPool.map((item, index) =>
        responseFor(item, index + 1, correctness[index]!)
      ),
      settings,
    })
    const deep = computeAdaptiveEstimates({
      nodes: deepNodes,
      levels,
      responses: deepPool.map((item, index) =>
        responseFor(item, index + 1, correctness[index]!)
      ),
      settings,
    })

    expect(deep.nodes.get(1)?.theta).toBe(shallow.nodes.get(1)?.theta)
    expect(deep.nodes.get(1)?.standardError).toBe(
      shallow.nodes.get(1)?.standardError
    )
    expect(deep.overall.theta).toBe(shallow.overall.theta)
    expect(deep.overall.standardError).toBe(shallow.overall.standardError)
  })

  it.each([2, 3, 4, 5])(
    'pools each response exactly once through a depth-%i node path',
    (depth) => {
      const nodes = chainNodes(depth)
      const path = nodes.map(({ id }) => id)
      const pool = [-2, -0.5, 0.5, 2].map((difficulty, index) =>
        poolItem(index + 1, path, path.at(-1)!, index < 2 ? 1 : 3, difficulty)
      )
      const responses = pool.map((item, index) =>
        responseFor(item, index + 1, index % 2 === 0)
      )
      const estimates = computeAdaptiveEstimates({
        nodes,
        levels,
        responses,
        settings,
      })
      const shallow = computeAdaptiveEstimates({
        nodes: [rootNode(1, 1)],
        levels,
        responses: responses.map((response) => ({
          ...response,
          poolItem: {
            ...response.poolItem,
            leafNodeId: 1,
            nodePath: [1],
          },
        })),
        settings,
      })

      expect(
        [...estimates.nodes.values()].map(({ responseCount }) => responseCount)
      ).toEqual(Array.from({ length: depth }, () => responses.length))
      expect(estimates.nodes.get(1)?.theta).toBe(shallow.nodes.get(1)?.theta)
      expect(estimates.overall.theta).toBe(shallow.overall.theta)
      expect(estimates.overall.standardError).toBe(
        shallow.overall.standardError
      )
    }
  )

  it('excludes disabled roots and descendants from node and overall estimates', () => {
    const nodes = twoRootNodes().map((node) =>
      node.id === 3 ? { ...node, enabled: false } : node
    )
    const firstRootPool = [-2, -0.5, 0.5, 2].map((difficulty, index) =>
      poolItem(index + 1, [1, 2], 2, index < 2 ? 1 : 3, difficulty)
    )
    const secondRootPool = [-2, -0.5, 0.5, 2].map((difficulty, index) =>
      poolItem(index + 10, [3, 4], 4, index < 2 ? 1 : 3, difficulty)
    )
    const firstResponses = firstRootPool.map((item, index) =>
      responseFor(item, index + 1, index < 3)
    )
    const estimates = computeAdaptiveEstimates({
      nodes,
      levels,
      responses: [
        ...firstResponses,
        ...secondRootPool.map((item, index) =>
          responseFor(item, index + 5, false)
        ),
      ],
      settings,
    })
    const firstOnly = computeAdaptiveEstimates({
      nodes: nodes.slice(0, 2),
      levels,
      responses: firstResponses,
      settings,
    })

    expect([...estimates.nodes.keys()]).toEqual([1, 2])
    expect(estimates.overall.theta).toBe(firstOnly.overall.theta)
    expect(estimates.overall.standardError).toBe(
      firstOnly.overall.standardError
    )
  })

  it('keeps capped all-correct and all-wrong reporting finite and ordered', () => {
    const nodes = [rootNode(1, 1), leafNode(2, 1, 1)]
    const pool = Array.from({ length: 8 }, (_, index) =>
      poolItem(index + 1, [1, 2], 2, (index % levels.length) + 1, index - 3.5)
    )
    const estimate = (correct: boolean) =>
      computeAdaptiveEstimates({
        nodes,
        levels,
        responses: pool.map((item, index) =>
          responseFor(item, index + 1, correct)
        ),
        settings,
      }).overall
    const allCorrect = estimate(true)
    const allWrong = estimate(false)

    expect(allCorrect.theta).toBeGreaterThan(allWrong.theta!)
    expect(Number.isFinite(allCorrect.standardError)).toBe(true)
    expect(Number.isFinite(allWrong.standardError)).toBe(true)
    expect(allCorrect.levelId).not.toBeNull()
    expect(allWrong.levelId).not.toBeNull()
  })

  it('normalizes widening and narrowing trajectory intervals without raw values', () => {
    const points = [0.9, 0.4, 0.7].map((standardError) =>
      normalizeRuntimeEstimateForChart({
        estimate: { theta: 0.25, standardError },
        settings,
      })
    )

    for (const point of points) {
      expect(point).not.toBeNull()
      expect(point!.lowerPosition).toBeLessThanOrEqual(point!.position)
      expect(point!.position).toBeLessThanOrEqual(point!.upperPosition)
      expect(point!.lowerPosition).toBeGreaterThanOrEqual(0)
      expect(point!.upperPosition).toBeLessThanOrEqual(1)
      expect(point).not.toHaveProperty('theta')
      expect(point).not.toHaveProperty('standardError')
    }
    const widths = points.map(
      (point) => point!.upperPosition - point!.lowerPosition
    )
    expect(widths[1]).toBeLessThan(widths[0]!)
    expect(widths[2]).toBeGreaterThan(widths[1]!)
  })

  it('returns explicit cap and pool fallback reasons', () => {
    const nodes = [rootNode(1, 1), leafNode(2, 1, 1)]
    const pool = [poolItem(1, [1, 2], 2, 1, -2)]
    const evidence = [responseFor(pool[0]!, 1, true)]
    const capped = selectAdaptiveNextPoolItem({
      attemptId: 'attempt-cap',
      nodes,
      levels,
      pool,
      responses: evidence,
      settings: { ...settings, totalQuestionCap: 1 },
    })
    expect(capped.stopReason).toBe(
      DB.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
    )

    const exhausted = selectAdaptiveNextPoolItem({
      attemptId: 'attempt-pool',
      nodes,
      levels,
      pool,
      responses: evidence,
      settings,
    })
    expect(exhausted.stopReason).toBe(
      DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
    )
  })

  it('grades supported snapshots and never serializes hidden answer data', () => {
    const choices = poolItem(1, [1, 2], 2, 2, 0)
    const result = gradeAdaptiveResponse({
      poolItem: choices,
      input: { choiceIndices: [0] },
    })
    expect(result).toMatchObject({ score: 1, correct: true })

    const safe = serializeAdaptiveParticipantElement(choices)
    const keys = collectKeys(safe)
    expect(keys).not.toContain('correct')
    expect(keys).not.toContain('solutions')
    expect(keys).not.toContain('feedback')
    expect(keys).not.toContain('difficulty')
    expect(keys).not.toContain('guessing')
    expect(keys).not.toContain('discrimination')

    const numerical = numericalPoolItem()
    expect(
      gradeAdaptiveResponse({
        poolItem: numerical,
        input: { numericalResponse: '0' },
      })
    ).toMatchObject({ score: 1, correct: true })
    expect(
      gradeAdaptiveResponse({
        poolItem: numerical,
        input: { numericalResponse: '1' },
      })
    ).toMatchObject({ score: 0, correct: false })

    const decimalNumerical = numericalPoolItem(0.5)
    expect(
      gradeAdaptiveResponse({
        poolItem: decimalNumerical,
        input: { numericalResponse: '0,500' },
      })
    ).toMatchObject({ score: 1, correct: true })
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: decimalNumerical,
        input: { numericalResponse: '1,200' },
      })
    ).toThrowError('unambiguous')
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: numericalPoolItem(0.25),
        input: { numericalResponse: '25%' },
      })
    ).toThrowError('Percent input is not enabled')
    expect(
      gradeAdaptiveResponse({
        poolItem: numericalPoolItem(0.25, true),
        input: { numericalResponse: '25%' },
      })
    ).toMatchObject({
      normalizedResponse: { value: '0.25' },
      score: 1,
      correct: true,
    })

    const freeText = freeTextPoolItem()
    expect(
      gradeAdaptiveResponse({
        poolItem: freeText,
        input: { freeTextResponse: '  ZÜRICH  ' },
      })
    ).toMatchObject({ score: 1, correct: true })

    const uncontrolled = freeTextPoolItem()
    uncontrolled.elementData = {
      ...uncontrolled.elementData,
      options: { solutions: [' '] },
    } as ElementData
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: uncontrolled,
        input: { freeTextResponse: 'Zurich' },
      })
    ).toThrowError('no controlled answer')
  })

  it('accepts an all-false KPRIM key as a controlled answer', () => {
    const item = poolItem(1, [1, 2], 2, 2, 0)
    item.elementType = DB.ElementType.KPRIM
    item.elementData = {
      ...item.elementData,
      type: DB.ElementType.KPRIM,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'A', correct: false },
          { ix: 1, value: 'B', correct: false },
          { ix: 2, value: 'C', correct: false },
          { ix: 3, value: 'D', correct: false },
        ],
      },
    } as ElementData

    expect(
      gradeAdaptiveResponse({ poolItem: item, input: { choiceIndices: [] } })
    ).toMatchObject({ score: 1, correct: true })
  })

  it('rejects an empty MC response to match the non-empty guessing space', () => {
    const item = poolItem(1, [1, 2], 2, 2, 0)
    item.elementType = DB.ElementType.MC
    item.elementData = {
      ...item.elementData,
      type: DB.ElementType.MC,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 10, value: 'A', correct: true },
          { ix: 20, value: 'B', correct: false },
          { ix: 30, value: 'C', correct: true },
        ],
      },
    } as ElementData

    expect(() =>
      gradeAdaptiveResponse({ poolItem: item, input: { choiceIndices: [] } })
    ).toThrowError('at least one selected choice')
    expect(
      gradeAdaptiveResponse({
        poolItem: item,
        input: { choiceIndices: [10, 30] },
      })
    ).toMatchObject({ score: 1, correct: true })
  })

  it('routes the 500-node and 10,000-item guardrail shape within budget', () => {
    const fixture = guardrailRuntimeFixture()
    const startedAt = performance.now()
    const decision = selectAdaptiveNextPoolItem({
      attemptId: 'guardrail-attempt',
      ...fixture,
    })
    const durationMs = performance.now() - startedAt

    expect(fixture.nodes).toHaveLength(500)
    expect(fixture.pool).toHaveLength(10_000)
    expect(decision.nextPoolItem).not.toBeNull()
    expect(durationMs).toBeLessThan(2_000)
  })
})

function twoRootNodes(): AdaptiveRuntimeNode[] {
  return [
    rootNode(1, 0.7),
    leafNode(2, 1, 1),
    rootNode(3, 0.3),
    leafNode(4, 3, 1),
  ]
}

function rootNode(id: number, weight: number): AdaptiveRuntimeNode {
  return {
    id,
    parentId: null,
    kind: DB.AdaptiveNodeKind.COMPETENCE,
    depth: 1,
    order: id,
    enabled: true,
    weight,
    questionCap: null,
  }
}

function leafNode(
  id: number,
  parentId: number,
  order: number
): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: DB.AdaptiveNodeKind.SUBCOMPETENCE,
    depth: 2,
    order,
    enabled: true,
    weight: null,
    questionCap: null,
  }
}

function chainNodes(depth: number): AdaptiveRuntimeNode[] {
  return Array.from({ length: depth }, (_, index) =>
    index === 0
      ? rootNode(1, 1)
      : {
          ...leafNode(index + 1, index, 0),
          depth: index + 1,
        }
  )
}

function poolItem(
  id: number,
  nodePath: number[],
  leafNodeId: number,
  levelId: number,
  difficulty: number
): AdaptiveRuntimePoolItem {
  return {
    id,
    sourceAssignmentId: id,
    elementId: id,
    elementVersion: 1,
    elementType: DB.ElementType.SC,
    elementName: `Question ${id}`,
    elementData: {
      id: `${id}-v1`,
      elementId: id,
      type: DB.ElementType.SC,
      name: `Question ${id}`,
      content: `Question ${id}`,
      pointsMultiplier: 1,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Correct', correct: true, feedback: 'Hidden' },
          { ix: 1, value: 'Incorrect', correct: false },
        ],
      },
    } as ElementData,
    leafNodeId,
    nodePath,
    nodeNamePath: nodePath.map((nodeId) => `Node ${nodeId}`),
    levelId,
    levelLabel: levels.find((level) => level.id === levelId)!.label,
    levelOrder: levels.find((level) => level.id === levelId)!.order,
    discrimination: 1.2,
    difficulty,
    guessing: 0.5,
    enablePercentInput: false,
  }
}

function numericalPoolItem(
  target = 0,
  enablePercentInput = false
): AdaptiveRuntimePoolItem {
  const item = poolItem(10, [1, 2], 2, 2, 0)
  return {
    ...item,
    elementType: DB.ElementType.NUMERICAL,
    elementData: {
      ...item.elementData,
      type: DB.ElementType.NUMERICAL,
      options: { solutionRanges: [{ min: target, max: target }] },
    } as ElementData,
    guessing: 0,
    enablePercentInput,
  }
}

function freeTextPoolItem(): AdaptiveRuntimePoolItem {
  const item = poolItem(11, [1, 2], 2, 2, 0)
  return {
    ...item,
    elementType: DB.ElementType.FREE_TEXT,
    elementData: {
      ...item.elementData,
      type: DB.ElementType.FREE_TEXT,
      options: { solutions: ['zurich'] },
    } as ElementData,
    guessing: 0,
  }
}

function responseFor(
  poolItem: AdaptiveRuntimePoolItem,
  order: number,
  correct: boolean
): AdaptiveRuntimeResponse {
  return { order, poolItemId: poolItem.id, correct, poolItem }
}

function guardrailRuntimeFixture() {
  const benchmarkLevels = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    label: `L${index + 1}`,
    order: index,
  }))
  const nodes: AdaptiveRuntimeNode[] = []
  const pool: AdaptiveRuntimeRoutingPoolItem[] = []
  let nodeId = 1
  let itemId = 1

  for (let rootIndex = 0; rootIndex < 250; rootIndex++) {
    const rootId = nodeId++
    nodes.push({
      ...rootNode(rootId, 0.01),
      order: rootIndex,
    })
    for (let leafIndex = 0; leafIndex < 1; leafIndex++) {
      const leafId = nodeId++
      nodes.push(leafNode(leafId, rootId, leafIndex))
      for (const level of benchmarkLevels) {
        for (let itemIndex = 0; itemIndex < 2; itemIndex++) {
          pool.push({
            id: itemId,
            sourceAssignmentId: itemId,
            elementId: itemId,
            elementVersion: 1,
            elementType: DB.ElementType.SC,
            elementName: `Question ${itemId}`,
            leafNodeId: leafId,
            nodePath: [rootId, leafId],
            nodeNamePath: [`Root ${rootIndex}`, `Leaf ${leafIndex}`],
            levelId: level.id,
            levelLabel: level.label,
            levelOrder: level.order,
            discrimination: 1.2,
            difficulty: -3 + (level.order * 6) / 19,
            guessing: 0.25,
            enablePercentInput: false,
          })
          itemId += 1
        }
      }
    }
  }

  const responses = Array.from({ length: 250 }, (_, rootIndex) => {
    const item = pool[rootIndex * 40]!
    return {
      order: rootIndex + 1,
      poolItemId: item.id,
      correct: rootIndex % 2 === 0,
      poolItem: item,
    }
  })

  return {
    nodes,
    levels: benchmarkLevels,
    pool,
    responses,
    settings: {
      ...settings,
      totalQuestionCap: 1_000,
      perLeafQuestionCap: 100,
    },
  }
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested),
  ])
}
