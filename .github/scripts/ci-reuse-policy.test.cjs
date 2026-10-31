const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')
const {
  MAX_ARTIFACT_BYTES,
  PLAYWRIGHT_SHARD_COUNT,
  PLAYWRIGHT_ROUTE_JOBS,
  readArtifactJson,
} = require('./ci-equivalent-run.cjs')
const { REQUIRED_CI_WORKFLOWS } = require('./stg-release-promoter.js')
const root = path.resolve(__dirname, '../..')
function yaml(file) {
  return YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

test('promotion grants every verifier read scope without a write capability', () => {
  const workflow = yaml('.github/workflows/deploy-stg-promote.yml')
  assert.deepEqual(workflow.permissions, {
    actions: 'read',
    contents: 'read',
    'pull-requests': 'read',
  })
  assert.equal(workflow.jobs.promote.permissions, undefined)
})

test('trusted Node pins match the repository toolchain on both execution routes', () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))
    .volta.node
  assert.match(version, /^\d+\.\d+\.\d+$/)
  for (const action of ['build', 'shard']) {
    const definition = yaml(`.github/actions/playwright-${action}/action.yml`)
    const step = definition.runs.steps.find(
      (step) => step.name === 'Define node version'
    )
    assert.equal(step.with['node-version'], version)
    assert.equal(step.with['node-version-file'], undefined)
  }
})

test('promotion shard inventory derives from the full coverage contract', () => {
  const workflow = REQUIRED_CI_WORKFLOWS.find((w) =>
    w.path.endsWith('/test-playwright.yml')
  )
  const shards = workflow.jobs.filter((j) =>
    j.id.includes(PLAYWRIGHT_ROUTE_JOBS.hosted.shards)
  )
  assert.equal(shards.length, PLAYWRIGHT_SHARD_COUNT)
  for (let index = 1; index <= PLAYWRIGHT_SHARD_COUNT; index += 1) {
    assert.equal(
      shards.filter((j) =>
        j.id.endsWith(` (${index}, ${PLAYWRIGHT_SHARD_COUNT})`)
      ).length,
      1
    )
  }
})

test('both trusted receipt producers bind the exact pull request number', () => {
  const workflow = yaml('.github/workflows/public-pr-playwright-shards.yml')
  for (const route of ['hosted', 'public-pr']) {
    const record = workflow.jobs[`build-and-compile-${route}`].steps.find(
      (s) => s.name === 'Record tested source tree'
    )
    assert.equal(
      record.env.SOURCE_PR_NUMBER,
      '${{ github.event.pull_request.number }}'
    )
    assert.equal(
      record.env.SOURCE_BASE_REF,
      '${{ github.event.pull_request.base.ref }}'
    )
    assert.match(
      record.run,
      /pullRequestNumber: Number\(process\.env\.SOURCE_PR_NUMBER\)/
    )
  }
})

test('oversized evidence has a distinct miss reason and is not downloaded', async () => {
  let downloads = 0
  const artifact = {
    id: 1,
    name: 'proof',
    expired: false,
    size_in_bytes: MAX_ARTIFACT_BYTES + 1,
  }
  const github = {
    rest: {
      actions: {
        listWorkflowRunArtifacts: async () => ({
          data: { artifacts: [artifact], total_count: 1 },
        }),
        downloadArtifact: async () => {
          downloads += 1
          throw new Error('must not download')
        },
      },
    },
  }
  await assert.rejects(
    readArtifactJson(github, {}, { id: 1 }, 'proof', 'proof.json', true),
    /^Error: artifact-too-large$/
  )
  assert.equal(downloads, 0)
})

test('verified artifacts reject late replacements and missing producer metadata before download', async () => {
  for (const mode of [
    'late',
    'early',
    'missing-time',
    'failed-upload',
    'duplicate-upload',
  ]) {
    let downloads = 0
    const step = {
      name: 'Upload tested source receipt',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-10-24T10:00:00Z',
      completed_at: '2026-10-24T10:00:02Z',
    }
    const artifact = {
      id: 1,
      name: 'ci-validation-receipt',
      expired: false,
      size_in_bytes: 128,
      workflow_run: { id: 9, head_sha: 'head' },
      digest: 'sha256:' + 'a'.repeat(64),
      created_at:
        mode === 'early' ? '2026-10-24T09:59:59Z' : '2026-10-24T10:00:03Z',
    }
    if (mode === 'missing-time') delete artifact.created_at
    if (mode === 'failed-upload') step.conclusion = 'failure'
    const jobs = [
      {
        name: 'test-playwright-execution / build-and-compile-hosted',
        status: 'completed',
        conclusion: 'success',
        steps: mode === 'duplicate-upload' ? [step, step] : [step],
      },
    ]
    const github = {
      rest: {
        actions: {
          listWorkflowRunArtifacts: async () => ({
            data: { artifacts: [artifact], total_count: 1 },
          }),
          listJobsForWorkflowRunAttempt: async ({ attempt_number }) => {
            assert.equal(attempt_number, 2)
            return { data: { jobs, total_count: jobs.length } }
          },
          downloadArtifact: async () => {
            downloads += 1
            throw new Error('must not download')
          },
        },
      },
    }
    await assert.rejects(
      readArtifactJson(
        github,
        {},
        { id: 9, head_sha: 'head', run_attempt: 2 },
        artifact.name,
        'ci-validation-receipt.json',
        true
      ),
      /artifact-(created-outside-producer-step|producer-time-invalid|producer-unproven)/,
      mode
    )
    assert.equal(downloads, 0, mode)
  }
})
