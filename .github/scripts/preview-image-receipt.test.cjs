'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  findReusablePreviewImage,
  publicReceipt,
} = require('./preview-image-receipt.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const WORKFLOW = '.github/workflows/v3_images-stg.yml'
const CONTROL_REVISION = 'a'.repeat(40)
const FINGERPRINT = `sha256:${'1'.repeat(64)}`
const CONFIGURATION = `sha256:${'2'.repeat(64)}`
const IMAGE_DIGEST = `sha256:${'3'.repeat(64)}`
const IMAGE = `ghcr.io/${REPOSITORY}/preview-fixtures@${IMAGE_DIGEST}`
const ARTIFACT_NAME = `preview-images-${'4'.repeat(64)}`

function workflowRun(overrides = {}) {
  return {
    id: 101,
    run_attempt: 2,
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    head_sha: CONTROL_REVISION,
    head_repository: { full_name: REPOSITORY },
    repository: { full_name: REPOSITORY },
    path: `${WORKFLOW}@refs/heads/v3`,
    ...overrides,
  }
}

function jobs(attempt = 2, overrides = {}) {
  return [
    {
      name: 'staging-only-job',
      run_attempt: attempt,
      status: 'completed',
      conclusion: 'skipped',
    },
    {
      name: 'preview-fixtures-amd64',
      run_attempt: attempt,
      status: 'completed',
      conclusion: 'success',
    },
    {
      name: 'preview-scan-fixtures',
      run_attempt: attempt,
      status: 'completed',
      conclusion: 'success',
    },
    {
      name: 'preview-finalize',
      run_attempt: attempt,
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-10-28T10:00:00Z',
      completed_at: '2026-10-28T10:05:00Z',
      ...overrides.finalizer,
    },
  ].map((job) => ({ ...job, ...(overrides[job.name] ?? {}) }))
}

function artifacts(overrides = {}) {
  return [
    {
      id: 501,
      name: ARTIFACT_NAME,
      expired: false,
      created_at: '2026-10-28T10:04:00Z',
      workflow_run: { id: 101, head_sha: CONTROL_REVISION },
      ...overrides,
    },
  ]
}

function receipt(overrides = {}) {
  return {
    ...publicReceipt({
      attempt: '2',
      configurationDigest: CONFIGURATION,
      controlRevision: CONTROL_REVISION,
      metadata: {
        configurationDigest: CONFIGURATION,
        id: 'fixtures',
        image: IMAGE,
        inputFingerprint: FINGERPRINT,
        logicalTargets: ['db-bootstrap', 'fixtures', 'local-mcp'],
        platform: 'linux/amd64',
        sourceRevision: 'b'.repeat(40),
        controlRevision: CONTROL_REVISION,
      },
      repository: REPOSITORY,
      runId: '101',
      sourceRevision: 'b'.repeat(40),
      target: 'fixtures',
      workflow: WORKFLOW,
    }),
    target: 'fixtures',
    ...overrides,
  }
}

function transport({
  run = workflowRun(),
  jobBatch = jobs(),
  artifactBatch = artifacts(),
} = {}) {
  return async ([, endpoint]) => {
    if (endpoint.includes('/runs?')) {
      return { total_count: 1, workflow_runs: [run] }
    }
    if (endpoint.includes('/jobs?')) {
      return { total_count: jobBatch.length, jobs: jobBatch }
    }
    if (endpoint.includes('/artifacts?')) {
      return { total_count: artifactBatch.length, artifacts: artifactBatch }
    }
    throw new Error('unexpected endpoint')
  }
}

async function find(options = {}) {
  return findReusablePreviewImage({
    repository: REPOSITORY,
    workflow: WORKFLOW,
    controlRevision: CONTROL_REVISION,
    target: 'fixtures',
    inputFingerprint: FINGERPRINT,
    configurationDigest: CONFIGURATION,
    platform: 'linux/amd64',
    gh: transport(options),
    extract: async ({ artifact }) => {
      assert.equal(artifact.name, ARTIFACT_NAME)
      return {
        schemaVersion: 1,
        receipts: [receipt(options.receipt)],
      }
    },
    ...options.functionOptions,
  })
}

test('qualified current-attempt receipt returns its immutable image', async () => {
  assert.equal(typeof receipt().attempt, 'number')
  assert.equal(Object.hasOwn(receipt(), 'digest'), false)
  assert.deepEqual(await find(), {
    image: IMAGE,
    digest: IMAGE_DIGEST,
    producerRunId: 101,
    producerAttempt: 2,
  })
})

test('fingerprint, configuration, and platform mismatches are not adopted', async () => {
  const cases = [
    {
      functionOptions: { inputFingerprint: `sha256:${'5'.repeat(64)}` },
    },
    {
      functionOptions: { configurationDigest: `sha256:${'6'.repeat(64)}` },
    },
    { receipt: { platform: 'linux/arm64' } },
  ]
  for (const options of cases) {
    assert.equal(await find(options), null)
  }
})

test('failed runs, wrong attempts, and stale artifacts are not admitted', async () => {
  assert.equal(
    await find({ run: workflowRun({ conclusion: 'failure' }) }),
    null
  )
  assert.equal(
    await find({
      jobBatch: jobs(2, {
        'preview-scan-fixtures': { run_attempt: 1 },
      }),
    }),
    null
  )
  assert.equal(
    await find({
      artifactBatch: artifacts({ created_at: '2026-10-28T09:59:59Z' }),
    }),
    null
  )
})

test('missing producer runs return null', async () => {
  const gh = async () => ({ total_count: 0, workflow_runs: [] })
  assert.equal(
    await findReusablePreviewImage({
      repository: REPOSITORY,
      workflow: WORKFLOW,
      controlRevision: CONTROL_REVISION,
      target: 'fixtures',
      inputFingerprint: FINGERPRINT,
      configurationDigest: CONFIGURATION,
      platform: 'linux/amd64',
      gh,
      extract: async () => {
        throw new Error('extract must not run')
      },
    }),
    null
  )
})
