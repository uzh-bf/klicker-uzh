const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const {
  evaluateScanAdmission,
  evaluateScanJobStatus,
  findScanReceipt,
  receiptFileName,
  validateScanReceipt,
} = require('./image-scan-admission.cjs')
const { collectScanAdmission } = require('./stg-release-promoter')

const WORKFLOW_PATH = '.github/workflows/v3_backend-docker-stg.yml'
const CANDIDATE_SHA = 'a'.repeat(40)
const RUN = {
  id: 700,
  attempt: 1,
  sha: CANDIDATE_SHA,
}
const APP_IMAGE = 'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm'
const MIGRATOR_IMAGE = 'ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm'
const APP_DIGEST = 'sha256:' + '1'.repeat(64)
const MIGRATOR_DIGEST = 'sha256:' + '2'.repeat(64)

const WORKFLOW = {
  jobs: [
    { id: 'build-arm', image: APP_IMAGE },
    { id: 'build-migrator-arm', image: MIGRATOR_IMAGE },
  ],
  path: WORKFLOW_PATH,
}

const IMAGES = [
  {
    digest: APP_DIGEST,
    job_id: 1,
    job_name: 'build-arm',
    repository: APP_IMAGE,
    run_id: RUN.id,
    workflow_path: WORKFLOW_PATH,
  },
  {
    digest: MIGRATOR_DIGEST,
    job_id: 2,
    job_name: 'build-migrator-arm',
    repository: MIGRATOR_IMAGE,
    run_id: RUN.id,
    workflow_path: WORKFLOW_PATH,
  },
]

function receipt(overrides = {}) {
  const digest = overrides.digest ?? APP_DIGEST
  const image = overrides.image ?? APP_IMAGE
  return {
    artifact: {
      architecture: 'linux/arm64',
      digest,
      image: image + '@' + digest,
    },
    policy: {
      failOn: ['HIGH', 'CRITICAL'],
      failOnUnfixed: false,
      unfixedFindings: 'reported-not-gating',
    },
    run: {
      attempt: String(overrides.runAttempt ?? RUN.attempt),
      gitSha: overrides.gitSha ?? CANDIDATE_SHA,
      id: String(overrides.runId ?? RUN.id),
    },
    scanner: {
      actionRef: 'aquasecurity/trivy-action@a9c7b0f',
      engineVersion: 'v0.74.0',
      name: 'trivy',
    },
    schemaVersion: 'klicker.image-scan-receipt/v1',
  }
}

function jobsFor({ scan = {} } = {}) {
  const build = (name) => ({
    conclusion: 'success',
    head_sha: CANDIDATE_SHA,
    id: name === 'build-arm' ? 1 : 2,
    name,
    status: 'completed',
  })
  const scanJob = (name) => ({
    conclusion: scan[name]?.conclusion ?? 'success',
    head_sha: CANDIDATE_SHA,
    id: name === 'scan-arm' ? 3 : 4,
    name,
    status: scan[name]?.status ?? 'completed',
  })
  return [
    build('build-arm'),
    build('build-migrator-arm'),
    scanJob('scan-arm'),
    scanJob('scan-migrator-arm'),
  ]
}

function scanGithub(jobRounds) {
  let call = 0
  return {
    paginate: async (endpoint, params) => {
      const response = await endpoint(params)
      return response.data.workflow_runs ?? response.data.jobs ?? []
    },
    rest: {
      actions: {
        listJobsForWorkflowRunAttempt: async () => ({
          data: { jobs: jobRounds[Math.min(call++, jobRounds.length - 1)] },
        }),
        listWorkflowRuns: async () => ({
          data: {
            workflow_runs: [
              {
                conclusion: 'success',
                event: 'push',
                head_branch: 'v3',
                head_sha: CANDIDATE_SHA,
                html_url:
                  'https://github.com/uzh-bf/klicker-uzh/actions/runs/700',
                id: RUN.id,
                path: WORKFLOW_PATH,
                repository: { full_name: 'uzh-bf/klicker-uzh' },
                run_attempt: RUN.attempt,
                status: 'completed',
              },
            ],
          },
        }),
      },
    },
  }
}

