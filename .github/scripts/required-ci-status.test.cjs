const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  REASON,
  buildEvidence,
  decideResult,
  evaluateReport,
  readEnv,
  resolveSelection,
} = require('./required-ci-status.cjs')

const STATUS_SCRIPT = path.join(__dirname, 'required-ci-status.cjs')
const REPOSITORY = 'uzh-bf/klicker-uzh'

function baseInput(overrides = {}) {
  return {
    eventName: 'pull_request',
    action: 'synchronize',
    draft: 'false',
    filterResult: 'success',
    shouldRun: 'true',
    duplicateRunId: '',
    testResult: 'success',
    refName: 'feature',
    ref: 'refs/pull/1/merge',
    sha: 'a'.repeat(40),
    headSha: 'a'.repeat(40),
    repository: REPOSITORY,
    runId: 11,
    runAttempt: 1,
    workflowPath: '.github/workflows/test-unit.yml',
    terminalJob: 'test-unit-status',
    evidencePath: '',
    stagingSourceBranch: '',
    ...overrides,
  }
}

test('selection accepts only the literal selector values', () => {
  assert.deepEqual(resolveSelection('true'), {
    selection: 'run',
    reason: REASON.success,
  })
  assert.deepEqual(resolveSelection('false'), {
    selection: 'no-change',
    reason: REASON.noChange,
  })
  for (const value of [
    undefined,
    null,
    'True',
    'yes',
    '',
    '  ',
    'unexpected',
  ]) {
    assert.throws(() => resolveSelection(value))
  }
})

test('a draft can never pass a run selection, a genuine failure keeps its reason', () => {
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'success', draft: 'false' }),
    { ok: true, reason: REASON.success }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'success', draft: 'true' }),
    { ok: false, reason: REASON.draftDeferred }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'skipped', draft: 'true' }),
    { ok: false, reason: REASON.draftDeferred }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'skipped', draft: 'false' }),
    { ok: false, reason: REASON.unexpectedSkip }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'failure', draft: 'true' }),
    { ok: false, reason: 'failure' }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: 'cancelled', draft: 'false' }),
    { ok: false, reason: 'cancelled' }
  )
  assert.deepEqual(
    decideResult({ selection: 'run', result: '', draft: 'false' }),
    {
      ok: false,
      reason: REASON.missingResult,
    }
  )
  // An explicit, validated no-change is the only draft selection that passes.
  assert.deepEqual(
    decideResult({ selection: 'no-change', result: 'skipped', draft: 'true' }),
    { ok: true, reason: REASON.noChange }
  )
  // A no-change selection only passes a skipped or successful suite.
  assert.deepEqual(
    decideResult({ selection: 'no-change', result: 'success', draft: 'false' }),
    { ok: true, reason: REASON.noChange }
  )
  assert.deepEqual(
    decideResult({
      selection: 'no-change',
      result: 'cancelled',
      draft: 'false',
    }),
    { ok: false, reason: REASON.cancelled }
  )
  assert.deepEqual(
    decideResult({ selection: 'no-change', result: 'failure', draft: 'false' }),
    { ok: false, reason: 'failure' }
  )
  assert.deepEqual(
    decideResult({ selection: 'no-change', result: '', draft: 'false' }),
    { ok: false, reason: REASON.missingResult }
  )
})

test('edited and retarget events run normally instead of green-passing', () => {
  const edited = baseInput({ action: 'edited' })
  // A retarget-free edit is evaluated on its own result, not green-passed.
  assert.deepEqual(evaluateReport(edited), {
    ok: true,
    reason: REASON.success,
  })
  // A retarget carries no prior head/base proof, so a stale reuse id must fail
  // rather than overwrite a failed required status with a green result.
  assert.equal(
    evaluateReport({ ...edited, duplicateRunId: '999' }).reason,
    REASON.invalidReuse
  )
  assert.deepEqual(evaluateReport({ ...edited, testResult: 'success' }), {
    ok: true,
    reason: REASON.success,
  })
})

test('report decisions fold filter, selection and result', () => {
  assert.deepEqual(evaluateReport(baseInput()), {
    ok: true,
    reason: REASON.success,
  })
  assert.equal(
    evaluateReport(baseInput({ filterResult: 'failure' })).reason,
    REASON.filterFailed + ':failure'
  )
  // An absent selector result is a failure, never an implicit no-change.
  assert.equal(
    evaluateReport(baseInput({ filterResult: '' })).reason,
    REASON.filterFailed + ':missing'
  )
  assert.equal(
    evaluateReport(baseInput({ filterResult: 'cancelled' })).reason,
    REASON.filterFailed + ':cancelled'
  )
  assert.equal(
    evaluateReport(baseInput({ testResult: 'cancelled' })).reason,
    REASON.cancelled
  )
  assert.match(
    evaluateReport(baseInput({ shouldRun: '' })).reason,
    new RegExp('^' + REASON.invalidSelection)
  )
  assert.deepEqual(evaluateReport(baseInput({ shouldRun: 'false' })), {
    ok: true,
    reason: REASON.noChange,
  })
})

