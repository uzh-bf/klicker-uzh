'use strict'

const fs = require('node:fs')

const EVIDENCE_SCHEMA_VERSION = 1
const TERMINAL_JOB = 'build-images-status'
const WORKFLOW_PATH = '.github/workflows/v3_images-stg.yml'

// GitHub reports a job as queued, in_progress or completed. Both non-terminal
// values are worth polling: the terminal job always runs after its needs, but a
// queued matrix leg can still be waiting for a runner.
const RETRYABLE_STATUSES = Object.freeze(['in_progress', 'queued'])
const DEFAULT_MAX_ATTEMPTS = 40
const DEFAULT_RETRY_DELAY_MS = 15000

// The plan job publishes its selection through step outputs, so every value
// arrives as a string. A list that cannot be parsed is a broken handoff, not an
// empty selection, and must fail closed rather than pass an empty requirement.
function readPlanFromEnv(env = process.env) {
  const parseList = (name) => {
    const raw = env[name]
    if (raw === undefined || raw === null || raw === '') return []
    let value
    try {
      value = JSON.parse(raw)
    } catch (error) {
      throw new Error(name + ' is not valid JSON: ' + error.message)
    }
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string' || item.length === 0)
    ) {
      throw new Error(name + ' is not a list of job names')
    }
    return value
  }
  const changedFileCount = Number(env.PLAN_CHANGED_FILE_COUNT ?? 0)
  if (!Number.isSafeInteger(changedFileCount) || changedFileCount < 0) {
    throw new Error('PLAN_CHANGED_FILE_COUNT is not a count')
  }
  return {
    amdJobNames: parseList('PLAN_AMD_JOB_NAMES'),
    buildJobNames: parseList('PLAN_BUILD_JOB_NAMES'),
    changedFileCount,
    mode: String(env.PLAN_MODE ?? ''),
    reason: String(env.PLAN_REASON ?? ''),
    result: String(env.PLAN_RESULT ?? ''),
    scanJobNames: parseList('PLAN_SCAN_JOB_NAMES'),
    selected: parseList('PLAN_SELECTED'),
    state: String(env.PLAN_STATE ?? ''),
    unavailable: parseList('PLAN_UNAVAILABLE'),
  }
}

