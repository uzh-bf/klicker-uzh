import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  formatRegressionGateFailures,
  regressionGateFailures,
  writeSimulationReport,
} from './simulationReport.js'

describe('adaptive-learning deterministic simulation report', () => {
  it('writes reviewable artifacts and enforces engineering regression gates', () => {
    const { report, jsonPath, markdownPath } = writeSimulationReport()
    const failures = regressionGateFailures(report)
    const prettierPath = fileURLToPath(
      new URL('../../../node_modules/.bin/prettier', import.meta.url)
    )

    execFileSync(prettierPath, ['--write', jsonPath, markdownPath])

    expect(jsonPath.endsWith('/reports/simulation-report.json')).toBe(true)
    expect(markdownPath.endsWith('/reports/simulation-summary.md')).toBe(true)
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
