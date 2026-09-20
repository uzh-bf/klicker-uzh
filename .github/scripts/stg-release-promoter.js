const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  evaluateScanAdmission,
  evaluateScanJobStatus,
  receiptFileName,
} = require('./image-scan-admission.cjs')

const {
  STAGING_STATUS_JOB_ID,
  STAGING_WORKFLOW_NAME,
  validateStagingWorkflow: validateConsolidatedStagingWorkflow,
} = require('./staging-image-workflow.cjs')

const {
  CONSOLIDATED_WORKFLOW_PATH,
  STAGING_IMAGE_TARGETS,
  WORKFLOWS_DIRECTORY,
  amdJobName,
  buildJobName,
  imageName,
  scanJobName,
  targetById,
} = require('./staging-image-targets.cjs')

const PROMOTION_REF = 'refs/heads/stg-release'
const PROMOTION_REF_NAME = 'stg-release'
const PROMOTION_REF_API = `heads/${PROMOTION_REF_NAME}`
const SOURCE_BRANCH_VARIABLE = 'STG_SOURCE_BRANCH'
const PROMOTION_ENABLED_VARIABLE = 'STG_RELEASE_PROMOTION_ENABLED'
const MANUAL_CONFIRMATION = 'stg-release'
const DEFAULT_MAX_ATTEMPTS = 6
const DEFAULT_RETRY_DELAY_MS = 20_000
const DEFAULT_POST_PUSH_READBACK_ATTEMPTS = 3
const DEFAULT_POST_PUSH_READBACK_DELAY_MS = 2_000
// One consolidated workflow replaces the per-image files. It stays a single
// trusted path, so the controller keeps validating a fixed workflow identity
// instead of a candidate-chosen set.
const WORKFLOW_PATH_PATTERN = new RegExp(
  '^' + CONSOLIDATED_WORKFLOW_PATH.replace(/[.]/g, '\\.') + '$'
)
const APPROVED_PUSH_BRANCHES = Object.freeze(['v3', 'v3*'])
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const SHA_PATTERN = /^[0-9a-f]{40}$/
// One scanned image uploads its findings report, SBOM, and receipt together, so
// the archive budget has to cover a full vulnerability report rather than a
// receipt alone.
const SCAN_ARCHIVE_LIMIT = 67108864
const REGISTRY_CONTENT_TYPES = Object.freeze([
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
])
const REGISTRY_ACCEPT = REGISTRY_CONTENT_TYPES.join(', ')

const CI_SUITE_JOBS = Object.freeze({
  'test-graphql.yml': ['test-graphql'],
  'test-unit.yml': ['test-unit'],
  'test-olat-api.yml': ['test-olat-api'],
  'test-intl-production.yml': [
    'intl-production-smoke (frontend-pwa)',
    'intl-production-smoke (frontend-manage)',
  ],
})

const REQUIRED_CI_WORKFLOWS = Object.freeze(
  [
    ['check.yml', 'check'],
    ['check-gitleaks.yml', 'check-gitleaks'],
    ['test-graphql.yml', 'test-graphql-status'],
    ['test-playwright.yml', 'test-playwright-status'],
    ['test-unit.yml', 'test-unit-status'],
    ['test-olat-api.yml', 'test-olat-api-status'],
    ['test-intl-production.yml', 'test-intl-production-status'],
    ['v3_images-stg.yml', 'build-images-status'],
    // Admission reads push runs. There the SonarCloud job publishes a branch
    // analysis without awaiting the quality gate, and the boundary step names
    // an inflated branch classification in an annotation rather than failing
    // the job. A hard scan failure still fails this candidate, which is what
    // admission checks. The awaited gate is on the pull request, where new
    // code is the diff against the base.
    ['v3_sonarcloud.yml', 'SonarCloud'],
  ].map(([file, id]) => ({
    path: `.github/workflows/${file}`,
    jobs:
      id === 'test-playwright-status'
        ? [
            { id },
            ...Array.from({ length: 8 }, (_, i) => ({
              id: `test-playwright-execution / test-playwright-hosted (${i + 1}, 8)`,
            })),
          ]
        : [{ id }, ...(CI_SUITE_JOBS[file] ?? []).map((id) => ({ id }))],
  }))
)

// The trusted runtime publisher inventory.
//
// One consolidated workflow now owns every staging image publication, so the
// controller no longer compares a candidate-authored set of workflow files
// against a list of trusted names. What stays trusted is the target list in
// .github/scripts/staging-image-targets.cjs, read from the controller's own
// revision: a candidate can neither add, drop nor retarget a promoted image.
// Which of those targets a candidate can actually build is resolved from the
// candidate tree through its dockerfiles, never from candidate output.
const STAGING_WORKFLOWS = Object.freeze([
  { name: STAGING_WORKFLOW_NAME, path: CONSOLIDATED_WORKFLOW_PATH },
])
const STAGING_WORKFLOW_PATHS = Object.freeze([CONSOLIDATED_WORKFLOW_PATH])

// Every target the trusted inventory names, regardless of whether a given
// branch can build it. Availability is resolved per candidate below.
const STAGING_TARGET_IDS = Object.freeze(
  STAGING_IMAGE_TARGETS.map((target) => target.id)
)

function stagingTargets(targetIds) {
  return (targetIds ?? [])
    .map((targetId) => targetById(targetId))
    .filter(Boolean)
}

// The ARM64 build job names, the scan job names and the AMD64 job names are
// deterministic functions of the trusted inventory. The controller matches them
// in the candidate run's own job list, so a candidate cannot fulfill an
// expected target with a differently named job of its own choosing.
function stagingArmBuildJobIds(targetIds) {
  return stagingTargets(targetIds).map((target) => buildJobName(target))
}

function stagingScanJobIds(targetIds) {
  return stagingTargets(targetIds)
    .filter((target) => target.scan === true)
    .map((target) => scanJobName(target))
}

function stagingAmdJobIds(targetIds) {
  return stagingTargets(targetIds)
    .filter((target) => target.amd === true)
    .map((target) => amdJobName(target))
}

