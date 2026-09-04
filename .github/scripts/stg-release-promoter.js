'use strict'

const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROMOTION_REF = 'refs/heads/stg-release'
const PROMOTION_REF_NAME = 'stg-release'
const PROMOTION_REF_API = `heads/${PROMOTION_REF_NAME}`
const SOURCE_BRANCH_VARIABLE = 'STG_SOURCE_BRANCH'
const PROMOTION_ENABLED_VARIABLE = 'STG_RELEASE_PROMOTION_ENABLED'
const MANUAL_CONFIRMATION = 'stg-release'
const DEFAULT_SOURCE_BRANCH = 'v3'
const DEFAULT_MAX_ATTEMPTS = 6
const DEFAULT_RETRY_DELAY_MS = 20_000
const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/v3_.*-stg\.yml$/
const APPROVED_PUSH_BRANCHES = Object.freeze(['v3', 'v3*'])
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const SHA_PATTERN = /^[0-9a-f]{40}$/
const REGISTRY_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ')

// Keep this inventory synchronized with the workflow_run names below. A
// candidate cannot rename, add, remove, or retarget a runtime publisher without
// a trusted controller change.
const STAGING_WORKFLOWS = Object.freeze([
  {
    jobs: [{ id: 'build-arm', image: 'analytics-arm' }],
    name: 'Build Docker image for analytics (stg)',
    path: '.github/workflows/v3_analytics-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'auth-arm' }],
    name: 'Build Docker image for auth (stg)',
    path: '.github/workflows/v3_auth-stg.yml',
  },
  {
    jobs: [
      { id: 'build-arm', image: 'backend-docker-arm' },
      { id: 'build-migrator-arm', image: 'backend-docker-migrator-arm' },
    ],
    name: 'Build Docker image for backend-docker (stg)',
    path: '.github/workflows/v3_backend-docker-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'chat-arm' }],
    name: 'Build Docker image for chat (stg)',
    path: '.github/workflows/v3_chat-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'frontend-control-arm' }],
    name: 'Build Docker image for frontend-control (stg)',
    path: '.github/workflows/v3_frontend-control-docker-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'frontend-manage-arm' }],
    name: 'Build Docker image for frontend-manage (stg)',
    path: '.github/workflows/v3_frontend-manage-docker-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'frontend-assessment-arm' }],
    name: 'Build Docker image for frontend-assessment (stg)',
    path: '.github/workflows/v3_frontend-pwa-docker-assessment-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'frontend-pwa-arm' }],
    name: 'Build Docker image for frontend-pwa (stg)',
    path: '.github/workflows/v3_frontend-pwa-docker-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'hatchet-worker-general-arm' }],
    name: 'Build Docker image for hatchet-worker-general (stg)',
    path: '.github/workflows/v3_hatchet-worker-general-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'hatchet-worker-response-processor-arm' }],
    name: 'Build Docker image for hatchet-worker-response-processor (stg)',
    path: '.github/workflows/v3_hatchet-worker-response-processor-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'lti-arm' }],
    name: 'Build Docker image for lti (stg)',
    path: '.github/workflows/v3_lti-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'mcp-lecturer-arm' }],
    name: 'Build Docker image for mcp-lecturer (stg)',
    nonRuntimeJobs: [{ id: 'build-amd', image: 'mcp-lecturer-amd' }],
    path: '.github/workflows/v3_mcp-lecturer-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'mcp-student-arm' }],
    name: 'Build Docker image for mcp-student (stg)',
    nonRuntimeJobs: [{ id: 'build-amd', image: 'mcp-student-amd' }],
    path: '.github/workflows/v3_mcp-student-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'olat-api-arm' }],
    name: 'Build Docker image for olat-api (stg)',
    path: '.github/workflows/v3_olat-api-stg.yml',
  },
  {
    jobs: [{ id: 'build-arm', image: 'response-api-arm' }],
    name: 'Build Docker image for response-api (stg)',
    path: '.github/workflows/v3_response-api-stg.yml',
  },
])
const STAGING_WORKFLOW_PATHS = Object.freeze(
  STAGING_WORKFLOWS.map((workflow) => workflow.path)
)

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
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

