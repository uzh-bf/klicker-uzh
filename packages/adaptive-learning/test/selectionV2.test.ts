import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_V2_RANDOMIZATION_VERSION,
  buildAdaptivePosteriorGrid,
  expectedPosteriorInformation,
  selectAdaptiveV2Item,
  summarizeAdaptivePosterior,
  type AdaptiveScaleDefinition,
  type AdaptiveV2PoolItem,
} from '../src/index.js'

const scale = createScale()

describe('adaptive v2 posterior selection', () => {
  it('computes posterior-mass-weighted item information', () => {
    const posterior = posteriorAt(0)
    const near = item(1, 0)
    const distant = item(2, 3)

    expect(expectedPosteriorInformation({ posterior, item: near })).toBeCloseTo(
      0.36,
      12
    )
    expect(
      expectedPosteriorInformation({ posterior, item: near })
    ).toBeGreaterThan(
      expectedPosteriorInformation({ posterior, item: distant })
    )
  })

  it('uses the selected leaf posterior for information targeting', () => {
    const selected = selectAdaptiveV2Item({
      attemptId: 'attempt-posterior',
      responseOrder: 3,
      mode: 'DIAGNOSTIC',
      minQuestionsPerLeaf: 1,
      totalAdministeredResponses: 2,
      topInformationRatio: 1,
      researchPolicy: null,
      leaves: [
        {
          rootId: 1,
          leafId: 2,
          stableOrder: [0, 0],
          effectiveWeight: 1,
          administeredResponseCount: 2,
          evidenceResponseCount: 2,
          rootEvidenceResponseCount: 2,
          posterior: posteriorAt(-2),
          eligibleItems: [item(1, -2), item(2, 2)],
          anchorResponsesByLevel: new Map(),
          fieldTestResponseCount: 0,
        },
      ],
    })

    expect(selected?.item.id).toBe(1)
  })

  it('prefers unseen and underused items inside the approved information set', () => {
    const items = [item(1, 0), item(2, 0), item(3, 0)]
    const selected = selectAdaptiveV2Item({
      attemptId: 'attempt-exposure',
      responseOrder: 1,
      mode: 'DIAGNOSTIC',
      minQuestionsPerLeaf: 1,
      totalAdministeredResponses: 0,
      topInformationRatio: 1,
      researchPolicy: null,
      selectionContext: {
        priorAttemptPoolItemIds: new Set([1]),
        servedCountByPoolItem: new Map([
          [2, 10],
          [3, 2],
        ]),
      },
      leaves: [
        {
          rootId: 1,
          leafId: 2,
          stableOrder: [0, 0],
          effectiveWeight: 1,
          administeredResponseCount: 0,
          evidenceResponseCount: 0,
          rootEvidenceResponseCount: 0,
          posterior: posteriorAt(0),
          eligibleItems: items,
          anchorResponsesByLevel: new Map(),
          fieldTestResponseCount: 0,
        },
      ],
    })

    expect(selected?.item.id).toBe(3)
    expect(selected?.conditionalAdministrationProbability).toBe(1)
  })

  it('excludes items rejected by the server exposure predicate', () => {
    const selected = selectAdaptiveV2Item({
      attemptId: 'attempt-exposure-ceiling',
      responseOrder: 1,
      mode: 'DIAGNOSTIC',
      minQuestionsPerLeaf: 1,
      totalAdministeredResponses: 0,
      topInformationRatio: 1,
      researchPolicy: null,
      selectionContext: {
        isExposureEligible: (candidate) => candidate.id !== 1,
      },
      leaves: [
        {
          rootId: 1,
          leafId: 2,
          stableOrder: [0, 0],
          effectiveWeight: 1,
          administeredResponseCount: 0,
          evidenceResponseCount: 0,
          rootEvidenceResponseCount: 0,
          posterior: posteriorAt(0),
          eligibleItems: [item(1, 0), item(2, 0)],
          anchorResponsesByLevel: new Map(),
          fieldTestResponseCount: 0,
        },
      ],
    })

    expect(selected?.item.id).toBe(2)
  })

  it('reports exact joint Research role and item propensities', () => {
    const fieldTests = [
      {
        ...item(3, 0),
        calibrationId: null,
        contributesToEstimate: false,
        role: 'FIELD_TEST' as const,
      },
      {
        ...item(4, 0),
        calibrationId: null,
        contributesToEstimate: false,
        role: 'FIELD_TEST' as const,
      },
    ]
    const roles = new Set<string>()
    for (let index = 0; index < 64; index++) {
      const selected = selectAdaptiveV2Item({
        attemptId: `attempt-joint-propensity-${index}`,
        responseOrder: 2,
        mode: 'RESEARCH',
        minQuestionsPerLeaf: 1,
        totalAdministeredResponses: 1,
        topInformationRatio: 1,
        researchPolicy: {
          anchorResponsesPerLeafLevel: 1,
          fieldTestResponsesPerLeaf: 1,
          fieldTestInclusionProbability: 0.5,
          collectionDesignVersion: 'RESEARCH_DESIGN_V1',
        },
        leaves: [
          {
            rootId: 1,
            leafId: 2,
            stableOrder: [0, 0],
            effectiveWeight: 1,
            administeredResponseCount: 1,
            evidenceResponseCount: 1,
            rootEvidenceResponseCount: 1,
            posterior: posteriorAt(0),
            eligibleItems: [item(1, 0), item(2, 0), ...fieldTests],
            anchorResponsesByLevel: new Map([[1, 1]]),
            fieldTestResponseCount: 0,
          },
        ],
      })

      expect(selected).not.toBeNull()
      roles.add(selected!.role)
      expect(selected!.conditionalAdministrationProbability).toBe(0.25)
      expect(selected!.randomizationVersion).toBe(
        ADAPTIVE_V2_RANDOMIZATION_VERSION
      )
      expect(selected!.randomDraw).toBeGreaterThanOrEqual(0)
      expect(selected!.randomDraw).toBeLessThan(0x1_0000_0000)
      expect(selected!.candidateSetHash).toMatch(/^[0-9a-f]{8}$/)
    }
    expect(roles).toEqual(new Set(['SCORING', 'FIELD_TEST']))
  })

  it('accounts exactly for modulo remainders in joint propensities', () => {
    const uint32Space = 0x1_0000_0000
    const threshold = Math.floor(0.3 * uint32Space)
    const scoring = [item(1, 0), item(2, 0), item(3, 0)]
    const fieldTests = [4, 5, 6].map((id) => ({
      ...item(id, 0),
      calibrationId: null,
      contributesToEstimate: false,
      role: 'FIELD_TEST' as const,
    }))
    const observedProbabilities = new Set<number>()

    for (let attempt = 0; attempt < 256; attempt++) {
      const selected = selectAdaptiveV2Item({
        attemptId: `attempt-modulo-remainder-${attempt}`,
        responseOrder: 2,
        mode: 'RESEARCH',
        minQuestionsPerLeaf: 1,
        totalAdministeredResponses: 1,
        topInformationRatio: 1,
        researchPolicy: {
          anchorResponsesPerLeafLevel: 1,
          fieldTestResponsesPerLeaf: 1,
          fieldTestInclusionProbability: 0.3,
          collectionDesignVersion: 'RESEARCH_DESIGN_V1',
        },
        leaves: [
          {
            rootId: 1,
            leafId: 2,
            stableOrder: [0, 0],
            effectiveWeight: 1,
            administeredResponseCount: 1,
            evidenceResponseCount: 1,
            rootEvidenceResponseCount: 1,
            posterior: posteriorAt(0),
            eligibleItems: [...scoring, ...fieldTests],
            anchorResponsesByLevel: new Map([[1, 1]]),
            fieldTestResponseCount: 0,
          },
        ],
      })!
      const isFieldTest = selected.role === 'FIELD_TEST'
      const span = isFieldTest ? threshold : uint32Space - threshold
      const firstId = isFieldTest ? 4 : 1
      const candidateIndex = selected.item.id - firstId
      const preimageCount = Math.floor((span - 1 - candidateIndex) / 3) + 1
      const expectedProbability = preimageCount / uint32Space

      expect(selected.conditionalAdministrationProbability).toBe(
        expectedProbability
      )
      observedProbabilities.add(expectedProbability)
    }

    expect(observedProbabilities.size).toBeGreaterThan(1)
  })
})