const CONTEXT = { repo: { owner: 'uzh-bf', repo: 'klicker-uzh' } }

function admissionArgs(jobRounds, receipts) {
  return {
    candidateSha: CANDIDATE_SHA,
    context: CONTEXT,
    getReceipts: async () => receipts,
    github: scanGithub(jobRounds),
    images: IMAGES,
    maxAttempts: 3,
    retryDelayMs: 0,
    sleep: async () => {},
    sourceBranch: 'v3',
    workflows: [WORKFLOW],
  }
}

describe('evaluateScanJobStatus', () => {
  it('accepts one successful scan job', () => {
    assert.deepEqual(evaluateScanJobStatus(jobsFor({}), 'scan-arm'), {
      status: 'success',
    })
  })

  it('reports a scan job that has not finished', () => {
    const jobs = jobsFor({ scan: { 'scan-arm': { status: 'in_progress' } } })
    assert.deepEqual(evaluateScanJobStatus(jobs, 'scan-arm'), {
      status: 'running',
    })
  })

  it('reports a failed scan job', () => {
    const jobs = jobsFor({ scan: { 'scan-arm': { conclusion: 'failure' } } })
    assert.deepEqual(evaluateScanJobStatus(jobs, 'scan-arm'), {
      status: 'failed',
    })
  })

  it('rejects a missing or duplicated scan job', () => {
    assert.deepEqual(evaluateScanJobStatus([], 'scan-arm'), {
      status: 'missing',
    })
    const duplicated = [
      ...jobsFor({}),
      { conclusion: 'success', name: 'scan-arm', status: 'completed' },
    ]
    assert.deepEqual(evaluateScanJobStatus(duplicated, 'scan-arm'), {
      status: 'wrong_evidence',
    })
  })
})

describe('validateScanReceipt', () => {
  const expected = {
    candidateSha: CANDIDATE_SHA,
    digest: APP_DIGEST,
    image: APP_IMAGE,
    runAttempt: RUN.attempt,
    runId: RUN.id,
  }

  it('accepts a receipt for the promoted digest and run', () => {
    assert.equal(validateScanReceipt(receipt(), expected).ok, true)
  })

  it('rejects another digest, tag, run, revision, or policy', () => {
    const cases = [
      [receipt({ digest: MIGRATOR_DIGEST }), /digest does not match/],
      [receipt({ image: APP_IMAGE.replace('-arm', '') }), /not the promoted/],
      [receipt({ runId: 701 }), /run id does not match/],
      [receipt({ runAttempt: 2 }), /attempt does not match/],
      [receipt({ gitSha: 'b'.repeat(40) }), /revision is not the candidate/],
    ]
    for (const [value, pattern] of cases) {
      const result = validateScanReceipt(value, expected)
      assert.equal(result.ok, false)
      assert.match(result.reason, pattern)
    }
  })

  it('rejects a foreign schema, scanner, or policy', () => {
    const foreignSchema = { ...receipt(), schemaVersion: 'other/v1' }
    assert.match(
      validateScanReceipt(foreignSchema, expected).reason,
      /schema is other/
    )
    const foreignScanner = receipt()
    foreignScanner.scanner.name = 'grype'
    assert.match(
      validateScanReceipt(foreignScanner, expected).reason,
      /scanner is grype/
    )
    const unfixed = receipt()
    unfixed.policy.failOnUnfixed = true
    assert.match(
      validateScanReceipt(unfixed, expected).reason,
      /fixable-only policy/
    )
    const partial = receipt()
    partial.policy.failOn = ['HIGH']
    assert.match(
      validateScanReceipt(partial, expected).reason,
      /fixable-only policy/
    )
  })

  it('rejects a receipt for an incomplete promoted digest', () => {
    const result = validateScanReceipt(receipt(), {
      ...expected,
      digest: 'sha256:short',
    })
    assert.match(result.reason, /promoted digest is incomplete/)
  })
})

