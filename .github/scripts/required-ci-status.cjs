// Shared, dependency-free contract for the always-reporting required status
// jobs. The unit, OLAT, translation, and GraphQL reporters use the same
// validated selection/result decision plus the same machine-readable evidence
// artifact, so a required context can never pass on missing selection data, an
// unexpected skip, or a deferred draft.
//
// Selection states:
//   run       - the suite must execute and succeed for this event
//   no-change - an explicitly validated selection ran no suite
//
// Only the literal strings produced by the path selector are accepted. An
// empty, absent, or unexpected value is a failure, never an implicit skip.

const REASON = Object.freeze({
  noChange: 'no-change',
  success: 'success',
  unexpectedSkip: 'unexpected-skip',
  draftDeferred: 'draft-deferred',
  cancelled: 'cancelled',
  missingResult: 'missing-result',
  filterFailed: 'filter-failed',
  invalidSelection: 'invalid-selection',
  invalidReuse: 'invalid-reuse',
})

// Fold the raw selector output into a validated selection.
function resolveSelection(shouldRun) {
  if (shouldRun === 'true') return { selection: 'run', reason: REASON.success }
  if (shouldRun === 'false') {
    return { selection: 'no-change', reason: REASON.noChange }
  }
  throw new Error(
    'invalid path selection ' +
      JSON.stringify(shouldRun ?? null) +
      '; expected the literal "true" or "false"'
  )
}

// A draft gate skips the suite before it runs, so the terminal required context
// must stay non-green. This also covers a draft whose suite did run: a green
// draft-era result would be reusable on the same unchanged head at the ready
// transition, so no draft selection may pass except a validated no-change.
// A genuine failure keeps its own conclusion for diagnosis.
function decideResult(input) {
  if (input.selection === 'no-change') {
    // A no-change selection still proves the suite did not fail: only a skipped
    // suite (the selector chose nothing) or a successful one may pass. A
    // cancelled or failed suite keeps the required context non-green.
    if (input.result === 'skipped' || input.result === 'success') {
      return { ok: true, reason: REASON.noChange }
    }
    if (input.result === 'cancelled') {
      return { ok: false, reason: REASON.cancelled }
    }
    return { ok: false, reason: input.result || REASON.missingResult }
  }
  if (!input.result) {
    return { ok: false, reason: REASON.missingResult }
  }
  if (input.result === 'success') {
    return input.draft === 'true'
      ? { ok: false, reason: REASON.draftDeferred }
      : { ok: true, reason: REASON.success }
  }
  if (input.result === 'skipped') {
    return input.draft === 'true'
      ? { ok: false, reason: REASON.draftDeferred }
      : { ok: false, reason: REASON.unexpectedSkip }
  }
  // The terminal reporter runs unconditionally, so a cancelled dependency is a
  // real failure here rather than a skipped check that could read as acceptable.
  if (input.result === 'cancelled') {
    return { ok: false, reason: REASON.cancelled }
  }
  return { ok: false, reason: input.result }
}

function evaluateReport(input) {
  if (input.duplicateRunId) return { ok: false, reason: REASON.invalidReuse }
  // The selector must report its result explicitly. An absent result is not a
  // no-change signal and never permits a pass.
  if (input.filterResult !== 'success') {
    return {
      ok: false,
      reason: REASON.filterFailed + ':' + (input.filterResult || 'missing'),
    }
  }
  let selection
  try {
    selection = resolveSelection(input.shouldRun).selection
  } catch (error) {
    return { ok: false, reason: REASON.invalidSelection + ':' + error.message }
  }
  return decideResult({
    selection,
    result: input.testResult,
    draft: input.draft,
  })
}

function appendSummary(message) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  try {
    require('node:fs').appendFileSync(summaryPath, message + '\n')
  } catch {
    // A missing writable summary must not change the reported decision.
  }
}

