import {
  validateAdaptiveQuizReadiness,
  validateAdaptiveSettings,
  type AdaptiveConfiguredAssignment,
  type AdaptiveConfiguredCoverage,
  type AdaptiveConfiguredNode,
  type AdaptiveConfiguredSettings,
} from '../src/services/adaptivePracticeQuizReadiness.js'

const settings: AdaptiveConfiguredSettings = {
  preset: 'RESEARCH',
  totalQuestionCap: 20,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 1,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  defaultDiscrimination: 1.2,
}

const nodes: AdaptiveConfiguredNode[] = [
  {
    id: 1,
    parentId: null,
    kind: 'COMPETENCE',
    name: 'Reading',
    depth: 1,
    enabled: true,
    weight: 0.5,
    questionCap: null,
  },
  {
    id: 2,
    parentId: 1,
    kind: 'SUBCOMPETENCE',
    name: 'Scanning',
    depth: 2,
    enabled: true,
    weight: null,
    questionCap: null,
  },
  {
    id: 3,
    parentId: null,
    kind: 'COMPETENCE',
    name: 'Writing',
    depth: 1,
    enabled: true,
    weight: 0.5,
    questionCap: null,
  },
  {
    id: 4,
    parentId: 3,
    kind: 'SUBCOMPETENCE',
    name: 'Structure',
    depth: 2,
    enabled: true,
    weight: null,
    questionCap: null,
  },
]

const coverages: AdaptiveConfiguredCoverage[] = [
  {
    id: 11,
    leafNodeId: 2,
    levelId: 101,
    targetItemCount: 1,
    enabled: true,
  },
  {
    id: 12,
    leafNodeId: 4,
    levelId: 101,
    targetItemCount: 1,
    enabled: true,
  },
]

const assignments: AdaptiveConfiguredAssignment[] = [
  assignment({ id: 21, leafNodeId: 2, elementName: 'Reading item' }),
  assignment({ id: 22, leafNodeId: 4, elementName: 'Writing item' }),
]

const levels = [
  {
    id: 101,
    theta: 0,
    lowerBound: Number.NEGATIVE_INFINITY,
    upperBound: Number.POSITIVE_INFINITY,
  },
]
const thetaRange = { min: -3, max: 3 }