// The publisher inventory for one candidate. 'jobs' pairs each ARM64 build job
// with the registry image the trusted target list binds to it; those are the
// images a promotion may contain. 'requiredJobIds' is every job the candidate
// must complete, so the scan and AMD64 legs are proved from the run's own job
// list rather than from candidate evidence.
function stagingWorkflowIncarnation({ repository, targetIds }) {
  const jobs = stagingTargets(targetIds)
    .map((target) => ({
      id: buildJobName(target),
      image: 'ghcr.io/' + repository + '/' + imageName(target) + '-arm',
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    jobs,
    name: STAGING_WORKFLOW_NAME,
    path: CONSOLIDATED_WORKFLOW_PATH,
    requiredJobIds: [
      ...jobs.map((job) => job.id),
      ...stagingScanJobIds(targetIds),
      ...stagingAmdJobIds(targetIds),
    ].sort(),
  }
}

// The scan admission entries for one candidate, derived from the same trusted
// target list, so the admitted set can never differ from the built set.
function stagingScanAdmissionInventory(targetIds) {
  return stagingTargets(targetIds)
    .filter((target) => target.scan === true)
    .map((target) => ({
      buildJob: buildJobName(target),
      scanJob: scanJobName(target),
      workflowPath: CONSOLIDATED_WORKFLOW_PATH,
    }))
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function validSha(value) {
  return SHA_PATTERN.test(value ?? '')
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function checksumReceipt(receipt) {
  return sha256(canonicalJson(receipt))
}

function repositoryName(context) {
  return `${context.repo.owner}/${context.repo.repo}`
}

function assertSafeSourceBranch(sourceBranch) {
  if (
    typeof sourceBranch !== 'string' ||
    !/^[A-Za-z0-9_.-]+$/.test(sourceBranch) ||
    !matchesApprovedBranch(sourceBranch)
  ) {
    throw new Error(
      `${SOURCE_BRANCH_VARIABLE} must be a safe branch covered by the approved push triggers`
    )
  }
  return sourceBranch
}

function matchesApprovedBranch(sourceBranch) {
  return APPROVED_PUSH_BRANCHES.some((pattern) =>
    pattern.endsWith('*')
      ? sourceBranch.startsWith(pattern.slice(0, -1))
      : sourceBranch === pattern
  )
}

// Structural validation of the candidate's consolidated staging workflow.
//
// The controller must not execute candidate code, so the shape the promotion
// contract depends on is pinned by staging-image-workflow.cjs (trusted name and
// trigger, plan and matrix structure, ARM runner, full-SHA publish guard,
// per-target digest handoff, pinned scanner, enforced scan policy, terminal
// reporting job). Which images that pipeline proves is then bound from the
// controller's own target inventory, never from candidate output.
function validateStagingWorkflow({
  path: workflowPath,
  content,
  repository,
  sourceBranch,
  targetIds = STAGING_TARGET_IDS,
}) {
  validateConsolidatedStagingWorkflow({
    content,
    path: workflowPath,
    sourceBranch,
  })
  const incarnation = stagingWorkflowIncarnation({ repository, targetIds })
  if (incarnation.jobs.length === 0) {
    throw new Error(`${workflowPath} proves no staging image target`)
  }
  return incarnation
}

function validateStagingWorkflows({
  definitions,
  repository,
  sourceBranch,
  expectedWorkflows = STAGING_WORKFLOWS,
  targetIds = STAGING_TARGET_IDS,
}) {
  assertSafeSourceBranch(sourceBranch)
  if (definitions.length !== 1) {
    throw new Error('the candidate must carry exactly one staging workflow')
  }
  const expected = expectedWorkflows.map((workflow) => workflow.path).sort()
  const paths = definitions.map((definition) => definition.path).sort()
  if (canonicalJson(paths) !== canonicalJson(expected)) {
    throw new Error(
      'candidate staging workflow set differs from the trusted set'
    )
  }
  return [
    validateStagingWorkflow({
      ...definitions[0],
      repository,
      sourceBranch,
      targetIds,
    }),
  ]
}

async function getFileText(github, context, filePath, ref) {
  const response = await github.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: filePath,
    ref,
  })
  const data = response.data
  if (
    Array.isArray(data) ||
    data?.type !== 'file' ||
    data.encoding !== 'base64'
  ) {
    throw new Error(`Expected ${filePath} to be a base64 file at ${ref}`)
  }
  return Buffer.from(data.content, 'base64').toString('utf8')
}

// The per-image workflows this consolidation replaces. A candidate that still
// carries one would publish outside the planned matrix, so its presence fails
// the candidate closed until the integration line carries the consolidation.
const LEGACY_STAGING_PATTERN = /^[.]github[/]workflows[/]v3_.*-stg[.]yml$/

function isLegacyStagingWorkflowPath(entryPath) {
  return (
    String(entryPath) !== CONSOLIDATED_WORKFLOW_PATH &&
    LEGACY_STAGING_PATTERN.test(String(entryPath))
  )
}

function legacyStagingWorkflowPaths(entries) {
  return (entries ?? [])
    .filter(
      (entry) =>
        entry?.type === 'file' && isLegacyStagingWorkflowPath(entry.path)
    )
    .map((entry) => entry.path)
    .sort()
}

async function getCandidateDefinitions({
  github,
  context,
  candidateSha,
  expectedWorkflows = STAGING_WORKFLOWS,
}) {
  const response = await github.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: WORKFLOWS_DIRECTORY,
    ref: candidateSha,
  })
  if (!Array.isArray(response.data)) {
    throw new Error('candidate workflow directory is unavailable')
  }
  const legacy = legacyStagingWorkflowPaths(response.data)
  if (legacy.length > 0) {
    throw new Error(
      'candidate still publishes per-image staging workflows: ' +
        legacy.join(', ')
    )
  }
  const expectedPaths = expectedWorkflows
    .map((workflow) => workflow.path)
    .sort()
  const present = response.data
    .filter(
      (entry) => entry?.type === 'file' && expectedPaths.includes(entry.path)
    )
    .map((entry) => entry.path)
    .sort()
  if (canonicalJson(present) !== canonicalJson(expectedPaths)) {
    throw new Error(
      'candidate staging workflow set differs from the trusted set'
    )
  }
  return Promise.all(
    expectedPaths.map(async (workflowPath) => ({
      content: await getFileText(github, context, workflowPath, candidateSha),
      path: workflowPath,
    }))
  )
}

// The targets a candidate must have built, from the targets its tree does not
// carry. A target marked optional in the trusted inventory exists on the
// integration lines only; every other absence is a missing publication and fails
// the candidate. Pure, so the boundary is covered without a token or a network.
function resolveCandidateTargetIds(unavailableTargetIds = []) {
  const known = new Set(STAGING_TARGET_IDS)
  const optional = new Set(
    STAGING_IMAGE_TARGETS.filter((target) => target.optional === true).map(
      (target) => target.id
    )
  )
  const missing = new Set()
  for (const targetId of unavailableTargetIds) {
    if (!known.has(targetId)) {
      throw new Error(
        `candidate reports an unknown staging image target: ${targetId}`
      )
    }
    if (!optional.has(targetId)) {
      throw new Error(
        `candidate is missing the required staging image target ${targetId}`
      )
    }
    missing.add(targetId)
  }
  return STAGING_TARGET_IDS.filter((targetId) => !missing.has(targetId))
}

// Availability is read from the candidate tree rather than from the plan output,
// so a candidate that omits a build also drops its dockerfile or fails here.
const MISSING_DOCKERFILE_STATUS = 404

async function getCandidateTargetIds({ github, context, candidateSha }) {
  const probe = async (target) => {
    try {
      const response = await github.rest.repos.getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: target.dockerfile,
        ref: candidateSha,
      })
      if (Array.isArray(response.data) || response.data?.type !== 'file') {
        throw new Error(
          `${target.dockerfile} is not a regular file in the candidate tree`
        )
      }
      return null
    } catch (error) {
      if (error?.status === MISSING_DOCKERFILE_STATUS) return target.id
      throw error
    }
  }
  const unavailable = (
    await Promise.all(STAGING_IMAGE_TARGETS.map(probe))
  ).filter(Boolean)
  return resolveCandidateTargetIds(unavailable)
}

