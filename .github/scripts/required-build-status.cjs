'use strict'

const fs = require('node:fs')
const path = require('node:path')

const WORKFLOWS_DIRECTORY = '.github/workflows'
// The always-reported terminal job of this workflow owns the required status
// context for affected image builds.
const TERMINAL_JOB = 'build-images-status'
const IMAGE_WORKFLOW_FILE = /^v3_.*-stg\.yml$/

// Every code image bundles the workspace packages it depends on, so a change
// under packages/ can reach any of them. Analytics is the only image without
// workspace dependencies, so its selection stays keyed to its own app.
const SHARED_PACKAGES_GLOB = 'packages/**'

// Root build inputs shared by every image whose docker build context is the
// repository root: 'turbo prune --docker' reads the workspace manifest, the
// lockfile and turbo.json, and .dockerignore decides which files reach that
// context at all, so a root dependency change can alter any node image. This
// repository has no root tsconfig.json, and .npmrc never reaches the docker
// context because of the '.**' rule in .dockerignore, so neither is listed.
const ROOT_BUILD_GLOBS = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.dockerignore',
])

// One entry per v3_*-stg.yml image workflow. 'globs' mirror that workflow's
// pull_request path filter and 'jobs' list the build jobs that must conclude
// successfully for an affected pull request or for any push. Jobs gated with
// an always-false condition are inactive and stay out.
const IMAGE_WORKFLOWS = Object.freeze([
  {
    globs: [
      'apps/analytics/**',
      'packages/prisma/src/prisma/schema/*.prisma',
      'util/sync-schema.sh',
      '.dockerignore',
      '.github/workflows/v3_analytics**',
    ],
    jobs: ['build-arm'],
    path: 'v3_analytics-stg.yml',
  },
  {
    globs: [
      'apps/auth/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_auth**',
    ],
    jobs: ['build-arm'],
    path: 'v3_auth-stg.yml',
  },
  {
    globs: [
      'apps/backend-docker/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_backend-docker**',
    ],
    jobs: ['build-arm', 'build-migrator-arm'],
    path: 'v3_backend-docker-stg.yml',
  },
  {
    globs: [
      'apps/chat/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_chat**',
    ],
    jobs: ['build-arm'],
    path: 'v3_chat-stg.yml',
  },
  {
    globs: [
      'apps/frontend-control/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_frontend-control**',
    ],
    jobs: ['build-arm'],
    path: 'v3_frontend-control-docker-stg.yml',
  },
  {
    globs: [
      'apps/frontend-manage/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_frontend-manage**',
    ],
    jobs: ['build-arm'],
    path: 'v3_frontend-manage-docker-stg.yml',
  },
  {
    globs: [
      'apps/frontend-pwa/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_frontend-pwa**',
    ],
    jobs: ['build-arm'],
    path: 'v3_frontend-pwa-docker-assessment-stg.yml',
  },
  {
    globs: [
      'apps/frontend-pwa/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_frontend-pwa**',
    ],
    jobs: ['build-arm'],
    path: 'v3_frontend-pwa-docker-stg.yml',
  },
  {
    globs: [
      'apps/hatchet-worker-general/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_hatchet-worker-general**',
    ],
    jobs: ['build-arm'],
    path: 'v3_hatchet-worker-general-stg.yml',
  },
  {
    globs: [
      'apps/hatchet-worker-response-processor/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_hatchet-worker-response-processor**',
    ],
    jobs: ['build-arm'],
    path: 'v3_hatchet-worker-response-processor-stg.yml',
  },
  {
    globs: [
      'apps/lti/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_lti**',
    ],
    jobs: ['build-arm'],
    path: 'v3_lti-stg.yml',
  },
  {
    globs: [
      'apps/mcp-lecturer/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_mcp-lecturer**',
    ],
    jobs: ['build-arm', 'build-amd'],
    path: 'v3_mcp-lecturer-stg.yml',
  },
  {
    globs: [
      'apps/mcp-student/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_mcp-student**',
    ],
    jobs: ['build-arm', 'build-amd'],
    path: 'v3_mcp-student-stg.yml',
  },
  {
    globs: [
      'apps/olat-api/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_olat-api**',
    ],
    jobs: ['build-arm'],
    path: 'v3_olat-api-stg.yml',
  },
  {
    globs: [
      'apps/response-api/**',
      SHARED_PACKAGES_GLOB,
      ...ROOT_BUILD_GLOBS,
      '.github/workflows/v3_response-api**',
    ],
    jobs: ['build-arm'],
    path: 'v3_response-api-stg.yml',
  },
])

