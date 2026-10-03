'use strict'

// Read-only audit for priority R4 of the CI efficiency roadmap: how much
// validation an integration branch buys twice, once through its push workflows
// and once through the pull request that carries the same head.
//
// The audit never decides anything by itself. It groups runs by head and
// workflow, classifies each push/pull-request pair against the equivalence
// predicate the repository would have to satisfy to reuse one result for the
// other, and reports the counts. Keeping the predicate in one module is what
// lets the next roadmap refresh re-measure the traffic instead of re-deriving
// the query, and lets the negative result stay reproducible.
//
// Two properties of this repository make the predicate strict on purpose:
//
// - `.github/workflows/deploy-stg-promote.yml` collects its gated workflows
//   from push runs of the candidate SHA on the selected source branch, so a
//   pull-request result can never satisfy release admission.
// - The selected source branch is itself a `v3-*` branch, so every run on an
//   integration branch stays out of the reusable set exactly as
//   `.github/scripts/ci-equivalent-run.cjs` requires.

const fs = require('node:fs')

// Every run of an integration branch, including `v3` itself, is excluded from
// reuse: those branches are deployment sources (see the module comment).
const DEPLOYMENT_SOURCE_BRANCH = /^v3(-|$)/

// A pull-request wave that starts within this window of the push wave for the
// same head is the ordinary `synchronize` shape, not a sequential retest that
// could have reused the push result.
const DEFAULT_TWIN_WINDOW_MS = 5 * 60 * 1000

function fail(message) {
  throw new Error(`ci-duplicate-audit: ${message}`)
}