function getSourceBranch(selectedSourceBranch) {
  if (selectedSourceBranch === undefined) {
    throw new Error(
      `${SOURCE_BRANCH_VARIABLE} must be resolved by the trusted workflow`
    )
  }
  return assertSafeSourceBranch(selectedSourceBranch)
}

async function compareRevisions({ github, context, base, head }) {
  if (typeof github.rest.repos?.compareCommitsWithBasehead !== 'function') {
    throw new Error('remote commit comparison is unavailable')
  }
  const response = await github.rest.repos.compareCommitsWithBasehead({
    owner: context.repo.owner,
    repo: context.repo.repo,
    basehead: `${base}...${head}`,
  })
  return response.data
}

async function validateCandidateAncestry({
  github,
  context,
  candidateSha,
  sourceBranch,
}) {
  const comparison = await compareRevisions({
    github,
    context,
    base: candidateSha,
    head: sourceBranch,
  })
  if (!['ahead', 'identical'].includes(comparison?.status)) {
    throw new Error(
      `candidate ${candidateSha} is not an ancestor of selected source ${sourceBranch}`
    )
  }
  return comparison
}

async function paginate(github, endpoint, params) {
  if (typeof github.paginate !== 'function') {
    throw new Error('GitHub pagination is unavailable')
  }
  const result = await github.paginate(endpoint, params)
  if (!Array.isArray(result)) {
    throw new Error('GitHub pagination returned an invalid result')
  }
  return result
}

function latestRun(runs, workflowPath, candidateSha, sourceBranch, repository) {
  const exact = runs
    .filter(
      (run) =>
        run?.path === workflowPath &&
        run?.head_sha === candidateSha &&
        run.event === 'push' &&
        run.head_branch === sourceBranch &&
        run.repository?.full_name === repository
    )
    .sort(
      (left, right) =>
        Number(right.id ?? 0) - Number(left.id ?? 0) ||
        Number(right.run_attempt ?? 0) - Number(left.run_attempt ?? 0)
    )
  return {
    exact: exact[0],
    candidateRuns: runs.filter((run) => run?.head_sha === candidateSha),
  }
}

function runState(run, sourceBranch, repository) {
  if (
    run?.event !== 'push' ||
    run?.head_branch !== sourceBranch ||
    run?.repository?.full_name !== repository
  ) {
    return 'wrong_evidence'
  }
  if (run.status !== 'completed') return 'running'
  if (run.conclusion === 'success') return 'success'
  if (run.conclusion === 'skipped') return 'skipped'
  if (run.conclusion === 'cancelled') return 'cancelled'
  return 'failed'
}

// The jobs a candidate run must have completed successfully. The publisher
// inventory carries the image each ARM64 build proves; the remaining required
// ids are the scan and AMD64 legs, which publish no runtime image and are
// verified for success alone.
function requiredJobIds(workflow) {
  return workflow.requiredJobIds ?? workflow.jobs.map((job) => job.id)
}

function publisherJobIds(workflow) {
  return workflow.jobs.map((job) => job.id)
}

function jobState(job, expectedJobId, candidateSha) {
  if (!job) return 'missing'
  if (job.name !== expectedJobId || job.head_sha !== candidateSha) {
    return 'wrong_evidence'
  }
  if (job.status !== 'completed') return 'running'
  if (job.conclusion === 'success') return 'success'
  if (job.conclusion === 'skipped') return 'skipped'
  if (job.conclusion === 'cancelled') return 'cancelled'
  return 'failed'
}

async function collectWorkflowEvidence({
  github,
  context,
  workflow,
  candidateSha,
  sourceBranch,
  repository,
}) {
  const runs = await paginate(github, github.rest.actions.listWorkflowRuns, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    workflow_id: workflow.path,
    event: 'push',
    head_sha: candidateSha,
    per_page: 100,
  })
  const { exact, candidateRuns } = latestRun(
    runs,
    workflow.path,
    candidateSha,
    sourceBranch,
    repository
  )
  if (!exact) {
    return {
      path: workflow.path,
      reason: candidateRuns.length > 0 ? 'wrong evidence' : 'no exact-SHA run',
      status: candidateRuns.length > 0 ? 'wrong_evidence' : 'missing',
    }
  }
  const state = runState(exact, sourceBranch, repository)
  if (state !== 'success') {
    return {
      path: workflow.path,
      reason:
        state === 'running'
          ? 'run is still running'
          : `run is ${state.replace('_', ' ')}`,
      run: exact,
      status: state,
    }
  }
  if (typeof github.rest.actions.listJobsForWorkflowRunAttempt !== 'function') {
    return {
      path: workflow.path,
      reason: 'workflow jobs are unavailable',
      run: exact,
      status: 'wrong_evidence',
    }
  }
  if (!Number.isSafeInteger(exact.run_attempt) || exact.run_attempt < 1) {
    return {
      path: workflow.path,
      reason: 'run attempt is unavailable',
      run: exact,
      status: 'wrong_evidence',
    }
  }
  const jobs = await paginate(
    github,
    github.rest.actions.listJobsForWorkflowRunAttempt,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: exact.id,
      attempt_number: exact.run_attempt,
      per_page: 100,
    }
  )
  const verifiedJobs = []
  // Every job the candidate had to complete must be present and successful, but
  // only the ARM64 publisher jobs carry an image reference for promotion.
  const publisherIds = new Set(publisherJobIds(workflow))
  for (const requiredJobId of requiredJobIds(workflow)) {
    const matches = jobs.filter((job) => job?.name === requiredJobId)
    if (matches.length > 1) {
      return {
        path: workflow.path,
        reason: `${requiredJobId} is ambiguous`,
        run: exact,
        status: 'wrong_evidence',
      }
    }
    const matching = matches[0]
    const stateForJob = jobState(matching, requiredJobId, candidateSha)
    if (stateForJob !== 'success') {
      return {
        path: workflow.path,
        reason: `${requiredJobId} is ${stateForJob.replace('_', ' ')}`,
        run: exact,
        status: stateForJob,
      }
    }
    if (!Number.isSafeInteger(matching.id) || matching.id <= 0) {
      return {
        path: workflow.path,
        reason: `${requiredJobId} has no stable job id`,
        run: exact,
        status: 'wrong_evidence',
      }
    }
    if (!publisherIds.has(requiredJobId)) continue
    verifiedJobs.push({
      id: matching.id,
      name: matching.name,
      url: matching.html_url ?? '',
      conclusion: matching.conclusion,
    })
  }
  return {
    jobs: verifiedJobs,
    observedJobs: jobs.map(({ id, name, status, conclusion }) => ({
      id,
      name,
      status,
      conclusion,
    })),
    path: workflow.path,
    run: {
      branch: exact.head_branch,
      id: exact.id,
      attempt: exact.run_attempt,
      event: exact.event,
      sha: exact.head_sha,
      url: exact.html_url ?? '',
    },
    status: 'success',
  }
}

