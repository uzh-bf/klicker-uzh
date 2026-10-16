const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  auditDuplicateValidation,
  classifyPair,
  formatSummary,
  isDeploymentSource,
  normalizeRun,
  normalizeRuns,
  wallMinutes,
} = require('./ci-duplicate-audit.cjs')

const HEAD = 'a'.repeat(40)
const OTHER_HEAD = 'b'.repeat(40)
const THIRD_HEAD = 'c'.repeat(40)
const FOURTH_HEAD = 'd'.repeat(40)

function run({
  branch = 'v3-ai',
  conclusion = 'success',
  event,
  headSha = HEAD,
  id,
  startedAt,
  status = 'completed',
  updatedAt,
  workflowPath = '.github/workflows/test-unit.yml',
}) {
  return {
    conclusion,
    event,
    headBranch: branch,
    headSha,
    id,
    startedAt,
    status,
    updatedAt,
    workflowPath,
  }
}

test('only v3 branches count as deployment sources', () => {
  assert.equal(isDeploymentSource('v3'), true)
  assert.equal(isDeploymentSource('v3-ai'), true)
  assert.equal(isDeploymentSource('v3-audit'), true)
  assert.equal(isDeploymentSource('rs/feature'), false)
  assert.equal(isDeploymentSource('v30'), false)
  assert.equal(isDeploymentSource('release/v3'), false)
})

test('a run record is normalized from either API spelling', () => {
  const fromRunList = normalizeRun(
    run({
      event: 'push',
      id: 1,
      startedAt: '2026-09-20T10:00:00Z',
      updatedAt: '2026-09-20T10:10:00Z',
    })
  )
  const fromApi = normalizeRun({
    event: 'pull_request',
    head_branch: 'v3-ai',
    head_sha: HEAD,
    id: 2,
    path: '.github/workflows/test-unit.yml',
    run_started_at: '2026-09-20T10:20:00Z',
    status: 'in_progress',
    updated_at: '2026-09-20T10:21:00Z',
  })
  assert.equal(fromRunList.id, '1')
  assert.equal(fromRunList.workflowPath, '.github/workflows/test-unit.yml')
  assert.equal(wallMinutes(fromRunList), 10)
  // An unfinished run has no wall time to count, so it cannot inflate a total.
  assert.equal(fromApi.completedAt, null)
  assert.equal(wallMinutes(fromApi), null)
})

test('a run record without a full head SHA is rejected', () => {
  assert.throws(
    () =>
      normalizeRun(
        run({
          event: 'push',
          headSha: 'abc',
          id: 3,
          startedAt: '2026-09-20T10:00:00Z',
        })
      ),
    /full head SHA/
  )
})

test('a gh run list record normalizes its database id and workflow name', () => {
  const normalized = normalizeRun({
    conclusion: 'success',
    databaseId: 35504725741,
    event: 'push',
    headBranch: 'v3',
    headSha: HEAD,
    startedAt: '2026-09-20T10:56:00Z',
    status: 'completed',
    updatedAt: '2026-09-20T11:06:00Z',
    workflowName: 'Test lightweight unit suites',
  })

  assert.equal(normalized.id, '35504725741')
  assert.equal(normalized.workflowPath, 'Test lightweight unit suites')
  assert.equal(wallMinutes(normalized), 10)
})

test('records whose run never started are counted instead of normalized', () => {
  const sample = normalizeRuns(
    [
      run({ event: 'push', id: 31, startedAt: null, status: 'queued' }),
      run({
        event: 'pull_request',
        id: 32,
        startedAt: '2026-09-20T10:00:00Z',
      }),
      run({ event: 'push', id: 33, startedAt: '2026-09-20T11:00:00Z' }),
    ],
    'push'
  )

  assert.equal(sample.skipped, 1)
  assert.deepEqual(
    sample.runs.map((entry) => entry.id),
    ['33']
  )
})