function parseScalar(value) {
  return String(value ?? '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
}

function extractTopLevelBlock(
  content,
  key,
  workflowPath,
  { optional = false } = {}
) {
  const lines = String(content).split(/\r?\n/)
  const indexes = lines
    .map((line, index) => (line === `${key}:` ? index : -1))
    .filter((index) => index >= 0)
  if (indexes.length === 0 && optional) return []
  if (indexes.length !== 1) {
    throw new Error(
      `${workflowPath} must have exactly one top-level ${key} block`
    )
  }
  const start = indexes[0]
  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => line.trim() !== '' && !/^\s/.test(line))
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd
  return lines.slice(start + 1, end)
}

function extractName(content, workflowPath) {
  const matches = [...String(content).matchAll(/^name:\s*(.+)$/gm)]
  if (matches.length !== 1 || !parseScalar(matches[0][1])) {
    throw new Error(`${workflowPath} must have exactly one workflow name`)
  }
  return parseScalar(matches[0][1])
}

function extractPushBranches(content, workflowPath) {
  const lines = extractTopLevelBlock(content, 'on', workflowPath)
  const pushIndex = lines.findIndex((line) => /^  push:\s*$/.test(line))
  if (pushIndex < 0) {
    throw new Error(`${workflowPath} has no push trigger`)
  }
  const end = lines.slice(pushIndex + 1).findIndex((line) => {
    return line.trim() !== '' && !/^\s*#/.test(line) && /^  \S/.test(line)
  })
  const endIndex = end < 0 ? lines.length : pushIndex + 1 + end
  const branchesIndex = lines.findIndex(
    (line, index) =>
      index > pushIndex && index < endIndex && /^    branches:\s*$/.test(line)
  )
  if (branchesIndex < 0) {
    throw new Error(`${workflowPath} push trigger has no branches`)
  }
  const pushKeys = lines
    .slice(pushIndex + 1, endIndex)
    .flatMap((line) => line.match(/^    ([A-Za-z0-9_-]+):/)?.[1] ?? [])
  if (canonicalJson(pushKeys) !== canonicalJson(['branches'])) {
    throw new Error(`${workflowPath} does not use the approved push triggers`)
  }
  const branches = []
  for (let index = branchesIndex + 1; index < endIndex; index += 1) {
    const match = lines[index].match(/^      -\s*(.+?)\s*$/)
    if (match) branches.push(parseScalar(match[1]))
  }
  return branches
}

function extractRootEnvironment(content, workflowPath) {
  const lines = extractTopLevelBlock(content, 'env', workflowPath, {
    optional: true,
  })
  const values = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/^  ([A-Z][A-Z0-9_]*)\s*:\s*(.*?)\s*$/)
    if (match) values[match[1]] = parseScalar(match[2])
  }
  return values
}

function extractJobBlocks(content, workflowPath) {
  const lines = extractTopLevelBlock(content, 'jobs', workflowPath)
  const jobs = []
  let current = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/)
    if (jobMatch) {
      if (current) jobs.push(current)
      current = { id: jobMatch[1], lines: [] }
      continue
    }
    if (current) {
      if (/^\S/.test(line) && line.trim() !== '') break
      current.lines.push(line)
    }
  }
  if (current) jobs.push(current)
  return jobs.map((job) => ({ ...job, content: job.lines.join('\n') }))
}