async function readCiEvidence({ github, context, run }) {
  const artifacts = await paginate(
    github,
    github.rest.actions.listWorkflowRunArtifacts,
    {
      ...context.repo,
      run_id: run.id,
      per_page: 100,
    }
  )
  const matches = artifacts.filter(
    (a) => a.name === 'required-ci-evidence' && !a.expired
  )
  if (matches.length !== 1 || matches[0].size_in_bytes > 1048576) {
    throw new Error('missing or ambiguous CI selection artifact')
  }
  const response = await github.rest.actions.downloadArtifact({
    ...context.repo,
    artifact_id: matches[0].id,
    archive_format: 'zip',
  })
  if (response.data.byteLength > 1048576)
    throw new Error('CI selection archive too large')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-ci-'))
  try {
    const archive = path.join(directory, 'evidence.zip')
    fs.writeFileSync(archive, Buffer.from(response.data))
    return JSON.parse(
      execFileSync('unzip', ['-p', archive, 'required-ci-evidence.json'], {
        encoding: 'utf8',
        maxBuffer: 1048576,
        timeout: 10000,
      })
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

// Scan receipts travel as one artifact per scanned image, next to the findings
// JSON and SBOM they describe. The findings report can be large, so the
// archive is bounded before it is read.
async function readScanReceipts({ github, context, run }) {
  const artifacts = await paginate(
    github,
    github.rest.actions.listWorkflowRunArtifacts,
    { ...context.repo, run_id: run.id, per_page: 100 }
  )
  const scanned = artifacts.filter(
    (artifact) =>
      typeof artifact.name === 'string' &&
      artifact.name.startsWith('image-scan-') &&
      !artifact.expired
  )
  const receipts = []
  for (const artifact of scanned) {
    if (artifact.size_in_bytes > SCAN_ARCHIVE_LIMIT) {
      throw new Error(`${artifact.name} exceeds the scan receipt read budget`)
    }
    const response = await github.rest.actions.downloadArtifact({
      ...context.repo,
      artifact_id: artifact.id,
      archive_format: 'zip',
    })
    if (response.data.byteLength > SCAN_ARCHIVE_LIMIT)
      throw new Error(`${artifact.name} archive too large`)
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-scan-'))
    try {
      const archive = path.join(directory, 'receipt.zip')
      fs.writeFileSync(archive, Buffer.from(response.data))
      receipts.push(
        JSON.parse(
          execFileSync(
            'unzip',
            ['-p', archive, receiptFileName(artifact.name)],
            { encoding: 'utf8', maxBuffer: 1048576, timeout: 10000 }
          )
        )
      )
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
  return receipts
}

// The scans run after the images they judge, so a candidate can legitimately
// finish its builds while a scan is still running. Only that state is retried.
// A failed or missing scan job, and a receipt that does not describe the
// promoted digest, block the candidate instead of being retried.
async function collectScanAdmission({
  github,
  context,
  workflows,
  images,
  candidateSha,
  sourceBranch,
  targetIds = STAGING_TARGET_IDS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  getReceipts = readScanReceipts,
  inventory = stagingScanAdmissionInventory(targetIds),
}) {
  const repository = repositoryName(context)
  const paths = [...new Set(inventory.map((entry) => entry.workflowPath))]
  const attempts = []
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const collected = await Promise.all(
      paths.map(async (workflowPath) => {
        const workflow = workflows.find((entry) => entry.path === workflowPath)
        if (!workflow) {
          return { path: workflowPath, status: 'wrong_evidence' }
        }
        const result = await collectWorkflowEvidence({
          github,
          context,
          workflow,
          candidateSha,
          sourceBranch,
          repository,
        })
        if (result.status !== 'success') return { ...result, workflowPath }
        const jobs = inventory
          .filter((entry) => entry.workflowPath === workflowPath)
          .map((entry) => ({
            ...evaluateScanJobStatus(result.observedJobs, entry.scanJob),
            scanJob: entry.scanJob,
          }))
        const failed = jobs.find((job) => job.status !== 'success')
        if (failed) {
          return {
            ...failed,
            path: workflowPath,
            reason: `${failed.scanJob} is ${failed.status.replace('_', ' ')}`,
            workflowPath,
          }
        }
        return { path: workflowPath, run: result.run, status: 'success' }
      })
    )
    const failures = collected.filter((result) => result.status !== 'success')
    attempts.push({
      attempt,
      failures: failures.map(({ path, reason, status }) => ({
        path,
        reason,
        status,
      })),
    })
    if (failures.length > 0) {
      const retryable = failures.every((failure) =>
        isRetryableEvidenceStatus(failure.status)
      )
      if (!retryable || attempt === maxAttempts) {
        return {
          attempts,
          entries: [],
          reason: failures
            .map(({ path, reason }) => `${path} (${reason})`)
            .join(', '),
          valid: false,
        }
      }
      await sleep(retryDelayMs)
      continue
    }
    const runs = Object.fromEntries(
      collected.map((result) => [result.path, result.run])
    )
    const receipts = Object.fromEntries(
      await Promise.all(
        collected.map(async (result) => [
          result.path,
          await getReceipts({ github, context, run: result.run }),
        ])
      )
    )
    const decision = evaluateScanAdmission({
      images,
      inventory,
      receipts,
      runs,
    })
    if (decision.valid) {
      return { attempts, entries: decision.entries, valid: true }
    }
    return {
      attempts,
      entries: decision.entries,
      reason: decision.entries
        .filter((entry) => !entry.ok)
        .map((entry) => `${entry.scanJob} (${entry.reason})`)
        .join(', '),
      valid: false,
    }
  }
  throw new Error('bounded scan admission did not reach a terminal state')
}

function validateCiSelection(
  evidence,
  workflow,
  repository,
  candidateSha,
  sourceBranch
) {
  if (
    evidence?.schemaVersion !== 1 ||
    evidence.repository !== repository ||
    evidence.workflow?.path !== workflow.path ||
    evidence.workflow?.terminalJob !== workflow.jobs[0].name ||
    evidence.event?.name !== 'push' ||
    evidence.event.branch !== sourceBranch ||
    evidence.event.sha !== candidateSha ||
    evidence.run?.id !== workflow.run.id ||
    evidence.run.attempt !== workflow.run.attempt ||
    evidence.decision?.outcome !== 'pass' ||
    evidence.reuse != null ||
    evidence.selection?.state !== 'run' ||
    !Array.isArray(evidence.jobs) ||
    evidence.jobs.length === 0
  ) {
    throw new Error('invalid CI selection evidence')
  }
  const expectedSuites = CI_SUITE_JOBS[path.basename(workflow.path)]
  if (!expectedSuites) throw new Error('unknown CI suite')
  const names = new Set()
  for (const job of evidence.jobs) {
    if (
      typeof job.name !== 'string' ||
      !job.name ||
      names.has(job.name) ||
      !['success', 'skipped'].includes(job.result)
    )
      throw new Error('invalid selected job evidence')
    const observed = workflow.observedJobs?.filter(
      (actual) => actual.name === job.name
    )
    if (
      observed?.length !== 1 ||
      observed[0].status !== 'completed' ||
      observed[0].conclusion !== job.result
    ) {
      throw new Error('CI selection does not match actual jobs')
    }
    names.add(job.name)
  }
  const suite = evidence.jobs.filter((job) => job.role === 'suite')
  const selector = evidence.jobs.filter((job) => job.role === 'selection')
  if (
    evidence.jobs.length !== expectedSuites.length + 1 ||
    suite.length !== expectedSuites.length ||
    expectedSuites.some(
      (name) =>
        !suite.some((job) => job.name === name && job.result === 'success')
    ) ||
    selector.length !== 1 ||
    selector[0].name !== 'filter' ||
    selector[0].result !== 'success'
  ) {
    throw new Error(
      'selected CI suite did not succeed or selection is unproven'
    )
  }
  return evidence
}

function isRetryableEvidenceStatus(status) {
  return status === 'missing' || status === 'running'
}

async function collectBuildEvidence({
  github,
  context,
  workflows,
  candidateSha,
  sourceBranch,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) {
  const repository = repositoryName(context)
  const attempts = []
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const results = await Promise.all(
      workflows.map((workflow) =>
        collectWorkflowEvidence({
          github,
          context,
          workflow,
          candidateSha,
          sourceBranch,
          repository,
        })
      )
    )
    const failures = results.filter((result) => result.status !== 'success')
    attempts.push({
      attempt,
      failures: failures.map(({ path, reason, status }) => ({
        path,
        reason,
        status,
      })),
    })
    if (failures.length === 0) {
      return {
        attempts,
        valid: true,
        workflows: results,
      }
    }
    const retryable = failures.every((failure) =>
      isRetryableEvidenceStatus(failure.status)
    )
    if (!retryable || attempt === maxAttempts) {
      return {
        attempts,
        failures,
        reason: failures
          .map(({ path, reason }) => `${path} (${reason})`)
          .join(', '),
        valid: false,
      }
    }
    await sleep(retryDelayMs)
  }
  throw new Error('bounded evidence collection did not reach a terminal state')
}

function uniqueImageReferences(evidence, workflows) {
  const references = []
  for (const evidenceWorkflow of evidence.workflows) {
    const workflow = workflows.find(
      (candidate) => candidate.path === evidenceWorkflow.path
    )
    for (const job of evidenceWorkflow.jobs) {
      const definition = workflow.jobs.find(
        (candidate) => candidate.id === job.name
      )
      references.push({
        job_id: job.id,
        job_name: job.name,
        repository: definition.image,
        run_id: evidenceWorkflow.run.id,
        run_url: evidenceWorkflow.run.url,
        workflow_path: evidenceWorkflow.path,
        workflow_run_sha: evidenceWorkflow.run.sha,
      })
    }
  }
  return references.sort((left, right) => {
    return canonicalJson(left).localeCompare(canonicalJson(right))
  })
}

function digestValue(value) {
  return typeof value === 'string' ? value : value?.digest
}

async function resolveStableRegistryDigests({
  candidateSha,
  evidence,
  workflows,
  getRegistryDigest,
}) {
  if (typeof getRegistryDigest !== 'function') {
    throw new Error('registry digest resolver is unavailable')
  }
  const references = uniqueImageReferences(evidence, workflows)
  const unique = [
    ...new Map(
      references.map((reference) => [
        `${reference.repository}:${candidateSha}`,
        { repository: reference.repository, tag: candidateSha },
      ])
    ).values(),
  ].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right))
  )

  const read = async () => {
    const entries = await Promise.all(
      unique.map(async (reference) => {
        const digest = digestValue(await getRegistryDigest(reference))
        if (!DIGEST_PATTERN.test(digest ?? '')) {
          throw new Error(
            `${reference.repository}:${reference.tag} has no complete registry digest`
          )
        }
        return { ...reference, digest }
      })
    )
    return entries.sort((left, right) =>
      canonicalJson(left).localeCompare(canonicalJson(right))
    )
  }

  const first = await read()
  const second = await read()
  if (canonicalJson(first) !== canonicalJson(second)) {
    throw new Error('registry SHA-tag digests changed during collection')
  }
  const digestByReference = new Map(
    first.map((entry) => [`${entry.repository}:${entry.tag}`, entry.digest])
  )
  return references.map((reference) => ({
    ...reference,
    digest: digestByReference.get(`${reference.repository}:${candidateSha}`),
    tag: candidateSha,
  }))
}

function registryManifestUrl(repository, tag) {
  const parts = repository.split('/')
  if (parts.length < 2)
    throw new Error(`invalid registry repository ${repository}`)
  const registry = parts.shift()
  return `https://${registry}/v2/${parts.map(encodeURIComponent).join('/')}/manifests/${encodeURIComponent(tag)}`
}

function parseBearerChallenge(value) {
  if (!/^Bearer\s+/i.test(value ?? '')) {
    throw new Error(
      'registry did not provide a Bearer authentication challenge'
    )
  }
  const parameters = Object.fromEntries(
    [...String(value).matchAll(/([a-z]+)="([^"]*)"/gi)].map((match) => [
      match[1].toLowerCase(),
      match[2],
    ])
  )
  if (!parameters.realm) {
    throw new Error('registry Bearer challenge has no token realm')
  }
  return parameters
}