test('evidence records run identity, selection and role-tagged jobs', () => {
  const input = baseInput({
    eventName: 'push',
    action: '',
    refName: 'v3',
    ref: 'refs/heads/v3',
    sha: 'b'.repeat(40),
    headSha: '',
    runId: 42,
    runAttempt: 2,
    workflowPath: '.github/workflows/test-unit.yml',
    terminalJob: 'test-unit-status',
    jobs: [
      { role: 'selection', name: 'filter', result: 'success' },
      { role: 'suite', name: 'test-unit', result: 'success' },
    ],
  })
  const evidence = buildEvidence(
    input,
    { ok: true, reason: REASON.success },
    { selection: 'run', reason: REASON.success }
  )
  assert.equal(evidence.schemaVersion, 1)
  assert.deepEqual(evidence.workflow, {
    path: '.github/workflows/test-unit.yml',
    terminalJob: 'test-unit-status',
  })
  assert.equal(evidence.event.name, 'push')
  assert.equal(evidence.event.branch, 'v3')
  assert.equal(evidence.event.sha, 'b'.repeat(40))
  assert.equal(evidence.event.headSha, 'b'.repeat(40))
  assert.equal(evidence.repository, REPOSITORY)
  assert.deepEqual(evidence.run, { id: 42, attempt: 2 })
  assert.deepEqual(evidence.selection, {
    state: 'run',
    reason: REASON.success,
  })
  assert.equal(evidence.reuse, null)
  assert.deepEqual(evidence.decision, {
    outcome: 'pass',
    reason: REASON.success,
  })
  assert.deepEqual(evidence.jobs, [
    { role: 'selection', name: 'filter', result: 'success' },
    { role: 'suite', name: 'test-unit', result: 'success' },
  ])
})

test('no-change keeps the selector role and a skipped suite role', () => {
  const input = baseInput({
    shouldRun: 'false',
    testResult: 'skipped',
    jobs: [
      { role: 'selection', name: 'filter', result: 'success' },
      { role: 'suite', name: 'test-unit', result: 'skipped' },
    ],
  })
  const evidence = buildEvidence(
    input,
    { ok: true, reason: REASON.noChange },
    { selection: 'no-change', reason: REASON.noChange }
  )
  assert.equal(evidence.selection.state, 'no-change')
  assert.deepEqual(evidence.jobs, [
    { role: 'selection', name: 'filter', result: 'success' },
    { role: 'suite', name: 'test-unit', result: 'skipped' },
  ])
})

function runReporter(t, env) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'required-ci-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const evidencePath = path.join(directory, 'required-ci-evidence.json')
  const result = spawnSync(process.execPath, [STATUS_SCRIPT, 'report'], {
    cwd: directory,
    env: {
      PATH: process.env.PATH,
      EVIDENCE_PATH: evidencePath,
      EVENT_NAME: 'pull_request',
      ACTION: 'synchronize',
      DRAFT: 'false',
      FILTER_RESULT: 'success',
      SHOULD_RUN: 'true',
      TEST_RESULT: 'success',
      REF_NAME: 'feature',
      REF: 'refs/pull/7/merge',
      SHA: 'c'.repeat(40),
      HEAD_SHA: 'c'.repeat(40),
      REPOSITORY: REPOSITORY,
      RUN_ID: '7',
      RUN_ATTEMPT: '1',
      WORKFLOW_PATH: '.github/workflows/test-unit.yml',
      TERMINAL_JOB: 'test-unit-status',
      SELECTION_JOB: 'filter',
      SELECTION_JOB_RESULT: 'success',
      SUITE_JOB: 'test-unit',
      SUITE_JOB_RESULT: 'success',
      ...env,
    },
    encoding: 'utf8',
  })
  return {
    ...result,
    output: result.stdout + result.stderr,
    evidence: fs.existsSync(evidencePath)
      ? JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
      : null,
  }
}

test('the CLI writes the evidence artifact and encodes the decision in its exit code', (t) => {
  const pass = runReporter(t, {})
  assert.equal(pass.status, 0, pass.output)
  assert.equal(pass.evidence.decision.outcome, 'pass')
  assert.equal(pass.evidence.jobs.length, 2)

  const fail = runReporter(t, { TEST_RESULT: 'failure' })
  assert.equal(fail.status, 1, fail.output)
  assert.equal(fail.evidence.decision.outcome, 'fail')

  const draft = runReporter(t, { DRAFT: 'true', TEST_RESULT: 'skipped' })
  assert.equal(draft.status, 1, draft.output)
  assert.equal(draft.evidence.decision.reason, REASON.draftDeferred)

  const invalid = runReporter(t, { SHOULD_RUN: '' })
  assert.equal(invalid.status, 1, invalid.output)
  assert.match(invalid.evidence.decision.reason, /^invalid-selection/)

  const reuseOnPr = runReporter(t, { DUPLICATE_RUN_ID: '5' })
  assert.equal(reuseOnPr.status, 1, reuseOnPr.output)
  assert.equal(reuseOnPr.evidence.decision.reason, REASON.invalidReuse)

  const unknown = spawnSync(process.execPath, [STATUS_SCRIPT, 'nonsense'], {
    encoding: 'utf8',
  })
  assert.equal(unknown.status, 1)
})

test('readEnv normalizes the selector-driven inputs', () => {
  const input = readEnv({
    EVENT_NAME: 'push',
    DRAFT: 'true',
    DUPLICATE_RUN_ID: ' 77 ',
    RUN_ID: '100',
    RUN_ATTEMPT: '3',
    STAGING_SOURCE_BRANCH: ' v3-audit ',
  })
  assert.equal(input.draft, 'true')
  assert.equal(input.duplicateRunId, '77')
  assert.equal(input.runId, 100)
  assert.equal(input.runAttempt, 3)
  assert.equal(readEnv({ DRAFT: 'false' }).draft, 'false')
})
