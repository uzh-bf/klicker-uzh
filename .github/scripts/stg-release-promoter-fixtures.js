'use strict'

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

function workflowDefinition({
  activeAmd = false,
  image,
  migrator = false,
  pushBranches = ["'v3'", "'v3*'"],
  fullShaTag = true,
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
${amdJob}${migratorJobs}
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

module.exports = {
  FIXTURE_STAGING_WORKFLOWS,
  FIXTURE_WORKFLOW_PATHS,
  fixtureDefinitions,
  workflowDefinition,
  workflowJobs,
  workflowRun,
}