async function registryResponse({ repository, tag, fetchImpl }) {
  const manifestUrl = registryManifestUrl(repository, tag)
  const request = (authorization = undefined) =>
    fetchImpl(manifestUrl, {
      headers: {
        accept: REGISTRY_ACCEPT,
        ...(authorization ? { authorization } : {}),
      },
      redirect: 'error',
    })
  let response = await request()
  if (response.redirected) {
    throw new Error(`${repository}:${tag} registry response redirected`)
  }
  if (response.status !== 401) return response

  const challenge = parseBearerChallenge(
    response.headers.get('www-authenticate')
  )
  const repositoryPath = repository.split('/').slice(1).join('/')
  const registry = new URL(manifestUrl).hostname
  const realm = new URL(challenge.realm)
  if (realm.protocol !== 'https:' || realm.hostname !== registry) {
    throw new Error('registry Bearer challenge uses an untrusted token realm')
  }
  if (challenge.service && challenge.service !== registry) {
    throw new Error('registry Bearer challenge uses an unexpected service')
  }
  const expectedScope = `repository:${repositoryPath}:pull`
  if (challenge.scope && challenge.scope !== expectedScope) {
    throw new Error('registry Bearer challenge uses an unexpected scope')
  }
  realm.searchParams.set('service', registry)
  realm.searchParams.set('scope', expectedScope)
  const tokenResponse = await fetchImpl(realm, { redirect: 'error' })
  if (tokenResponse.redirected) {
    throw new Error(`${repository}:${tag} registry token response redirected`)
  }
  if (!tokenResponse.ok) {
    throw new Error(
      `${repository}:${tag} registry token response was ${tokenResponse.status}`
    )
  }
  const tokenPayload = await tokenResponse.json()
  const token = tokenPayload?.token ?? tokenPayload?.access_token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `${repository}:${tag} registry token response was incomplete`
    )
  }
  response = await request(`Bearer ${token}`)
  if (response.redirected) {
    throw new Error(`${repository}:${tag} registry response redirected`)
  }
  return response
}

