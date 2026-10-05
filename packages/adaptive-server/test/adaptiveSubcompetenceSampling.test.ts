import { describe, expect, it } from 'vitest'
import type { AdaptiveBankAnalyzer } from '../src/services/adaptivePracticeQuizReachability.js'
import {
  type AdaptiveConfiguredAssignment,
  type AdaptiveConfiguredNode,
  type AdaptiveConfiguredSettings,
  validateAdaptiveQuizReadiness,
} from '../src/services/adaptivePracticeQuizReadiness.js'
import {
  planAdaptiveSubcompetenceSampling,
  resolveAdaptiveSubcompetenceSampling,
} from '../src/services/adaptivePracticeQuizSubcompetenceSampling.js'

// Numeric transport fixture only; readiness policy is what is under test.
const analyzer: AdaptiveBankAnalyzer = {
  async analyzeBank(request) {
    return {
      contractVersion: 1 as const,
      items: request.items.map((item) => ({
        localId: item.localId,
        informationAtDifficulty: 1,
      })),
      banks: request.banks.map((bank) => ({
        localId: bank.localId,
        information: request.thetaPoints.map(
          () => bank.itemLocalIds.length * 0.01
        ),
        maximumInformation: request.thetaPoints.map(() => 0.01),
      })),
    }
  },
}

const levels = [
  {
    id: 101,
    theta: 0,
    lowerBound: Number.NEGATIVE_INFINITY,
    upperBound: Number.POSITIVE_INFINITY,
  },
]

type RootSpec = {
  id: number
  name: string
  weight: number
  leafCount: number
  questionCap?: number | null
}

function buildTree(roots: RootSpec[], itemsPerLeaf = 3) {
  const nodes: AdaptiveConfiguredNode[] = []
  const assignments: AdaptiveConfiguredAssignment[] = []
  for (const root of roots) {
    nodes.push({
      id: root.id,
      parentId: null,
      kind: 'COMPETENCE',
      name: root.name,
      depth: 1,
      enabled: true,
      weight: root.weight,
      questionCap: root.questionCap ?? null,
    })
    for (let leaf = 0; leaf < root.leafCount; leaf++) {
      const leafId = root.id * 1000 + leaf
      nodes.push({
        id: leafId,
        parentId: root.id,
        kind: 'SUBCOMPETENCE',
        name: `${root.name} ${leaf + 1}`,
        depth: 2,
        enabled: true,
        weight: null,
        questionCap: null,
      })
      for (let item = 0; item < itemsPerLeaf; item++) {
        const id = leafId * 10 + item
        assignments.push({
          id,
          elementId: id + 100,
          elementName: `Item ${id}`,
          elementType: 'SC',
          leafNodeId: leafId,
          levelId: 101,
          enabled: true,
          available: true,
          discrimination: 1.2,
          difficulty: 0,
          guessing: 0.25,
          controlledAnswerReady: true,
        })
      }
    }
  }
  return { nodes, assignments }
}

function diagnosticSettings(
  overrides: Partial<AdaptiveConfiguredSettings> = {}
): AdaptiveConfiguredSettings {
  return {
    preset: 'DIAGNOSTIC',
    subcompetenceSampling: true,
    totalQuestionCap: 50,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 2,
    classificationZ: 1.28,
    topInformationRatio: 0.8,
    defaultDiscrimination: 1.2,
    ...overrides,
  }
}

async function readiness(
  roots: RootSpec[],
  settings: AdaptiveConfiguredSettings
) {
  const { nodes, assignments } = buildTree(roots)
  return validateAdaptiveQuizReadiness({
    settings,
    nodes,
    coverages: [],
    assignments,
    levels,
    thetaRange: { min: -3, max: 3 },
    analyzer,
  })
}

const MINIMUM_EVIDENCE_CODES = [
  'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
  'ADAPTIVE_MINIMUM_EVIDENCE_CAPPED',
]

const reportedTree: RootSpec[] = [
  { id: 1, name: 'GRAMÁTICA', weight: 0.4, leafCount: 30 },
  { id: 2, name: 'LÉXICO', weight: 0.3, leafCount: 25 },
  { id: 3, name: 'COMUNICACIÓN', weight: 0.3, leafCount: 16 },
]

