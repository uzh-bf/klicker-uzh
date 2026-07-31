import { beforeAll, describe, expect, it } from 'vitest'
import {
  runAdaptiveV2Simulation,
  type AdaptiveV2SimulationReport,
} from '../scripts/internalSimulation.js'
import { buildAdaptiveV2ContractInput } from '../scripts/simulationV2Scenarios.js'

describe('IRT v2 synthetic release evidence', () => {
  let report: AdaptiveV2SimulationReport

  beforeAll(() => {
    report = runAdaptiveV2Simulation(buildAdaptiveV2ContractInput())
  }, 900_000)

  it('evaluates every code-owned threshold without approving a failing profile', () => {
    expect(
      report.thresholdResults.map(
        ({ probabilityThreshold }) => probabilityThreshold
      )
    ).toEqual([0.8, 0.9, 0.95])
    expect(
      report.thresholdResults.every(
        ({ gates, passed }) => passed === gates.every((gate) => gate.passed)
      )
    ).toBe(true)
  })

  it('reports the reviewed sample, uncertainty, safety, and duration evidence', () => {
    const metrics = report.thresholdResults[0]!.metrics

    expect(metrics.learnerCount).toBe(36)
    expect(
      metrics.strata.every(({ key, learnerCount }) =>
        key.startsWith('theta-cell:') ? learnerCount >= 1 : learnerCount >= 8
      )
    ).toBe(true)
    expect(
      metrics.strata.filter(({ key }) => key.startsWith('theta-cell:'))
    ).toHaveLength(15)
    expect(metrics.forcedClassificationCount).toBe(0)
    expect(metrics.unexpectedFallbackCount).toBe(0)
    expect(Number.isFinite(metrics.absoluteBiasUpper95)).toBe(true)
    expect(Number.isFinite(metrics.rmseUpper95)).toBe(true)
    expect(metrics.credibleCoverage).toBeGreaterThan(0)
    expect(metrics.p95QuestionCount).toBeLessThanOrEqual(60)
    expect(metrics.p95DurationSeconds).toBeLessThanOrEqual(3_600)
  })

  it('keeps report traces compact and reproducibly fingerprinted', () => {
    expect(report.inputFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(report.retainedTraces).toHaveLength(24)
    expect(
      report.retainedTraces.every(
        ({
          trueTheta,
          cutDistance,
          thetaCellKey,
          selectedItemIds,
          responseBits,
        }) =>
          (cutDistance === 'NEAR_CUT'
            ? thetaCellKey === null &&
              Math.abs(
                Math.min(
                  Math.abs(trueTheta - -1.5),
                  Math.abs(trueTheta - 1.5)
                ) - 0.02
              ) < 1e-12
            : thetaCellKey?.startsWith('theta-cell:') === true) &&
          selectedItemIds.length > 0 &&
          selectedItemIds.length <= 60 &&
          responseBits.length === selectedItemIds.length
      )
    ).toBe(true)
  })
})
