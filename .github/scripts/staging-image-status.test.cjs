'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  EVIDENCE_SCHEMA_VERSION,
  TERMINAL_JOB,
  WORKFLOW_PATH,
  buildStagingEvidence,
  determineStagingDecision,
  evaluateStagingImageStatus,
  readPlanFromEnv,
} = require('./staging-image-status.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const SHA = 'a'.repeat(40)

function planEnv(overrides = {}) {
  return {
    PLAN_AMD_JOB_NAMES: JSON.stringify(overrides.amdJobNames ?? []),
    PLAN_BUILD_JOB_NAMES: JSON.stringify(
      overrides.buildJobNames ?? ['build-arm-auth']
    ),
    PLAN_CHANGED_FILE_COUNT: String(overrides.changedFileCount ?? 1),
    PLAN_MODE: overrides.mode ?? 'affected',
    PLAN_REASON: overrides.reason ?? 'affected target(s): auth-arm',
    PLAN_RESULT: overrides.result ?? 'success',
    PLAN_SCAN_JOB_NAMES: JSON.stringify(overrides.scanJobNames ?? []),
    PLAN_SELECTED: JSON.stringify(overrides.selected ?? ['auth-arm']),
    PLAN_STATE: overrides.state ?? 'run',
    PLAN_UNAVAILABLE: JSON.stringify(overrides.unavailable ?? []),
  }
}

function job(name, overrides = {}) {
  return {
    conclusion: 'success',
    name,
    status: 'completed',
    ...overrides,
  }
}

function binding() {
  return {
    branch: 'v3',
    event: 'push',
    repository: REPOSITORY,
    runAttempt: 1,
    runId: 42,
    sha: SHA,
  }
}

function pushContext() {
  return {
    eventName: 'push',
    payload: {},
    ref: 'refs/heads/v3',
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runAttempt: 1,
    runId: 42,
    sha: SHA,
  }
}

test('the plan outputs round-trip through the environment', () => {
  const plan = readPlanFromEnv(
    planEnv({ scanJobNames: ['scan-arm-backend-docker'] })
  )
  assert.deepEqual(plan.buildJobNames, ['build-arm-auth'])
  assert.deepEqual(plan.scanJobNames, ['scan-arm-backend-docker'])
  assert.equal(plan.state, 'run')
  assert.equal(plan.changedFileCount, 1)
})

test('a malformed plan list fails closed instead of parsing as empty', () => {
  assert.throws(
    () =>
      readPlanFromEnv({ ...planEnv(), PLAN_BUILD_JOB_NAMES: 'build-arm-auth' }),
    /not valid JSON/
  )
  assert.throws(
    () => readPlanFromEnv({ ...planEnv(), PLAN_SELECTED: '[1]' }),
    /not a list of job names/
  )
})

test('a selected run requires every planned job exactly once', () => {
  const plan = readPlanFromEnv(planEnv())
  assert.equal(
    determineStagingDecision({
      binding: binding(),
      observedJobs: [job('build-arm-auth')],
      plan,
    }).ok,
    true
  )
  const missing = determineStagingDecision({
    binding: binding(),
    observedJobs: [],
    plan,
  })
  assert.equal(missing.ok, false)
  assert.match(missing.reason, /missing/)

  const duplicate = determineStagingDecision({
    binding: binding(),
    observedJobs: [job('build-arm-auth'), job('build-arm-auth')],
    plan,
  })
  assert.equal(duplicate.ok, false)
  assert.match(duplicate.reason, /ambiguous/)
})

test('a failed or cancelled build leg blocks the context', () => {
  const plan = readPlanFromEnv(planEnv())
  for (const conclusion of ['failure', 'cancelled', 'skipped']) {
    const decision = determineStagingDecision({
      binding: binding(),
      observedJobs: [job('build-arm-auth', { conclusion })],
      plan,
    })
    assert.equal(decision.ok, false, conclusion + ' must block')
    assert.match(decision.reason, new RegExp(conclusion))
  }
})

test('a still-running leg is retryable rather than immediately failed', () => {
  const plan = readPlanFromEnv(planEnv())
  const decision = determineStagingDecision({
    binding: binding(),
    observedJobs: [
      job('build-arm-auth', { conclusion: null, status: 'in_progress' }),
    ],
    plan,
  })
  assert.equal(decision.ok, false)
  assert.equal(decision.retryable, true)
})

test('the deferred, empty and unavailable states pass or block as designed', () => {
  const draft = determineStagingDecision({
    binding: binding(),
    observedJobs: [],
    plan: readPlanFromEnv(planEnv({ state: 'draft', buildJobNames: [] })),
  })
  assert.equal(draft.ok, true)
  assert.equal(draft.state, 'draft')

  const noChange = determineStagingDecision({
    binding: binding(),
    observedJobs: [],
    plan: readPlanFromEnv(planEnv({ state: 'no-change', buildJobNames: [] })),
  })
  assert.equal(noChange.ok, true)
  assert.equal(noChange.state, 'no-change')

  const unavailable = determineStagingDecision({
    binding: binding(),
    observedJobs: [],
    plan: readPlanFromEnv(planEnv({ state: 'unavailable', buildJobNames: [] })),
  })
  assert.equal(unavailable.ok, false)
  assert.equal(unavailable.state, 'unavailable')
})

test('a failed plan blocks even when it selected targets', () => {
  const decision = determineStagingDecision({
    binding: binding(),
    observedJobs: [job('build-arm-auth')],
    plan: readPlanFromEnv(
      planEnv({
        result: 'failure',
        reason: 'changed-file selection is unavailable',
      })
    ),
  })
  assert.equal(decision.ok, false)
  assert.equal(decision.state, 'unavailable')
})

test('a duplicate planned job is rejected before any observation', () => {
  const decision = determineStagingDecision({
    binding: binding(),
    observedJobs: [job('build-arm-auth')],
    plan: readPlanFromEnv(
      planEnv({ buildJobNames: ['build-arm-auth', 'build-arm-auth'] })
    ),
  })
  assert.equal(decision.ok, false)
  assert.match(decision.reason, /duplicate/)
})

test('the evidence artifact keeps the shared promotion contract', () => {
  const plan = readPlanFromEnv(planEnv())
  const evidence = buildStagingEvidence({
    binding: binding(),
    decision: {
      ok: true,
      reason: 'all 1 selected image build job(s) succeeded',
      state: 'run',
    },
    plan,
  })
  assert.equal(evidence.schemaVersion, EVIDENCE_SCHEMA_VERSION)
  assert.equal(evidence.repository, REPOSITORY)
  assert.equal(evidence.event.name, 'push')
  assert.equal(evidence.event.sha, SHA)
  assert.equal(evidence.workflow.path, WORKFLOW_PATH)
  assert.equal(evidence.workflow.terminalJob, TERMINAL_JOB)
  assert.equal(evidence.decision.outcome, 'pass')
  assert.equal(evidence.selection.state, 'run')
  assert.equal(evidence.reuse, null)
  assert.equal(evidence.builds.length, 1)
  assert.equal(evidence.builds[0].id, 'auth-arm')
  assert.equal(evidence.builds[0].path, WORKFLOW_PATH)
})

test('the evaluator writes evidence and fails the job on a block', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-status-'))
  const evidencePath = path.join(directory, 'required-ci-evidence.json')
  const calls = []
  const github = {
    rest: {
      actions: {
        listJobsForWorkflowRunAttempt: async (params) => {
          calls.push(params)
          return {
            data: { jobs: [job('build-arm-auth', { conclusion: 'failure' })] },
          }
        },
      },
    },
  }
  await assert.rejects(
    () =>
      evaluateStagingImageStatus({
        context: pushContext(),
        env: { ...planEnv(), BUILD_STATUS_EVIDENCE_PATH: evidencePath },
        evidencePath,
        github,
        maxAttempts: 1,
      }),
    /blocked/
  )
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
  assert.equal(evidence.decision.outcome, 'fail')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].run_id, 42)
})

test('the evaluator polls a running leg to completion', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-status-'))
  const evidencePath = path.join(directory, 'required-ci-evidence.json')
  let call = 0
  const github = {
    rest: {
      actions: {
        listJobsForWorkflowRunAttempt: async () => {
          call += 1
          return {
            data: {
              jobs: [
                call === 1
                  ? job('build-arm-auth', {
                      conclusion: null,
                      status: 'in_progress',
                    })
                  : job('build-arm-auth'),
              ],
            },
          }
        },
      },
    },
  }
  const decision = await evaluateStagingImageStatus({
    context: pushContext(),
    env: { ...planEnv(), BUILD_STATUS_EVIDENCE_PATH: evidencePath },
    evidencePath,
    github,
    maxAttempts: 3,
    retryDelayMs: 0,
    sleep: async () => {},
  })
  assert.equal(decision.ok, true)
  assert.equal(call, 2)
})
