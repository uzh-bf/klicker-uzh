import { normalizeThetaForChart } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import {
  mapLevelForTheta,
  serializeLevelBands,
} from './adaptivePracticeQuizLegacyLevelScale.js'
import type { AdaptiveParticipantElement } from './adaptivePracticeQuizRuntime.js'
import type {
  AdaptiveAttemptRuntimeRecord,
  LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'
import { buildAdaptiveTestingHistory } from './adaptivePracticeQuizTestingHistory.js'
import {
  type AdaptiveTestingLevelResolver,
  mostProbableBandLabel,
  withAdaptiveTestingEstimates,
} from './adaptivePracticeQuizTestingInfo.js'
import {
  normalizeV2Position,
  serializeV2LevelBands,
} from './adaptivePracticeQuizV2ParticipantViews.js'

// Attaches attempt-level testing data (estimates, answer history) to the
// served item's testing info. Testing info itself only exists when
// ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true; the history re-checks the same flag.
export function withAttemptTestingEstimates(
  element: AdaptiveParticipantElement,
  runtime: LoadedAdaptiveRuntime,
  attempt: AdaptiveAttemptRuntimeRecord
): AdaptiveParticipantElement {
  if (!element.testingInfo) return element
  const resolver = adaptiveTestingLevelResolver(runtime)
  const v2 =
    runtime.estimator.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  const settings = runtime.algorithm.settings
  return {
    ...element,
    testingInfo: {
      ...withAdaptiveTestingEstimates(
        element.testingInfo,
        attempt.estimates,
        resolver
      ),
      history: buildAdaptiveTestingHistory({
        responses: attempt.responses,
        estimates: attempt.estimates,
        levelBands: v2
          ? serializeV2LevelBands(runtime)
          : serializeLevelBands(runtime.algorithm.levels, settings),
        normalizeTheta: v2
          ? (theta) => normalizeV2Position(theta, runtime)
          : (theta) => normalizeThetaForChart(theta, settings.thetaRange),
        resolver,
        showSolutions: process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS,
      }),
    },
  }
}

function adaptiveTestingLevelResolver(
  runtime: LoadedAdaptiveRuntime
): AdaptiveTestingLevelResolver {
  const intervalZ = runtime.publication.evidenceMinimumSnapshot.classificationZ
  if (
    runtime.estimator.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    const levels = runtime.publication.cutScoreSnapshot
    return {
      intervalZ,
      labelForLevelId: (levelId) =>
        levels.find(({ sourceLevelId }) => sourceLevelId === levelId)?.label ??
        null,
      tentativeLabel: (estimate) =>
        mostProbableBandLabel(estimate.bandProbabilities, levels),
    }
  }
  const levels = runtime.algorithm.levels
  const settings = runtime.algorithm.settings
  return {
    intervalZ,
    labelForLevelId: (levelId) =>
      levels.find(({ id }) => id === levelId)?.label ?? null,
    tentativeLabel: (estimate) =>
      estimate.theta === null
        ? null
        : (mapLevelForTheta(estimate.theta, levels, settings)?.label ?? null),
  }
}