function posteriorAt(theta: number) {
  const points = buildAdaptivePosteriorGrid(scale)
  return summarizeAdaptivePosterior({
    points,
    probabilities: points.map((point) =>
      Math.abs(point - theta) < 1e-12 ? 1 : 0
    ),
    scale,
    credibleMass: 0.9,
  })
}

function item(id: number, difficulty: number): AdaptiveV2PoolItem {
  return {
    id,
    leafNodeId: 2,
    nodePath: [1, 2],
    levelId: 2,
    itemType: 'NUMERICAL',
    choiceCount: null,
    model: 'TWO_PL',
    calibrationId: `calibration-${id}`,
    contributesToEstimate: true,
    role: 'SCORING',
    discrimination: 1.2,
    difficulty,
    guessing: 0,
  }
}

function createScale(): AdaptiveScaleDefinition {
  return {
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -6,
    gridMax: 6,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    levels: [
      {
        id: 1,
        label: 'Foundation',
        order: 0,
        lowerBound: Number.NEGATIVE_INFINITY,
        upperBound: -1,
        itemDifficultyPrior: -2,
      },
      {
        id: 2,
        label: 'Independent',
        order: 1,
        lowerBound: -1,
        upperBound: 1,
        itemDifficultyPrior: 0,
      },
      {
        id: 3,
        label: 'Advanced',
        order: 2,
        lowerBound: 1,
        upperBound: Number.POSITIVE_INFINITY,
        itemDifficultyPrior: 2,
      },
    ],
  }
}