describe('Diagnostic subcompetence sampling readiness', () => {
  it('publishes 71 leaves under a 50-question cap with per-root sampling warnings', async () => {
    const result = await readiness(reportedTree, diagnosticSettings())

    expect(result.errors).toEqual([])
    expect(result.ready).toBe(true)
    const codes = [...result.errors, ...result.warnings].map(({ code }) => code)
    for (const code of MINIMUM_EVIDENCE_CODES) {
      expect(codes).not.toContain(code)
    }

    const allocations = new Map(
      result.rootReachability.map((root) => [
        root.nodeId,
        root.allocatedQuestionCount,
      ])
    )
    expect(allocations).toEqual(
      new Map([
        [1, 20],
        [2, 15],
        [3, 15],
      ])
    )
    const sampling = result.warnings.filter(
      ({ code }) => code === 'ADAPTIVE_SUBCOMPETENCE_SAMPLING'
    )
    expect(sampling).toEqual([
      expect.objectContaining({
        nodeId: 1,
        message:
          'Each student is tested on about 10 of 30 GRAMÁTICA subcompetences (20 questions, 2 per subcompetence).',
        parameters: expect.objectContaining({
          rootName: 'GRAMÁTICA',
          allocatedQuestionCount: 20,
          leafCount: 30,
          coveredLeafCount: 10,
          questionsPerLeaf: 2,
        }),
      }),
      expect.objectContaining({
        nodeId: 2,
        parameters: expect.objectContaining({
          allocatedQuestionCount: 15,
          leafCount: 25,
          coveredLeafCount: 7,
        }),
      }),
      expect.objectContaining({
        nodeId: 3,
        parameters: expect.objectContaining({
          allocatedQuestionCount: 15,
          leafCount: 16,
          coveredLeafCount: 7,
        }),
      }),
    ])
  })

  it('does not warn for roots whose share covers every leaf', async () => {
    const result = await readiness(
      [
        { id: 1, name: 'Wide', weight: 0.6, leafCount: 30 },
        { id: 2, name: 'Narrow', weight: 0.4, leafCount: 5 },
      ],
      diagnosticSettings({ totalQuestionCap: 40 })
    )
    expect(result.ready).toBe(true)
    // Narrow needs only 10 questions; the remaining budget goes to Wide.
    expect(
      result.rootReachability.find(({ nodeId }) => nodeId === 2)
    ).toMatchObject({ allocatedQuestionCount: 10 })
    expect(
      result.warnings
        .filter(({ code }) => code === 'ADAPTIVE_SUBCOMPETENCE_SAMPLING')
        .map(({ nodeId, parameters }) => [nodeId, parameters.coveredLeafCount])
    ).toEqual([[1, 15]])
  })

  it('accepts exactly one leaf block per root', async () => {
    const result = await readiness(
      [
        { id: 1, name: 'Reading', weight: 0.5, leafCount: 3 },
        { id: 2, name: 'Writing', weight: 0.5, leafCount: 3 },
      ],
      diagnosticSettings({ totalQuestionCap: 4 })
    )
    expect(result.errors).toEqual([])
    expect(result.ready).toBe(true)
    expect(
      result.warnings
        .filter(({ code }) => code === 'ADAPTIVE_SUBCOMPETENCE_SAMPLING')
        .map(({ parameters }) => parameters.coveredLeafCount)
    ).toEqual([1, 1])
  })

  it('stays blocking when a root cannot receive one leaf block', async () => {
    const result = await readiness(
      [
        { id: 1, name: 'Reading', weight: 0.5, leafCount: 2 },
        { id: 2, name: 'Writing', weight: 0.5, leafCount: 2 },
      ],
      diagnosticSettings({ totalQuestionCap: 6, minQuestionsPerLeaf: 4 })
    )
    expect(result.ready).toBe(false)
    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
        'ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE',
      ])
    )
    expect(
      result.errors
        .filter(
          ({ code }) => code === 'ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE'
        )
        .map(({ nodeId, parameters }) => [
          nodeId,
          parameters.allocatedQuestionCount,
        ])
    ).toEqual([
      [1, 3],
      [2, 3],
    ])
    expect(result.warnings.map(({ code }) => code)).not.toContain(
      'ADAPTIVE_SUBCOMPETENCE_SAMPLING'
    )
  })

  it('stays blocking when a low-weight root would receive no questions', async () => {
    const result = await readiness(
      [
        { id: 1, name: 'Main', weight: 0.98, leafCount: 10 },
        { id: 2, name: 'Minor', weight: 0.01, leafCount: 10 },
        { id: 3, name: 'Tiny', weight: 0.01, leafCount: 10 },
      ],
      diagnosticSettings({ totalQuestionCap: 6 })
    )
    expect(result.ready).toBe(false)
    expect(
      result.errors.some(
        ({ code, parameters }) =>
          code === 'ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE' &&
          (parameters.allocatedQuestionCount ?? 0) < 2
      )
    ).toBe(true)
  })

  it('treats a root cap below its leaf minimum as sampling', async () => {
    const result = await readiness(
      [
        { id: 1, name: 'Capped', weight: 0.5, leafCount: 10, questionCap: 8 },
        { id: 2, name: 'Open', weight: 0.5, leafCount: 2 },
      ],
      diagnosticSettings({ totalQuestionCap: 40 })
    )
    expect(result.errors).toEqual([])
    expect(result.ready).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_SUBCOMPETENCE_SAMPLING',
        nodeId: 1,
        parameters: expect.objectContaining({
          allocatedQuestionCount: 8,
          coveredLeafCount: 4,
          leafCount: 10,
        }),
      })
    )
  })

  it('keeps the blocking error when sampled routing is not available', async () => {
    const result = await readiness(
      reportedTree,
      diagnosticSettings({ subcompetenceSampling: false })
    )
    expect(result.ready).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED',
        message:
          'The enabled leaves require 142 minimum-evidence questions, but the total cap is 50.',
      })
    )
  })

  it('leaves Research readiness unchanged', async () => {
    const result = await readiness(
      reportedTree,
      diagnosticSettings({ preset: 'RESEARCH' })
    )
    expect(result.errors).toEqual([])
    expect(result.warnings.map(({ code }) => code)).toContain(
      'ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED'
    )
    expect(result.warnings.map(({ code }) => code)).not.toContain(
      'ADAPTIVE_SUBCOMPETENCE_SAMPLING'
    )
    expect(result.ready).toBe(false)
  })
})

