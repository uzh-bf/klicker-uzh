import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ADAPTIVE_V2_DIAGNOSTIC_RELEASE } from '../src/release.js'
import {
  formatRegressionGateFailures,
  regressionGateFailures,
  renderCanonicalJsonReport,
  renderCanonicalMarkdownSummary,
  type AdaptiveSimulationReport,
} from './simulationReport.js'

describe('adaptive-learning deterministic simulation report', () => {
  it('verifies reviewable artifacts and engineering regression gates', async () => {
    const jsonPath = fileURLToPath(
      new URL('../reports/simulation-report.json', import.meta.url)
    )
    const markdownPath = fileURLToPath(
      new URL('../reports/simulation-summary.md', import.meta.url)
    )
    const json = readFileSync(jsonPath, 'utf8')
    const report = JSON.parse(json) as AdaptiveSimulationReport
    const markdown = readFileSync(markdownPath, 'utf8')
    const failures = regressionGateFailures(report)

    expect(jsonPath.endsWith('/reports/simulation-report.json')).toBe(true)
    expect(markdownPath.endsWith('/reports/simulation-summary.md')).toBe(true)
    expect(json).toBe(await renderCanonicalJsonReport(report, jsonPath))
    expect(markdown).toBe(
      await renderCanonicalMarkdownSummary(report, markdownPath)
    )
    expect(report.schemaVersion).toBe(3)
    expect(report.irtV2.thresholdResults).toHaveLength(3)
    expect(report.irtV2.evidenceProfile).toBe('RELEASE')
    expect(report.irtV2.passed).toBe(
      report.irtV2.approvedProbabilityThreshold !== null
    )
    expect(ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion).toBe(
      report.irtV2.policyVersion
    )
    if (ADAPTIVE_V2_DIAGNOSTIC_RELEASE.enabled) {
      expect(report.irtV2.passed).toBe(true)
      expect(ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold).toBe(
        report.irtV2.approvedProbabilityThreshold
      )
    } else {
      expect(
        ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold
      ).toBeNull()
    }
    expect(report.irtV2.retainedTraces).toHaveLength(24)
    expect(
      report.irtV2.thresholdResults.every(
        ({ metrics }) =>
          metrics.strata.filter(({ key }) => key.startsWith('theta-cell:'))
            .length === 15
      )
    ).toBe(true)
    expect(report.irtV2ScenarioProbes).toHaveLength(
      report.irtV2ScenarioSet.length
    )
    expect(
      report.irtV2ScenarioProbes.every(
        ({ executedSuccessfully }) => executedSuccessfully
      )
    ).toBe(true)
    expect(
      report.irtV2ScenarioProbes.find(({ id }) => id === 'cut-sides')
        ?.releaseGate
    ).toBeNull()
    expect(
      report.irtV2ScenarioProbes
        .filter(({ id }) =>
          ['item-type-dif-sc', 'course-cohort-dif'].includes(id)
        )
        .every(({ releaseGate }) => releaseGate?.passed === true)
    ).toBe(true)
    expect(
      report.irtV2.thresholdResults.every(
        ({ gates, passed }) => passed === gates.every((gate) => gate.passed)
      )
    ).toBe(true)
    for (const scenario of report.scenarios) {
      expect(scenario.learnerTraces).toHaveLength(scenario.metrics.learnerCount)
      let nullEstimateCount = 0
      for (const trace of scenario.learnerTraces) {
        const answeredQuestions = trace[9]
        const selectedItemCount =
          trace[7] === '' ? 0 : trace[7].split(',').length
        expect(trace).toHaveLength(14)
        expect(selectedItemCount).toBe(answeredQuestions)
        expect(trace[8]).toMatch(/^[01]*$/)
        expect(trace[8]).toHaveLength(answeredQuestions)
        expect(trace[12]).toHaveLength(4)
        expect(trace[13]).toHaveLength(scenario.config.rootCount)
        if (trace[12][0] === null) nullEstimateCount += 1
      }
      expect(nullEstimateCount).toBe(scenario.metrics.nullEstimateCount)
    }
    if (failures.length > 0) {
      throw new Error(
        `Phase 11 regression gates failed:\n${formatRegressionGateFailures(
          failures
        )}`
      )
    }
  })
})