async function fetchRegistryDigest({ repository, tag, fetchImpl = fetch }) {
  const response = await registryResponse({ repository, tag, fetchImpl })
  if (!response.ok) {
    throw new Error(
      `${repository}:${tag} registry response was ${response.status}`
    )
  }
  const contentType = String(response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (!REGISTRY_CONTENT_TYPES.includes(contentType)) {
    throw new Error(
      `${repository}:${tag} registry response has an unexpected content type`
    )
  }
  const digest = response.headers.get('docker-content-digest')
  if (!DIGEST_PATTERN.test(digest ?? '')) {
    throw new Error(
      `${repository}:${tag} registry response has no valid digest header`
    )
  }
  if (typeof response.arrayBuffer !== 'function') {
    throw new Error(`${repository}:${tag} registry response was incomplete`)
  }
  let body
  try {
    body = Buffer.from(await response.arrayBuffer())
  } catch {
    throw new Error(`${repository}:${tag} registry response was incomplete`)
  }
  if (body.length === 0) {
    throw new Error(`${repository}:${tag} registry response was incomplete`)
  }
  const bodyDigest = `sha256:${sha256Bytes(body)}`
  if (bodyDigest !== digest) {
    throw new Error(
      `${repository}:${tag} registry response body does not match its digest header`
    )
  }
  return digest
}

async function getReleaseRef({ github, context }) {
  if (typeof github.rest.git?.getRef !== 'function') {
    throw new Error('stg-release remote ref API is unavailable')
  }
  try {
    const response = await github.rest.git.getRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: PROMOTION_REF_API,
    })
    const sha = response.data?.object?.sha
    if (response.data?.object?.type !== 'commit' || !validSha(sha))
      throw new Error('stg-release does not point to a commit')
    return sha
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}

function releaseRepositoryUrl(
  context,
  serverUrl = process.env.GITHUB_SERVER_URL
) {
  const owner = context.repo.owner
  const repository = context.repo.repo
  if (
    !/^[A-Za-z0-9_.-]+$/.test(owner ?? '') ||
    !/^[A-Za-z0-9_.-]+$/.test(repository ?? '')
  ) {
    throw new Error('repository identity is unsafe for a ref update')
  }
  const server = new URL(serverUrl || 'https://github.com')
  if (server.protocol !== 'https:') {
    throw new Error('repository server must use HTTPS')
  }
  return new URL(`${owner}/${repository}.git`, `${server.origin}/`).toString()
}

function gitEnvironment(gitToken, repositoryUrl) {
  const environment = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  }
  delete environment.GITHUB_TOKEN
  delete environment['INPUT_GITHUB-TOKEN']
  delete environment.STG_PROMOTE_TOKEN
  if (!gitToken) return environment

  const origin = new URL(repositoryUrl).origin
  const authorization = Buffer.from(`x-access-token:${gitToken}`).toString(
    'base64'
  )
  environment.GIT_CONFIG_COUNT = '1'
  environment.GIT_CONFIG_KEY_0 = `http.${origin}/.extraheader`
  environment.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${authorization}`
  return environment
}

function runGit(args, options) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    ...options,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function pushReleaseRefWithLease({
  context,
  expectedSha,
  candidateSha,
  gitToken,
  repositoryUrl = releaseRepositoryUrl(context),
  gitRunner = runGit,
  workspace = process.cwd(),
}) {
  if (!validSha(candidateSha)) throw new Error('candidate SHA is invalid')
  if (expectedSha != null && !validSha(expectedSha)) {
    throw new Error('expected release SHA is invalid')
  }
  if (!gitToken && /^https:/i.test(repositoryUrl)) {
    throw new Error('STG_PROMOTE_TOKEN is unavailable for the ref update')
  }

  const options = {
    cwd: workspace,
    env: gitEnvironment(gitToken, repositoryUrl),
  }
  gitRunner(
    [
      'fetch',
      '--no-tags',
      '--no-write-fetch-head',
      '--no-recurse-submodules',
      repositoryUrl,
      candidateSha,
    ],
    { ...options, env: gitEnvironment(process.env.GITHUB_TOKEN, repositoryUrl) }
  )
  gitRunner(
    [
      'push',
      '--porcelain',
      // GitHub's ref API has no expected-old field. The explicit lease supplies
      // that compare-and-swap condition after graph validation proved this is
      // a create or fast-forward, never a history rewrite.
      `--force-with-lease=${PROMOTION_REF}:${expectedSha ?? ''}`,
      repositoryUrl,
      `${candidateSha}:${PROMOTION_REF}`,
    ],
    options
  )
}

async function planReleaseRef({ github, context, currentSha, candidateSha }) {
  if (currentSha == null) return { action: 'create', currentSha: null }
  if (currentSha === candidateSha) {
    return { action: 'no-op-equal', currentSha }
  }
  const comparison = await compareRevisions({
    github,
    context,
    base: currentSha,
    head: candidateSha,
  })
  if (comparison.status === 'ahead') {
    return { action: 'fast-forward', currentSha }
  }
  if (comparison.status === 'behind') {
    return { action: 'no-op-stale', currentSha }
  }
  if (comparison.status === 'identical') {
    return { action: 'no-op-equal', currentSha }
  }
  throw new Error('stg-release diverges from the candidate; refusing promotion')
}

async function compareAndSwapReleaseRef({
  github,
  context,
  expectedSha,
  candidateSha,
  gitToken,
  repositoryUrl,
  gitRunner,
  workspace,
  readbackMaxAttempts = DEFAULT_POST_PUSH_READBACK_ATTEMPTS,
  readbackRetryDelayMs = DEFAULT_POST_PUSH_READBACK_DELAY_MS,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) {
  if (!Number.isSafeInteger(readbackMaxAttempts) || readbackMaxAttempts < 1) {
    throw new Error('post-push readback attempts must be a positive integer')
  }
  if (!Number.isSafeInteger(readbackRetryDelayMs) || readbackRetryDelayMs < 0) {
    throw new Error('post-push readback delay must be a non-negative integer')
  }
  const observed = await getReleaseRef({ github, context })
  if (observed !== expectedSha) {
    throw new Error('stg-release changed before the compare-and-swap')
  }
  if (expectedSha != null) {
    const comparison = await compareRevisions({
      github,
      context,
      base: expectedSha,
      head: candidateSha,
    })
    if (!['ahead', 'identical'].includes(comparison?.status)) {
      throw new Error('stg-release compare-and-swap is not a fast-forward')
    }
  }
  try {
    pushReleaseRefWithLease({
      context,
      expectedSha,
      candidateSha,
      gitToken,
      repositoryUrl,
      gitRunner,
      workspace,
    })
  } catch {
    // Git errors can retain subprocess credentials in attached fields. Report
    // only fixed guidance, never the raw error or its nested cause.
    throw new Error(
      'stg-release compare-and-swap failed; verify the write token permissions, ref protection, and concurrent ref updates'
    )
  }

  const readbackAttempts = []
  let observedReleaseSha = null
  let verification = 'uncertain'
  for (let attempt = 1; attempt <= readbackMaxAttempts; attempt += 1) {
    try {
      observedReleaseSha = await getReleaseRef({ github, context })
      verification =
        observedReleaseSha === candidateSha ? 'verified' : 'mismatch'
      readbackAttempts.push({
        attempt,
        observed_release_sha: observedReleaseSha,
        state: verification,
      })
      if (verification === 'verified') break
    } catch {
      observedReleaseSha = null
      verification = 'uncertain'
      readbackAttempts.push({
        attempt,
        observed_release_sha: null,
        state: 'unavailable',
      })
    }
    if (attempt < readbackMaxAttempts) {
      try {
        await sleep(readbackRetryDelayMs)
      } catch {
        break
      }
    }
  }
  return {
    observed_release_sha: observedReleaseSha,
    readback_attempts: readbackAttempts,
    result: 'push-succeeded',
    verification,
  }
}

function defaultReceiptPath() {
  return path.join(
    process.env.RUNNER_TEMP || os.tmpdir(),
    'stg-release-promotion-receipt.json'
  )
}

function defaultChecksumPath() {
  return path.join(
    process.env.RUNNER_TEMP || os.tmpdir(),
    'stg-release-promotion-receipt.sha256'
  )
}

function writeReceiptArtifacts({
  receipt,
  checksum,
  receiptPath = defaultReceiptPath(),
  checksumPath = defaultChecksumPath(),
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
}) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true })
  fs.mkdirSync(path.dirname(checksumPath), { recursive: true })
  const serialized = canonicalJson(receipt)
  fs.writeFileSync(receiptPath, `${serialized}\n`)
  fs.writeFileSync(checksumPath, `${checksum}  ${path.basename(receiptPath)}\n`)
  if (summaryPath) {
    fs.appendFileSync(
      summaryPath,
      [
        '### Staging release promotion',
        '',
        `- Candidate: \`${receipt.candidate_sha}\``,
        `- Source: \`${receipt.source_branch}\``,
        `- Controller run: \`${receipt.controller_run_id}\``,
        `- Decision: \`${receipt.decision.action}\``,
        `- Write mode: \`${receipt.decision.mode}\``,
        `- Ref update: \`${receipt.update_result.result}\``,
        `- Ref verification: \`${receipt.update_result.verification}\``,
        `- Workflows: ${receipt.workflows.length}`,
        `- Runtime image digests: ${receipt.images.length}`,
        `- Receipt checksum: \`${checksum}\``,
        '',
      ].join('\n')
    )
  }
  return { checksumPath, receiptPath }
}

