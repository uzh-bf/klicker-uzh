#!/usr/bin/env node
// Lists tests that passed only after a retry. CI retries each failed test
// once, so these flakes otherwise leave a green shard with no visible trace.
const fs = require('node:fs')

function collectFlaky(report) {
  const flaky = []
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === 'flaky') {
          flaky.push({ file: spec.file, line: spec.line, title: spec.title })
        }
      }
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites ?? []) visit(suite)
  return flaky
}

function render(flaky) {
  if (flaky.length === 0) return ''
  const rows = flaky.map((t) => `- \`${t.file}:${t.line}\` ${t.title}`)
  return [`#### Passed only on retry (${flaky.length})`, '', ...rows, ''].join(
    '\n'
  )
}

if (require.main === module) {
  const [reportPath, summaryPath] = process.argv.slice(2)
  if (!reportPath || !fs.existsSync(reportPath)) process.exit(0)
  const flaky = collectFlaky(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
  for (const t of flaky) {
    console.log(
      `::warning file=playwright/tests/${t.file},line=${t.line}::Passed only on retry: ${t.title}`
    )
  }
  if (summaryPath && flaky.length > 0) {
    fs.appendFileSync(summaryPath, render(flaky))
  }
}

module.exports = { collectFlaky, render }