// Machine-readable evidence for the trusted staging promoter. It records the
// exact run identity, the validated selection, and every contributing job
// result so the controller can bind a candidate to selection evidence instead
// of a bare green terminal context. The upload fails when this file is missing.
//
// Every job object carries a role so the reader can tell the selector (path
// filter), the suite, and any auxiliary job apart without name matching:
//   selection - the path-filter job; its success proves the selection ran
//   suite     - the tested suite; success is required when the state is "run"
//   auxiliary - any remaining contributing job
const JOB_INPUTS = Object.freeze([
  ['selection', 'SELECTION'],
  ['suite', 'SUITE'],
  ['auxiliary', 'AUX'],
])

function collectJobs(env) {
  const jobs = []
  for (const [role, prefix] of JOB_INPUTS) {
    const names = env[prefix + '_JOBS']
      ? JSON.parse(env[prefix + '_JOBS'])
      : [(env[prefix + '_JOB'] ?? '').trim()].filter(Boolean)
    for (const name of names) {
      jobs.push({ role, name, result: env[prefix + '_JOB_RESULT'] ?? '' })
    }
  }
  return jobs
}

function buildEvidence(input, decision, selection) {
  return {
    schemaVersion: 1,
    workflow: {
      path: input.workflowPath,
      terminalJob: input.terminalJob,
    },
    event: {
      name: input.eventName,
      action: input.action,
      ref: input.ref,
      branch: input.refName,
      sha: input.sha,
      headSha: input.headSha || input.sha,
    },
    repository: input.repository,
    run: { id: input.runId, attempt: input.runAttempt },
    selection: { state: selection.selection, reason: selection.reason },
    reuse: null,
    decision: {
      outcome: decision.ok ? 'pass' : 'fail',
      reason: decision.reason,
    },
    jobs: Array.isArray(input.jobs) ? input.jobs : collectJobs(input),
  }
}

function writeEvidence(input, decision, selection) {
  const evidencePath = input.evidencePath || 'required-ci-evidence.json'
  require('node:fs').writeFileSync(
    evidencePath,
    JSON.stringify(buildEvidence(input, decision, selection), null, 2) + '\n'
  )
  return evidencePath
}

function readEnv(env) {
  return {
    eventName: env.EVENT_NAME ?? '',
    action: env.ACTION ?? '',
    draft: env.DRAFT === 'true' ? 'true' : 'false',
    filterResult: env.FILTER_RESULT ?? '',
    shouldRun: env.SHOULD_RUN ?? '',
    duplicateRunId: (env.DUPLICATE_RUN_ID ?? '').trim(),
    testResult: env.TEST_RESULT ?? '',
    refName: env.REF_NAME ?? '',
    ref: env.REF ?? '',
    sha: env.SHA ?? '',
    headSha: env.HEAD_SHA ?? '',
    repository: env.REPOSITORY ?? '',
    runId: Number(env.RUN_ID ?? 0),
    runAttempt: Number(env.RUN_ATTEMPT ?? 0),
    workflowPath: env.WORKFLOW_PATH ?? '',
    terminalJob: env.TERMINAL_JOB ?? '',
    evidencePath: env.EVIDENCE_PATH ?? '',
    // The contributing job results travel in the same environment so the CLI
    // path records them without a separate argument.
    jobs: collectJobs(env),
  }
}

function run(subcommand, input) {
  if (subcommand !== 'report') {
    process.stderr.write(
      'unknown subcommand ' + JSON.stringify(subcommand) + '\n'
    )
    return 1
  }
  const decision = evaluateReport(input)
  let selection
  try {
    selection = resolveSelection(input.shouldRun)
  } catch {
    selection = { selection: 'no-change', reason: REASON.invalidSelection }
  }
  writeEvidence(input, decision, selection)
  process.stdout.write(
    'required-status ' +
      (decision.ok ? 'passed' : 'failed') +
      ': ' +
      decision.reason +
      '\n'
  )
  appendSummary(
    'Required suite decision: ' +
      (decision.ok ? 'pass' : 'fail') +
      ' (' +
      decision.reason +
      ')'
  )
  return decision.ok ? 0 : 1
}

if (require.main === module) {
  process.exitCode = run(process.argv[2], readEnv(process.env))
}

module.exports = {
  REASON,
  buildEvidence,
  collectJobs,
  decideResult,
  evaluateReport,
  readEnv,
  resolveSelection,
  run,
  writeEvidence,
}