describe('planAdaptiveSubcompetenceSampling', () => {
  const roots: AdaptiveConfiguredNode[] = [1, 2].map((id) => ({
    id,
    parentId: null,
    kind: 'COMPETENCE',
    name: `Root ${id}`,
    depth: 1,
    enabled: true,
    weight: 0.5,
    questionCap: null,
  }))
  const leaves: AdaptiveConfiguredNode[] = [11, 12, 13, 21].map((id) => ({
    id,
    parentId: Math.floor(id / 10),
    kind: 'SUBCOMPETENCE',
    name: `Leaf ${id}`,
    depth: 2,
    enabled: true,
    weight: null,
    questionCap: null,
  }))
  const rootByNode = new Map(
    leaves.map((leaf) => [leaf.id, leaf.parentId!] as const)
  )

  it('floors covered leaves and caps them at the leaf count', () => {
    expect(
      planAdaptiveSubcompetenceSampling({
        roots,
        enabledLeaves: leaves,
        rootByNode,
        rootAllocations: new Map([
          [1, 5],
          [2, 9],
        ]),
        minQuestionsPerLeaf: 2,
      })
    ).toEqual([
      {
        rootId: 1,
        rootName: 'Root 1',
        allocatedQuestionCount: 5,
        leafCount: 3,
        coveredLeafCount: 2,
        questionsPerLeaf: 2,
      },
      {
        rootId: 2,
        rootName: 'Root 2',
        allocatedQuestionCount: 9,
        leafCount: 1,
        coveredLeafCount: 1,
        questionsPerLeaf: 2,
      },
    ])
  })

  it('reports nothing when there is no minimum-evidence conflict', () => {
    expect(
      resolveAdaptiveSubcompetenceSampling({
        plans: [
          {
            rootId: 1,
            rootName: 'Root 1',
            allocatedQuestionCount: 0,
            leafCount: 3,
            coveredLeafCount: 0,
            questionsPerLeaf: 2,
          },
        ],
        deferredIssues: [],
      })
    ).toEqual({ errors: [], warnings: [] })
  })
})
