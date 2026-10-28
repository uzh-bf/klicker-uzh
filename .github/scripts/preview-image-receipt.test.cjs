'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  findReusablePreviewImage,
  publicReceipt,
  parseExceptionPolicy,
  evaluatePreviewScan,
  verifyScan,
} = require('./preview-image-receipt.cjs')
const { buildReceipt } = require('./image-scan-receipt.cjs')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const WORKFLOW = '.github/workflows/v3_images-stg.yml'
const CONTROL_REVISION = 'a'.repeat(40)
const FINGERPRINT = `sha256:${'1'.repeat(64)}`
const CONFIGURATION = `sha256:${'2'.repeat(64)}`
const IMAGE_DIGEST = `sha256:${'3'.repeat(64)}`
const IMAGE = `ghcr.io/${REPOSITORY}/preview-fixtures@${IMAGE_DIGEST}`
const ARTIFACT_NAME = `preview-images-${'4'.repeat(64)}`
const NOW = Date.parse('2026-10-28T12:00:00Z')
const PILOT = {
  sourceRevision: 'b'.repeat(40),
  platform: 'linux/amd64',
  expiresAt: '2026-10-30T15:29:31Z',
  exceptions: [
    {
      target: 'azurite',
      vulnerabilityId: 'CVE-2026-109461',
      packageName: '@azure/msal-node',
      installedVersion: '5.5.0',
      severity: 'HIGH',
      maxOccurrences: 1,
    },
  ],
}
const FINDING = {
  VulnerabilityID: 'CVE-2026-109461',
  PkgName: '@azure/msal-node',
  InstalledVersion: '5.5.0',
  Severity: 'HIGH',
  FixedVersion: '7.1.0',
}

test('finite pilot policy rejects any scope, expiry or tuple expansion', () => {
  const identity = {
    sourceRevision: PILOT.sourceRevision,
    platform: PILOT.platform,
  }
  assert.equal(parseExceptionPolicy(undefined, identity, NOW), undefined)
  assert.deepEqual(
    parseExceptionPolicy(JSON.stringify(PILOT), identity, NOW),
    PILOT
  )
  for (const policy of [
    { ...PILOT, sourceRevision: 'c'.repeat(40) },
    { ...PILOT, platform: 'linux/arm64' },
    { ...PILOT, expiresAt: '2026-10-31T00:00:00Z' },
    { ...PILOT, expiresAt: '2026-10-27T00:00:00Z' },
    { ...PILOT, exceptions: [...PILOT.exceptions, ...PILOT.exceptions] },
    ...[
      'packageName',
      'installedVersion',
      'severity',
      'vulnerabilityId',
      'target',
      'maxOccurrences',
    ].map((key) => ({
      ...PILOT,
      exceptions: [
        {
          ...PILOT.exceptions[0],
          [key]: key === 'maxOccurrences' ? 2 : 'different',
        },
      ],
    })),
  ])
    assert.throws(() => parseExceptionPolicy(policy, identity, NOW))
})

test('pilot exceptions preserve raw findings and block other or repeated occurrences', () => {
  const results = [{ Vulnerabilities: [FINDING] }]
  assert.equal(evaluatePreviewScan(results, 'azurite').summary.violation, true)
  const result = evaluatePreviewScan(results, 'azurite', PILOT)
  assert.equal(result.summary.violation, false)
  assert.equal(result.admission.accepted[0].occurrences, 1)
  assert.deepEqual(results, [{ Vulnerabilities: [FINDING] }])
  assert.equal(
    evaluatePreviewScan(results, 'litellm', PILOT).summary.violation,
    true
  )
  assert.equal(
    evaluatePreviewScan(
      [
        {
          Vulnerabilities: [
            FINDING,
            { ...FINDING, VulnerabilityID: 'CVE-2026-999999' },
          ],
        },
      ],
      'azurite',
      PILOT
    ).summary.violation,
    true
  )
  assert.throws(() =>
    evaluatePreviewScan([...results, ...results], 'azurite', PILOT)
  )
  for (const key of ['PkgName', 'InstalledVersion', 'Severity']) {
    assert.equal(
      evaluatePreviewScan(
        [
          {
            Vulnerabilities: [
              { ...FINDING, [key]: key === 'Severity' ? 'CRITICAL' : 'other' },
            ],
          },
        ],
        'azurite',
        PILOT
      ).summary.violation,
      true
    )
  }
  const filelockPolicy = {
    ...PILOT,
    exceptions: [
      {
        target: 'litellm',
        vulnerabilityId: 'CVE-2026-112940',
        packageName: 'filelock',
        installedVersion: '3.32.7',
        severity: 'HIGH',
        maxOccurrences: 1,
      },
    ],
  }
  assert.equal(
    evaluatePreviewScan(
      [
        {
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2026-112940',
              PkgName: 'filelock',
              InstalledVersion: '3.32.7',
              Severity: 'HIGH',
              FixedVersion: '4.2.1',
            },
          ],
        },
      ],
      'litellm',
      parseExceptionPolicy(
        filelockPolicy,
        { sourceRevision: PILOT.sourceRevision, platform: PILOT.platform },
        NOW
      )
    ).summary.violation,
    false
  )
})

test('scan annotation is required, recomputed at finalization and expires', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-exception-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const scanPath = path.join(directory, 'receipt.json')
  const findings = JSON.stringify({
    SchemaVersion: 2,
    Results: [{ Vulnerabilities: [FINDING] }],
  })
  fs.writeFileSync(path.join(directory, 'findings.json'), findings)
  fs.writeFileSync(path.join(directory, 'sbom.json'), '{}')
  const metadata = {
    id: 'azurite',
    platform: PILOT.platform,
    image: IMAGE,
    digest: IMAGE_DIGEST,
  }
  const identity = {
    sourceRevision: PILOT.sourceRevision,
    runId: '101',
    attempt: '2',
    exceptionPolicy: PILOT,
    now: NOW,
  }
  const scan = buildReceipt({
    image: IMAGE,
    digest: IMAGE_DIGEST,
    architecture: PILOT.platform,
    runId: '101',
    runAttempt: '2',
    gitSha: PILOT.sourceRevision,
    engineVersion: 'v0.74.0',
    actionRef: 'pinned-action',
    findingsReport: 'findings.json',
    sbomReport: 'sbom.json',
  })
  fs.writeFileSync(scanPath, JSON.stringify(scan))
  assert.throws(() => verifyScan(metadata, scanPath, identity))
  verifyScan(metadata, scanPath, { ...identity, recordAdmission: true })
  verifyScan(metadata, scanPath, identity)
  assert.equal(
    fs.readFileSync(path.join(directory, 'findings.json'), 'utf8'),
    findings
  )
  assert.throws(() =>
    verifyScan(metadata, scanPath, { ...identity, exceptionPolicy: undefined })
  )
  assert.throws(() =>
    verifyScan(metadata, scanPath, {
      ...identity,
      now: Date.parse(PILOT.expiresAt),
    })
  )
  assert.throws(() =>
    verifyScan(
      { ...metadata, digest: `sha256:${'f'.repeat(64)}` },
      scanPath,
      identity
    )
  )
  const annotated = JSON.parse(fs.readFileSync(scanPath, 'utf8'))
  annotated.previewAdmission.accepted[0].occurrences = 0
  fs.writeFileSync(scanPath, JSON.stringify(annotated))
  assert.throws(() => verifyScan(metadata, scanPath, identity))
})

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