function isDisabledJob(job) {
  return /^    if:\s*\$\{\{\s*false\s*\}\}\s*(?:#.*)?$/m.test(job.content)
}

function resolveTemplate(value, environment, repository) {
  let resolved = parseScalar(value)
  for (let pass = 0; pass < 3; pass += 1) {
    const next = resolved
      .replace(/\$\{\{\s*github\.repository\s*\}\}/g, repository)
      .replace(
        /\$\{\{\s*env\.([A-Z][A-Z0-9_]*)\s*\}\}/g,
        (_match, name) => environment[name] ?? ''
      )
    if (next === resolved) break
    resolved = next
  }
  return resolved
}

function extractActionSteps(job, workflowPath) {
  const lines = job.content.split(/\r?\n/)
  const stepsIndexes = lines
    .map((line, index) => (line === '    steps:' ? index : -1))
    .filter((index) => index >= 0)
  if (stepsIndexes.length !== 1) {
    throw new Error(
      `${workflowPath}/${job.id} must have exactly one steps block`
    )
  }
  const start = stepsIndexes[0]
  const relativeEnd = lines.slice(start + 1).findIndex((line) => {
    return (
      line.trim() !== '' &&
      !/^\s*#/.test(line) &&
      /^    [A-Za-z0-9_-]+:/.test(line)
    )
  })
  const end = relativeEnd < 0 ? lines.length : start + 1 + relativeEnd
  const steps = []
  let current = null
  for (const line of lines.slice(start + 1, end)) {
    if (/^      -\s+/.test(line)) {
      if (current) steps.push(current.join('\n'))
      current = [line]
    } else if (current) {
      current.push(line)
    }
  }
  if (current) steps.push(current.join('\n'))
  return steps
}

function actionStep(job, action, workflowPath) {
  const matches = extractActionSteps(job, workflowPath).filter((step) =>
    new RegExp(
      `^(?:      - uses|        uses):\\s*${action.replace('/', '\\/')}@[^\\s#]+\\s*(?:#.*)?$`,
      'm'
    ).test(step)
  )
  if (matches.length !== 1) {
    throw new Error(`${workflowPath}/${job.id} must use exactly one ${action}`)
  }
  return matches[0]
}

function extractImageReference(
  step,
  environment,
  repository,
  workflowPath,
  jobId
) {
  const matches = [...step.matchAll(/^          images:\s*(.+)$/gm)]
  if (matches.length !== 1) {
    throw new Error(
      `${workflowPath}/${jobId} must declare exactly one metadata image`
    )
  }
  const match = matches[0]
  if (!match) {
    throw new Error(`${workflowPath}/${jobId} has no Docker image metadata`)
  }
  const image = resolveTemplate(match[1], environment, repository)
  if (
    image.includes('${{') ||
    !/^[A-Za-z0-9.-]+\/[A-Za-z0-9._/-]+$/.test(image)
  ) {
    throw new Error(
      `${workflowPath}/${jobId} has an unresolved image reference`
    )
  }
  return image
}

function hasFullShaTag(metadataStep) {
  return (
    /^\s*type\s*=\s*raw[^\n#]*value\s*=\s*\$\{\{\s*github\.sha\s*\}\}\s*$/m.test(
      metadataStep
    ) || /^\s*tags:\s*\$\{\{\s*github\.sha\s*\}\}\s*$/m.test(metadataStep)
  )
}

function validateStagingWorkflow({
  path: workflowPath,
  content,
  expectedWorkflow,
  repository,
  sourceBranch,
}) {
  if (!WORKFLOW_PATH_PATTERN.test(workflowPath)) {
    throw new Error(`${workflowPath} is not an approved staging workflow path`)
  }
  const workflowName = extractName(content, workflowPath)
  if (workflowName !== expectedWorkflow.name) {
    throw new Error(`${workflowPath} does not use the trusted workflow name`)
  }
  const branches = extractPushBranches(content, workflowPath)
  if (canonicalJson(branches) !== canonicalJson([...APPROVED_PUSH_BRANCHES])) {
    throw new Error(`${workflowPath} does not use the approved push triggers`)
  }
  if (!matchesApprovedBranch(sourceBranch)) {
    throw new Error(
      `${sourceBranch} is not covered by the approved push triggers`
    )
  }

  const environment = extractRootEnvironment(content, workflowPath)
  const jobs = extractJobBlocks(content, workflowPath)
  if (jobs.length === 0) throw new Error(`${workflowPath} has no jobs`)

  const expectedNonRuntimeJobIds = (expectedWorkflow.nonRuntimeJobs ?? [])
    .map((job) => job.id)
    .sort()
  for (const job of jobs.filter((entry) => entry.id.endsWith('-amd'))) {
    if (!isDisabledJob(job) && !expectedNonRuntimeJobIds.includes(job.id)) {
      throw new Error(`${workflowPath}/${job.id} must remain disabled`)
    }
  }

  const activeArmJobs = jobs.filter(
    (job) => job.id.endsWith('-arm') && !isDisabledJob(job)
  )
  const expectedJobIds = expectedWorkflow.jobs.map((job) => job.id).sort()
  const actualJobIds = activeArmJobs.map((job) => job.id).sort()
  if (canonicalJson(actualJobIds) !== canonicalJson(expectedJobIds)) {
    throw new Error(`${workflowPath} active ARM job inventory changed`)
  }

  const activeNonRuntimeJobs = jobs.filter(
    (job) => expectedNonRuntimeJobIds.includes(job.id) && !isDisabledJob(job)
  )
  const actualNonRuntimeJobIds = activeNonRuntimeJobs
    .map((job) => job.id)
    .sort()
  if (
    canonicalJson(actualNonRuntimeJobIds) !==
    canonicalJson(expectedNonRuntimeJobIds)
  ) {
    throw new Error(`${workflowPath} active non-runtime job inventory changed`)
  }

  const publisherJobs = [...activeArmJobs, ...activeNonRuntimeJobs]
  const images = publisherJobs.map((job) => {
    if (
      job.id.endsWith('-arm') &&
      !/^    runs-on:\s*ubuntu-24\.04-arm\s*$/m.test(job.content)
    ) {
      throw new Error(
        `${workflowPath}/${job.id} is not pinned to the ARM runner`
      )
    }
    const metadataStep = actionStep(job, 'docker/metadata-action', workflowPath)
    const publisherStep = actionStep(
      job,
      'docker/build-push-action',
      workflowPath
    )
    const metadataId = metadataStep.match(
      /^        id:\s*([A-Za-z0-9_-]+)\s*$/m
    )?.[1]
    if (!metadataId) {
      throw new Error(
        `${workflowPath}/${job.id} metadata action has no stable id`
      )
    }
    if (
      !/^          push:\s*\$\{\{\s*github\.event_name\s*!=\s*'pull_request'\s*\}\}\s*$/m.test(
        publisherStep
      )
    ) {
      throw new Error(`${workflowPath}/${job.id} has an unsafe push condition`)
    }
    if (
      !new RegExp(
        `^          tags:\\s*\\$\\{\\{\\s*steps\\.${metadataId}\\.outputs\\.tags\\s*\\}\\}\\s*$`,
        'm'
      ).test(publisherStep)
    ) {
      throw new Error(
        `${workflowPath}/${job.id} does not publish the validated metadata tags`
      )
    }
    if (!hasFullShaTag(metadataStep)) {
      throw new Error(
        `${workflowPath}/${job.id} does not publish a full source SHA tag`
      )
    }
    return {
      id: job.id,
      image: extractImageReference(
        metadataStep,
        environment,
        repository,
        workflowPath,
        job.id
      ),
    }
  })

  const unexpectedPublishers = jobs.filter(
    (job) =>
      extractActionSteps(job, workflowPath).some((step) =>
        /^(?:      - uses|        uses):\s*docker\/build-push-action@[^\s#]+\s*(?:#.*)?$/m.test(
          step
        )
      ) &&
      !publisherJobs.includes(job) &&
      !(job.id.endsWith('-amd') && isDisabledJob(job))
  )
  if (unexpectedPublishers.length > 0) {
    throw new Error(`${workflowPath} has an unexpected active image publisher`)
  }

  const hasMigratorJob = expectedJobIds.includes('build-migrator-arm')
  if (
    hasMigratorJob &&
    !/^    needs:\s*build-migrator-arm\s*$/m.test(
      activeArmJobs.find((job) => job.id === 'build-arm').content
    )
  ) {
    throw new Error(`${workflowPath}/build-arm does not wait for the migrator`)
  }

  const expectedImages = [
    ...expectedWorkflow.jobs,
    ...(expectedWorkflow.nonRuntimeJobs ?? []),
  ]
    .map((job) => ({
      id: job.id,
      image: `ghcr.io/${repository}/${job.image}`,
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const actualImages = images.sort((left, right) =>
    left.id.localeCompare(right.id)
  )
  if (canonicalJson(actualImages) !== canonicalJson(expectedImages)) {
    throw new Error(`${workflowPath} runtime image inventory changed`)
  }

  const runtimeJobIds = new Set(expectedJobIds)
  return {
    name: workflowName,
    path: workflowPath,
    jobs: actualImages.filter((job) => runtimeJobIds.has(job.id)),
  }
}

function validateStagingWorkflows({
  definitions,
  repository,
  sourceBranch,
  expectedWorkflows = STAGING_WORKFLOWS,
}) {
  assertSafeSourceBranch(sourceBranch)
  const paths = definitions.map((definition) => definition.path).sort()
  const expected = expectedWorkflows.map((workflow) => workflow.path).sort()
  if (canonicalJson(paths) !== canonicalJson(expected)) {
    throw new Error(
      'candidate staging workflow set differs from the trusted set'
    )
  }
  const workflows = definitions
    .map((definition) => {
      const expectedWorkflow = expectedWorkflows.find(
        (workflow) => workflow.path === definition.path
      )
      return validateStagingWorkflow({
        ...definition,
        expectedWorkflow,
        repository,
        sourceBranch,
      })
    })
    .sort((left, right) => left.path.localeCompare(right.path))
  const jobCount = workflows.reduce(
    (count, workflow) => count + workflow.jobs.length,
    0
  )
  if (jobCount === 0) throw new Error('candidate has no active ARM image jobs')
  return workflows
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

async function getCandidateDefinitions({
  github,
  context,
  candidateSha,
  expectedWorkflows = STAGING_WORKFLOWS,
}) {
  const response = await github.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: '.github/workflows',
    ref: candidateSha,
  })
  if (!Array.isArray(response.data)) {
    throw new Error('candidate workflow directory is unavailable')
  }
  const entries = response.data
    .filter(
      (entry) =>
        entry?.type === 'file' && WORKFLOW_PATH_PATTERN.test(entry.path)
    )
    .map((entry) => entry.path)
    .sort()
  const expectedPaths = expectedWorkflows
    .map((workflow) => workflow.path)
    .sort()
  if (canonicalJson(entries) !== canonicalJson(expectedPaths)) {
    throw new Error(
      'candidate staging workflow set differs from the trusted set'
    )
  }
  const definitions = await Promise.all(
    entries.map(async (workflowPath) => ({
      content: await getFileText(github, context, workflowPath, candidateSha),
      path: workflowPath,
    }))
  )
  return definitions
}

async function getSourceBranch({
  github,
  context,
  selectedSourceBranch = undefined,
}) {
  if (selectedSourceBranch !== undefined) {
    return assertSafeSourceBranch(selectedSourceBranch)
  }
  const getVariable = github.rest.actions?.getRepoVariable
  if (typeof getVariable !== 'function') return DEFAULT_SOURCE_BRANCH
  try {
    const response = await getVariable({
      name: SOURCE_BRANCH_VARIABLE,
      owner: context.repo.owner,
      repo: context.repo.repo,
    })
    return assertSafeSourceBranch(response.data?.value)
  } catch (error) {
    if (error?.status === 404) return DEFAULT_SOURCE_BRANCH
    throw error
  }
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
  if (typeof github.paginate === 'function') {
    const result = await github.paginate(endpoint, params)
    return Array.isArray(result) ? result : []
  }
  const response = await endpoint(params)
  const data = response?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.workflow_runs)) return data.workflow_runs
  if (Array.isArray(data?.jobs)) return data.jobs
  return []
}

function latestRun(runs, workflowPath, candidateSha) {
  const exact = runs
    .filter(
      (run) => run?.path === workflowPath && run?.head_sha === candidateSha
    )
    .sort((left, right) => Number(right.id ?? 0) - Number(left.id ?? 0))
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
  const { exact, candidateRuns } = latestRun(runs, workflow.path, candidateSha)
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
  if (typeof github.rest.actions.listJobsForWorkflowRun !== 'function') {
    return {
      path: workflow.path,
      reason: 'workflow jobs are unavailable',
      run: exact,
      status: 'wrong_evidence',
    }
  }
  const jobs = await paginate(
    github,
    github.rest.actions.listJobsForWorkflowRun,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: exact.id,
      per_page: 100,
    }
  )
  const verifiedJobs = []
  for (const required of workflow.jobs) {
    const matching = jobs.find((job) => job?.name === required.id)
    const stateForJob = jobState(matching, required.id, candidateSha)
    if (stateForJob !== 'success') {
      return {
        path: workflow.path,
        reason: `${required.id} is ${stateForJob.replace('_', ' ')}`,
        run: exact,
        status: stateForJob,
      }
    }
    if (!Number.isSafeInteger(matching.id) || matching.id <= 0) {
      return {
        path: workflow.path,
        reason: `${required.id} has no stable job id`,
        run: exact,
        status: 'wrong_evidence',
      }
    }
    verifiedJobs.push({
      id: matching.id,
      name: matching.name,
      url: matching.html_url ?? '',
    })
  }
  return {
    jobs: verifiedJobs,
    path: workflow.path,
    run: {
      branch: exact.head_branch,
      id: exact.id,
      sha: exact.head_sha,
      url: exact.html_url ?? '',
    },
    status: 'success',
  }
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
  return response
}