function setOutput(core, name, value) {
  if (typeof core?.setOutput === 'function') core.setOutput(name, value)
}

async function resolveInputs({
  context,
  sourceBranch,
  candidateSha,
  promotionEnabled = process.env[PROMOTION_ENABLED_VARIABLE],
}) {
  const selectedSourceBranch = getSourceBranch(sourceBranch)
  if (context.eventName === 'workflow_run') {
    const workflowRun = context.payload?.workflow_run
    if (
      workflowRun?.event !== 'push' ||
      workflowRun?.conclusion !== 'success' ||
      workflowRun?.head_branch !== selectedSourceBranch
    ) {
      return {
        mode: 'automatic',
        reason: 'workflow completion is not a successful selected-source push',
        skipped: true,
      }
    }
    return {
      allowWrite: promotionEnabled === 'true',
      candidateSha: workflowRun.head_sha,
      confirmation: '',
      dryRun: false,
      mode: 'automatic',
      sourceBranch: selectedSourceBranch,
    }
  }
  if (context.eventName === 'workflow_dispatch') {
    const inputs = context.payload?.inputs ?? {}
    const selectedCandidateSha = candidateSha ?? inputs.sha
    const dryRun = inputs.dry_run !== false && inputs.dry_run !== 'false'
    const confirmation = inputs.confirm_ref_update ?? ''
    if (!dryRun && confirmation !== MANUAL_CONFIRMATION) {
      throw new Error(
        `manual writes require confirm_ref_update=${MANUAL_CONFIRMATION}`
      )
    }
    if (
      !dryRun &&
      ((inputs.expected_release_sha !== 'absent' &&
        !validSha(inputs.expected_release_sha)) ||
        !validSha(inputs.expected_controller_sha))
    ) {
      throw new Error(
        'manual writes require expected_release_sha and expected_controller_sha'
      )
    }
    return {
      expectedReleaseSha: inputs.expected_release_sha,
      expectedControllerSha: inputs.expected_controller_sha,
      allowWrite: !dryRun,
      candidateSha: selectedCandidateSha,
      confirmation,
      dryRun,
      mode: 'manual',
      sourceBranch: selectedSourceBranch,
    }
  }
  throw new Error(`unsupported promotion event ${context.eventName}`)
}

