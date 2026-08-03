import { evaluateAdaptiveV2ReleaseGate } from './simulationV2Gates.js'
import type { AdaptiveV2SimulationReport } from './simulationV2Types.js'

export function assertAdaptiveV2SimulationRelease(
  report: AdaptiveV2SimulationReport
) {
  if (report.evidenceProfile !== 'RELEASE') {
    throw new Error('Adaptive release assertions require RELEASE evidence.')
  }
  const inconsistentResult = report.thresholdResults.find(
    ({ gates, passed }) =>
      gates.length === 0 ||
      gates.some(
        (gate) => gate.passed !== evaluateAdaptiveV2ReleaseGate(gate)
      ) ||
      passed !== gates.every((gate) => evaluateAdaptiveV2ReleaseGate(gate))
  )
  if (
    inconsistentResult !== undefined ||
    report.thresholdResults.length === 0
  ) {
    throw new Error(
      'Adaptive release report threshold results are internally inconsistent.'
    )
  }
  const derivedApprovedThreshold =
    report.thresholdResults.find(({ gates }) =>
      gates.every((gate) => evaluateAdaptiveV2ReleaseGate(gate))
    )?.probabilityThreshold ?? null
  if (
    report.approvedProbabilityThreshold !== derivedApprovedThreshold ||
    report.passed !== (derivedApprovedThreshold !== null)
  ) {
    throw new Error(
      'Adaptive release report approval fields contradict its gates.'
    )
  }
  if (derivedApprovedThreshold === null) {
    throw new Error(formatAdaptiveV2ReleaseFailures(report))
  }

  return derivedApprovedThreshold
}

export function formatAdaptiveV2ReleaseFailures(
  report: AdaptiveV2SimulationReport
) {
  return `No v2 threshold passed:\n${report.thresholdResults
    .map(
      ({ probabilityThreshold, gates }) =>
        `${probabilityThreshold}: ${gates
          .filter(({ passed }) => !passed)
          .map(
            ({ name, actual, required }) => `${name}=${actual} (${required})`
          )
          .join(', ')}`
    )
    .join('\n')}`
}