async function fetchRegistryDigest({ repository, tag, fetchImpl = fetch }) {
  const response = await registryResponse({ repository, tag, fetchImpl })
  if (!response.ok) {
    throw new Error(
      `${repository}:${tag} registry response was ${response.status}`
    )
  }
  const digest = response.headers.get('docker-content-digest')
  if (!DIGEST_PATTERN.test(digest ?? '')) {
    throw new Error(
      `${repository}:${tag} registry response has no digest header`
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
  gitToken = process.env.GITHUB_TOKEN,
  repositoryUrl = releaseRepositoryUrl(context),
  gitRunner = runGit,
  workspace = process.cwd(),
}) {
  if (!validSha(candidateSha)) throw new Error('candidate SHA is invalid')
  if (expectedSha != null && !validSha(expectedSha)) {
    throw new Error('expected release SHA is invalid')
  }
  if (!gitToken && /^https:/i.test(repositoryUrl)) {
    throw new Error('GITHUB_TOKEN is unavailable for the ref update')
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
      repositoryUrl,
      candidateSha,
    ],
    options
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
}) {
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
  } catch (error) {
    throw new Error('stg-release compare-and-swap failed', { cause: error })
  }
  const result = await getReleaseRef({ github, context })
  if (result !== candidateSha) {
    throw new Error('stg-release changed during the compare-and-swap')
  }
  return result
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
  github,
  context,
  sourceBranch,
  candidateSha,
  promotionEnabled = process.env[PROMOTION_ENABLED_VARIABLE],
}) {
  const selectedSourceBranch = await getSourceBranch({
    github,
    context,
    selectedSourceBranch: sourceBranch,
  })
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
    const confirmation = inputs.confirm ?? ''
    if (!dryRun && confirmation !== MANUAL_CONFIRMATION) {
      throw new Error(
        `manual writes require the exact confirmation ${MANUAL_CONFIRMATION}`
      )
    }
    return {
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
  expectedWorkflows = STAGING_WORKFLOWS,
  getRegistryDigest = fetchRegistryDigest,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  receiptPath,
  checksumPath,
  summaryPath,
  gitToken,
  repositoryUrl,
  gitRunner,
  workspace,
}) {
  const inputs = await resolveInputs({
    github,
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

  const repository = repositoryName(context)
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
  const images = await resolveStableRegistryDigests({
    candidateSha: inputs.candidateSha,
    evidence,
    workflows,
    getRegistryDigest,
  })

  const currentSha = await getReleaseRef({ github, context })
  const decision = await planReleaseRef({
    github,
    context,
    currentSha,
    candidateSha: inputs.candidateSha,
  })
  let appliedSha = null
  if (
    inputs.allowWrite &&
    ['create', 'fast-forward'].includes(decision.action)
  ) {
    appliedSha = await compareAndSwapReleaseRef({
      github,
      context,
      expectedSha: currentSha,
      candidateSha: inputs.candidateSha,
      gitToken,
      repositoryUrl,
      gitRunner,
      workspace,
    })
  }

  const receipt = {
    schema_version: 'stg-release-promotion/v1',
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
  return { ...receipt, checksum, ...artifacts }
}

module.exports = {
  APPROVED_PUSH_BRANCHES,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
  DIGEST_PATTERN,
  MANUAL_CONFIRMATION,
  PROMOTION_ENABLED_VARIABLE,
  PROMOTION_REF,
  PROMOTION_REF_API,
  PROMOTION_REF_NAME,
  SOURCE_BRANCH_VARIABLE,
  STAGING_WORKFLOWS,
  STAGING_WORKFLOW_PATHS,
  canonicalJson,
  checksumReceipt,
  collectBuildEvidence,
  compareAndSwapReleaseRef,
  fetchRegistryDigest,
  getCandidateDefinitions,
  getReleaseRef,
  getSourceBranch,
  isDisabledJob,
  matchesApprovedBranch,
  planReleaseRef,
  pushReleaseRefWithLease,
  resolveStableRegistryDigests,
  runPromotion,
  validateCandidateAncestry,
  validateStagingWorkflow,
  validateStagingWorkflows,
  writeReceiptArtifacts,
}