describe('adaptive practice quiz readiness', () => {
  it('accepts a covered, scorable pool and reports planning totals', () => {
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes,
      coverages,
      assignments,
      levels,
      thetaRange,
    })

    expect(result).toMatchObject({
      ready: true,
      errors: [],
      warnings: [],
      enabledRootCount: 2,
      enabledLeafCount: 2,
      enabledAssignmentCount: 2,
      expectedQuestionCount: 2,
      estimatedDurationMinutes: 2,
    })
    expect(result.coverages.every(({ ready }) => ready)).toBe(true)
  })

  it('blocks publication when an enabled coverage cell is empty', () => {
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes,
      coverages,
      assignments: assignments.slice(0, 1),
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        leafNodeId: 4,
        levelId: 101,
      })
    )
  })

  it.each([
    ['PLACEMENT', 0, 'ADAPTIVE_COVERAGE_CELL_EMPTY'],
    ['PLACEMENT', 1, 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM'],
    ['PLACEMENT', 4, 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM'],
    ['PLACEMENT', 5, null],
    ['PLACEMENT', 6, null],
    ['DIAGNOSTIC', 0, 'ADAPTIVE_COVERAGE_CELL_EMPTY'],
    ['DIAGNOSTIC', 1, 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM'],
    ['DIAGNOSTIC', 4, 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM'],
    ['DIAGNOSTIC', 5, null],
    ['DIAGNOSTIC', 6, null],
  ] as const)('%s requires five usable items per enabled coverage cell (count: %i)', (preset, itemCount, expectedErrorCode) => {
    const result = validateAdaptiveQuizReadiness({
      settings: { ...settings, preset },
      nodes: nodes.slice(0, 2),
      coverages: [{ ...coverages[0]!, targetItemCount: 5 }],
      assignments: Array.from({ length: itemCount }, (_, index) =>
        assignment({
          id: 100 + index,
          leafNodeId: 2,
          elementName: `Reading item ${index + 1}`,
        })
      ),
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(expectedErrorCode === null)
    expect(result.coverages[0]?.ready).toBe(itemCount >= 5)
    if (expectedErrorCode) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: expectedErrorCode })
      )
    }
  })

  it('keeps sparse Research coverage visible as a warning', () => {
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes: nodes.slice(0, 2),
      coverages: [{ ...coverages[0]!, targetItemCount: 5 }],
      assignments: assignments.slice(0, 1),
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_COVERAGE_BELOW_TARGET' })
    )
  })

  it('does not count unscorable items toward coverage or reachability', () => {
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes: nodes.slice(0, 2),
      coverages: coverages.slice(0, 1),
      assignments: [{ ...assignments[0]!, controlledAnswerReady: false }],
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(false)
    expect(result.enabledAssignmentCount).toBe(0)
    expect(result.coverages[0]).toMatchObject({
      enabledAssignmentCount: 0,
      ready: false,
    })
    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ADAPTIVE_ITEM_NOT_SCORABLE',
        'ADAPTIVE_COVERAGE_CELL_EMPTY',
      ])
    )
  })

  it('warns for low coverage and long duration', () => {
    const result = validateAdaptiveQuizReadiness({
      settings: {
        ...settings,
        totalQuestionCap: 40,
      },
      nodes: nodes.slice(0, 2),
      coverages: [{ ...coverages[0]!, targetItemCount: 41 }],
      assignments: Array.from({ length: 40 }, (_, index) =>
        assignment({
          id: 100 + index,
          leafNodeId: 2,
          elementName: `Reading item ${index + 1}`,
        })
      ),
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(true)
    expect(result.expectedQuestionCount).toBe(40)
    expect(result.estimatedDurationMinutes).toBe(40)
    expect(result.warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ADAPTIVE_COVERAGE_BELOW_TARGET',
        'ADAPTIVE_TIME_BUDGET_EXCEEDED',
      ])
    )
  })

  it('applies ancestor enablement before counting leaves and assignments', () => {
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes: nodes.map((node) =>
        node.id === 1 ? { ...node, enabled: false } : node
      ),
      coverages,
      assignments,
      levels,
      thetaRange,
    })

    expect(result.enabledRootCount).toBe(1)
    expect(result.enabledLeafCount).toBe(1)
    expect(result.enabledAssignmentCount).toBe(1)
    expect(result.coverages).toHaveLength(1)
  })

  it('applies intermediate hierarchy caps to reachability and duration', () => {
    const cappedNodes: AdaptiveConfiguredNode[] = [
      nodes[0]!,
      {
        id: 5,
        parentId: 1,
        kind: 'SUBCOMPETENCE',
        name: 'Reading methods',
        depth: 2,
        enabled: true,
        weight: null,
        questionCap: 1,
      },
      { ...nodes[1]!, parentId: 5, depth: 3 },
      {
        id: 6,
        parentId: 5,
        kind: 'SUBCOMPETENCE',
        name: 'Close reading',
        depth: 3,
        enabled: true,
        weight: null,
        questionCap: null,
      },
    ]
    const result = validateAdaptiveQuizReadiness({
      settings,
      nodes: cappedNodes,
      coverages: [
        coverages[0]!,
        {
          id: 13,
          leafNodeId: 6,
          levelId: 101,
          targetItemCount: 1,
          enabled: true,
        },
      ],
      assignments: [
        assignments[0]!,
        assignment({
          id: 23,
          leafNodeId: 6,
          elementName: 'Close-reading item',
        }),
      ],
      levels,
      thetaRange,
    })

    expect(result.ready).toBe(false)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED' })
    )
    expect(result.rootReachability[0]).toMatchObject({
      nodeId: 1,
      availableItemCount: 1,
    })
    expect(result.expectedQuestionCount).toBe(1)
  })

  it('shares the global question cap across weighted root competences', () => {
    const result = validateAdaptiveQuizReadiness({
      settings: {
        ...settings,
        totalQuestionCap: 2,
      },
      nodes,
      coverages,
      assignments: [
        ...assignments,
        assignment({
          id: 23,
          leafNodeId: 2,
          elementName: 'Second reading item',
        }),
        assignment({
          id: 24,
          leafNodeId: 4,
          elementName: 'Second writing item',
        }),
      ],
      levels,
      thetaRange,
    })

    expect(
      result.rootReachability.map(
        ({ allocatedQuestionCount }) => allocatedQuestionCount
      )
    ).toEqual([1, 1])
    expect(
      result.rootReachability.every(
        ({ minimumReachableStandardError }) =>
          minimumReachableStandardError !== null
      )
    ).toBe(true)
  })

  it('reserves minimum evidence from every leaf before information-based fill', () => {
    const secondLeaf: AdaptiveConfiguredNode = {
      id: 5,
      parentId: 1,
      kind: 'SUBCOMPETENCE',
      name: 'Interpretation',
      depth: 2,
      enabled: true,
      weight: null,
      questionCap: null,
    }
    const highInformation = [41, 42].map((id) => ({
      ...assignment({
        id,
        leafNodeId: 2,
        elementName: `High-information item ${id}`,
      }),
      discrimination: 4,
      guessing: 0,
    }))
    const lowInformation = [43, 44].map((id) => ({
      ...assignment({
        id,
        leafNodeId: 5,
        elementName: `Low-information item ${id}`,
      }),
      discrimination: 0.2,
      guessing: 0,
    }))
    const result = validateAdaptiveQuizReadiness({
      settings: {
        ...settings,
        totalQuestionCap: 2,
      },
      nodes: [...nodes.slice(0, 2), secondLeaf],
      coverages: [
        coverages[0]!,
        {
          id: 14,
          leafNodeId: 5,
          levelId: 101,
          targetItemCount: 1,
          enabled: true,
        },
      ],
      assignments: [...highInformation, ...lowInformation],
      levels,
      thetaRange,
    })

    expect(result.rootReachability[0]).toMatchObject({
      allocatedQuestionCount: 2,
    })
    expect(
      result.rootReachability[0]?.minimumReachableStandardError
    ).toBeGreaterThan(0)
  })

  it('applies caps to minimum evidence and evaluates information at a common theta', () => {
    const separatedAssignments = [
      {
        ...assignment({
          id: 31,
          leafNodeId: 2,
          elementName: 'Low difficulty',
        }),
        difficulty: -3,
      },
      {
        ...assignment({
          id: 32,
          leafNodeId: 2,
          elementName: 'High difficulty',
        }),
        levelId: 102,
        difficulty: 3,
      },
    ]
    const result = validateAdaptiveQuizReadiness({
      settings: {
        ...settings,
        totalQuestionCap: 2,
        perLeafQuestionCap: 1,
        minQuestionsPerLeaf: 2,
      },
      nodes: nodes.slice(0, 2),
      coverages: [
        coverages[0]!,
        {
          id: 13,
          leafNodeId: 2,
          levelId: 102,
          targetItemCount: 1,
          enabled: true,
        },
      ],
      assignments: separatedAssignments,
      levels: [
        {
          id: 101,
          theta: -3,
          lowerBound: Number.NEGATIVE_INFINITY,
          upperBound: 0,
        },
        {
          id: 102,
          theta: 3,
          lowerBound: 0,
          upperBound: Number.POSITIVE_INFINITY,
        },
      ],
      thetaRange,
    })

    expect(result.rootReachability[0]).toMatchObject({
      availableItemCount: 1,
      allocatedQuestionCount: 1,
    })
    expect(result.warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
        'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
      ])
    )
    expect(result.ready).toBe(false)
  })

  it('handles the initial production guardrail shape in one readiness pass', () => {
    const rootCount = 250
    const levelCount = 20
    const largeNodes: AdaptiveConfiguredNode[] = Array.from(
      { length: rootCount },
      (_, index) => {
        const rootId = 1_000 + index * 2
        return [
          {
            id: rootId,
            parentId: null,
            kind: 'COMPETENCE' as const,
            name: `Root ${index}`,
            depth: 1,
            enabled: true,
            weight: 1 / rootCount,
            questionCap: null,
          },
          {
            id: rootId + 1,
            parentId: rootId,
            kind: 'SUBCOMPETENCE' as const,
            name: `Leaf ${index}`,
            depth: 2,
            enabled: true,
            weight: null,
            questionCap: null,
          },
        ]
      }
    ).flat()
    const largeLevels = Array.from({ length: levelCount }, (_, index) => {
      const theta = -3 + (6 * index) / (levelCount - 1)
      const previousTheta = -3 + (6 * (index - 1)) / (levelCount - 1)
      const nextTheta = -3 + (6 * (index + 1)) / (levelCount - 1)
      return {
        id: 2_000 + index,
        theta,
        lowerBound:
          index === 0 ? Number.NEGATIVE_INFINITY : (theta + previousTheta) / 2,
        upperBound:
          index === levelCount - 1
            ? Number.POSITIVE_INFINITY
            : (theta + nextTheta) / 2,
      }
    })
    const largeCoverages: AdaptiveConfiguredCoverage[] = Array.from(
      { length: rootCount * levelCount },
      (_, index) => ({
        id: 3_000 + index,
        leafNodeId: 1_001 + (index % rootCount) * 2,
        levelId: 2_000 + (Math.floor(index / rootCount) % levelCount),
        targetItemCount: 1,
        enabled: true,
      })
    )
    const largeAssignments: AdaptiveConfiguredAssignment[] = Array.from(
      { length: 10_000 },
      (_, index) => {
        const rootIndex = index % rootCount
        const levelIndex = Math.floor(index / rootCount) % levelCount
        return {
          ...assignment({
            id: 10_000 + index,
            leafNodeId: 1_001 + rootIndex * 2,
            elementName: `Item ${index}`,
          }),
          levelId: 2_000 + levelIndex,
          difficulty: largeLevels[levelIndex]!.theta,
        }
      }
    )

    const result = validateAdaptiveQuizReadiness({
      settings: { ...settings, totalQuestionCap: 1_000 },
      nodes: largeNodes,
      coverages: largeCoverages,
      assignments: largeAssignments,
      levels: largeLevels,
      thetaRange,
    })

    expect(result.ready).toBe(false)
    expect(result.enabledRootCount).toBe(rootCount)
    expect(result.enabledAssignmentCount).toBe(10_000)
    expect(result.expectedQuestionCount).toBe(1_000)
    expect(
      result.rootReachability.every(
        ({ allocatedQuestionCount }) => allocatedQuestionCount === 4
      )
    ).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
      })
    )
  })

  it('rejects non-finite and out-of-range planning settings', () => {
    const issues = validateAdaptiveSettings({
      ...settings,
      totalQuestionCap: 0,
      minQuestionsPerLeaf: 21,
      classificationZ: Number.NaN,
      topInformationRatio: 2,
      defaultDiscrimination: 0,
    })

    expect(issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'totalQuestionCap',
        'minQuestionsPerLeaf',
        'classificationZ',
        'topInformationRatio',
        'defaultDiscrimination',
      ])
    )
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ADAPTIVE_CONFIG_INTEGER_RANGE',
          path: 'totalQuestionCap',
          parameters: {
            field: 'totalQuestionCap',
            minimumValue: 1,
            maximumValue: 1000,
          },
        }),
        expect.objectContaining({
          code: 'ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL',
          path: 'minQuestionsPerLeaf',
          parameters: { totalQuestionCap: 0 },
        }),
        expect.objectContaining({
          code: 'ADAPTIVE_CLASSIFICATION_Z_INVALID',
          parameters: { minimumValue: 0, maximumValue: 5 },
        }),
        expect.objectContaining({
          code: 'ADAPTIVE_TOP_INFORMATION_RATIO_INVALID',
          parameters: { minimumValue: 0, maximumValue: 1 },
        }),
        expect.objectContaining({
          code: 'ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID',
          parameters: { minimumValue: 0, maximumValue: 10 },
        }),
      ])
    )
  })
})

function assignment({
  id,
  leafNodeId,
  elementName,
}: {
  id: number
  leafNodeId: number
  elementName: string
}): AdaptiveConfiguredAssignment {
  return {
    id,
    elementId: id + 100,
    elementName,
    elementType: 'SC',
    leafNodeId,
    levelId: 101,
    enabled: true,
    available: true,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0.25,
    controlledAnswerReady: true,
  }
}
