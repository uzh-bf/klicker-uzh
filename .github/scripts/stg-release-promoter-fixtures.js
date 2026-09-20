const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const {
  CONSOLIDATED_WORKFLOW_PATH,
  STAGING_IMAGE_TARGETS,
  amdJobName,
  buildJobName,
  scanJobName,
} = require('./staging-image-targets.cjs')

const OCI_MANIFEST_CONTENT_TYPE = 'application/vnd.oci.image.manifest.v1+json'

// The fixture workflow is the real consolidated workflow, read from the tree.
// Deriving it rather than restating it keeps the structural contract the
// promotion controller enforces under test against the file that ships.
const FIXTURE_WORKFLOW_PATH = CONSOLIDATED_WORKFLOW_PATH

// A representative candidate: one independent image, the migrator, and the
// application image that waits for it. 'auth' and 'backend-docker' are
// available on every branch, so the fixture resolves the same way on v3 and on
// the integration lines.
const FIXTURE_TARGET_IDS = Object.freeze([
  'auth-arm',
  'backend-docker-arm',
  'backend-docker-migrator-arm',
])

const REAL_WORKFLOW = fs.readFileSync(
  path.join(__dirname, '..', 'workflows', path.basename(FIXTURE_WORKFLOW_PATH)),
  'utf8'
)

const FIXTURE_STAGING_WORKFLOWS = Object.freeze([
  {
    jobs: FIXTURE_TARGET_IDS.map((targetId) => ({ id: targetId })),
    name: 'Build staging images',
    path: FIXTURE_WORKFLOW_PATH,
  },
])

// The workflow text a candidate would carry. Callers mutate the returned copy to
// express a hostile or broken candidate.
function workflowDefinition(overrides = {}) {
  let content = REAL_WORKFLOW
  if (overrides.pushBranches) {
    content = content.replace(
      "      - 'v3'\n      - 'v3*'\n  pull_request:",
      overrides.pushBranches.map((branch) => '      - ' + branch).join('\n') +
        '\n  pull_request:'
    )
  }
  if (overrides.fullShaTag === false) {
    content = content.replace('type=raw,value=${{ github.sha }}', 'type=sha')
  }
  return content
}

function fixtureDefinitions(overrides = {}) {
  return [
    { content: workflowDefinition(overrides), path: FIXTURE_WORKFLOW_PATH },
  ]
}

function targetById(targetId) {
  return STAGING_IMAGE_TARGETS.find((target) => target.id === targetId)
}

// Every job a candidate for the fixture target set must complete: the ARM64
// publishers, the scan legs for the scanned targets, and the AMD64 legs. One
// run of the consolidated workflow also carries the terminal status job, which
// is the required CI context the promotion controller admits alongside the
// build evidence.
function fixtureJobNames(targetIds = FIXTURE_TARGET_IDS) {
  const targets = targetIds.map(targetById).filter(Boolean)
  return [
    ...targets.map((target) => buildJobName(target)),
    ...targets.filter((t) => t.scan).map((target) => scanJobName(target)),
    ...targets.filter((t) => t.amd).map((target) => amdJobName(target)),
    'build-images-status',
  ].sort()
}

function workflowRun({
  candidateSha,
  conclusion = 'success',
  event = 'push',
  headBranch = 'v3',
  id,
  path: workflowPath,
  repository = 'uzh-bf/klicker-uzh',
  status = 'completed',
}) {
  return {
    conclusion,
    run_attempt: 1,
    event,
    head_branch: headBranch,
    head_sha: candidateSha,
    html_url: `https://github.com/${repository}/actions/runs/${id}`,
    id,
    path: workflowPath,
    repository: { full_name: repository },
    status,
  }
}

function workflowJobs({
  candidateSha,
  jobState = {},
  path: workflowPath,
  targetIds = FIXTURE_TARGET_IDS,
}) {
  return fixtureJobNames(targetIds).map((name, index) => ({
    conclusion: jobState[name]?.conclusion ?? 'success',
    head_sha: jobState[name]?.head_sha ?? candidateSha,
    html_url: `https://github.com/uzh-bf/klicker-uzh/actions/runs/1/job/${index + 1}`,
    id: index + 1,
    name,
    path: workflowPath,
    status: jobState[name]?.status ?? 'completed',
  }))
}

function registryManifestResponse({
  body = '{"schemaVersion":2}',
  contentType = OCI_MANIFEST_CONTENT_TYPE,
  digest,
  includeDigest = true,
  includeReader = true,
  redirected = false,
} = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const resolvedDigest =
    digest ??
    `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`
  const values = new Map(
    Object.entries({
      'content-type': contentType,
      ...(includeDigest ? { 'docker-content-digest': resolvedDigest } : {}),
    })
  )
  return {
    ...(includeReader ? { arrayBuffer: async () => bytes } : {}),
    headers: {
      get: (name) => values.get(String(name).toLowerCase()) ?? null,
    },
    ok: true,
    redirected,
    status: 200,
  }
}

function transientReadbackFailure(status = 503) {
  const error = new Error('synthetic readback unavailable')
  error.status = status
  return error
}

module.exports = {
  FIXTURE_STAGING_WORKFLOWS,
  FIXTURE_TARGET_IDS,
  FIXTURE_WORKFLOW_PATH,
  OCI_MANIFEST_CONTENT_TYPE,
  fixtureDefinitions,
  fixtureJobNames,
  registryManifestResponse,
  transientReadbackFailure,
  workflowDefinition,
  workflowJobs,
  workflowRun,
}