const RETRYABLE_STATUSES = Object.freeze(['missing', 'running'])
const DEFAULT_MAX_ATTEMPTS = 60
const DEFAULT_RETRY_DELAY_MS = 30000

// GitHub path filters follow a restricted glob: '*' stops at '/', '**' crosses
// it, and every other character is literal.
function globToRegExp(glob) {
  let pattern = ''
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index]
    if (character === '*') {
      if (glob[index + 1] === '*') {
        pattern += '.*'
        index += 1
      } else {
        pattern += '[^/]*'
      }
    } else if (character === '?') {
      pattern += '[^/]'
    } else {
      pattern += character.replace(/[.+^$()|[\]{}]/g, '\\$&')
    }
  }
  return new RegExp('^' + pattern + '$')
}

const GLOB_CACHE = new Map()

function matchGlob(glob, filePath) {
  if (!GLOB_CACHE.has(glob)) GLOB_CACHE.set(glob, globToRegExp(glob))
  return GLOB_CACHE.get(glob).test(filePath)
}

function presentImageWorkflows(rootDirectory = process.cwd()) {
  return fs
    .readdirSync(path.join(rootDirectory, WORKFLOWS_DIRECTORY))
    .filter((name) => IMAGE_WORKFLOW_FILE.test(name))
    .sort()
}

// Additions and deletions must agree with the required publisher inventory.
function uncoveredWorkflows(presentFiles) {
  const covered = new Set(IMAGE_WORKFLOWS.map((entry) => entry.path))
  return [
    ...presentFiles.filter((file) => !covered.has(file)),
    ...[...covered].filter((file) => !presentFiles.includes(file)),
  ].sort()
}