test('a pair is only eligible when the pull request finished first on a non-source branch', () => {
  const push = normalizeRun(
    run({
      event: 'push',
      id: 1,
      startedAt: '2026-09-20T10:00:00Z',
      updatedAt: '2026-09-20T10:30:00Z',
    })
  )
  const sequential = normalizeRun(
    run({
      branch: 'rs/feature',
      event: 'pull_request',
      id: 2,
      startedAt: '2026-09-20T09:00:00Z',
      updatedAt: '2026-09-20T09:30:00Z',
    })
  )
  const qualified = classifyPair(
    { ...push, headBranch: 'rs/feature' },
    sequential,
    300000
  )
  assert.equal(qualified.eligible, true)
  assert.equal(qualified.overlap, false)
  assert.equal(qualified.pushStartedFirst, false)

  // The same sequential shape on a deployment source branch stays rejected.
  const source = classifyPair(push, sequential, 300000)
  assert.equal(source.eligible, false)

  // A pull request that finished after the push started is not a reuse.
  const late = normalizeRun(
    run({
      branch: 'rs/feature',
      event: 'pull_request',
      id: 3,
      startedAt: '2026-09-20T10:05:00Z',
      updatedAt: '2026-09-20T10:40:00Z',
    })
  )
  const overlapping = classifyPair(
    { ...push, headBranch: 'rs/feature' },
    late,
    300000
  )
  assert.equal(overlapping.eligible, false)
  assert.equal(overlapping.overlap, true)
  assert.equal(overlapping.pushStartedFirst, true)
})

test('a failed pull-request run never qualifies as reusable evidence', () => {
  const push = normalizeRun(
    run({
      event: 'push',
      id: 1,
      startedAt: '2026-09-20T10:00:00Z',
      updatedAt: '2026-09-20T10:30:00Z',
    })
  )
  const failed = normalizeRun(
    run({
      branch: 'rs/feature',
      conclusion: 'failure',
      event: 'pull_request',
      id: 2,
      startedAt: '2026-09-20T09:00:00Z',
      updatedAt: '2026-09-20T09:30:00Z',
    })
  )
  assert.equal(
    classifyPair({ ...push, headBranch: 'rs/feature' }, failed, 300000)
      .eligible,
    false
  )
})

test('the audit groups pairs by workflow and head and counts the shapes', () => {
  const report = auditDuplicateValidation({
    pullRequestRuns: [
      run({
        event: 'pull_request',
        id: 11,
        startedAt: '2026-09-20T10:00:30Z',
        updatedAt: '2026-09-20T10:40:00Z',
      }),
      run({
        event: 'pull_request',
        // A pull-request run without a push twin still counts in the reverse
        // direction, which is why it carries a head of its own.
        headSha: THIRD_HEAD,
        id: 12,
        startedAt: '2026-09-20T11:00:00Z',
        updatedAt: '2026-09-20T11:30:00Z',
      }),
      run({
        branch: 'rs/feature',
        event: 'pull_request',
        headSha: FOURTH_HEAD,
        id: 13,
        startedAt: '2026-09-20T12:00:00Z',
        updatedAt: '2026-09-20T12:30:00Z',
      }),
    ],
    pushRuns: [
      run({
        event: 'push',
        id: 21,
        startedAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:50:00Z',
      }),
      run({
        event: 'push',
        headSha: OTHER_HEAD,
        id: 22,
        startedAt: '2026-09-20T12:00:00Z',
        updatedAt: '2026-09-20T12:20:00Z',
      }),
      run({
        branch: 'rs/feature',
        event: 'push',
        headSha: OTHER_HEAD,
        id: 23,
        startedAt: '2026-09-20T13:00:00Z',
        updatedAt: '2026-09-20T13:10:00Z',
      }),
    ],
  })

  assert.equal(report.summary.pushRuns, 3)
  assert.equal(report.summary.integrationPushRuns, 2)
  // Only the push runs on integration heads are grouped, and only the head that
  // also has a pull-request run produces a pair.
  assert.equal(report.summary.duplicatePairs, 1)
  assert.equal(report.summary.eligiblePairs, 0)
  assert.equal(report.summary.pushStartedFirstPairs, 1)
  assert.equal(report.summary.overlappingPairs, 1)
  assert.equal(report.summary.twinConcurrentPairs, 1)
  assert.equal(report.summary.duplicatePushWallMinutes, 50)
  assert.deepEqual(report.summary.duplicatePairsByWorkflow, {
    '.github/workflows/test-unit.yml': 1,
  })
  // The reverse direction counts the pull-request runs on integration heads that
  // started beside a push run for the same head.
  assert.equal(report.summary.pullRequestRunsOnIntegrationHeads, 2)
  assert.equal(report.summary.twinConcurrentReverseRuns, 1)
  assert.equal(report.pairs[0].pushId, '21')

  const summary = formatSummary(report, {
    pushFile: 'p.json',
    pullRequestFile: 'r.json',
  })
  assert.match(summary, /Pairs the equivalence predicate would admit: 0/)
  assert.match(summary, /No changes were made/)
})