describe('findScanReceipt', () => {
  const expected = {
    candidateSha: CANDIDATE_SHA,
    digest: APP_DIGEST,
    image: APP_IMAGE,
    runAttempt: RUN.attempt,
    runId: RUN.id,
  }

  it('selects the receipt that covers the promoted digest', () => {
    const result = findScanReceipt(
      [receipt({ image: MIGRATOR_IMAGE, digest: MIGRATOR_DIGEST }), receipt()],
      expected
    )
    assert.equal(result.ok, true)
  })

  it('reports a receipt for the right digest with the wrong provenance', () => {
    const result = findScanReceipt([receipt({ runId: 701 })], expected)
    assert.equal(result.ok, false)
    assert.match(result.reason, /run id does not match/)
  })

  it('reports when nothing covers the digest', () => {
    const result = findScanReceipt(
      [receipt({ digest: MIGRATOR_DIGEST })],
      expected
    )
    assert.equal(result.ok, false)
    assert.match(result.reason, /no receipt covers the promoted digest/)
  })
})

describe('receiptFileName', () => {
  it('maps an artifact name to its receipt file', () => {
    assert.equal(
      receiptFileName('image-scan-backend-docker-arm'),
      'image-scan-backend-docker-arm-receipt.json'
    )
  })
})

describe('evaluateScanAdmission', () => {
  const runs = { [WORKFLOW_PATH]: RUN }

  it('admits a candidate whose images are both scanned', () => {
    const result = evaluateScanAdmission({
      images: IMAGES,
      receipts: {
        [WORKFLOW_PATH]: [
          receipt(),
          receipt({ digest: MIGRATOR_DIGEST, image: MIGRATOR_IMAGE }),
        ],
      },
      runs,
    })
    assert.equal(result.valid, true)
    assert.equal(result.entries.length, 2)
    assert.deepEqual(
      result.entries.map((entry) => entry.reason),
      ['scanned', 'scanned']
    )
  })

  it('blocks a candidate whose receipt describes another digest', () => {
    const result = evaluateScanAdmission({
      images: IMAGES,
      receipts: { [WORKFLOW_PATH]: [receipt({ digest: MIGRATOR_DIGEST })] },
      runs,
    })
    assert.equal(result.valid, false)
    assert.match(result.reason, /no receipt covers the promoted digest/)
  })

  it('blocks a candidate without a resolved image or run', () => {
    const noImage = evaluateScanAdmission({
      images: [IMAGES[0]],
      receipts: { [WORKFLOW_PATH]: [receipt()] },
      runs,
    })
    assert.equal(noImage.valid, false)
    assert.match(noImage.reason, /no resolved image/)
    const noRun = evaluateScanAdmission({
      images: IMAGES,
      receipts: { [WORKFLOW_PATH]: [receipt()] },
      runs: {},
    })
    assert.equal(noRun.valid, false)
    assert.match(noRun.reason, /no publishing run/)
  })
})

describe('collectScanAdmission', () => {
  const receipts = [
    receipt(),
    receipt({ digest: MIGRATOR_DIGEST, image: MIGRATOR_IMAGE }),
  ]

  it('retries while a scan is still running and then admits', async () => {
    const result = await collectScanAdmission(
      admissionArgs(
        [
          jobsFor({ scan: { 'scan-arm': { status: 'in_progress' } } }),
          jobsFor({}),
        ],
        receipts
      )
    )
    assert.equal(result.valid, true)
    assert.equal(result.attempts.length, 2)
    assert.equal(result.entries.length, 2)
  })

  it('blocks without retrying when a scan job failed', async () => {
    const result = await collectScanAdmission(
      admissionArgs(
        [jobsFor({ scan: { 'scan-arm': { conclusion: 'failure' } } })],
        receipts
      )
    )
    assert.equal(result.valid, false)
    assert.equal(result.attempts.length, 1)
    assert.match(result.reason, /scan-arm is failed/)
  })

  it('blocks when the receipt does not cover the promoted digest', async () => {
    const result = await collectScanAdmission(
      admissionArgs([jobsFor({})], [receipt({ digest: MIGRATOR_DIGEST })])
    )
    assert.equal(result.valid, false)
    assert.match(result.reason, /no receipt covers the promoted digest/)
  })
})