async function runPromotion({
  github,
  context,
  core,
  sourceBranch,
  candidateSha,
  promotionEnabled,
  controllerSha = process.env.TRUSTED_WORKFLOW_SHA,
  expectedWorkflows = STAGING_WORKFLOWS,
  getCandidateTargetIds: resolveTargetIds = getCandidateTargetIds,
  getRegistryDigest = fetchRegistryDigest,
  getCiEvidence = readCiEvidence,
  getScanAdmission = collectScanAdmission,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  readbackMaxAttempts = DEFAULT_POST_PUSH_READBACK_ATTEMPTS,
  readbackRetryDelayMs = DEFAULT_POST_PUSH_READBACK_DELAY_MS,
  receiptPath,
  checksumPath,
  summaryPath,
  gitToken,
  repositoryUrl,
  gitRunner,
  workspace,
}) {
  const inputs = await resolveInputs({
    context,
    sourceBranch,
    candidateSha,
    promotionEnabled,
  })
  if (inputs.skipped) {
    core?.info?.(`Skipping staging release promotion: ${inputs.reason}`)
    setOutput(core, 'decision', 'skipped')
    return inputs
  }
  if (!validSha(inputs.candidateSha)) {
    throw new Error('candidate SHA must be 40 lowercase hexadecimal characters')
  }
  if (!Number.isSafeInteger(context.runId) || context.runId <= 0) {
    throw new Error('controller run id is unavailable')
  }
  if (inputs.mode === 'automatic' && !inputs.allowWrite) {
    core?.info?.(
      `${PROMOTION_ENABLED_VARIABLE} is not true; automatic promotion remains read-only`
    )
    setOutput(core, 'decision', 'disabled')
    return { ...inputs, decision: 'disabled', skipped: true }
  }

  if (!validSha(controllerSha))
    throw new Error('trusted controller SHA is unavailable')
  if (
    inputs.expectedControllerSha &&
    inputs.expectedControllerSha !== controllerSha
  ) {
    throw new Error('trusted controller SHA changed since dry run')
  }
  const repository = repositoryName(context)
  // Which targets this candidate can build is read from its own tree, so a
  // candidate that drops an integration-only image is tolerated while a missing
  // required image fails before any evidence is collected.
  const targetIds = await resolveTargetIds({
    github,
    context,
    candidateSha: inputs.candidateSha,
  })
  const definitions = await getCandidateDefinitions({
    github,
    context,
    candidateSha: inputs.candidateSha,
    expectedWorkflows,
  })
  const workflows = validateStagingWorkflows({
    definitions,
    repository,
    sourceBranch: inputs.sourceBranch,
    expectedWorkflows,
    targetIds,
  })
  await validateCandidateAncestry({
    github,
    context,
    candidateSha: inputs.candidateSha,
    sourceBranch: inputs.sourceBranch,
  })

  const evidence = await collectBuildEvidence({
    github,
    context,
    workflows,
    candidateSha: inputs.candidateSha,
    sourceBranch: inputs.sourceBranch,
    maxAttempts,
    retryDelayMs,
    sleep,
  })
  if (!evidence.valid) {
    throw new Error(`staging build evidence is incomplete: ${evidence.reason}`)
  }
  const ciEvidence = await collectBuildEvidence({
    github,
    context,
    workflows: REQUIRED_CI_WORKFLOWS,
    candidateSha: inputs.candidateSha,
    sourceBranch: inputs.sourceBranch,
    maxAttempts,
    retryDelayMs,
    sleep,
  })
  if (!ciEvidence.valid) {
    throw new Error(`staging CI evidence is incomplete: ${ciEvidence.reason}`)
  }
  for (const workflow of ciEvidence.workflows) {
    if (
      [
        'test-graphql.yml',
        'test-unit.yml',
        'test-olat-api.yml',
        'test-intl-production.yml',
      ].some((file) => workflow.path === `.github/workflows/${file}`)
    ) {
      workflow.selection = validateCiSelection(
        await getCiEvidence({ github, context, run: workflow.run }),
        workflow,
        repository,
        inputs.candidateSha,
        inputs.sourceBranch
      )
    }
  }
  const images = await resolveStableRegistryDigests({
    candidateSha: inputs.candidateSha,
    evidence,
    workflows,
    getRegistryDigest,
  })
  // A promoted digest must be the digest the scan policy judged, so the scan
  // evidence is bound to the resolved references rather than to an image name.
  const scanEvidence = await getScanAdmission({
    github,
    context,
    workflows,
    images,
    candidateSha: inputs.candidateSha,
    sourceBranch: inputs.sourceBranch,
    targetIds,
    maxAttempts,
    retryDelayMs,
    sleep,
  })
  if (!scanEvidence.valid) {
    throw new Error(
      `staging image scan evidence is incomplete: ${scanEvidence.reason}`
    )
  }

  const currentSha = await getReleaseRef({ github, context })
  if (
    inputs.expectedReleaseSha &&
    (inputs.expectedReleaseSha === 'absent'
      ? currentSha !== null
      : inputs.expectedReleaseSha !== currentSha)
  ) {
    throw new Error('stg-release changed since dry run')
  }
  const decision = await planReleaseRef({
    github,
    context,
    currentSha,
    candidateSha: inputs.candidateSha,
  })
  let updateResult = {
    observed_release_sha: currentSha,
    readback_attempts: [],
    result: 'not-attempted',
    verification: 'not-required',
  }
  if (
    inputs.allowWrite &&
    ['create', 'fast-forward'].includes(decision.action)
  ) {
    updateResult = await compareAndSwapReleaseRef({
      github,
      context,
      expectedSha: currentSha,
      candidateSha: inputs.candidateSha,
      gitToken,
      repositoryUrl,
      gitRunner,
      workspace,
      readbackMaxAttempts,
      readbackRetryDelayMs,
      sleep,
    })
  }
  const appliedSha =
    updateResult.verification === 'verified' ? inputs.candidateSha : null

  const receipt = {
    schema_version: 'stg-release-promotion/v2',
    controller_sha: controllerSha,
    ci: ciEvidence,
    controller_run_id: context.runId,
    repository,
    source_branch: inputs.sourceBranch,
    candidate_sha: inputs.candidateSha,
    previous_release_sha: currentSha,
    applied_release_sha: appliedSha,
    decision: {
      action: decision.action,
      mode: inputs.allowWrite ? 'apply' : 'dry-run',
      ref: PROMOTION_REF,
    },
    update_result: updateResult,
    attempts: evidence.attempts,
    workflows: evidence.workflows.map((workflow) => ({
      name: workflows.find((entry) => entry.path === workflow.path).name,
      path: workflow.path,
      run_id: workflow.run.id,
      run_sha: workflow.run.sha,
      run_url: workflow.run.url,
      jobs: workflow.jobs,
    })),
    images,
    scan: {
      attempts: scanEvidence.attempts,
      images: scanEvidence.entries,
    },
  }
  const checksum = checksumReceipt(receipt)
  const artifacts = writeReceiptArtifacts({
    receipt,
    checksum,
    receiptPath,
    checksumPath,
    summaryPath,
  })
  setOutput(core, 'decision', decision.action)
  setOutput(core, 'receipt_path', artifacts.receiptPath)
  setOutput(core, 'checksum_path', artifacts.checksumPath)
  setOutput(core, 'receipt_checksum', checksum)
  core?.info?.(
    `Staging release promotion ${decision.action}; receipt ${checksum}`
  )
  if (
    updateResult.result === 'push-succeeded' &&
    updateResult.verification !== 'verified'
  ) {
    throw new Error(
      `stg-release push succeeded but post-push verification is ${updateResult.verification}; receipt ${checksum}`
    )
  }
  return { ...receipt, checksum, ...artifacts }
}

module.exports = {
  readCiEvidence,
  resolveInputs,
  validateCiSelection,
  REQUIRED_CI_WORKFLOWS,
  APPROVED_PUSH_BRANCHES,
  STAGING_IMAGE_TARGETS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_POST_PUSH_READBACK_ATTEMPTS,
  DEFAULT_POST_PUSH_READBACK_DELAY_MS,
  DEFAULT_RETRY_DELAY_MS,
  DIGEST_PATTERN,
  MANUAL_CONFIRMATION,
  PROMOTION_ENABLED_VARIABLE,
  PROMOTION_REF,
  PROMOTION_REF_API,
  PROMOTION_REF_NAME,
  SOURCE_BRANCH_VARIABLE,
  STAGING_TARGET_IDS,
  STAGING_WORKFLOWS,
  STAGING_WORKFLOW_PATHS,
  canonicalJson,
  checksumReceipt,
  collectBuildEvidence,
  collectScanAdmission,
  compareAndSwapReleaseRef,
  fetchRegistryDigest,
  getCandidateDefinitions,
  getCandidateTargetIds,
  getReleaseRef,
  getSourceBranch,
  isLegacyStagingWorkflowPath,
  legacyStagingWorkflowPaths,
  matchesApprovedBranch,
  planReleaseRef,
  pushReleaseRefWithLease,
  readScanReceipts,
  requiredJobIds,
  resolveCandidateTargetIds,
  resolveStableRegistryDigests,
  runPromotion,
  stagingAmdJobIds,
  stagingArmBuildJobIds,
  stagingScanAdmissionInventory,
  stagingScanJobIds,
  stagingTargets,
  stagingWorkflowIncarnation,
  validateCandidateAncestry,
  validateStagingWorkflow,
  validateStagingWorkflows,
  writeReceiptArtifacts,
}
