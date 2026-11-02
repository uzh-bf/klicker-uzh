import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import {
  type AdaptiveTestingEstimateRecord,
  type AdaptiveTestingLevelResolver,
  buildAdaptiveTestingInfo,
  loadAdaptiveTestingElementTags,
  mostProbableBandLabel,
  serializeAdaptiveTestingEstimate,
  withAdaptiveTestingEstimates,
} from '../src/services/adaptivePracticeQuizTestingInfo.js'

const poolItem = {
  elementId: 42,
  elementVersion: 3,
  elementName: 'Portfolio basics',
  elementData: {
    id: '42-v3',
    elementId: 42,
    type: DB.ElementType.SC,
    name: 'Portfolio basics',
    content: 'Which one?',
    pointsMultiplier: 1,
    options: {
      displayMode: 'LIST',
      choices: [
        { ix: 0, value: 'A', correct: false },
        { ix: 1, value: 'B', correct: true },
      ],
    },
  } as ElementData,
  nodePath: [1, 5],
  nodeNamePath: ['Finance', 'Diversification'],
  leafNodeId: 5,
  levelLabel: 'Independent',
}

const levelLabels = new Map([
  [11, 'Basic'],
  [12, 'Independent'],
])
const resolver: AdaptiveTestingLevelResolver = {
  intervalZ: 2,
  labelForLevelId: (levelId) => levelLabels.get(levelId) ?? null,
  tentativeLabel: (estimate) =>
    estimate.theta === null ? null : estimate.theta < 0 ? 'Basic' : 'Advanced',
}

function estimate(
  overrides: Partial<AdaptiveTestingEstimateRecord>
): AdaptiveTestingEstimateRecord {
  return {
    nodeKind: DB.AdaptiveEstimateNodeKind.OVERALL,
    nodeId: null,
    theta: 0.5,
    standardError: 0.25,
    credibleLower: null,
    credibleUpper: null,
    responseCount: 2,
    levelId: 12,
    resultStatus: null,
    bandProbabilities: null,
    ...overrides,
  }
}

describe('adaptive practice quiz testing info', () => {
  it('stays hidden unless the server flag is exactly true', () => {
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      expect(buildAdaptiveTestingInfo(poolItem, flag)).toBeNull()
    }
  })

  it('maps the served item metadata and its competence mapping', () => {
    const info = buildAdaptiveTestingInfo(poolItem, 'true')
    expect(info).toEqual({
      solution: { choiceIndices: [1], answers: [] },
      elementId: 42,
      elementVersion: 3,
      elementTitle: 'Portfolio basics',
      competencePath: ['Finance', 'Diversification'],
      subcompetenceName: 'Diversification',
      itemLevelLabel: 'Independent',
      overallEstimate: null,
      competenceEstimate: null,
      subcompetenceEstimate: null,
      history: null,
      leafNodeId: 5,
      rootNodeId: 1,
    })
    expect(
      buildAdaptiveTestingInfo(
        { ...poolItem, nodePath: [5], nodeNamePath: ['Diversification'] },
        'true'
      )?.rootNodeId
    ).toBeNull()
  })

  it('reports no estimate before the first answer', () => {
    const info = buildAdaptiveTestingInfo(poolItem, 'true')!
    const withNone = withAdaptiveTestingEstimates(info, [], resolver)
    expect(withNone.overallEstimate).toBeNull()
    expect(withNone.competenceEstimate).toBeNull()
    expect(withNone.subcompetenceEstimate).toBeNull()
    expect(
      serializeAdaptiveTestingEstimate(estimate({ responseCount: 0 }), resolver)
    ).toBeNull()
  })

  it('attaches overall, competence, and subcompetence estimates', () => {
    const info = buildAdaptiveTestingInfo(poolItem, 'true')!
    const result = withAdaptiveTestingEstimates(
      info,
      [
        estimate({}),
        estimate({
          nodeKind: DB.AdaptiveEstimateNodeKind.COMPETENCE,
          nodeId: 1,
          theta: -0.4,
          levelId: null,
        }),
        estimate({
          nodeKind: DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
          nodeId: 5,
          responseCount: 1,
          levelId: 11,
          credibleLower: -1,
          credibleUpper: 0.2,
          resultStatus: DB.AdaptiveResultStatus.BETWEEN_LEVELS,
        }),
        estimate({
          nodeKind: DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
          nodeId: 9,
          levelId: 11,
        }),
      ],
      resolver
    )
    expect(result.overallEstimate).toEqual({
      responseCount: 2,
      theta: 0.5,
      standardError: 0.25,
      lowerBound: 0,
      upperBound: 1,
      levelLabel: 'Independent',
      levelIsTentative: false,
      resultStatus: null,
    })
    expect(result.competenceEstimate).toMatchObject({
      theta: -0.4,
      levelLabel: 'Basic',
      levelIsTentative: true,
    })
    expect(result.subcompetenceEstimate).toMatchObject({
      responseCount: 1,
      lowerBound: -1,
      upperBound: 0.2,
      levelLabel: 'Basic',
      levelIsTentative: false,
      resultStatus: DB.AdaptiveResultStatus.BETWEEN_LEVELS,
    })
  })

  it('handles estimates without theta or level', () => {
    expect(
      serializeAdaptiveTestingEstimate(
        estimate({ theta: null, standardError: null, levelId: null }),
        resolver
      )
    ).toMatchObject({
      lowerBound: null,
      upperBound: null,
      levelLabel: null,
      levelIsTentative: false,
    })
  })

  it('picks the most probable posterior band', () => {
    const levels = [
      { scaleLevelId: 1, label: 'Basic' },
      { scaleLevelId: 2, label: 'Independent' },
      { scaleLevelId: 3, label: 'Advanced' },
    ]
    expect(mostProbableBandLabel({ 1: 0.2, 2: 0.5, 3: 0.3 }, levels)).toBe(
      'Independent'
    )
    expect(mostProbableBandLabel(null, levels)).toBeNull()
    expect(mostProbableBandLabel([0.1], levels)).toBeNull()
  })

  it('reads tags from the live source element', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      tags: [{ name: 'finance' }, { name: 'week 3' }],
    })
    const prisma = { element: { findUnique } } as unknown as Parameters<
      typeof loadAdaptiveTestingElementTags
    >[0]
    await expect(loadAdaptiveTestingElementTags(prisma, 42)).resolves.toEqual([
      'finance',
      'week 3',
    ])
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { tags: { select: { name: true }, orderBy: { order: 'asc' } } },
    })
    findUnique.mockResolvedValueOnce(null)
    await expect(loadAdaptiveTestingElementTags(prisma, 7)).resolves.toEqual([])
  })
})
