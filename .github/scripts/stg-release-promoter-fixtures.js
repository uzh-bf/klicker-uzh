const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  CONSOLIDATED_WORKFLOW_PATH,
  STAGING_IMAGE_TARGETS,
  amdJobName,
  buildJobName,
  scanJobName,
} = require('./staging-image-targets.cjs')

const { fingerprintTag } = require('./image-input-fingerprint.cjs')

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

// The fixture targets a release may adopt instead of rebuilding, resolved from
// the trusted inventory rather than restated here.
const FIXTURE_REUSE_TARGET_IDS = Object.freeze(
  FIXTURE_TARGET_IDS.filter((targetId) => targetById(targetId)?.reuse === true)
)

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

// The digest artifact one staging publication uploads per reuse-capable
// target: the published digest, the input fingerprint the build resolved, and
// the reuse record that says whether this publication adopted an
// already-qualified digest or built one.
const PUBLICATION_ARCHIVE_CACHE = new Map()

function publicationFingerprint(targetId) {
  return 'sha256:' + crypto.createHash('sha256').update(targetId).digest('hex')
}

function publicationArtifacts({
  adopted = {},
  omit = [],
  override = {},
  runId = 100,
  targetIds = FIXTURE_REUSE_TARGET_IDS,
} = {}) {
  const key = JSON.stringify({ adopted, omit, override, runId, targetIds })
  const cached = PUBLICATION_ARCHIVE_CACHE.get(key)
  if (cached) return cached
  const archives = new Map()
  const artifacts = targetIds.map((targetId, index) => {
    const fingerprint = publicationFingerprint(targetId)
    const tag = fingerprintTag(fingerprint)
    const members = Object.fromEntries(
      Object.entries({
        'digest.txt': 'sha256:' + '0'.repeat(64) + '\n',
        ['image-input-fingerprint-' + targetId + '.json']: JSON.stringify({
          fingerprint,
          reuseEligible: true,
          tag,
          target: targetId,
        }),
        ['image-reuse-' + targetId + '.json']: JSON.stringify({
          adopted: adopted[targetId] !== undefined,
          digest: adopted[targetId] ?? '',
          schemaVersion: 1,
          tag,
        }),
      })
        .filter(([name]) => !omit.includes(name))
        .map(([name, content]) => [name, override[name] ?? content])
    )
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-record-'))
    try {
      for (const [name, content] of Object.entries(members)) {
        fs.writeFileSync(path.join(directory, name), content)
      }
      execFileSync('zip', ['-q', 'record.zip', ...Object.keys(members)], {
        cwd: directory,
      })
      archives.set(
        index + 1,
        fs.readFileSync(path.join(directory, 'record.zip'))
      )
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
    return {
      expired: false,
      id: index + 1,
      name: 'build-digest-' + targetId,
      run_id: runId,
      size_in_bytes: archives.get(index + 1).byteLength,
    }
  })
  const fixture = { archives, artifacts }
  PUBLICATION_ARCHIVE_CACHE.set(key, fixture)
  return fixture
}

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
  FIXTURE_REUSE_TARGET_IDS,
  FIXTURE_TARGET_IDS,
  FIXTURE_WORKFLOW_PATH,
  OCI_MANIFEST_CONTENT_TYPE,
  fixtureDefinitions,
  fixtureJobNames,
  publicationArtifacts,
  publicationFingerprint,
  registryManifestResponse,
  transientReadbackFailure,
  workflowDefinition,
  workflowJobs,
  workflowRun,
}
