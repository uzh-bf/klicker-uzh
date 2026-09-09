const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REQUIRED_ACCOUNT_SPECS = Object.freeze([
  'A-account-lti.spec.ts',
  'A-account-production.spec.ts',
  'A-account-registration.spec.ts',
])

function reportTests(report) {
  assert(Array.isArray(report?.suites), 'Missing Playwright suites')
  assert(
    Array.isArray(report.errors) && report.errors.length === 0,
    'Playwright reported global errors'
  )
  const tests = []
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        assert(typeof spec.id === 'string' && spec.id, 'Missing test identity')
        assert.equal(test.projectName, 'chromium', 'Unexpected browser project')
        tests.push({
          key: `${path.basename(spec.file)}:${spec.id}:${test.projectName}`,
          file: path.basename(spec.file),
          test,
        })
      }
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites) visit(suite)
  assert(tests.length > 0, 'No production tests were discovered')
  assert.equal(
    new Set(tests.map(({ key }) => key)).size,
    tests.length,
    'Duplicate test identities'
  )
  return tests
}

function verifyProductionReport({ inventory, result, expectedSpecs }) {
  assert(
    Array.isArray(expectedSpecs) && expectedSpecs.length > 0,
    'Missing production spec obligations'
  )
  const planned = reportTests(inventory)
  const executed = reportTests(result)
  assert.deepEqual(
    [...new Set(planned.map(({ file }) => file))].sort(),
    [...expectedSpecs].sort(),
    'Incomplete production spec inventory'
  )
  assert.deepEqual(
    executed.map(({ key }) => key).sort(),
    planned.map(({ key }) => key).sort(),
    'Execution does not match discovered tests'
  )
  for (const { test } of executed) {
    assert.equal(
      test.expectedStatus,
      'passed',
      'Expected failures cannot satisfy production coverage'
    )
    assert.equal(
      test.status,
      'expected',
      'Production test did not pass consistently'
    )
    assert(test.results.length > 0, 'Production test never ran')
    assert(
      test.results.every(
        (entry) =>
          entry.status === 'passed' &&
          !entry.error &&
          (!entry.errors || entry.errors.length === 0)
      ),
      'Failed, skipped or interrupted production attempt'
    )
  }
  assert.equal(result.stats?.unexpected, 0)
  assert.equal(result.stats?.skipped, 0)
  assert.equal(result.stats?.flaky, 0)
  assert.equal(result.stats?.expected, executed.length)
  return { specs: [...expectedSpecs].sort(), tests: executed.length }
}

if (require.main === module) {
  const [inventoryPath, resultPath, specsPath, outputPath] =
    process.argv.slice(2)
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  // This verifier runs directly in the CI job, outside Turbo.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Candidate identity is supplied by the workflow event.
  assert.equal(sourceSha, process.env.CANDIDATE_SHA, 'Wrong candidate checkout')
  assert.deepEqual(read(specsPath).slice().sort(), REQUIRED_ACCOUNT_SPECS)
  const receipt = verifyProductionReport({
    inventory: read(inventoryPath),
    result: read(resultPath),
    expectedSpecs: read(specsPath),
  })
  const build = read('.devcontainer/.runtime/production-artifacts.json')
  assert.equal(build.sourceSha, sourceSha, 'Wrong production artifact revision')
  for (const app of ['auth', 'frontend-pwa', 'frontend-manage']) {
    assert.equal(build.artifacts[app]?.bundler, 'webpack')
    assert.match(build.artifacts[app]?.digest ?? '', /^[a-f0-9]{64}$/)
    assert(build.artifacts[app]?.buildId, 'Missing production build identity')
  }
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({ sourceSha, ...receipt, artifacts: build.artifacts }, null, 2)}\n`
  )
}

module.exports = { REQUIRED_ACCOUNT_SPECS, verifyProductionReport }