function resolveBinding(context) {
  const eventName = context.eventName
  if (eventName !== 'push' && eventName !== 'pull_request') {
    throw new Error(TERMINAL_JOB + ' does not support ' + eventName)
  }
  const pullRequest = context.payload?.pull_request
  const ref = String(context.ref ?? '')
  const binding = {
    action: String(context.payload?.action ?? ''),
    branch:
      eventName === 'push'
        ? ref.replace(/^refs\/heads\//, '')
        : pullRequest?.head?.ref,
    event: eventName,
    ref,
    repository: context.repo.owner + '/' + context.repo.repo,
    runAttempt: Number(context.runAttempt ?? 0),
    runId: Number(context.runId ?? 0),
    sha: eventName === 'push' ? context.sha : pullRequest?.head?.sha,
  }
  if (typeof binding.sha !== 'string' || binding.sha.length === 0) {
    throw new Error(TERMINAL_JOB + ' has no commit for ' + eventName)
  }
  if (typeof binding.branch !== 'string' || binding.branch.length === 0) {
    throw new Error(TERMINAL_JOB + ' has no branch for ' + eventName)
  }
  return binding
}

// Every job the plan said it would run is required, exactly once, completed and
// successful. The terminal job observes the same run it belongs to, so a
// matrix leg that never started is missing rather than merely unreported.
function determineStagingDecision({ observedJobs, plan, binding }) {
  const expected = [
    ...plan.buildJobNames,
    ...plan.scanJobNames,
    ...plan.amdJobNames,
  ]
  if (new Set(expected).size !== expected.length) {
    return {
      ok: false,
      reason: 'the plan published a duplicate expected job',
      state: 'unavailable',
    }
  }
  if (plan.result !== 'success') {
    return {
      ok: false,
      reason:
        'the image plan ' +
        (plan.result ? 'concluded ' + plan.result : 'has no result') +
        ', so the affected set is unknown',
      state: 'unavailable',
    }
  }
  if (plan.state === 'unavailable') {
    return {
      ok: false,
      reason: plan.reason || 'the affected image set is unavailable',
      state: 'unavailable',
    }
  }
  // Draft pull requests defer their builds, so there is nothing to observe.
  if (plan.state === 'draft') {
    return {
      ok: true,
      reason:
        plan.reason ||
        'draft pull request: affected image builds are deferred until the pull request is marked ready',
      state: 'draft',
    }
  }
  if (plan.state === 'no-change') {
    return {
      ok: true,
      reason: plan.reason || 'no affected image builds for this change',
      state: 'no-change',
    }
  }
  if (plan.state !== 'run') {
    return {
      ok: false,
      reason: 'the plan reported an unknown state: ' + String(plan.state),
      state: 'unavailable',
    }
  }
  if (expected.length === 0) {
    return {
      ok: false,
      reason: 'the plan selected a build but published no expected job',
      state: 'unavailable',
    }
  }
  for (const name of expected) {
    const matches = observedJobs.filter((job) => job?.name === name)
    if (matches.length === 0) {
      return {
        ok: false,
        reason: name + ' is missing from run ' + binding.runId,
        state: 'run',
      }
    }
    if (matches.length > 1) {
      return {
        ok: false,
        reason: name + ' is ambiguous in run ' + binding.runId,
        state: 'run',
      }
    }
    const job = matches[0]
    if (job.status !== 'completed') {
      return {
        ok: false,
        reason: name + ' is ' + String(job.status),
        state: 'run',
        retryable: RETRYABLE_STATUSES.includes(String(job.status)),
      }
    }
    if (job.conclusion !== 'success') {
      const conclusion = job.conclusion ?? 'without a conclusion'
      return {
        ok: false,
        reason: name + ' concluded ' + conclusion,
        state: 'run',
      }
    }
  }
  return {
    ok: true,
    reason: 'all ' + expected.length + ' selected image build job(s) succeeded',
    state: 'run',
  }
}

function buildStagingEvidence({ binding, decision, plan }) {
  return {
    builds: plan.selected.map((id) => ({
      id,
      path: WORKFLOW_PATH,
      result: decision.ok ? 'success' : 'failure',
      run: {
        attempt: binding.runAttempt,
        branch: binding.branch,
        event: binding.event,
        id: binding.runId,
        sha: binding.sha,
        url: '',
      },
    })),
    decision: {
      outcome: decision.ok ? 'pass' : 'fail',
      reason: decision.reason,
    },
    event: {
      action: binding.action,
      branch: binding.branch,
      name: binding.event,
      ref: binding.ref,
      sha: binding.sha,
    },
    repository: binding.repository,
    reuse: null,
    run: { attempt: binding.runAttempt, id: binding.runId },
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    selection: {
      changedFileCount: plan.changedFileCount,
      mode: plan.mode,
      reason: plan.reason,
      state: decision.state,
    },
    workflow: { path: WORKFLOW_PATH, terminalJob: TERMINAL_JOB },
  }
}

function formatSummary({ decision, plan }) {
  const lines = [
    '## Image build status',
    '',
    '- Decision: ' + (decision.ok ? 'pass' : 'block'),
    '- Reason: ' + decision.reason,
    '- Selection state: ' + decision.state,
    '- Selected targets: ' + (plan.selected.join(', ') || 'none'),
    '- Expected jobs: ' +
      (
        plan.buildJobNames.length +
        plan.scanJobNames.length +
        plan.amdJobNames.length
      ).toString(),
  ]
  if (plan.unavailable.length > 0) {
    lines.push('- Unavailable targets: ' + plan.unavailable.join(', '))
  }
  return lines.join('\n') + '\n'
}

async function paginate(github, endpoint, params) {
  const items = []
  for (let page = 1; ; page += 1) {
    const response = await endpoint({ ...params, page, per_page: 100 })
    const batch = response?.data?.jobs
    if (!Array.isArray(batch)) return null
    items.push(...batch)
    if (batch.length < 100) return items
  }
}

async function listRunJobs({ github, context, binding }) {
  if (typeof github.rest.actions.listJobsForWorkflowRunAttempt !== 'function') {
    throw new Error('workflow jobs are unavailable')
  }
  const jobs = await paginate(
    github,
    github.rest.actions.listJobsForWorkflowRunAttempt,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: binding.runId,
      attempt_number: binding.runAttempt,
    }
  )
  if (jobs === null) throw new Error('the workflow job list is truncated')
  return jobs
}

// The required context is reported from the same run that holds the builds, so
// a leg that is still running is polled to completion instead of being read as
// a failure. A determined block still fails the job, which is what makes the
// context red.
async function evaluateStagingImageStatus({
  github,
  context,
  core,
  env = process.env,
  evidencePath = env.BUILD_STATUS_EVIDENCE_PATH,
  maxAttempts = Number(env.BUILD_STATUS_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
  retryDelayMs = Number(
    env.BUILD_STATUS_RETRY_DELAY_MS ?? DEFAULT_RETRY_DELAY_MS
  ),
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) {
  const binding = resolveBinding(context)
  const plan = readPlanFromEnv(env)

  const publish = (decision) => {
    if (!evidencePath) return
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(
        buildStagingEvidence({ binding, decision, plan }),
        null,
        2
      ) + '\n'
    )
  }

  let decision = null
  let attemptCount = 0
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    attemptCount = attempt
    const jobs = await listRunJobs({ github, context, binding })
    decision = determineStagingDecision({ binding, observedJobs: jobs, plan })
    if (decision.ok || !decision.retryable) break
    if (attempt < maxAttempts) await sleep(retryDelayMs)
  }

  publish(decision)
  const summary = formatSummary({ decision, plan })
  core?.info?.(summary)
  if (core?.summary?.addRaw) {
    await core.summary.addRaw(summary).write()
  }
  core?.setOutput?.('decision', decision.ok ? 'pass' : 'block')
  core?.setOutput?.('state', decision.state)
  if (!decision.ok) {
    throw new Error('image build status is blocked: ' + decision.reason)
  }
  return decision
}

if (require.main === module) {
  // Offline self-check: the decision core is pure, so it can be exercised
  // without a token.
  const plan = readPlanFromEnv()
  process.stdout.write(
    JSON.stringify(
      determineStagingDecision({
        binding: { runId: 0 },
        observedJobs: [],
        plan,
      }),
      null,
      2
    ) + '\n'
  )
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  TERMINAL_JOB,
  WORKFLOW_PATH,
  buildStagingEvidence,
  determineStagingDecision,
  evaluateStagingImageStatus,
  formatSummary,
  readPlanFromEnv,
  resolveBinding,
}