// The changed-file list is produced by the workflow's diff step. An absent or
// unreadable list means the selection is unknown, which must block instead of
// passing as an empty change set.
function readChangedFiles(changedFilesPath) {
  if (!changedFilesPath) {
    throw new Error('no changed-file selection path is configured')
  }
  let raw
  try {
    raw = fs.readFileSync(changedFilesPath, 'utf8')
  } catch (error) {
    throw new Error(changedFilesPath + ' is unavailable: ' + error.message)
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// A push always builds every image workflow present on the branch, because the
// push triggers carry no path filter. A pull request only builds the images
// whose declared path filter matches the change.
function selectImageWorkflows({ presentFiles, eventName, changedFiles = [] }) {
  const present = new Set(presentFiles)
  const candidates = IMAGE_WORKFLOWS.filter((entry) => present.has(entry.path))
  const unknown = uncoveredWorkflows(presentFiles)
  if (eventName === 'push') return { expected: candidates, unknown }
  const expected = candidates.filter((entry) =>
    entry.globs.some((glob) =>
      changedFiles.some((file) => matchGlob(glob, file))
    )
  )
  return { expected, unknown }
}

function selectionMode({ binding, expected }) {
  if (binding.event === 'push') return 'push-all'
  return expected.length > 0 ? 'affected' : 'no-change'
}

// A run is evidence only when its workflow path, event, branch, commit and
// repository all bind to this evaluation. Push candidates can therefore never
// be qualified by pull-request runs, or the reverse.
function bindsRun(run, entry, binding) {
  const runPath = String(run?.path ?? '').split('@')[0]
  return (
    runPath === WORKFLOWS_DIRECTORY + '/' + entry.path &&
    run.event === binding.event &&
    run.head_branch === binding.branch &&
    run.head_sha === binding.sha &&
    run.repository?.full_name === binding.repository
  )
}

// The newest run and attempt is authoritative: a newer pending, failed,
// cancelled or skipped attempt must never fall back to an older success.
function selectRun(runs, entry, binding) {
  return runs
    .filter((run) => bindsRun(run, entry, binding))
    .sort(
      (left, right) =>
        Number(right.id ?? 0) - Number(left.id ?? 0) ||
        Number(right.run_attempt ?? 0) - Number(left.run_attempt ?? 0)
    )[0]
}

function jobIdentity(job) {
  return {
    conclusion: job.conclusion ?? null,
    jobId: job.id ?? null,
    name: job.name,
    url: job.html_url ?? '',
  }
}

// Draft pull requests run the same build jobs as ready ones, so only a
// successful run with successful build jobs can qualify. An unexpected skip is
// a failure, never a deferral.
function evaluateWorkflowRun({ run, jobs, entry, binding }) {
  const identity = {
    attempt: run.run_attempt ?? null,
    id: run.id ?? null,
    url: run.html_url ?? '',
  }
  const failure = (status, reason, verified = []) => ({
    jobs: verified,
    reason,
    run: identity,
    status,
    workflow: entry.path,
  })
  if (run.status !== 'completed') {
    return failure('running', 'run ' + run.id + ' is ' + run.status)
  }
  if (run.conclusion !== 'success') {
    const conclusion = run.conclusion ?? 'without a conclusion'
    return failure(
      run.conclusion === 'cancelled' ? 'cancelled' : 'failed',
      'run ' + run.id + ' concluded ' + conclusion
    )
  }
  const verified = []
  for (const name of entry.jobs) {
    const matches = jobs.filter((job) => job?.name === name)
    if (matches.length > 1) {
      return failure(
        'wrong_evidence',
        name + ' is ambiguous in run ' + run.id,
        verified
      )
    }
    const job = matches[0]
    if (!job || job.head_sha !== binding.sha) {
      return failure(
        'wrong_evidence',
        name + ' is missing from run ' + run.id,
        verified
      )
    }
    if (job.status !== 'completed') {
      return failure(
        'running',
        name + ' in run ' + run.id + ' is ' + job.status,
        verified
      )
    }
    if (job.conclusion !== 'success') {
      const conclusion = job.conclusion ?? 'without a conclusion'
      return failure(
        job.conclusion === 'cancelled' ? 'cancelled' : 'failed',
        name + ' in run ' + run.id + ' concluded ' + conclusion,
        verified
      )
    }
    verified.push(jobIdentity(job))
  }
  return {
    jobs: verified,
    reason: 'build job succeeded',
    run: identity,
    status: 'success',
    workflow: entry.path,
  }
}

function decideBuildStatus({ unknown, expected, evidence }) {
  if (unknown.length > 0) {
    return {
      evidence: [],
      failures: [],
      ok: false,
      reason: 'uncovered image workflow(s): ' + unknown.join(', '),
    }
  }
  if (expected.length === 0) {
    return {
      evidence: [],
      failures: [],
      noChange: true,
      ok: true,
      reason: 'no affected image builds for this change',
    }
  }
  if (
    evidence.length !== expected.length ||
    expected.some(
      (item) =>
        evidence.filter((result) => result.workflow === item.path).length !== 1
    )
  ) {
    return {
      evidence,
      failures: [],
      ok: false,
      reason: 'missing or duplicate expected build evidence',
    }
  }
  const failures = evidence.filter((entry) => entry.status !== 'success')
  if (failures.length > 0) {
    return {
      evidence,
      failures,
      ok: false,
      reason: failures
        .map((entry) => entry.workflow + ' (' + entry.reason + ')')
        .join(', '),
    }
  }
  return {
    evidence,
    failures: [],
    ok: true,
    reason: 'all ' + expected.length + ' affected image build(s) succeeded',
  }
}

// Machine-readable evidence for the staging promotion receipt. The envelope
// follows the shared required-status contract so a consumer reads the decision
// the same way, and 'builds' records the selected workflow identities with the
// run and job results that qualified them.
function buildEvidence({
  binding,
  changedFileCount,
  decision,
  mode,
  selectionState,
}) {
  return {
    builds: decision.evidence.map((entry) => ({
      jobs: entry.jobs ?? [],
      path: WORKFLOWS_DIRECTORY + '/' + entry.workflow,
      reason: entry.reason,
      result: entry.status,
      run: entry.run
        ? {
            attempt: entry.run.attempt ?? null,
            branch: binding.branch,
            event: binding.event,
            id: entry.run.id ?? null,
            sha: binding.sha,
            url: entry.run.url ?? '',
          }
        : null,
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
    schemaVersion: 1,
    selection: {
      changedFileCount,
      mode,
      reason: decision.reason,
      state: selectionState,
    },
    workflow: {
      path: WORKFLOWS_DIRECTORY + '/v3_build-fallback.yml',
      terminalJob: TERMINAL_JOB,
    },
  }
}

function resolveBinding(context) {
  const eventName = context.eventName
  if (eventName !== 'push' && eventName !== 'pull_request') {
    throw new Error('build-images-status does not support ' + eventName)
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
    throw new Error('build-images-status has no commit for ' + eventName)
  }
  if (typeof binding.branch !== 'string' || binding.branch.length === 0) {
    throw new Error('build-images-status has no branch for ' + eventName)
  }
  return binding
}

function formatSummary({ attemptCount, decision, expected }) {
  const lines = [
    '## Image build status',
    '',
    '- Decision: ' + (decision.ok ? 'pass' : 'block'),
    '- Reason: ' + decision.reason,
    '- Affected image workflows: ' + expected.length,
  ]
  for (const entry of expected) {
    const required = entry.jobs.map((job) => `\`${job}\``).join(', ')
    lines.push(`  - \`${entry.path}\` requires ${required}`)
  }
  if (attemptCount > 1 || (attemptCount > 0 && !decision.ok)) {
    lines.push('', '- Attempts: ' + attemptCount)
  }
  return lines.join('\n') + '\n'
}

// Runs are listed through the workflow-scoped endpoint so every response binds
// to one selected workflow identity. Truncated responses block qualification.
async function listRuns({ github, context, entry, binding }) {
  const { data } = await github.rest.actions.listWorkflowRuns({
    branch: binding.branch,
    event: binding.event,
    head_sha: binding.sha,
    owner: context.repo.owner,
    per_page: 100,
    repo: context.repo.repo,
    workflow_id: entry.path,
  })
  if (
    !Array.isArray(data?.workflow_runs) ||
    data.total_count > data.workflow_runs.length
  ) {
    throw new Error('GitHub workflow run listing is invalid')
  }
  return data.workflow_runs
}

// Jobs are read for the exact attempt, because the unattempted job listing
// mixes executions of a re-run. The cache is keyed by run and attempt, so a
// re-run is never served from an earlier attempt's jobs.
async function listJobs({ github, context, run, cache }) {
  const key = run.id + ':' + run.run_attempt
  if (cache.has(key)) return cache.get(key)
  const { data } = await github.rest.actions.listJobsForWorkflowRunAttempt({
    attempt_number: run.run_attempt,
    owner: context.repo.owner,
    per_page: 100,
    repo: context.repo.repo,
    run_id: run.id,
  })
  if (!Array.isArray(data?.jobs) || data.total_count > data.jobs.length) {
    throw new Error('GitHub workflow job listing is invalid')
  }
  cache.set(key, data.jobs)
  return data.jobs
}

async function evaluateBuildImagesStatus({
  github,
  context,
  core,
  rootDirectory = process.cwd(),
  changedFilesPath = process.env.CHANGED_FILES_PATH,
  evidencePath = process.env.BUILD_STATUS_EVIDENCE_PATH,
  maxAttempts = Number(
    process.env.BUILD_STATUS_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS
  ),
  retryDelayMs = Number(
    process.env.BUILD_STATUS_RETRY_DELAY_MS ?? DEFAULT_RETRY_DELAY_MS
  ),
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) {
  const binding = resolveBinding(context)

  const publish = async ({
    attemptCount = 0,
    changedFileCount,
    decision,
    expected,
    mode,
    state,
  }) => {
    if (evidencePath) {
      const evidence = buildEvidence({
        binding,
        changedFileCount,
        decision,
        mode,
        selectionState: state,
      })
      fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n')
    }
    const summary = formatSummary({ attemptCount, decision, expected })
    core?.info?.(summary)
    if (core?.summary?.addRaw) {
      await core.summary.addRaw(summary).write()
    }
  }

  const block = async ({ changedFileCount = 0, mode, reason, state }) => {
    const decision = { evidence: [], failures: [], ok: false, reason }
    await publish({
      attemptCount: 0,
      changedFileCount,
      decision,
      expected: [],
      mode,
      state,
    })
    return decision
  }

  const presentFiles = presentImageWorkflows(rootDirectory)
  const unknown = uncoveredWorkflows(presentFiles)
  if (unknown.length > 0) {
    const decision = await block({
      mode: 'uncovered-workflow',
      reason:
        'uncovered image workflow(s): ' +
        unknown.join(', ') +
        ' (add them to the required build inventory)',
      state: 'unavailable',
    })
    throw new Error(decision.reason)
  }

  let changedFiles = []
  if (binding.event === 'pull_request') {
    try {
      changedFiles = readChangedFiles(changedFilesPath)
    } catch (error) {
      const decision = await block({
        mode: 'selection-unavailable',
        reason: 'changed-file selection is unavailable: ' + error.message,
        state: 'unavailable',
      })
      throw new Error(decision.reason)
    }
  }

  const { expected } = selectImageWorkflows({
    changedFiles,
    eventName: binding.event,
    presentFiles,
  })
  const mode = selectionMode({ binding, expected })
  if (expected.length === 0) {
    const decision = decideBuildStatus({ evidence: [], expected, unknown: [] })
    await publish({
      attemptCount: 0,
      changedFileCount: changedFiles.length,
      decision,
      expected,
      mode,
      state: 'no-change',
    })
    return decision
  }

  const cache = new Map()
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const evidence = []
    for (const entry of expected) {
      const runs = await listRuns({ binding, context, entry, github })
      const run = selectRun(runs, entry, binding)
      if (!run) {
        evidence.push({
          jobs: [],
          reason: 'no run for this event, branch and commit',
          status: 'missing',
          workflow: entry.path,
        })
        continue
      }
      if (run.status !== 'completed') {
        evidence.push({
          jobs: [],
          reason: 'run ' + run.id + ' is ' + run.status,
          status: 'running',
          workflow: entry.path,
        })
        continue
      }
      if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
        evidence.push({
          jobs: [],
          reason: 'run ' + run.id + ' has no usable attempt',
          status: 'wrong_evidence',
          workflow: entry.path,
        })
        continue
      }
      const jobs = await listJobs({ cache, context, github, run })
      evidence.push(evaluateWorkflowRun({ binding, entry, jobs, run }))
    }
    const decision = decideBuildStatus({ evidence, expected, unknown: [] })
    const retryable = decision.failures.every((entry) =>
      RETRYABLE_STATUSES.includes(entry.status)
    )
    if (decision.ok || !retryable || attempt === maxAttempts) {
      await publish({
        attemptCount: attempt,
        changedFileCount: changedFiles.length,
        decision,
        expected,
        mode,
        state: 'run',
      })
      if (decision.ok) return decision
      throw new Error('image build qualification blocked: ' + decision.reason)
    }
    await sleep(retryDelayMs)
  }
  throw new Error('image build qualification never reached a terminal state')
}

module.exports = {
  IMAGE_WORKFLOWS,
  ROOT_BUILD_GLOBS,
  TERMINAL_JOB,
  buildEvidence,
  decideBuildStatus,
  evaluateBuildImagesStatus,
  evaluateWorkflowRun,
  globToRegExp,
  matchGlob,
  presentImageWorkflows,
  readChangedFiles,
  resolveBinding,
  selectImageWorkflows,
  selectRun,
  selectionMode,
  uncoveredWorkflows,
}
