import type { AdaptiveRuntimeStopReason } from '../src/index.js'
import { evaluateV2ReleaseGates } from './simulationV2Gates.js'
import {
  reduceAdaptiveV2SimulationMetrics as reduceMetrics,
  summarizeAdaptiveV2ExposureAndOverlap as summarizeExposureAndOverlap,
} from './simulationV2Metrics.js'
import {
  generateItemTypeEvidence,
  generateLearnerEvidence,
} from './simulationV2Population.js'
import {
  assertSimulationInput,
  fingerprintAdaptiveSimulationInput,
  prepareSimulationRuntime,
} from './simulationV2Support.js'
import type {
  AdaptiveV2SimulationInput,
  AdaptiveV2SimulationReport,
} from './simulationV2Types.js'

export { simulateAdaptiveAttemptAcrossThresholds } from './simulationV2Attempt.js'
export type {
  AdaptiveV2ReleaseGate,
  AdaptiveV2ReleasePolicy,
  AdaptiveV2SimulationMetrics,
  AdaptiveV2SimulationStratum,
} from './simulationV2Gates.js'
export { selectStratifiedRetakeEvidence } from './simulationV2Population.js'
export {
  createSimulationRandom,
  fingerprintAdaptiveSimulationInput,
  simulationChoiceCountFor,
} from './simulationV2Support.js'
export type {
  AdaptiveV2SimulationInput,
  AdaptiveV2SimulationItem,
  AdaptiveV2SimulationReport,
  AdaptiveV2SimulationTrace,
  ClassifiedObservation,
  LearnerEvidence,
  RootOutcome,
} from './simulationV2Types.js'

export function runAdaptiveV2Simulation(
  input: AdaptiveV2SimulationInput
): AdaptiveV2SimulationReport {
  assertSimulationInput(input)
  const thresholds = [...input.policy.candidateProbabilityThresholds]
  const runtime = prepareSimulationRuntime(input, thresholds.at(-1)!)
  const evidenceBundle = generateLearnerEvidence(input, runtime, thresholds)
  const itemTypeEvidence = generateItemTypeEvidence(input, thresholds)
  const inputFingerprint = fingerprintAdaptiveSimulationInput(input)
  const thresholdResults = thresholds.map((probabilityThreshold) => {
    const evidence = evidenceBundle.byThreshold.get(probabilityThreshold)!
    const exposureAndOverlap = summarizeExposureAndOverlap({
      evidence,
      pool: input.pool,
      retakePairs:
        evidenceBundle.retakePairsByThreshold.get(probabilityThreshold) ?? [],
      sampleSize: input.simulationSettings.pairwiseFormSampleSize,
    })
    const metrics = reduceMetrics({
      evidence,
      itemTypeEvidence: itemTypeEvidence.get(probabilityThreshold) ?? new Map(),
      input,
      probabilityThreshold,
      ...exposureAndOverlap,
    })
    const gates = [
      ...evaluateV2ReleaseGates(metrics, input.policy),
      ...input.scenarioReleaseGates
        .filter((gate) => gate.probabilityThreshold === probabilityThreshold)
        .map(
          ({ probabilityThreshold: _probabilityThreshold, ...gate }) => gate
        ),
    ]
    return {
      probabilityThreshold,
      metrics,
      gates,
      passed: gates.every(({ passed }) => passed),
    }
  })
  const approvedProbabilityThreshold =
    thresholdResults.find(
      ({ probabilityThreshold, passed }) =>
        probabilityThreshold >= input.policy.minimumProbabilityThreshold &&
        passed
    )?.probabilityThreshold ?? null

  return {
    schemaVersion: 1,
    evidenceProfile: input.evidenceProfile,
    inputFingerprint,
    estimatorVersion: input.estimatorVersion,
    policyVersion: input.policy.version,
    seed: input.seed,
    thresholdResults,
    approvedProbabilityThreshold,
    passed: approvedProbabilityThreshold !== null,
    retainedTraces: evidenceBundle.byThreshold
      .get(thresholds[0]!)!
      .slice(0, input.retainedTraceLimit)
      .map((learner) => ({
        learnerId: learner.learnerId,
        trueTheta: learner.trueTheta,
        trueLevelId: learner.trueLevelId,
        courseCohort: learner.courseCohort,
        cutDistance: learner.cutDistance,
        thetaCellKey: learner.thetaCellKey,
        selectedItemIds: learner.selectedItemIds,
        responseBits: learner.responseBits,
        posteriorMean: learner.posterior.mean,
        credibleLower: learner.posterior.credibleLower,
        credibleUpper: learner.posterior.credibleUpper,
        resultStatus: learner.observation.resultStatus,
        stopReason: learner.observation.stopReason as AdaptiveRuntimeStopReason,
      })),
  }
}
