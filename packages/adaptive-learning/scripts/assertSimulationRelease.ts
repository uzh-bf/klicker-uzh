import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AdaptiveSimulationReport } from './simulationReport.js'
import { assertAdaptiveV2SimulationRelease } from './simulationV2ReleaseAssertion.js'

const report = JSON.parse(
  readFileSync(resolve(process.cwd(), 'reports/simulation-report.json'), 'utf8')
) as AdaptiveSimulationReport

assertAdaptiveV2SimulationRelease(report.irtV2)