function requiredText(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} is required`)
  }
  return value.trim()
}

function millis(label, value) {
  const parsed = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(parsed)) fail(`${label} is not a timestamp`)
  return parsed
}

// `gh run list --json` and `gh api` disagree on the field names for the run
// id, the workflow path and the start time, so every spelling is accepted and
// normalized here.
function normalizeRun(record) {
  const started = millis(
    'startedAt',
    record.startedAt ?? record.started_at ?? record.run_started_at
  )
  const completedSource = record.updatedAt ?? record.updated_at
  const completed =
    record.status === 'completed' && completedSource
      ? millis('updatedAt', completedSource)
      : null
  const run = {
    id: String(record.id ?? record.databaseId ?? ''),
    conclusion: record.conclusion ?? null,
    event: requiredText('event', record.event),
    headBranch: requiredText(
      'headBranch',
      record.headBranch ?? record.head_branch
    ),
    headSha: requiredText('headSha', record.headSha ?? record.head_sha),
    startedAt: started,
    completedAt: completed,
    status: record.status ?? null,
    workflowPath: requiredText(
      'workflowPath',
      record.workflowPath ?? record.path ?? record.workflowName ?? record.name
    ),
  }
  if (!/^[0-9a-f]{40}$/.test(run.headSha)) {
    fail(`run ${run.id} has no full head SHA`)
  }
  return run
}

// A record whose run never started carries no wall time and cannot belong to a
// duplicate pair, so it is skipped rather than guessed at. The count is
// reported, because a sample that quietly drops records would understate the
// traffic it is supposed to measure.
function normalizeRuns(records, event) {
  const runs = []
  let skipped = 0
  for (const record of records) {
    if (record.event !== event) continue
    const startedAt =
      record.startedAt ?? record.started_at ?? record.run_started_at
    if (startedAt === undefined || startedAt === null) {
      skipped += 1
      continue
    }
    runs.push(normalizeRun(record))
  }
  return { runs, skipped }
}

function wallMinutes(run) {
  if (run.completedAt === null) return null
  return (run.completedAt - run.startedAt) / 60000
}

function isDeploymentSource(headBranch) {
  return DEPLOYMENT_SOURCE_BRANCH.test(headBranch)
}

// The predicate is deliberately narrower than "the pull request succeeded":
// a pull-request result could only replace a push result if the push branch
// were not a deployment source, the pull-request run completed successfully,
// and it finished before the push run started.
function isEquivalentEligible(pair) {
  return (
    !isDeploymentSource(pair.push.headBranch) &&
    pair.pullRequest.conclusion === 'success' &&
    pair.pullRequest.completedAt !== null &&
    pair.pullRequest.completedAt <= pair.push.startedAt
  )
}

function classifyPair(push, pullRequest, twinWindowMs) {
  const pushFinished = push.completedAt ?? Number.POSITIVE_INFINITY
  const pullFinished = pullRequest.completedAt ?? Number.POSITIVE_INFINITY
  const overlap =
    push.startedAt < pullFinished && pullRequest.startedAt < pushFinished
  const pair = {
    headBranch: push.headBranch,
    headSha: push.headSha,
    overlap,
    pullRequest,
    pullRequestStartedFirst: pullRequest.startedAt < push.startedAt,
    push,
    pushStartedFirst: push.startedAt <= pullRequest.startedAt,
    twinConcurrent:
      Math.abs(pullRequest.startedAt - push.startedAt) <= twinWindowMs,
    workflowPath: push.workflowPath,
  }
  pair.pushWallMinutes = wallMinutes(push)
  pair.eligible = isEquivalentEligible(pair)
  return pair
}

function key(run) {
  return `${run.workflowPath}\u0000${run.headSha}`
}

function group(runs) {
  const index = new Map()
  for (const run of runs) {
    const bucket = index.get(key(run)) ?? []
    bucket.push(run)
    index.set(key(run), bucket)
  }
  return index
}

function duplicateCounts(pairs) {
  const perWorkflow = new Map()
  for (const pair of pairs) {
    perWorkflow.set(
      pair.workflowPath,
      (perWorkflow.get(pair.workflowPath) ?? 0) + 1
    )
  }
  return Object.fromEntries(
    [...perWorkflow.entries()].sort((left, right) => right[1] - left[1])
  )
}

function auditDuplicateValidation({
  pushRuns,
  pullRequestRuns,
  twinWindowMs = DEFAULT_TWIN_WINDOW_MS,
}) {
  const pushSample = normalizeRuns(pushRuns, 'push')
  const pullSample = normalizeRuns(pullRequestRuns, 'pull_request')
  const push = pushSample.runs
  const pull = pullSample.runs
  const integrationPush = push.filter((run) =>
    isDeploymentSource(run.headBranch)
  )
  const pullIndex = group(pull)
  const pairs = []
  for (const pushRun of integrationPush) {
    for (const pullRun of pullIndex.get(key(pushRun)) ?? []) {
      pairs.push(classifyPair(pushRun, pullRun, twinWindowMs))
    }
  }
  const completedPushMinutes = pairs.reduce(
    (total, pair) => total + (pair.pushWallMinutes ?? 0),
    0
  )
  const reversePull = pull.filter((run) => isDeploymentSource(run.headBranch))
  const reverseTwin = reversePull.filter((pullRun) => {
    const candidates = (group(integrationPush).get(key(pullRun)) ?? []).filter(
      (pushRun) =>
        Math.abs(pushRun.startedAt - pullRun.startedAt) <= twinWindowMs
    )
    return candidates.length > 0
  })
  const sumMinutes = (runs) =>
    runs.reduce((total, run) => total + (wallMinutes(run) ?? 0), 0)
  return {
    pairs: pairs.map((pair) => ({
      eligible: pair.eligible,
      headBranch: pair.headBranch,
      headSha: pair.headSha,
      overlap: pair.overlap,
      pullRequestId: pair.pullRequest.id,
      pullRequestStartedFirst: pair.pullRequestStartedFirst,
      pushId: pair.push.id,
      pushStartedFirst: pair.pushStartedFirst,
      pushWallMinutes: pair.pushWallMinutes,
      twinConcurrent: pair.twinConcurrent,
      workflowPath: pair.workflowPath,
    })),
    summary: {
      duplicatePairs: pairs.length,
      duplicatePairsByWorkflow: duplicateCounts(pairs),
      duplicatePushWallMinutes: Math.round(completedPushMinutes * 10) / 10,
      eligiblePairs: pairs.filter((pair) => pair.eligible).length,
      integrationPushRuns: integrationPush.length,
      overlappingPairs: pairs.filter((pair) => pair.overlap).length,
      pullRequestRunsOnIntegrationHeads: reversePull.length,
      pullRequestRunsOnIntegrationHeadsMinutes:
        Math.round(sumMinutes(reversePull) * 10) / 10,
      pushRuns: push.length,
      pushStartedFirstPairs: pairs.filter((pair) => pair.pushStartedFirst)
        .length,
      skippedPullRequestRecordsWithoutStart: pullSample.skipped,
      skippedPushRecordsWithoutStart: pushSample.skipped,
      twinConcurrentPairs: pairs.filter((pair) => pair.twinConcurrent).length,
      twinConcurrentReverseRuns: reverseTwin.length,
      twinWindowMinutes: twinWindowMs / 60000,
    },
  }
}

function formatSummary(report, source = {}) {
  const summary = report.summary
  const lines = [
    '## Integration-branch duplicate validation audit',
    '',
    `- Push runs read: ${summary.pushRuns} (integration branches: ${summary.integrationPushRuns})`,
    `- Same-head push/pull-request pairs: ${summary.duplicatePairs}`,
    `- Pairs the equivalence predicate would admit: ${summary.eligiblePairs}`,
    `- Push-started-first pairs: ${summary.pushStartedFirstPairs}`,
    `- Overlapping pairs: ${summary.overlappingPairs}`,
    `- Twin-concurrent pairs (within ${summary.twinWindowMinutes} min): ${summary.twinConcurrentPairs}`,
    `- Push wall minutes inside those pairs: ${summary.duplicatePushWallMinutes}`,
    `- Records without a start time, skipped: ${summary.skippedPushRecordsWithoutStart} push / ${summary.skippedPullRequestRecordsWithoutStart} pull request`,
    `- Pull-request runs on integration heads: ${summary.pullRequestRunsOnIntegrationHeads}`,
    `- Of those, twin-concurrent with a push run: ${summary.twinConcurrentReverseRuns}`,
  ]
  if (Object.keys(summary.duplicatePairsByWorkflow).length > 0) {
    lines.push('- Duplicate pairs by workflow:')
    for (const [workflowPath, count] of Object.entries(
      summary.duplicatePairsByWorkflow
    )) {
      lines.push(`  - ${workflowPath}: ${count}`)
    }
  }
  if (source.pushFile) lines.push(`- Push records: \`${source.pushFile}\``)
  if (source.pullRequestFile) {
    lines.push(`- Pull-request records: \`${source.pullRequestFile}\``)
  }
  lines.push(
    '',
    'No changes were made. The audit is read-only and cancels nothing.',
    ''
  )
  return lines.join('\n')
}

