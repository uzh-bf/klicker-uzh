'use strict'

const crypto = require('node:crypto')

const OCI_MANIFEST_CONTENT_TYPE = 'application/vnd.oci.image.manifest.v1+json'

const FIXTURE_WORKFLOW_PATHS = Object.freeze([
  '.github/workflows/v3_auth-stg.yml',
  '.github/workflows/v3_backend-docker-stg.yml',
  '.github/workflows/v3_mcp-lecturer-stg.yml',
])
const FIXTURE_STAGING_WORKFLOWS = Object.freeze([
  {
    jobs: [{ id: 'build-arm', image: 'auth-arm' }],
    name: 'Build Docker image for auth (stg)',
    path: FIXTURE_WORKFLOW_PATHS[0],
  },
  {
    jobs: [
      { id: 'build-arm', image: 'backend-docker-arm' },
      { id: 'build-migrator-arm', image: 'backend-docker-migrator-arm' },
    ],
    name: 'Build Docker image for backend-docker (stg)',
    path: FIXTURE_WORKFLOW_PATHS[1],
  },
  {
    jobs: [{ id: 'build-arm', image: 'mcp-lecturer-arm' }],
    name: 'Build Docker image for mcp-lecturer (stg)',
    nonRuntimeJobs: [{ id: 'build-amd', image: 'mcp-lecturer-amd' }],
    path: FIXTURE_WORKFLOW_PATHS[2],
  },
])

function scanJobDefinition(id, needs) {
  return `  ${id}:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-24.04-arm
    needs: ${needs}
    steps:
      - uses: actions/checkout@v4
      - name: Scan the pushed image for vulnerabilities
        uses: aquasecurity/trivy-action@a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8
      - name: Enforce the fixable HIGH/CRITICAL policy
        run: |
          node .github/scripts/image-scan-receipt.cjs check
`
}

function workflowDefinition({
  activeAmd = false,
  image,
  migrator = false,
  pushBranches = ["'v3'", "'v3*'"],
  fullShaTag = true,
  scans = false,
}) {
  const imageEnvironment = migrator
    ? `  MIGRATOR_IMAGE_NAME: \${{ github.repository }}/${image}-migrator`
    : ''
  const tagLines = fullShaTag
    ? '          type=raw,value=\${{ github.sha }}'
    : '          type=ref,event=branch'
  const amdJob = activeAmd
    ? `  build-amd:
    if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    steps:
      - uses: docker/metadata-action@v4
        id: meta
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}-amd
          tags: |
${tagLines}
      - uses: docker/build-push-action@v5
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
`
    : `  build-amd:
    if: \${{ false }}
    runs-on: ubuntu-latest
    steps:
      - uses: docker/metadata-action@v4
`
  const migratorJobs = migrator
    ? `  build-migrator-arm:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: docker/metadata-action@v4
        id: meta
        with:
          images: \${{ env.REGISTRY }}/\${{ env.MIGRATOR_IMAGE_NAME }}-arm
          tags: |
${tagLines}
      - uses: docker/build-push-action@v5
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
  build-migrator-amd:
    if: \${{ false }}
    runs-on: ubuntu-latest
    steps:
      - uses: docker/metadata-action@v4
`
    : ''
  // The admission inventory adds one scan job per published image. Those jobs
  // are active ARM jobs that publish nothing, so a candidate that carries them
  // still has to validate against the publisher inventory.
  const scanJobs = scans
    ? [
        scanJobDefinition('scan-arm', 'build-arm'),
        ...(migrator
          ? [scanJobDefinition('scan-migrator-arm', 'build-migrator-arm')]
          : []),
      ].join('')
    : ''
  return `name: Build Docker image for ${image} (stg)

on:
  push:
    branches:
${pushBranches.map((branch) => `      - ${branch}`).join('\n')}
  pull_request:
    types: [opened]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}/${image}
${imageEnvironment}
jobs:
  build-arm:
    if: github.event.pull_request.draft == false
${migrator ? '    needs: build-migrator-arm\n' : ''}    runs-on: ubuntu-24.04-arm
    steps:
      - uses: docker/metadata-action@v4
        id: meta
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}-arm
          tags: |
${tagLines}
      - uses: docker/build-push-action@v5
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
${amdJob}${migratorJobs}${scanJobs}
`
}

function fixtureDefinitions(options = {}) {
  return FIXTURE_WORKFLOW_PATHS.map((path) => {
    const backend = path.includes('backend-docker')
    const mcp = path.includes('mcp-lecturer')
    return {
      content: workflowDefinition({
        activeAmd: mcp,
        image: backend ? 'backend-docker' : mcp ? 'mcp-lecturer' : 'auth',
        migrator: backend,
        scans: backend,
        ...options,
      }),
      path,
    }
  })
}

function workflowRun({
  candidateSha,
  conclusion = 'success',
  event = 'push',
  headBranch = 'v3',
  id,
  path,
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
    path,
    repository: { full_name: repository },
    status,
  }
}

function workflowJobs({
  candidateSha,
  includeMigrator = false,
  jobState = {},
  path,
}) {
  const names = ['build-arm']
  if (includeMigrator) names.push('build-migrator-arm')
  return names.map((name, index) => ({
    conclusion: jobState[name]?.conclusion ?? 'success',
    head_sha: jobState[name]?.head_sha ?? candidateSha,
    html_url: `https://github.com/uzh-bf/klicker-uzh/actions/runs/1/job/${index + 1}`,
    id: index + 1,
    name,
    path,
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
  FIXTURE_WORKFLOW_PATHS,
  OCI_MANIFEST_CONTENT_TYPE,
  fixtureDefinitions,
  registryManifestResponse,
  transientReadbackFailure,
  workflowDefinition,
  workflowJobs,
  workflowRun,
}