test('a queued record is reported and does not stop the measurement', () => {
  const report = auditDuplicateValidation({
    pullRequestRuns: [
      run({
        event: 'pull_request',
        id: 41,
        startedAt: '2026-09-20T10:00:30Z',
        updatedAt: '2026-09-20T10:40:00Z',
      }),
    ],
    pushRuns: [
      run({
        event: 'push',
        id: 42,
        startedAt: '2026-09-20T10:00:00Z',
        updatedAt: '2026-09-20T10:50:00Z',
      }),
      run({
        event: 'push',
        headSha: OTHER_HEAD,
        id: 43,
        startedAt: null,
        status: 'queued',
        updatedAt: '2026-09-20T10:50:00Z',
      }),
    ],
  })

  assert.equal(report.summary.skippedPushRecordsWithoutStart, 1)
  assert.equal(report.summary.skippedPullRequestRecordsWithoutStart, 0)
  assert.equal(report.summary.pushRuns, 1)
  assert.equal(report.summary.duplicatePairs, 1)
})

test('an empty sample reports zero instead of guessing', () => {
  const report = auditDuplicateValidation({ pullRequestRuns: [], pushRuns: [] })
  assert.deepEqual(report.pairs, [])
  assert.equal(report.summary.duplicatePairs, 0)
  assert.equal(report.summary.duplicatePushWallMinutes, 0)
  assert.equal(report.summary.twinWindowMinutes, 5)
})

test('the documented invocation runs with a valueless --json switch', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'duplicate-audit-'))
  const pushFile = path.join(directory, 'push-runs.json')
  const pullRequestFile = path.join(directory, 'pr-runs.json')
  const record = (overrides) => ({
    conclusion: 'success',
    event: 'push',
    headBranch: 'v3-ai',
    headSha: HEAD,
    startedAt: '2026-09-20T10:00:00Z',
    status: 'completed',
    updatedAt: '2026-09-20T10:50:00Z',
    workflowName: 'Test lightweight unit suites',
    ...overrides,
  })
  fs.writeFileSync(pushFile, JSON.stringify([record({ databaseId: 51 })]))
  fs.writeFileSync(
    pullRequestFile,
    JSON.stringify([
      record({
        databaseId: 52,
        event: 'pull_request',
        startedAt: '2026-09-20T10:00:30Z',
        updatedAt: '2026-09-20T10:40:00Z',
      }),
    ])
  )

  const output = execFileSync(
    process.execPath,
    [
      path.join(__dirname, 'ci-duplicate-audit.cjs'),
      '--push',
      pushFile,
      '--pull-request',
      pullRequestFile,
      '--json',
    ],
    { encoding: 'utf8' }
  )
  const report = JSON.parse(output)

  assert.equal(report.summary.pushRuns, 1)
  assert.equal(report.summary.duplicatePairs, 1)
  assert.equal(report.summary.duplicatePushWallMinutes, 50)
  assert.deepEqual(report.summary.duplicatePairsByWorkflow, {
    'Test lightweight unit suites': 1,
  })
  fs.rmSync(directory, { force: true, recursive: true })
})
