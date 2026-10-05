import {
  createAdaptiveClient,
  type ValidationRequest,
} from '@klicker-uzh/adaptive-client'
import { GraphQLError } from 'graphql'

type AdaptiveEngineValidator = Pick<
  ReturnType<typeof createAdaptiveClient>,
  'validate'
>

// Synthetic, content-free IRT_V1 snapshot: one competence, one subcompetence,
// two levels and one item. It only probes which settings the engine accepts.
function toleranceProbe(toleranceBands?: number): ValidationRequest {
  return {
    contractVersion: 1,
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
    responses: [],
    levels: [
      { id: 1, label: 'level-0', order: 0 },
      { id: 2, label: 'level-1', order: 1 },
    ],
    pool: [
      {
        id: 1,
        leafNodeId: 2,
        nodePath: [1, 2],
        levelId: 1,
        discrimination: 1.2,
        difficulty: 0,
        guessing: 0.25,
      },
    ],
    settings: {
      totalQuestionCap: 10,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 1,
      classificationZ: 1.28,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST',
      thetaRange: { min: -3, max: 3 },
      ...(toleranceBands
        ? { classificationToleranceBands: toleranceBands }
        : {}),
    },
  }
}

/**
 * Publication guard for IRT_V1 classification tolerance above 0, which needs
 * Catalyst SEQUENTIAL_ROOTS_V6; older engines reject the setting as invalid.
 * The same probe is validated without the setting first, so an unavailable
 * engine is reported as unavailable rather than as an unsupported setting.
 */
export async function assertAdaptiveEngineSupportsClassificationTolerance(
  toleranceBands: number,
  validator?: AdaptiveEngineValidator
) {
  if (toleranceBands <= 0) return
  const engine = validator ?? createConfiguredValidator()
  try {
    await engine.validate(toleranceProbe())
  } catch {
    throw new GraphQLError(
      'The adaptive calculation service is unavailable. Please try again.',
      { extensions: { code: 'ADAPTIVE_ENGINE_UNAVAILABLE' } }
    )
  }
  try {
    await engine.validate(toleranceProbe(toleranceBands))
  } catch {
    throw new GraphQLError(
      'The adaptive engine does not support the selected classification precision yet. Choose "Exact level" or publish again after the engine upgrade.',
      {
        extensions: { code: 'ADAPTIVE_CLASSIFICATION_TOLERANCE_UNSUPPORTED' },
      }
    )
  }
}

function createConfiguredValidator(): AdaptiveEngineValidator {
  const baseUrl = process.env.ADAPTIVE_ENGINE_URL
  const token = process.env.ADAPTIVE_ENGINE_TOKEN
  if (!baseUrl || !token) {
    return {
      validate: () =>
        Promise.reject(new Error('Adaptive engine is not configured')),
    }
  }
  return createAdaptiveClient({ baseUrl, token, timeoutMs: 4000 })
}
