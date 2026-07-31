import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_MEASUREMENT_VERSIONS,
  AdaptiveRuntimeConfigurationError,
  assertSupportedEstimatorVersion,
  prepareAdaptiveRuntime,
  prepareAdaptiveV2Runtime,
  resolveAdaptiveEstimator,
} from '../src/index.js'

describe('adaptive estimator version dispatch', () => {
  it('resolves immutable v1 and v2 estimator identities', () => {
    expect(resolveAdaptiveEstimator('IRT_V1')).toEqual({
      version: 'IRT_V1',
      estimation: 'LEGACY_MLE_MAP',
    })
    expect(resolveAdaptiveEstimator('IRT_V2_EAP_GRID_1')).toEqual({
      version: 'IRT_V2_EAP_GRID_1',
      estimation: 'BAYESIAN_EAP_GRID',
    })
    expect(Object.isFrozen(resolveAdaptiveEstimator('IRT_V1'))).toBe(true)
    expect(Object.isFrozen(ADAPTIVE_MEASUREMENT_VERSIONS)).toBe(true)
    const mutableVersions = ADAPTIVE_MEASUREMENT_VERSIONS as unknown as string[]
    expect(() => {
      mutableVersions.push('IRT_V3_MUTATED')
    }).toThrow(TypeError)
  })

  it('fails closed for unknown versions and runtime mismatches', () => {
    expect(() =>
      assertSupportedEstimatorVersion('IRT_V3_UNKNOWN')
    ).toThrowError(AdaptiveRuntimeConfigurationError)
    expect(() =>
      prepareAdaptiveRuntime({
        measurementVersion: 'IRT_V2_EAP_GRID_1',
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
        ],
        levels: [{ id: 1, label: 'Only', order: 0 }],
        pool: [],
        settings: {
          totalQuestionCap: 1,
          perLeafQuestionCap: null,
          minQuestionsPerLeaf: 1,
          classificationZ: 1.28,
          topInformationRatio: 0.8,
          levelMappingRule: 'NEAREST',
          thetaRange: { min: -3, max: 3 },
        },
      })
    ).toThrowError('The legacy adaptive runtime requires the IRT_V1 estimator.')
    expect(() =>
      prepareAdaptiveV2Runtime({
        measurementVersion: 'IRT_V1',
        nodes: [],
        scale: {} as never,
        pool: [],
        settings: {} as never,
      })
    ).toThrowError(
      'The Bayesian adaptive runtime requires the IRT_V2_EAP_GRID_1 estimator.'
    )
  })
})
