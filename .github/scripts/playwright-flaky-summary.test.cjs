const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const YAML = require('yaml')
const { collectFlaky, render } = require('./playwright-flaky-summary.cjs')

test('collects only flaky tests from nested suites', () => {
  const report = {
    suites: [
      {
        specs: [
          {
            file: 'A.spec.ts',
            line: 3,
            title: 'stable',
            tests: [{ status: 'expected' }],
          },
        ],
        suites: [
          {
            specs: [
              {
                file: 'B.spec.ts',
                line: 9,
                title: 'retried',
                tests: [{ status: 'flaky' }],
              },
              {
                file: 'B.spec.ts',
                line: 20,
                title: 'broken',
                tests: [{ status: 'unexpected' }],
              },
            ],
          },
        ],
      },
    ],
  }
  assert.deepEqual(collectFlaky(report), [
    { file: 'B.spec.ts', line: 9, title: 'retried' },
  ])
})

test('renders nothing when no test was retried', () => {
  assert.equal(render([]), '')
})

function runSummary(t, report) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-retries-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const reportPath = path.join(root, 'results.json')
  const summaryPath = path.join(root, 'summary.md')
  const outputPath = path.join(root, 'output')
  if (report !== undefined) {
    fs.writeFileSync(
      reportPath,
      typeof report === 'string' ? report : JSON.stringify(report)
    )
  }
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, 'playwright-flaky-summary.cjs'),
      reportPath,
      summaryPath,
      outputPath,
    ],
    { encoding: 'utf8' }
  )
  const read = (file) =>
    fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  return { ...result, output: read(outputPath), summary: read(summaryPath) }
}

function reportWithStatuses(statuses) {
  return {
    suites: [
      {
        suites: [
          {
            specs: [
              {
                file: 'synthetic.spec.ts',
                line: 7,
                title: 'synthetic retry',
                tests: statuses.map((status) => ({ status })),
              },
            ],
          },
        ],
      },
    ],
  }
}

test('CLI exposes retry count for a green run with flaky tests', (t) => {
  const result = runSummary(
    t,
    reportWithStatuses(['expected', 'flaky', 'flaky'])
  )
  assert.equal(result.status, 0)
  assert.equal(result.output, 'flaky-count=2\n')
  assert.match(result.summary, /Passed only on retry \(2\)/)
  assert.match(
    result.stdout,
    /::warning file=playwright\/tests\/synthetic.spec.ts,line=7/
  )
})

test('stable, skipped and unexpected tests do not count as passed-on-retry', (t) => {
  const result = runSummary(
    t,
    reportWithStatuses(['expected', 'skipped', 'unexpected'])
  )
  assert.equal(result.status, 0)
  assert.equal(result.output, 'flaky-count=0\n')
  assert.equal(result.summary, '')
  assert.equal(result.stdout, '')
})

test('a failed run can also contain passed-on-retry evidence', (t) => {
  const result = runSummary(t, reportWithStatuses(['unexpected', 'flaky']))
  assert.equal(result.status, 0)
  assert.equal(result.output, 'flaky-count=1\n')
})

test('missing report leaves retry evidence unknown rather than reporting zero', (t) => {
  const result = runSummary(t, undefined)
  assert.equal(result.status, 0)
  assert.equal(result.output, '')
  assert.equal(result.summary, '')
})

test('invalid JSON fails without publishing a successful zero count', (t) => {
  const result = runSummary(t, '{invalid')
  assert.notEqual(result.status, 0)
  assert.equal(result.output, '')
})

test('workflow outputs contain only the numeric count, never report titles', (t) => {
  const report = reportWithStatuses(['flaky'])
  report.suites[0].suites[0].specs[0].title = 'title\nflaky-count=0\nother=true'
  const result = runSummary(t, report)
  assert.equal(result.status, 0)
  assert.equal(result.output, 'flaky-count=1\n')
})

test('shard retains failed, flaky and unknown diagnostics without changing artifact scope', () => {
  const action = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../actions/playwright-shard/action.yml'),
      'utf8'
    )
  )
  const summary = action.runs.steps.find((step) => step.id === 'flaky-summary')
  assert.equal(summary.if, 'always()')
  assert.equal(summary['continue-on-error'], true)
  assert.match(
    summary.run,
    /\.ci-control\/\.github\/scripts\/playwright-flaky-summary\.cjs/
  )
  assert.match(summary.run, /"\$GITHUB_STEP_SUMMARY" "\$GITHUB_OUTPUT"$/)
  const upload = action.runs.steps.find(
    (step) => step.name === 'Upload Playwright diagnostics'
  )
  assert.equal(
    upload.if,
    `\${{ !cancelled() && (failure() || steps.flaky-summary.outputs.flaky-count > 0 || steps.flaky-summary.outputs.flaky-count == '') }}`
  )
  assert.equal(upload.with['retention-days'], 1)
  assert.equal(
    upload.with.name,
    `playwright-diagnostics-\${{ inputs.shard-index }}-of-\${{ inputs.shard-total }}`
  )
  assert.deepEqual(upload.with.path.trim().split('\n'), [
    'playwright/playwright-report',
    'playwright/test-results',
    'service.log',
  ])
})
