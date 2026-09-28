import { ADAPTIVE_V2_RANDOMIZATION_VERSION } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  assertPlacementPilotSettings,
  resolvePresetSettings,
} from '../src/services/adaptivePracticeQuizConfigSettings.js'
import {
  ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
  ADAPTIVE_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
  ADAPTIVE_V2_PLACEMENT_PILOT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_STOPPING_POLICY_VERSION,
} from '../src/services/adaptivePracticeQuizEstimatorIdentity.js'
import { preparePublishedV2Settings } from '../src/services/adaptivePracticeQuizRuntimeV2.js'

function publication(
  overrides: Partial<DB.PracticeQuizAdaptivePublication> = {}
) {
  return {
    measurementVersion: 'IRT_V2_EAP_GRID_1',
    estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
    classificationPolicyVersion: 1,
    calibrationPolicyVersion: 1,
    candidateSetPolicyVersion: ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
    randomizationPolicyVersion: ADAPTIVE_V2_RANDOMIZATION_VERSION,
    overlapPolicyVersion: ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
    stoppingPolicyVersion: ADAPTIVE_V2_PLACEMENT_PILOT_STOPPING_POLICY_VERSION,
    preset: 'PLACEMENT',
    researchAllocationPolicy: null,
    totalQuestionCap: 50,
    classificationProbabilityThreshold: 0.8,
    retakePolicy: 'LATEST_COMPLETED',
    evidenceMinimumSnapshot: {
      minimumResponsesPerLeaf: 4,
      minimumResponsesPerRoot: 4,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST',
    },
    questionCapSnapshot: { node: {}, leaf: { '2': null } },
    gridMin: -6,
    gridMax: 6,
    ...overrides,
  } as DB.PracticeQuizAdaptivePublication
}

function rootPublication(
  overrides: Partial<DB.PracticeQuizAdaptivePublication> = {}
) {
  return publication({
    stoppingPolicyVersion:
      ADAPTIVE_V2_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
    totalQuestionCap: 60,
    ...overrides,
  })
}

describe('sealed overall placement pilot identity', () => {
  it('selects the explicit pilot policy from the immutable publication', () => {
    expect(preparePublishedV2Settings(publication())).toMatchObject({
      mode: 'DIAGNOSTIC',
      stoppingPolicy: 'OVERALL_PLACEMENT_PILOT',
      totalQuestionCap: 50,
      minQuestionsPerLeaf: 4,
      classificationProbabilityThreshold: 0.8,
      researchPolicy: null,
    })
  })
  it('preserves diagnostic stopping for existing publications', () => {
    expect(
      preparePublishedV2Settings(
        publication({
          preset: 'DIAGNOSTIC',
          stoppingPolicyVersion: ADAPTIVE_V2_STOPPING_POLICY_VERSION,
        })
      ).stoppingPolicy
    ).toBeUndefined()
  })
  it.each([
    { preset: 'DIAGNOSTIC' },
    { stoppingPolicyVersion: ADAPTIVE_V2_STOPPING_POLICY_VERSION },
    { totalQuestionCap: 51 },
    { classificationProbabilityThreshold: 0.9 },
    { retakePolicy: 'FIRST_COMPLETED' },
    { researchAllocationPolicy: {} },
  ])('rejects inconsistent pilot snapshot %j', (patch) => {
    expect(() =>
      preparePublishedV2Settings(publication(patch as never))
    ).toThrow()
  })
})

describe('sealed root-balanced placement identity', () => {
  it('restores the 60-question policy without changing historical publications', () => {
    expect(preparePublishedV2Settings(rootPublication())).toMatchObject({
      stoppingPolicy: 'ROOT_BALANCED_PLACEMENT',
      totalQuestionCap: 60,
      minimumRootResponses: 4,
      perLeafQuestionCap: null,
      classificationProbabilityThreshold: 0.8,
    })
    expect(preparePublishedV2Settings(publication())).toMatchObject({
      stoppingPolicy: 'OVERALL_PLACEMENT_PILOT',
      totalQuestionCap: 50,
    })
  })

  it.each([
    { totalQuestionCap: 61 },
    { preset: 'DIAGNOSTIC' },
    { classificationProbabilityThreshold: 0.7 },
    { retakePolicy: 'FIRST_COMPLETED' },
    { questionCapSnapshot: { node: {}, leaf: { '2': 4 } } },
    {
      evidenceMinimumSnapshot: {
        ...publication().evidenceMinimumSnapshot,
        minimumResponsesPerRoot: 3,
      },
    },
  ])('rejects an inconsistent root-balanced publication %j', (patch) => {
    expect(() =>
      preparePublishedV2Settings(rootPublication(patch as never))
    ).toThrow()
  })
})

describe('sealed focused root-balanced placement identity', () => {
  const focusedPublication = (
    overrides: Partial<DB.PracticeQuizAdaptivePublication> = {}
  ) =>
    publication({
      stoppingPolicyVersion:
        ADAPTIVE_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
      totalQuestionCap: 70,
      ...overrides,
    })

  it('restores the new 70-question policy without changing sealed 60-question publications', () => {
    expect(preparePublishedV2Settings(focusedPublication())).toMatchObject({
      stoppingPolicy: 'FOCUSED_ROOT_BALANCED_PLACEMENT',
      totalQuestionCap: 70,
      minimumRootResponses: 4,
      perLeafQuestionCap: null,
      classificationProbabilityThreshold: 0.8,
    })
    expect(preparePublishedV2Settings(rootPublication())).toMatchObject({
      stoppingPolicy: 'ROOT_BALANCED_PLACEMENT',
      totalQuestionCap: 60,
    })
  })

  it('inherits the tree default and accepts an explicitly configured 70-question cap', () => {
    const treeDefaults = {
      defaultDiscrimination: 1.2,
      defaultTotalQuestionCap: 50,
      defaultTimeLimitSeconds: null,
    }
    const inherited = resolvePresetSettings(
      {
        competenceTreeId: 'tree',
        scaleVersionId: 'scale',
        preset: DB.AdaptivePracticeQuizPreset.PLACEMENT,
        perLeafQuestionCap: null,
      },
      treeDefaults
    )
    expect(inherited.totalQuestionCap).toBe(50)

    const configured = resolvePresetSettings(
      {
        competenceTreeId: 'tree',
        scaleVersionId: 'scale',
        preset: DB.AdaptivePracticeQuizPreset.PLACEMENT,
        totalQuestionCap: 70,
        perLeafQuestionCap: null,
      },
      treeDefaults
    )
    expect(() =>
      assertPlacementPilotSettings(
        {
          scaleVersionId: 'scale',
          preset: DB.AdaptivePracticeQuizPreset.PLACEMENT,
          measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        },
        configured
      )
    ).not.toThrow()
  })

  it.each([
    { preset: 'DIAGNOSTIC' },
    { classificationProbabilityThreshold: 0.7 },
    { retakePolicy: 'FIRST_COMPLETED' },
    { questionCapSnapshot: { node: {}, leaf: { '2': 4 } } },
    {
      evidenceMinimumSnapshot: {
        ...publication().evidenceMinimumSnapshot,
        minimumResponsesPerRoot: 3,
      },
    },
  ])('rejects an inconsistent focused root-balanced publication %j', (patch) => {
    expect(() =>
      preparePublishedV2Settings(focusedPublication(patch as never))
    ).toThrow()
  })
})
