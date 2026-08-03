import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSimulationReport,
  renderCanonicalJsonReport,
  renderCanonicalMarkdownSummary,
} from './simulationReport.js'

const reportPath = resolve(process.cwd(), 'reports/simulation-report.json')
const markdownPath = resolve(process.cwd(), 'reports/simulation-summary.md')
const existingJson = readFileSync(reportPath, 'utf8')
const existingMarkdown = readFileSync(markdownPath, 'utf8')
const replayReport = buildSimulationReport()
const replayJson = await renderCanonicalJsonReport(replayReport, reportPath)
const replayMarkdown = await renderCanonicalMarkdownSummary(
  replayReport,
  markdownPath
)

if (existingJson !== replayJson) {
  const firstDifference = findFirstDifference(existingJson, replayJson)

  throw new Error(
    `Simulation report determinism verification failed: replay differs from ${reportPath} at serialized character ${firstDifference} (existing length ${existingJson.length}, replay length ${replayJson.length}).`
  )
}

if (existingMarkdown !== replayMarkdown) {
  const firstDifference = findFirstDifference(existingMarkdown, replayMarkdown)

  throw new Error(
    `Simulation Markdown determinism verification failed: replay differs from ${markdownPath} at character ${firstDifference} (existing length ${existingMarkdown.length}, replay length ${replayMarkdown.length}).`
  )
}

console.log('Simulation report determinism verified.')

function findFirstDifference(left: string, right: string) {
  const sharedLength = Math.min(left.length, right.length)

  for (let index = 0; index < sharedLength; index++) {
    if (left[index] !== right[index]) {
      return index
    }
  }

  return sharedLength
}