function readRecords(filePath) {
  const file = requiredText('file path', filePath)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`could not read ${file}: ${error.message}`)
  }
  const records = Array.isArray(parsed)
    ? parsed
    : (parsed.workflow_runs ?? parsed.runs)
  if (!Array.isArray(records)) {
    fail(`${file} holds neither a run list nor a workflow_runs collection`)
  }
  return records
}

function parseArguments(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (typeof flag !== 'string' || !flag.startsWith('--')) {
      fail(`unexpected argument ${flag}`)
    }
    const value = argv[index + 1]
    // `--json` is a switch; every other option takes the next argument.
    if (value === undefined || value.startsWith('--')) {
      if (flag !== '--json') fail(`${flag} requires a value`)
      args[flag.slice(2)] = 'true'
      continue
    }
    args[flag.slice(2)] = value
    index += 1
  }
  return args
}

// The two record sets come from the two event endpoints, because one `gh run
// list` call cannot page both events together:
//
//   gh run list --event push --limit 1000 \
//     --json databaseId,event,status,conclusion,headBranch,headSha,workflowName,startedAt,updatedAt \
//     > /tmp/push-runs.json
//   gh run list --event pull_request --limit 1000 \
//     --json databaseId,event,status,conclusion,headBranch,headSha,workflowName,startedAt,updatedAt \
//     > /tmp/pr-runs.json
//   node .github/scripts/ci-duplicate-audit.cjs \
//     --push /tmp/push-runs.json --pull-request /tmp/pr-runs.json --json
//
// `gh api --paginate 'repos/<owner>/<repo>/actions/runs?event=push&per_page=100'`
// can supply the same two sets from the REST API, where the run id is `id`,
// the path is `path` and the start time is `run_started_at`.
function runAuditCli(argv = process.argv.slice(2)) {
  const args = parseArguments(argv)
  const pushFile = args.push
  const pullRequestFile = args['pull-request']
  if (!pushFile || !pullRequestFile) {
    fail('--push and --pull-request record files are both required')
  }
  const report = auditDuplicateValidation({
    pushRuns: readRecords(pushFile),
    pullRequestRuns: readRecords(pullRequestFile),
    twinWindowMs: args['twin-window-minutes']
      ? Number(args['twin-window-minutes']) * 60000
      : DEFAULT_TWIN_WINDOW_MS,
  })
  if (!Number.isFinite(report.summary.twinWindowMinutes)) {
    fail('--twin-window-minutes must be a number')
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      formatSummary(report, { pullRequestFile, pushFile }) + '\n'
    )
  }
  // The report is always JSON; `--json` stays an accepted switch so the
  // documented invocation can name the output format it gets.
  process.stdout.write(
    `${JSON.stringify({ pairs: report.pairs, summary: report.summary }, null, 2)}\n`
  )
  return report
}

if (require.main === module) {
  try {
    runAuditCli()
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  DEFAULT_TWIN_WINDOW_MS,
  auditDuplicateValidation,
  classifyPair,
  formatSummary,
  isDeploymentSource,
  isEquivalentEligible,
  normalizeRun,
  normalizeRuns,
  runAuditCli,
  wallMinutes,
}
