const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FIXTURE_STAGING_WORKFLOWS,
  FIXTURE_REUSE_TARGET_IDS,
  FIXTURE_TARGET_IDS,
  FIXTURE_WORKFLOW_PATH,
  fixtureDefinitions,
  fixtureJobNames,
  registryManifestResponse,
  transientReadbackFailure,
  publicationArtifacts,
  publicationFingerprint,
  workflowJobs,
  workflowRun,
} = require('./stg-release-promoter-fixtures')
const {
  buildJobName,
  imageName,
  scanJobName,
  targetById,
} = require('./staging-image-targets.cjs')
const { fingerprintTag } = require('./image-input-fingerprint.cjs')
const {
  readCiEvidence,
  resolveInputs,
  validateCiSelection,
  REQUIRED_CI_WORKFLOWS,
  MANUAL_CONFIRMATION,
  PROMOTION_REF,
  STAGING_IMAGE_TARGETS,
  STAGING_TARGET_IDS,
  STAGING_WORKFLOWS,
  STAGING_WORKFLOW_PATHS,
  checksumReceipt,
  collectBuildEvidence,
  compareAndSwapReleaseRef,
  fetchRegistryDigest,
  getSourceBranch,
  planReleaseRef,
  pushReleaseRefWithLease,
  resolveCandidateTargetIds,
  resolveStableRegistryDigests,
  runPromotion,
  validateCandidateAncestry,
  validateStagingWorkflows,
} = require('./stg-release-promoter')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const CANDIDATE_SHA = 'a'.repeat(40)
const CURRENT_SHA = 'b'.repeat(40)
const NEXT_SHA = 'c'.repeat(40)

// The admitted scan receipts of the fixture targets. The release manifest binds
// a scanned target to the receipt that judged its digest, so the stub names the
// exact jobs the trusted inventory scans.
async function fixtureScanAdmission() {
  const entries = FIXTURE_TARGET_IDS.filter(
    (targetId) => targetById(targetId)?.scan === true
  ).map((targetId) => ({
    buildJob: buildJobName(targetById(targetId)),
    digest: `sha256:${'4'.repeat(64)}`,
    image:
      'ghcr.io/' + REPOSITORY + '/' + imageName(targetById(targetId)) + '-arm',
    ok: true,
    reason: 'scanned',
    scanJob: scanJobName(targetById(targetId)),
    workflowPath: FIXTURE_WORKFLOW_PATH,
  }))
  return { attempts: [{ attempt: 1, failures: [] }], entries, valid: true }
}

async function fixtureCiEvidence({ run }) {
  const workflow = REQUIRED_CI_WORKFLOWS[run.id - 500]
  return {
    schemaVersion: 1,
    repository: REPOSITORY,
    workflow: { path: workflow.path, terminalJob: workflow.jobs[0].id },
    event: { name: 'push', branch: 'v3', sha: CANDIDATE_SHA },
    run: { id: run.id, attempt: run.attempt },
    selection: { state: 'run', reason: 'success' },
    reuse: null,
    decision: { outcome: 'pass', reason: 'success' },
    jobs: [
      ...workflow.jobs
        .slice(1)
        .map(({ id }) => ({ name: id, role: 'suite', result: 'success' })),
      { name: 'filter', role: 'selection', result: 'success' },
    ],
  }
}

function reviewContext(eventName = 'workflow_dispatch', inputs = {}) {
  return {
    eventName,
    payload: {
      inputs,
      repository: { default_branch: 'v3' },
      workflow_run: {
        conclusion: 'success',
        event: 'push',
        head_branch: 'v3',
        head_sha: CANDIDATE_SHA,
      },
    },
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runId: 9001,
  }
}

// The fixture candidate builds three targets, so every validation call binds
// that same set against the real consolidated workflow text.
function validateFixture({ definitions, ...rest }) {
  return validateStagingWorkflows({
    definitions,
    targetIds: FIXTURE_TARGET_IDS,
    ...rest,
  })
}

function validWorkflows() {
  return validateFixture({
    definitions: fixtureDefinitions(),
    expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
    repository: REPOSITORY,
    sourceBranch: 'v3',
  })
}

function evidenceRuns(workflows, overrides = {}) {
  return Object.fromEntries(
    workflows.map((workflow, index) => [
      workflow.path,
      overrides[workflow.path] ?? [
        workflowRun({
          candidateSha: CANDIDATE_SHA,
          id: 100 + index,
          path: workflow.path,
        }),
      ],
    ])
  )
}

function evidenceGithub({
  definitions = [],
  workflows,
  runs = evidenceRuns(workflows),
  jobs = {},
  comparisons = {},
  publication = publicationArtifacts(),
}) {
  const ciRuns = Object.fromEntries(
    REQUIRED_CI_WORKFLOWS.map((w, i) => [
      w.path,
      [workflowRun({ candidateSha: CANDIDATE_SHA, id: 500 + i, path: w.path })],
    ])
  )
  for (const [i, w] of REQUIRED_CI_WORKFLOWS.entries()) {
    jobs[500 + i] ??= w.jobs.map((j, n) => ({
      id: 5000 + i * 10 + n,
      name: j.id,
      head_sha: CANDIDATE_SHA,
      status: 'completed',
      conclusion: 'success',
    }))
  }
  for (const [i] of REQUIRED_CI_WORKFLOWS.entries()) {
    jobs[500 + i].push(
      ...['filter'].map((name, n) => ({
        id: 6000 + i * 10 + n,
        name,
        head_sha: CANDIDATE_SHA,
        status: 'completed',
        conclusion: 'success',
      }))
    )
  }
  runs = { ...ciRuns, ...runs }
  const runEndpoint = async (params) => ({
    data: { workflow_runs: runs[params.workflow_id] ?? [] },
  })
  const jobEndpoint = async (params) => ({
    data: { jobs: jobs[params.run_id] ?? [] },
  })
  const compareEndpoint = async ({ basehead }) => ({
    data: comparisons[basehead] ?? { status: 'ahead' },
  })
  const github = {
    rest: {
      actions: {
        downloadArtifact: async ({ artifact_id }) => ({
          data: publication.archives.get(artifact_id),
        }),
        listJobsForWorkflowRunAttempt: jobEndpoint,
        listWorkflowRunArtifacts: async ({ run_id }) => ({
          data: {
            artifacts: publication.artifacts.filter(
              (artifact) => artifact.run_id === run_id
            ),
          },
        }),
        listWorkflowRuns: runEndpoint,
      },
      repos: {
        compareCommitsWithBasehead: compareEndpoint,
        getContent: async ({ path: filePath }) => {
          if (filePath === '.github/workflows') {
            return {
              data: definitions.map((definition) => ({
                name: definition.path.split('/').at(-1),
                path: definition.path,
                type: 'file',
              })),
            }
          }
          const definition = definitions.find(
            (candidate) => candidate.path === filePath
          )
          return {
            data: {
              content: Buffer.from(definition?.content ?? '').toString(
                'base64'
              ),
              encoding: 'base64',
              type: 'file',
            },
          }
        },
      },
    },
    paginate: async (endpoint, params) => {
      const response = await endpoint(params)
      return (
        response.data.workflow_runs ??
        response.data.jobs ??
        response.data.artifacts ??
        []
      )
    },
  }
  return { github, jobEndpoint, runEndpoint }
}

function successfulJobs(workflows) {
  return Object.fromEntries(
    workflows.map((workflow, index) => {
      const runId = 100 + index
      return [
        runId,
        workflowJobs({
          candidateSha: CANDIDATE_SHA,
          path: workflow.path,
          targetIds: FIXTURE_TARGET_IDS,
        }),
      ]
    })
  )
}

function refGithub(
  initialSha = null,
  { afterUpdateSha, postPushReadbacks = [] } = {}
) {
  let currentSha = initialSha
  let pushed = false
  let readbackIndex = 0
  const calls = []
  const github = {
    calls,
    rest: {
      git: {
        getRef: async (params) => {
          calls.push({ method: 'getRef', params })
          if (pushed && readbackIndex < postPushReadbacks.length) {
            const readback = postPushReadbacks[readbackIndex]
            readbackIndex += 1
            if (readback instanceof Error) throw readback
            if (readback == null) {
              const error = new Error('reference not found')
              error.status = 404
              throw error
            }
            return { data: { object: { sha: readback, type: 'commit' } } }
          }
          if (currentSha == null) {
            const error = new Error('reference not found')
            error.status = 404
            throw error
          }
          return { data: { object: { sha: currentSha, type: 'commit' } } }
        },
      },
      repos: {
        compareCommitsWithBasehead: async () => ({
          data: { status: 'ahead' },
        }),
      },
    },
  }
  const gitRunner = (args) => {
    calls.push({ args, method: 'git' })
    if (args[0] !== 'push') return ''
    const lease = args.find((argument) =>
      argument.startsWith('--force-with-lease=')
    )
    const expectedSha = lease.slice(lease.lastIndexOf(':') + 1) || null
    if (currentSha !== expectedSha) throw new Error('stale ref lease')
    const candidateSha = args.at(-1).split(':')[0]
    currentSha = afterUpdateSha ?? candidateSha
    pushed = true
    return ''
  }
  return {
    github,
    calls,
    current: () => currentSha,
    gitRunner,
    set: (sha) => {
      currentSha = sha
    },
  }
}

test('requires the trusted workflow to resolve the selected source branch', () => {
  assert.equal(getSourceBranch('v3'), 'v3')
  assert.throws(() => getSourceBranch(), /resolved by the trusted workflow/)
  assert.throws(() => getSourceBranch('main'), /approved push triggers/)
})

test('validates the consolidated candidate workflow and derives the publisher inventory', () => {
  const workflows = validWorkflows()
  assert.equal(workflows.length, 1)
  assert.equal(workflows[0].path, FIXTURE_WORKFLOW_PATH)
  assert.equal(workflows[0].name, 'Build staging images')
  // Only the ARM64 publisher jobs carry a promotable image; the scan and AMD64
  // legs are required to succeed but publish nothing the controller promotes.
  assert.deepEqual(
    workflows[0].jobs.map((job) => job.id),
    [
      'build-arm-auth',
      'build-arm-backend-docker',
      'build-arm-backend-docker-migrator',
    ]
  )
  assert.deepEqual(workflows[0].requiredJobIds, [
    'build-arm-auth',
    'build-arm-backend-docker',
    'build-arm-backend-docker-migrator',
    'scan-arm-backend-docker',
    'scan-arm-backend-docker-migrator',
  ])
  assert.deepEqual(
    workflows[0].jobs.map((job) => job.image),
    [
      'ghcr.io/uzh-bf/klicker-uzh/auth-arm',
      'ghcr.io/uzh-bf/klicker-uzh/backend-docker-arm',
      'ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm',
    ]
  )
})

test('a candidate that still publishes per-image workflows fails closed', () => {
  const legacy = fixtureDefinitions()
  legacy.push({
    content: 'name: Build Docker image for auth (stg)\n',
    path: '.github/workflows/v3_auth-stg.yml',
  })
  assert.throws(
    () =>
      validateFixture({
        definitions: legacy,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /must carry exactly one staging workflow/
  )
})

test('only the controlled set of integration-only targets may be absent', () => {
  const optionalIds = STAGING_IMAGE_TARGETS.filter(
    (target) => target.optional === true
  ).map((target) => target.id)
  assert.ok(optionalIds.length > 0, 'no optional target is declared')

  assert.deepEqual(resolveCandidateTargetIds([]), STAGING_TARGET_IDS)
  // An optional target may be absent: the integration lines carry those apps and
  // 'v3' does not.
  const withoutOptional = resolveCandidateTargetIds(optionalIds)
  for (const optionalId of optionalIds) {
    assert.equal(withoutOptional.includes(optionalId), false)
  }
  assert.equal(withoutOptional.includes('auth-arm'), true)

  // A required target may never be absent.
  const requiredId = STAGING_TARGET_IDS.find((id) => !optionalIds.includes(id))
  assert.throws(
    () => resolveCandidateTargetIds([requiredId]),
    /missing the required staging image target/
  )
  assert.throws(
    () => resolveCandidateTargetIds(['not-a-target']),
    /unknown staging image target/
  )
})

test('admits inventoried scan jobs without treating them as publishers', () => {
  // The scan legs are required jobs but never publishers.
  const workflows = validWorkflows()
  assert.equal(
    workflows[0].jobs.some((job) => job.id.startsWith('scan-')),
    false
  )
  assert.equal(
    workflows[0].requiredJobIds.some((id) => id.startsWith('scan-')),
    true
  )
  // A scan leg that stops enforcing the policy blocks the candidate even though
  // it publishes nothing the controller promotes.
  const uncheckedScan = fixtureDefinitions()
  uncheckedScan[0].content = uncheckedScan[0].content.replace(
    'node .github/scripts/image-scan-receipt.cjs check',
    'node .github/scripts/other.cjs check'
  )
  assert.throws(
    () =>
      validateFixture({
        definitions: uncheckedScan,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /does not enforce the scan policy/
  )
})

// Every workflow-level property the old per-image validator enforced is still
// enforced against the consolidated file, so a candidate cannot weaken the
// publication pipeline by editing the one workflow it now owns.
test('rejects unsafe workflow publication changes', () => {
  const reject = (label, definitions, pattern) => {
    const targetIds = FIXTURE_TARGET_IDS
    try {
      validateFixture({
        definitions,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
        targetIds,
      })
    } catch (error) {
      assert.match(error.message, pattern, label)
      return
    }
    assert.fail(label + ' was accepted')
  }
  const mutateAll = (pairs) => {
    const definitions = fixtureDefinitions()
    for (const [from, to] of pairs) {
      assert.ok(
        definitions[0].content.includes(from),
        'fixture no longer contains the text to replace: ' + from
      )
      // Every occurrence, so a mutant that removes a required guardrail removes
      // it from every leg instead of leaving a matching sibling behind.
      definitions[0].content = definitions[0].content.split(from).join(to)
    }
    return definitions
  }
  const mutate = (from, to) => mutateAll([[from, to]])

  reject(
    'narrowed push triggers',
    fixtureDefinitions({ pushBranches: ["'v3'"] }),
    /approved push triggers/
  )
  reject(
    'reduced pull-request types',
    mutate(
      'types: [opened, synchronize, reopened, edited, ready_for_review]',
      'types: [opened]'
    ),
    /approved pull-request triggers/
  )
  reject(
    'workflow-level path filter',
    mutate(
      '    types: [opened, synchronize, reopened, edited, ready_for_review]',
      '    paths:\n      - apps/auth/**\n    types: [opened, synchronize, reopened, edited, ready_for_review]'
    ),
    /must not filter pull-request paths/
  )
  reject(
    'missing full-SHA tag',
    fixtureDefinitions({ fullShaTag: false }),
    /full source SHA tag/
  )
  reject(
    'renamed workflow',
    mutate('Build staging images', 'Build staging images renamed'),
    /trusted workflow name/
  )
  reject(
    'ungated publication',
    mutate("steps.publish_guard.outputs.publish == 'true'", 'true'),
    /publish guard/
  )
  reject(
    'removed fingerprint resolution',
    mutate(
      'uses: ./.github/actions/staging-image-input-fingerprint',
      'uses: ./.github/actions/other-fingerprint'
    ),
    /does not resolve the input fingerprint/
  )
  reject(
    'removed fingerprint tag publication',
    mutate(
      '.github/scripts/stg-image-reuse-guard.sh',
      '.github/scripts/other-reuse-guard.sh'
    ),
    /does not publish the resolved fingerprint tag/
  )
  reject(
    'fingerprint tag published without the reuse condition',
    mutate('matrix.reuse == true', 'true'),
    /reuse-capable publications/
  )
  reject(
    'digest published without its input fingerprint',
    mutate('image-input-fingerprint-', 'fingerprint-record-'),
    /does not ship the input fingerprint with the digest/
  )
  reject(
    'digest published without its reuse record',
    mutate('runner.temp }}/image-reuse-', 'runner.temp }}/reuse-'),
    /does not publish a reuse record with the digest/
  )
  reject(
    'image published without its source revision label',
    mutate('org.opencontainers.image.revision', 'org.example.revision'),
    /does not label the image with its source revision/
  )
  // The reuse resolution has to run before the guard decides whether to build:
  // it is the adoption that publishes the full-SHA tag the guard then finds.
  reject(
    'reuse resolved after the publish guard',
    mutateAll([
      ['id: fingerprint', 'id: reuse-resolution'],
      ['id: publish_guard', 'id: fingerprint'],
      ['id: reuse-resolution', 'id: publish_guard'],
    ]),
    /resolves the publish guard before the reuse resolution/
  )
  reject(
    'removed publish guard script',
    mutate(
      '.github/scripts/stg-image-publish-guard.sh',
      '.github/scripts/other-guard.sh'
    ),
    /full-SHA tag before publishing/
  )
  reject(
    'floating scanner revision',
    mutate(
      'aquasecurity/trivy-action@a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8',
      'aquasecurity/trivy-action@v0.36.0'
    ),
    /pin exactly one trivy action revision/
  )
  reject(
    'removed scan policy',
    mutate(
      'node .github/scripts/image-scan-receipt.cjs check',
      'node .github/scripts/other.cjs check'
    ),
    /does not enforce the scan policy/
  )
  reject(
    'ARM build no longer defers drafts',
    mutate('github.event.pull_request.draft == false', 'true'),
    /does not defer draft builds/
  )
  reject(
    'publication reading the pull-request cache',
    mutate(
      "format('type=registry,ref=ghcr.io/{0}/{1}-arm:buildcache-trusted-{2}'",
      "format('type=registry,ref=ghcr.io/{0}/{1}-arm:buildcache'"
    ),
    /trusted epoch cache/
  )
  reject(
    'pull request reaching the trusted cache',
    mutate(
      "format('type=registry,ref=ghcr.io/{0}/{1}-arm:buildcache'",
      "format('type=registry,ref=ghcr.io/{0}/{1}-arm:buildcache-trusted'"
    ),
    /trusted epoch cache/
  )
  reject(
    'publication with the shared cache disabled',
    mutate(
      '          cache-from: ',
      '          no-cache: true\n          cache-from: '
    ),
    /disables the shared build cache/
  )
  reject(
    'retargeted matrix image',
    mutate('matrix.image', 'matrix.imageName'),
    /derive the image from the matrix/
  )
  reject(
    'status job no longer reports',
    mutate(
      '    if: always()\n    runs-on: ubuntu-latest\n    timeout-minutes: 10',
      '    if: success()\n    runs-on: ubuntu-latest\n    timeout-minutes: 10'
    ),
    /must report for every outcome/
  )
})

test('requires the candidate to be an ancestor of the selected source', async () => {
  const context = reviewContext()
  const github = evidenceGithub({ workflows: validWorkflows() }).github
  await assert.doesNotReject(
    validateCandidateAncestry({
      github,
      context,
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
    })
  )

  const staleGithub = evidenceGithub({
    comparisons: { [`${CANDIDATE_SHA}...v3`]: { status: 'behind' } },
    workflows: validWorkflows(),
  }).github
  await assert.rejects(
    validateCandidateAncestry({
      github: staleGithub,
      context,
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
    }),
    /not an ancestor/
  )
})

test('accepts delayed and running exact-SHA evidence after bounded retries', async () => {
  const workflows = validWorkflows()
  let runReads = 0
  const { github: delayedGithub } = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
  })
  const delayedEndpoint = delayedGithub.rest.actions.listWorkflowRuns
  delayedGithub.rest.actions.listWorkflowRuns = async (params) => {
    runReads += 1
    if (runReads === 1) return { data: { workflow_runs: [] } }
    return delayedEndpoint(params)
  }
  const delays = []
  const delayed = await collectBuildEvidence({
    github: delayedGithub,
    context: reviewContext(),
    workflows,
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 2,
    retryDelayMs: 7,
    sleep: async (delay) => delays.push(delay),
  })
  assert.equal(delayed.valid, true)
  assert.deepEqual(delays, [7])
  assert.equal(delayed.attempts.length, 2)

  let runningReads = 0
  const runningGithub = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
  }).github
  const runningEndpoint = runningGithub.rest.actions.listWorkflowRuns
  runningGithub.rest.actions.listWorkflowRuns = async (params) => {
    runningReads += 1
    if (runningReads === 1) {
      return {
        data: {
          workflow_runs: [
            workflowRun({
              candidateSha: CANDIDATE_SHA,
              id: 100,
              path: params.workflow_id,
              status: 'in_progress',
            }),
          ],
        },
      }
    }
    return runningEndpoint(params)
  }
  const running = await collectBuildEvidence({
    github: runningGithub,
    context: reviewContext(),
    workflows,
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 2,
    sleep: async () => {},
  })
  assert.equal(running.valid, true)
  assert.equal(running.attempts[0].failures[0].status, 'running')
})

test('fails closed for missing, skipped, failed, cancelled, and wrong evidence', async () => {
  const workflows = validWorkflows()
  const cases = [
    [
      'skipped',
      [
        workflowRun({
          candidateSha: CANDIDATE_SHA,
          conclusion: 'skipped',
          id: 100,
          path: workflows[0].path,
        }),
      ],
      /run is skipped/,
    ],
    [
      'failed',
      [
        workflowRun({
          candidateSha: CANDIDATE_SHA,
          conclusion: 'failure',
          id: 100,
          path: workflows[0].path,
        }),
      ],
      /run is failed/,
    ],
    [
      'cancelled',
      [
        workflowRun({
          candidateSha: CANDIDATE_SHA,
          conclusion: 'cancelled',
          id: 100,
          path: workflows[0].path,
        }),
      ],
      /run is cancelled/,
    ],
    [
      'wrong evidence',
      [
        workflowRun({
          candidateSha: CANDIDATE_SHA,
          headBranch: 'other',
          id: 100,
          path: workflows[0].path,
        }),
      ],
      /wrong evidence/,
    ],
  ]
  for (const [label, firstRuns, reason] of cases) {
    const runs = evidenceRuns(workflows)
    runs[workflows[0].path] = firstRuns
    const { github } = evidenceGithub({
      workflows,
      jobs: successfulJobs(workflows),
      runs,
    })
    const result = await collectBuildEvidence({
      github,
      context: reviewContext(),
      workflows,
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
      maxAttempts: 3,
      sleep: async () => {
        throw new Error(`${label} should not retry`)
      },
    })
    assert.equal(result.valid, false, label)
    assert.match(result.reason, reason, label)
    assert.equal(result.attempts.length, 1, label)
  }

  const missingRuns = evidenceRuns(workflows)
  missingRuns[workflows[0].path] = []
  const { github: missingGithub } = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
    runs: missingRuns,
  })
  const missing = await collectBuildEvidence({
    github: missingGithub,
    context: reviewContext(),
    workflows,
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 2,
    sleep: async () => {},
  })
  assert.equal(missing.valid, false)
  assert.match(missing.reason, /no exact-SHA run/)
  assert.equal(missing.attempts.length, 2)

  const runningJobs = successfulJobs(workflows)
  runningJobs[100] = workflowJobs({
    candidateSha: CANDIDATE_SHA,
    jobState: { 'build-arm-auth': { status: 'in_progress' } },
    path: workflows[0].path,
  })
  const { github: runningGithub } = evidenceGithub({
    workflows,
    jobs: runningJobs,
  })
  const runningResult = await collectBuildEvidence({
    github: runningGithub,
    context: reviewContext(),
    workflows: [workflows[0]],
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 1,
  })
  assert.match(runningResult.reason, /build-arm-auth is running/)

  const jobCases = [
    ['skipped', { conclusion: 'skipped' }],
    ['failed', { conclusion: 'failure' }],
    ['cancelled', { conclusion: 'cancelled' }],
    ['wrong evidence', { head_sha: 'd'.repeat(40) }],
  ]
  for (const [label, jobState] of jobCases) {
    const terminalJobs = successfulJobs(workflows)
    terminalJobs[100] = workflowJobs({
      candidateSha: CANDIDATE_SHA,
      jobState: { 'build-arm-auth': jobState },
      path: workflows[0].path,
    })
    const { github: terminalGithub } = evidenceGithub({
      workflows,
      jobs: terminalJobs,
    })
    const result = await collectBuildEvidence({
      github: terminalGithub,
      context: reviewContext(),
      workflows: [workflows[0]],
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
      maxAttempts: 3,
      sleep: async () => {
        throw new Error(`${label} job should not retry`)
      },
    })
    assert.equal(result.valid, false, label)
    assert.match(result.reason, new RegExp(label), label)
    assert.equal(result.attempts.length, 1, label)
  }
})

test('fails closed when Octokit pagination is unavailable or invalid', async () => {
  const workflows = validWorkflows()
  const missingPaginator = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
  }).github
  delete missingPaginator.paginate
  await assert.rejects(
    collectBuildEvidence({
      github: missingPaginator,
      context: reviewContext(),
      workflows,
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
      maxAttempts: 1,
    }),
    /pagination is unavailable/
  )

  const invalidPaginator = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
  }).github
  invalidPaginator.paginate = async () => ({})
  await assert.rejects(
    collectBuildEvidence({
      github: invalidPaginator,
      context: reviewContext(),
      workflows,
      candidateSha: CANDIDATE_SHA,
      sourceBranch: 'v3',
      maxAttempts: 1,
    }),
    /pagination returned an invalid result/
  )
})

test('resolves stable runtime SHA-tag digests and rejects incomplete or changing results', async () => {
  const workflows = validWorkflows()
  const { github } = evidenceGithub({
    workflows,
    jobs: successfulJobs(workflows),
  })
  const evidence = await collectBuildEvidence({
    github,
    context: reviewContext(),
    workflows,
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 1,
  })
  const digest = `sha256:${'1'.repeat(64)}`
  const receiptImages = await resolveStableRegistryDigests({
    candidateSha: CANDIDATE_SHA,
    evidence,
    workflows,
    getRegistryDigest: async () => digest,
  })
  assert.equal(
    receiptImages.length,
    workflows.reduce((count, workflow) => count + workflow.jobs.length, 0)
  )
  assert.equal(
    receiptImages.some((image) => image.repository.endsWith('-amd')),
    false
  )
  assert.equal(
    receiptImages.every((image) => image.digest === digest),
    true
  )
  assert.equal(
    checksumReceipt({ images: receiptImages }),
    checksumReceipt({ images: receiptImages })
  )

  let reads = 0
  await assert.rejects(
    resolveStableRegistryDigests({
      candidateSha: CANDIDATE_SHA,
      evidence,
      workflows,
      getRegistryDigest: async () => {
        reads += 1
        return `sha256:${(reads === 1 ? '2' : '3').repeat(64)}`
      },
    }),
    /changed during collection/
  )
  await assert.rejects(
    resolveStableRegistryDigests({
      candidateSha: CANDIDATE_SHA,
      evidence,
      workflows,
      getRegistryDigest: async () => undefined,
    }),
    /no complete registry digest/
  )
})

test('resolves a public registry Bearer challenge without exposing credentials', async () => {
  const manifestResponse = registryManifestResponse()
  const digest = manifestResponse.headers.get('docker-content-digest')
  const calls = []
  const responses = [
    {
      headers: new Headers({
        'www-authenticate':
          'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:uzh-bf/klicker-uzh/auth-arm:pull"',
      }),
      ok: false,
      status: 401,
    },
    {
      json: async () => ({ token: 'synthetic-registry-token' }),
      ok: true,
      status: 200,
    },
    manifestResponse,
  ]
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    return responses.shift()
  }
  assert.equal(
    await fetchRegistryDigest({
      repository: 'ghcr.io/uzh-bf/klicker-uzh/auth-arm',
      tag: CANDIDATE_SHA,
      fetchImpl,
    }),
    digest
  )
  assert.equal(calls.length, 3)
  assert.equal(calls[0].options.headers.authorization, undefined)
  assert.match(calls[1].url, /^https:\/\/ghcr\.io\/token\?/)
  assert.equal(
    calls[2].options.headers.authorization,
    'Bearer synthetic-registry-token'
  )
})

test('verifies registry digest headers against accepted raw manifest bodies', async () => {
  const contentTypes = [
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.v2+json',
  ]
  for (const contentType of contentTypes) {
    const response = registryManifestResponse({
      contentType: `${contentType}; charset=utf-8`,
    })
    assert.equal(
      await fetchRegistryDigest({
        repository: 'ghcr.io/uzh-bf/klicker-uzh/auth-arm',
        tag: CANDIDATE_SHA,
        fetchImpl: async () => response,
      }),
      response.headers.get('docker-content-digest'),
      contentType
    )
  }
})

test('rejects untrusted or incomplete registry manifest responses', async () => {
  const cases = [
    [
      'unexpected content type',
      registryManifestResponse({ contentType: 'text/plain' }),
      /unexpected content type/,
    ],
    [
      'missing digest',
      registryManifestResponse({ includeDigest: false }),
      /no valid digest header/,
    ],
    [
      'invalid digest',
      registryManifestResponse({ digest: 'sha256:not-a-digest' }),
      /no valid digest header/,
    ],
    [
      'body mismatch',
      registryManifestResponse({ digest: `sha256:${'f'.repeat(64)}` }),
      /does not match its digest header/,
    ],
    ['redirect', registryManifestResponse({ redirected: true }), /redirected/],
    [
      'missing body reader',
      registryManifestResponse({ includeReader: false }),
      /incomplete/,
    ],
    [
      'empty body',
      registryManifestResponse({ body: Buffer.alloc(0) }),
      /incomplete/,
    ],
  ]
  for (const [label, response, reason] of cases) {
    await assert.rejects(
      fetchRegistryDigest({
        repository: 'ghcr.io/uzh-bf/klicker-uzh/auth-arm',
        tag: CANDIDATE_SHA,
        fetchImpl: async () => response,
      }),
      reason,
      label
    )
  }

  const interrupted = registryManifestResponse()
  interrupted.arrayBuffer = async () => {
    throw new Error('synthetic truncated body')
  }
  await assert.rejects(
    fetchRegistryDigest({
      repository: 'ghcr.io/uzh-bf/klicker-uzh/auth-arm',
      tag: CANDIDATE_SHA,
      fetchImpl: async () => interrupted,
    }),
    /incomplete/
  )
})

test('plans equal, stale, fast-forward, and divergent release refs without force', async () => {
  const context = reviewContext()
  const equal = await planReleaseRef({
    github: evidenceGithub({ workflows: [] }).github,
    context,
    currentSha: CANDIDATE_SHA,
    candidateSha: CANDIDATE_SHA,
  })
  assert.equal(equal.action, 'no-op-equal')

  const staleGithub = evidenceGithub({
    comparisons: {
      [`${CURRENT_SHA}...${CANDIDATE_SHA}`]: { status: 'behind' },
    },
    workflows: [],
  }).github
  assert.equal(
    (
      await planReleaseRef({
        github: staleGithub,
        context,
        currentSha: CURRENT_SHA,
        candidateSha: CANDIDATE_SHA,
      })
    ).action,
    'no-op-stale'
  )

  const forwardGithub = evidenceGithub({
    comparisons: { [`${CURRENT_SHA}...${NEXT_SHA}`]: { status: 'ahead' } },
    workflows: [],
  }).github
  assert.equal(
    (
      await planReleaseRef({
        github: forwardGithub,
        context,
        currentSha: CURRENT_SHA,
        candidateSha: NEXT_SHA,
      })
    ).action,
    'fast-forward'
  )

  const divergentGithub = evidenceGithub({
    comparisons: { [`${CURRENT_SHA}...${NEXT_SHA}`]: { status: 'diverged' } },
    workflows: [],
  }).github
  await assert.rejects(
    planReleaseRef({
      github: divergentGithub,
      context,
      currentSha: CURRENT_SHA,
      candidateSha: NEXT_SHA,
    }),
    /diverges/
  )
})

test('separates Git read and write credentials without an ambient write fallback', (t) => {
  const readToken = 'synthetic-read-token'
  const writeToken = 'synthetic-write-token'
  const previous = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    'INPUT_GITHUB-TOKEN': process.env['INPUT_GITHUB-TOKEN'],
    STG_PROMOTE_TOKEN: process.env.STG_PROMOTE_TOKEN,
  }
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })
  process.env.GITHUB_TOKEN = readToken
  process.env['INPUT_GITHUB-TOKEN'] = readToken
  process.env.STG_PROMOTE_TOKEN = writeToken
  const calls = []
  const options = {
    context: reviewContext(),
    candidateSha: CANDIDATE_SHA,
    expectedSha: null,
    gitRunner: (args, options) => calls.push({ args, options }),
  }
  assert.throws(() => pushReleaseRefWithLease(options), /STG_PROMOTE_TOKEN/)
  assert.equal(calls.length, 0)
  pushReleaseRefWithLease({ ...options, gitToken: writeToken })
  assert.equal(calls.length, 2)
  for (const [index, token] of [readToken, writeToken].entries()) {
    const { args, options } = calls[index]
    assert.equal(args[0], index === 0 ? 'fetch' : 'push')
    assert.equal(options.env.GITHUB_TOKEN, undefined)
    assert.equal(options.env['INPUT_GITHUB-TOKEN'], undefined)
    assert.equal(options.env.STG_PROMOTE_TOKEN, undefined)
    assert.equal(
      options.env.GIT_CONFIG_VALUE_0,
      `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
    )
    assert.equal(JSON.stringify(args).includes(readToken), false)
    assert.equal(JSON.stringify(args).includes(writeToken), false)
  }
})

test('uses an exact remote lease for create and prevalidated fast-forward updates', async () => {
  const context = reviewContext()
  const create = refGithub()
  const created = await compareAndSwapReleaseRef({
    github: create.github,
    context,
    expectedSha: null,
    candidateSha: CANDIDATE_SHA,
    gitRunner: create.gitRunner,
    gitToken: 'fixture-token',
  })
  assert.equal(created.result, 'push-succeeded')
  assert.equal(created.verification, 'verified')
  assert.equal(created.observed_release_sha, CANDIDATE_SHA)
  const createGitCalls = create.calls.filter((call) => call.method === 'git')
  assert.equal(createGitCalls[0].args[0], 'fetch')
  assert.deepEqual(createGitCalls[1].args.slice(0, 3), [
    'push',
    '--porcelain',
    `--force-with-lease=${PROMOTION_REF}:`,
  ])
  assert.equal(createGitCalls[1].args.includes('--force'), false)

  const update = refGithub(CURRENT_SHA)
  await compareAndSwapReleaseRef({
    github: update.github,
    context,
    expectedSha: CURRENT_SHA,
    candidateSha: NEXT_SHA,
    gitRunner: update.gitRunner,
    gitToken: 'fixture-token',
  })
  const updateCall = update.calls.find(
    (call) => call.method === 'git' && call.args[0] === 'push'
  )
  assert.ok(
    updateCall.args.includes(
      `--force-with-lease=${PROMOTION_REF}:${CURRENT_SHA}`
    )
  )
  assert.equal(updateCall.args.at(-1), `${NEXT_SHA}:${PROMOTION_REF}`)

  const preRaced = refGithub(CURRENT_SHA)
  await assert.rejects(
    compareAndSwapReleaseRef({
      github: preRaced.github,
      context,
      expectedSha: 'd'.repeat(40),
      candidateSha: NEXT_SHA,
      gitRunner: preRaced.gitRunner,
      gitToken: 'fixture-token',
    }),
    /changed before the compare-and-swap/
  )
  assert.equal(
    preRaced.calls.some(
      (call) => call.method === 'git' && call.args[0] === 'push'
    ),
    false
  )

  const raced = refGithub(CURRENT_SHA, { afterUpdateSha: 'd'.repeat(40) })
  const racedResult = await compareAndSwapReleaseRef({
    github: raced.github,
    context,
    expectedSha: CURRENT_SHA,
    candidateSha: NEXT_SHA,
    gitRunner: raced.gitRunner,
    gitToken: 'fixture-token',
    readbackMaxAttempts: 2,
    readbackRetryDelayMs: 0,
    sleep: async () => {},
  })
  assert.equal(racedResult.result, 'push-succeeded')
  assert.equal(racedResult.verification, 'mismatch')
  assert.equal(racedResult.observed_release_sha, 'd'.repeat(40))
  assert.equal(racedResult.readback_attempts.length, 2)

  const notForward = refGithub(CURRENT_SHA)
  notForward.github.rest.repos.compareCommitsWithBasehead = async () => ({
    data: { status: 'diverged' },
  })
  await assert.rejects(
    compareAndSwapReleaseRef({
      github: notForward.github,
      context,
      expectedSha: CURRENT_SHA,
      candidateSha: NEXT_SHA,
      gitRunner: notForward.gitRunner,
      gitToken: 'fixture-token',
    }),
    /not a fast-forward/
  )
  assert.equal(
    notForward.calls.some(
      (call) => call.method === 'git' && call.args[0] === 'push'
    ),
    false
  )
})

test('sanitizes credential-bearing fetch and push failures', async () => {
  for (const operation of ['fetch', 'push']) {
    const refs = refGithub()
    const sensitive = 'synthetic-private-token'
    const original = Object.assign(new Error(sensitive), {
      stderr: `refusing to allow a GitHub App without workflows permission ${sensitive}`,
      cause: new Error(sensitive),
      env: { STG_PROMOTE_TOKEN: sensitive },
    })
    await assert.rejects(
      compareAndSwapReleaseRef({
        github: refs.github,
        context: reviewContext(),
        expectedSha: null,
        candidateSha: CANDIDATE_SHA,
        gitToken: sensitive,
        gitRunner: (args) => {
          if (args[0] === operation) throw original
        },
      }),
      (error) => {
        assert.equal(error.cause, undefined)
        assert.ok(error instanceof Error)
        assert.doesNotMatch(
          require('node:util').inspect(error),
          /synthetic-private-token/
        )
        return true
      }
    )
  }
})

test('recovers from a transient post-push ref readback failure', async () => {
  const refs = refGithub(null, {
    postPushReadbacks: [transientReadbackFailure(), CANDIDATE_SHA],
  })
  const result = await compareAndSwapReleaseRef({
    github: refs.github,
    context: reviewContext(),
    expectedSha: null,
    candidateSha: CANDIDATE_SHA,
    gitRunner: refs.gitRunner,
    gitToken: 'fixture-token',
    readbackMaxAttempts: 3,
    readbackRetryDelayMs: 0,
    sleep: async () => {},
  })
  assert.equal(result.verification, 'verified')
  assert.deepEqual(
    result.readback_attempts.map((attempt) => attempt.state),
    ['unavailable', 'verified']
  )
})

test('promotes without fetching submodules and rejects a concurrent ref update', (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-release-cas-')
  )
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }))

  const remote = path.join(temporaryDirectory, 'remote.git')
  const client = path.join(temporaryDirectory, 'client')
  execFileSync('git', ['init', '--bare', '--quiet', remote])
  execFileSync('git', ['init', '--quiet', client])
  execFileSync('git', [
    '-C',
    client,
    'config',
    'fetch.recurseSubmodules',
    'true',
  ])
  const fixtureEnvironment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
  }
  const makeCommit = (label, parent = null) => {
    const modules = execFileSync(
      'git',
      ['--git-dir', remote, 'hash-object', '-w', '--stdin'],
      {
        encoding: 'utf8',
        input:
          '[submodule "unavailable-submodule"]\n\tpath = unavailable-submodule\n\turl = ./missing.git\n',
      }
    ).trim()
    const blob = execFileSync(
      'git',
      ['--git-dir', remote, 'hash-object', '-w', '--stdin'],
      { encoding: 'utf8', input: `${label}\n` }
    ).trim()
    const tree = execFileSync('git', ['--git-dir', remote, 'mktree'], {
      encoding: 'utf8',
      input: `100644 blob ${modules}\t.gitmodules\n100644 blob ${blob}\tfixture.txt\n160000 commit ${(parent ? '2' : '1').repeat(40)}\tunavailable-submodule\n`,
    }).trim()
    return execFileSync(
      'git',
      [
        '--git-dir',
        remote,
        'commit-tree',
        tree,
        ...(parent ? ['-p', parent] : []),
      ],
      { encoding: 'utf8', env: fixtureEnvironment, input: `${label}\n` }
    ).trim()
  }
  const baseSha = makeCommit('base')
  const racedSha = makeCommit('raced', baseSha)
  const candidateSha = makeCommit('candidate', racedSha)
  execFileSync('git', [
    '-C',
    client,
    'fetch',
    '--quiet',
    '--no-recurse-submodules',
    remote,
    baseSha,
  ])
  execFileSync('git', ['-C', client, 'checkout', '--quiet', baseSha])
  execFileSync('git', ['-C', client, 'submodule', 'init'], { stdio: 'pipe' })
  execFileSync('git', [
    'init',
    '--quiet',
    path.join(client, 'unavailable-submodule'),
  ])
  const readRemoteRef = () =>
    execFileSync('git', ['--git-dir', remote, 'rev-parse', PROMOTION_REF], {
      encoding: 'utf8',
    }).trim()

  pushReleaseRefWithLease({
    candidateSha,
    context: reviewContext(),
    expectedSha: null,
    gitToken: '',
    repositoryUrl: remote,
    workspace: client,
  })
  assert.equal(readRemoteRef(), candidateSha)

  execFileSync('git', [
    '--git-dir',
    remote,
    'update-ref',
    PROMOTION_REF,
    baseSha,
  ])
  pushReleaseRefWithLease({
    candidateSha,
    context: reviewContext(),
    expectedSha: baseSha,
    gitToken: '',
    repositoryUrl: remote,
    workspace: client,
  })
  assert.equal(readRemoteRef(), candidateSha)

  execFileSync('git', [
    '--git-dir',
    remote,
    'update-ref',
    PROMOTION_REF,
    baseSha,
  ])
  const racingGitRunner = (args, options) => {
    if (args[0] === 'push') {
      execFileSync('git', [
        '--git-dir',
        remote,
        'update-ref',
        PROMOTION_REF,
        racedSha,
      ])
    }
    return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  assert.throws(
    () =>
      pushReleaseRefWithLease({
        candidateSha,
        context: reviewContext(),
        expectedSha: baseSha,
        gitRunner: racingGitRunner,
        gitToken: '',
        repositoryUrl: remote,
        workspace: client,
      }),
    /Command failed/
  )
  assert.equal(readRemoteRef(), racedSha)
})

test('keeps an out-of-order candidate stale after a newer fast-forward wins', async () => {
  const context = reviewContext()
  const comparisons = {
    [`${CURRENT_SHA}...${NEXT_SHA}`]: { status: 'ahead' },
    [`${NEXT_SHA}...${CANDIDATE_SHA}`]: { status: 'behind' },
  }
  const github = evidenceGithub({ comparisons, workflows: [] }).github
  const remote = refGithub(CURRENT_SHA)
  const combinedGithub = {
    ...github,
    rest: { ...github.rest, git: remote.github.rest.git },
  }

  const newer = await planReleaseRef({
    github: combinedGithub,
    context,
    currentSha: CURRENT_SHA,
    candidateSha: NEXT_SHA,
  })
  assert.equal(newer.action, 'fast-forward')
  await compareAndSwapReleaseRef({
    github: combinedGithub,
    context,
    expectedSha: CURRENT_SHA,
    candidateSha: NEXT_SHA,
    gitRunner: remote.gitRunner,
    gitToken: 'fixture-token',
  })

  const older = await planReleaseRef({
    github: combinedGithub,
    context,
    currentSha: NEXT_SHA,
    candidateSha: CANDIDATE_SHA,
  })
  assert.equal(older.action, 'no-op-stale')
  assert.equal(remote.current(), NEXT_SHA)
  assert.equal(
    remote.calls.filter(
      (call) => call.method === 'git' && call.args[0] === 'push'
    ).length,
    1
  )
})

test('writes receipts before rejecting uncertain or mismatched post-push readback', async (t) => {
  const workflows = validWorkflows()
  const { github: baseGithub } = evidenceGithub({
    definitions: fixtureDefinitions(),
    workflows,
    jobs: successfulJobs(workflows),
    runs: evidenceRuns(workflows),
  })
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-release-readback-')
  )
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }))

  const cases = [
    {
      label: 'uncertain',
      options: {
        postPushReadbacks: [
          transientReadbackFailure(),
          transientReadbackFailure(),
        ],
      },
      reason: /post-push verification is uncertain/,
      states: ['unavailable', 'unavailable'],
    },
    {
      label: 'mismatch',
      options: { afterUpdateSha: NEXT_SHA },
      reason: /post-push verification is mismatch/,
      states: ['mismatch', 'mismatch'],
    },
  ]

  for (const fixture of cases) {
    const refs = refGithub(CURRENT_SHA, fixture.options)
    const github = {
      ...baseGithub,
      rest: {
        ...baseGithub.rest,
        git: refs.github.rest.git,
      },
    }
    const receiptPath = path.join(
      temporaryDirectory,
      `${fixture.label}-receipt.json`
    )
    const checksumPath = path.join(
      temporaryDirectory,
      `${fixture.label}-receipt.sha256`
    )
    const outputs = new Map()
    await assert.rejects(
      runPromotion({
        getCiEvidence: fixtureCiEvidence,
        getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
        getScanAdmission: fixtureScanAdmission,
        controllerSha: NEXT_SHA,
        github,
        context: reviewContext('workflow_dispatch', {
          confirm_ref_update: MANUAL_CONFIRMATION,
          expected_release_sha: CURRENT_SHA,
          expected_controller_sha: NEXT_SHA,
          dry_run: false,
          sha: CANDIDATE_SHA,
        }),
        sourceBranch: 'v3',
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        getRegistryDigest: async () => `sha256:${'6'.repeat(64)}`,
        gitRunner: refs.gitRunner,
        gitToken: 'fixture-token',
        maxAttempts: 1,
        readbackMaxAttempts: 2,
        readbackRetryDelayMs: 0,
        sleep: async () => {},
        receiptPath,
        checksumPath,
        core: {
          setOutput: (name, value) => outputs.set(name, value),
        },
      }),
      fixture.reason,
      fixture.label
    )

    assert.equal(fs.existsSync(receiptPath), true, fixture.label)
    assert.equal(fs.existsSync(checksumPath), true, fixture.label)
    const receiptText = fs.readFileSync(receiptPath, 'utf8')
    const receipt = JSON.parse(receiptText)
    assert.equal(receipt.update_result.result, 'push-succeeded')
    assert.equal(receipt.update_result.verification, fixture.label)
    assert.equal(receipt.applied_release_sha, null)
    assert.deepEqual(
      receipt.update_result.readback_attempts.map((attempt) => attempt.state),
      fixture.states
    )
    assert.doesNotMatch(receiptText, /synthetic readback unavailable/)
    const checksum = checksumReceipt(receipt)
    assert.equal(outputs.get('receipt_checksum'), checksum)
    assert.equal(
      fs.readFileSync(checksumPath, 'utf8'),
      `${checksum}  ${path.basename(receiptPath)}\n`
    )
  }
})

test('keeps manual defaults dry-run and gates automatic writes', async () => {
  const workflows = validWorkflows()
  const runs = evidenceRuns(workflows)
  const { github: baseGithub } = evidenceGithub({
    definitions: fixtureDefinitions(),
    workflows,
    jobs: successfulJobs(workflows),
    runs,
  })
  const refs = refGithub()
  const github = {
    ...baseGithub,
    rest: {
      ...baseGithub.rest,
      git: refs.github.rest.git,
    },
  }
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-release-promoter-')
  )
  const summaryPath = path.join(temporaryDirectory, 'summary.md')
  try {
    const result = await runPromotion({
      getCiEvidence: fixtureCiEvidence,
      getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
      getScanAdmission: fixtureScanAdmission,
      controllerSha: NEXT_SHA,
      github,
      context: reviewContext('workflow_dispatch', {
        dry_run: true,
        sha: CANDIDATE_SHA,
      }),
      sourceBranch: 'v3',
      candidateSha: CANDIDATE_SHA,
      expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
      getRegistryDigest: async () => `sha256:${'4'.repeat(64)}`,
      maxAttempts: 1,
      receiptPath: path.join(temporaryDirectory, 'receipt.json'),
      checksumPath: path.join(temporaryDirectory, 'receipt.sha256'),
      summaryPath,
    })
    assert.equal(result.decision.mode, 'dry-run')
    assert.equal(result.decision.action, 'create')
    assert.equal(result.update_result.result, 'not-attempted')
    assert.equal(result.update_result.verification, 'not-required')
    assert.equal(refs.current(), null)
    assert.equal(
      checksumReceipt(JSON.parse(fs.readFileSync(result.receiptPath, 'utf8'))),
      result.checksum
    )
    assert.match(fs.readFileSync(summaryPath, 'utf8'), /Controller run: `9001`/)

    const rerunRefs = refGithub(CANDIDATE_SHA)
    const rerunGithub = {
      ...baseGithub,
      rest: {
        ...baseGithub.rest,
        git: rerunRefs.github.rest.git,
      },
    }
    const rerun = await runPromotion({
      getCiEvidence: fixtureCiEvidence,
      getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
      getScanAdmission: fixtureScanAdmission,
      controllerSha: NEXT_SHA,
      github: rerunGithub,
      context: reviewContext('workflow_dispatch', {
        confirm_ref_update: MANUAL_CONFIRMATION,
        expected_release_sha: CANDIDATE_SHA,
        expected_controller_sha: NEXT_SHA,
        dry_run: false,
        sha: CANDIDATE_SHA,
      }),
      sourceBranch: 'v3',
      expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
      getRegistryDigest: async () => `sha256:${'4'.repeat(64)}`,
      maxAttempts: 1,
      receiptPath: path.join(temporaryDirectory, 'rerun-receipt.json'),
      checksumPath: path.join(temporaryDirectory, 'rerun-receipt.sha256'),
      summaryPath,
    })
    assert.equal(rerun.decision.action, 'no-op-equal')
    assert.equal(rerun.update_result.result, 'not-attempted')
    assert.equal(
      rerunRefs.calls.some((call) => call.method === 'updateRef'),
      false
    )

    const automatic = await runPromotion({
      getCiEvidence: fixtureCiEvidence,
      getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
      getScanAdmission: fixtureScanAdmission,
      controllerSha: NEXT_SHA,
      github,
      context: reviewContext('workflow_run'),
      sourceBranch: 'v3',
      promotionEnabled: 'false',
    })
    assert.equal(automatic.decision, 'disabled')
    assert.equal(refs.current(), null)

    const enabled = await runPromotion({
      getCiEvidence: fixtureCiEvidence,
      getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
      getScanAdmission: fixtureScanAdmission,
      controllerSha: NEXT_SHA,
      github,
      context: reviewContext('workflow_run'),
      sourceBranch: 'v3',
      promotionEnabled: 'true',
      expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
      getRegistryDigest: async () => `sha256:${'5'.repeat(64)}`,
      gitRunner: refs.gitRunner,
      gitToken: 'fixture-token',
      maxAttempts: 1,
      receiptPath: path.join(temporaryDirectory, 'enabled-receipt.json'),
      checksumPath: path.join(temporaryDirectory, 'enabled-receipt.sha256'),
      summaryPath,
    })
    assert.equal(enabled.decision.action, 'create')
    assert.equal(enabled.decision.mode, 'apply')
    assert.equal(enabled.update_result.result, 'push-succeeded')
    assert.equal(enabled.update_result.verification, 'verified')
    assert.equal(refs.current(), CANDIDATE_SHA)
    assert.equal(
      fs.readFileSync(enabled.receiptPath, 'utf8').includes('fixture-token'),
      false
    )
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }

  for (const inputs of [
    { confirm_ref_update: 'wrong' },
    { confirm: MANUAL_CONFIRMATION },
  ]) {
    await assert.rejects(
      runPromotion({
        getCiEvidence: fixtureCiEvidence,
        getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
        getScanAdmission: fixtureScanAdmission,
        controllerSha: NEXT_SHA,
        github,
        context: reviewContext('workflow_dispatch', {
          ...inputs,
          dry_run: false,
          sha: CANDIDATE_SHA,
        }),
        sourceBranch: 'v3',
        candidateSha: CANDIDATE_SHA,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
      }),
      new RegExp(`confirm_ref_update=${MANUAL_CONFIRMATION}`)
    )
  }
})

// One dry-run promotion of the fixture candidate, wired with the registry
// revision labels and the published records a test wants the controller to
// read. The receipt is parsed before the temporary directory is removed, so the
// assertions describe what the run actually wrote.
async function fixturePromotion({
  comparisons = {},
  publication,
  revisionOf,
} = {}) {
  const workflows = validWorkflows()
  const { github: baseGithub } = evidenceGithub({
    comparisons,
    definitions: fixtureDefinitions(),
    jobs: successfulJobs(workflows),
    publication,
    runs: evidenceRuns(workflows),
  })
  const refs = refGithub()
  const github = {
    ...baseGithub,
    rest: { ...baseGithub.rest, git: refs.github.rest.git },
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-promotion-'))
  const receiptPath = path.join(directory, 'receipt.json')
  try {
    const result = await runPromotion({
      candidateSha: CANDIDATE_SHA,
      context: reviewContext('workflow_dispatch', {
        dry_run: true,
        sha: CANDIDATE_SHA,
      }),
      controllerSha: NEXT_SHA,
      expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
      getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
      getCiEvidence: fixtureCiEvidence,
      getImageRevision: revisionOf,
      getRegistryDigest: async () => `sha256:${'4'.repeat(64)}`,
      getScanAdmission: fixtureScanAdmission,
      github,
      maxAttempts: 1,
      receiptPath,
      checksumPath: path.join(directory, 'receipt.sha256'),
      sourceBranch: 'v3',
      summaryPath: path.join(directory, 'summary.md'),
    })
    return { receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')), result }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

test('a publication that adopted a qualified digest is promoted as reused', async () => {
  const digest = `sha256:${'4'.repeat(64)}`
  const sourceSha = 'd'.repeat(40)
  const fingerprint = publicationFingerprint('backend-docker-arm')
  const { receipt, result } = await fixturePromotion({
    publication: publicationArtifacts({
      adopted: { 'backend-docker-arm': digest },
    }),
    revisionOf: async () => sourceSha,
  })

  const entry = result.release_manifest.entries.find(
    (candidate) => candidate.targetId === 'backend-docker-arm'
  )
  assert.equal(entry.digest, digest)
  assert.equal(
    entry.image,
    `ghcr.io/${REPOSITORY}/backend-docker-arm@${digest}`
  )
  assert.deepEqual(entry.reusedFrom, {
    digest,
    fingerprint,
    sourceSha,
    tag: fingerprintTag(fingerprint),
  })
  // The provenance of an adopted image is the revision label it carries, not
  // the run that built it: the receipt names the commit and nothing else.
  assert.equal('runId' in entry.reusedFrom, false)
  // Only a target the inventory marks reusable may be reported as reused.
  assert.deepEqual(result.reuse, {
    rebuilt: ['auth-arm', 'backend-docker-migrator-arm'],
    reused: ['backend-docker-arm'],
  })
  assert.deepEqual(receipt.reuse, result.reuse)
  assert.deepEqual(receipt.release_manifest, result.release_manifest)
  assert.equal(receipt.schema_version, 'stg-release-promotion/v2')

  // An image built from the candidate itself is a proven ancestor without a
  // commit comparison, so a re-run of the same commit still reuses.
  const self = await fixturePromotion({
    publication: publicationArtifacts({
      adopted: { 'backend-docker-arm': digest },
    }),
    revisionOf: async () => CANDIDATE_SHA,
  })
  assert.equal(
    self.result.release_manifest.entries.find(
      (candidate) => candidate.targetId === 'backend-docker-arm'
    ).reusedFrom.sourceSha,
    CANDIDATE_SHA
  )
  assert.deepEqual(self.result.reuse, result.reuse)
})

test('a reuse source that is not an ancestor of the candidate fails closed', async () => {
  const digest = `sha256:${'4'.repeat(64)}`
  const sourceSha = 'e'.repeat(40)
  await assert.rejects(
    fixturePromotion({
      comparisons: {
        [`${sourceSha}...${CANDIDATE_SHA}`]: { status: 'behind' },
      },
      publication: publicationArtifacts({
        adopted: { 'backend-docker-arm': digest },
      }),
      revisionOf: async () => sourceSha,
    }),
    /release manifest rejected: backend-docker-arm:reuse-ancestry/
  )
})

test('an adoption of a digest other than the published one fails closed', async () => {
  const adopted = `sha256:${'5'.repeat(64)}`
  await assert.rejects(
    fixturePromotion({
      publication: publicationArtifacts({
        adopted: { 'backend-docker-arm': adopted },
      }),
      revisionOf: async () => CANDIDATE_SHA,
    }),
    /backend-docker-arm adopted sha256:5{64} but published sha256:4{64}/
  )
})

test('only the records of reuse-capable targets are read', async () => {
  // 'auth-arm' is fingerprinted nowhere in the trusted inventory, so a
  // publication that ships a record for it is ignored rather than trusted.
  const { result } = await fixturePromotion({
    publication: publicationArtifacts({
      adopted: { 'auth-arm': `sha256:${'4'.repeat(64)}` },
      targetIds: [...FIXTURE_REUSE_TARGET_IDS, 'auth-arm'],
    }),
    revisionOf: async () => CANDIDATE_SHA,
  })
  const entry = result.release_manifest.entries.find(
    (candidate) => candidate.targetId === 'auth-arm'
  )
  assert.equal(entry.fingerprint, null)
  assert.equal(entry.reusedFrom, null)
  assert.deepEqual(result.reuse.reused, [])
})

test('an incomplete publication record fails closed', async (t) => {
  const cases = [
    {
      label: 'no input fingerprint',
      options: { omit: ['image-input-fingerprint-backend-docker-arm.json'] },
      reason: /published no input fingerprint with its staging digest/,
    },
    {
      label: 'no reuse record',
      options: { omit: ['image-reuse-backend-docker-arm.json'] },
      reason: /published no reuse record with its digest/,
    },
  ]
  for (const fixture of cases) {
    await t.test(fixture.label, async () => {
      await assert.rejects(
        fixturePromotion({
          publication: publicationArtifacts(fixture.options),
        }),
        fixture.reason
      )
    })
  }
})

test('a record that contradicts the trusted inventory fails closed', async (t) => {
  const targetId = 'backend-docker-arm'
  const fingerprint = publicationFingerprint(targetId)
  const tag = fingerprintTag(fingerprint)
  const fingerprintMember = 'image-input-fingerprint-' + targetId + '.json'
  const reuseMember = 'image-reuse-' + targetId + '.json'
  const cases = [
    {
      label: 'fingerprint of another target',
      member: fingerprintMember,
      record: { fingerprint, reuseEligible: true, tag, target: 'auth-arm' },
      reason: /published a fingerprint for another target/,
    },
    {
      label: 'fingerprint that is not canonical',
      member: fingerprintMember,
      record: {
        fingerprint: 'latest',
        reuseEligible: true,
        tag,
        target: targetId,
      },
      reason: /published no canonical input fingerprint/,
    },
    {
      label: 'fingerprint under another tag',
      member: fingerprintMember,
      record: {
        fingerprint,
        reuseEligible: true,
        tag: 'fp-' + '0'.repeat(64),
        target: targetId,
      },
      reason: /published a fingerprint under another tag/,
    },
    {
      label: 'target that is not reusable in its own record',
      member: fingerprintMember,
      record: { fingerprint, reuseEligible: false, tag, target: targetId },
      reason: /is reusable in the trusted inventory but not in its own/,
    },
    {
      label: 'reuse record of another schema',
      member: reuseMember,
      record: { adopted: false, digest: '', schemaVersion: 2, tag },
      reason: /published a reuse record of another schema/,
    },
    {
      label: 'adoption without a digest',
      member: reuseMember,
      record: { adopted: true, digest: '', schemaVersion: 1, tag },
      reason: /adopted an image without a digest/,
    },
  ]
  for (const fixture of cases) {
    await t.test(fixture.label, async () => {
      await assert.rejects(
        fixturePromotion({
          publication: publicationArtifacts({
            override: { [fixture.member]: JSON.stringify(fixture.record) },
          }),
        }),
        fixture.reason
      )
    })
  }
})

test('a publication must ship exactly one digest artifact per reusable target', async () => {
  const publication = publicationArtifacts()
  await assert.rejects(
    fixturePromotion({
      publication: {
        artifacts: publication.artifacts.filter(
          (artifact) => artifact.name !== 'build-digest-backend-docker-arm'
        ),
        archives: publication.archives,
      },
    }),
    /backend-docker-arm published 0 build-digest-backend-docker-arm artifacts/
  )
})

test('uses only trusted controller checkout and has no commit or PR commands', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../workflows/deploy-stg-promote.yml'),
    'utf8'
  )
  assert.match(workflow, /ref: \$\{\{ github\.workflow_sha \}\}/)
  assert.match(workflow, /STG_RELEASE_PROMOTION_ENABLED/)
  assert.match(workflow, /SOURCE_BRANCH:.*STG_SOURCE_BRANCH/)
  assert.match(workflow, /sourceBranch: process\.env\.SOURCE_BRANCH/)
  assert.match(workflow, /default: true/)
  assert.match(workflow, /^ {6}confirm_ref_update:$/m)
  assert.doesNotMatch(workflow, /^ {6}confirm:$/m)
  assert.match(workflow, /stg-release/)
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/)
  assert.doesNotMatch(workflow, /git commit|git push|gh pr/)
  assert.doesNotMatch(workflow, /promote-stg-writer/)
  assert.doesNotMatch(workflow, /ref: \$\{\{[^}]*head_sha/)
  assert.doesNotMatch(workflow, /actions\/cache@|actions\/download-artifact@/)
  assert.match(workflow, /actions\/upload-artifact@/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/)
  assert.match(workflow, /github-token: \$\{\{ github\.token \}\}/)
  assert.match(workflow, /gitToken: process\.env\.STG_PROMOTE_TOKEN/)
  assert.match(workflow, /secrets\.STG_PROMOTE_TOKEN/)
  assert.match(workflow, /^ {2}contents: read$/m)

  // The controller watches the one consolidated producer instead of the fifteen
  // per-image workflows it replaced.
  const stagingProducers = [...workflow.matchAll(/^ {6}- '(Build .+)'$/gm)].map(
    (match) => match[1]
  )
  assert.deepEqual(
    stagingProducers.sort(),
    STAGING_WORKFLOWS.map((entry) => entry.name).sort()
  )

  const permissions = [
    ...workflow
      .match(/\npermissions:\n((?: {2}[a-z-]+: (?:read|write)\n)+)/)[1]
      .matchAll(/^ {2}([a-z-]+): (read|write)$/gm),
  ].map((match) => match[1])
  assert.deepEqual([...new Set(permissions)].sort(), ['actions', 'contents'])

  const promoter = fs.readFileSync(
    `${__dirname}/stg-release-promoter.js`,
    'utf8'
  )
  assert.match(promoter, /--force-with-lease=/)
  assert.doesNotMatch(promoter, /['"]--force['"]|git commit|gh pr/)
  assert.doesNotMatch(promoter, /createRef|updateRef|pulls\.create/)
  assert.doesNotMatch(promoter, /getRepoVariable/)
})

test('does not use candidate files as executable workflow inputs', () => {
  const promoter = fs.readFileSync(
    `${__dirname}/stg-release-promoter.js`,
    'utf8'
  )
  assert.match(promoter, /getCandidateDefinitions/)
  assert.match(promoter, /ref: candidateSha/)
  assert.doesNotMatch(promoter, /require\([^)]*candidate/)
  assert.doesNotMatch(promoter, /eval\(|new Function\(/)
  // One consolidated workflow replaces the fifteen per-image files, and the
  // candidate tree never becomes an executable input: it is read as text and
  // validated structurally.
  assert.equal(STAGING_WORKFLOW_PATHS.length, 1)
  assert.equal(STAGING_WORKFLOWS.length, 1)
  assert.deepEqual(
    STAGING_WORKFLOW_PATHS,
    STAGING_WORKFLOWS.map((workflow) => workflow.path)
  )
  assert.deepEqual(STAGING_WORKFLOW_PATHS, [FIXTURE_WORKFLOW_PATH])
})

test('requires complete candidate CI before a release write', async (t) => {
  for (const conclusion of [
    'failure',
    'cancelled',
    'skipped',
    'neutral',
    null,
  ]) {
    const workflows = validWorkflows()
    const ciPath = REQUIRED_CI_WORKFLOWS[0].path
    const { github: base } = evidenceGithub({
      definitions: fixtureDefinitions(),
      workflows,
      jobs: successfulJobs(workflows),
      runs: {
        ...evidenceRuns(workflows),
        [ciPath]: [
          workflowRun({
            candidateSha: CANDIDATE_SHA,
            id: 500,
            path: ciPath,
            conclusion,
            status: conclusion === null ? 'in_progress' : 'completed',
          }),
        ],
      },
    })
    const refs = refGithub(CURRENT_SHA)
    const github = {
      ...base,
      rest: { ...base.rest, git: refs.github.rest.git },
    }
    await assert.rejects(
      runPromotion({
        getCiEvidence: fixtureCiEvidence,
        getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
        getScanAdmission: fixtureScanAdmission,
        github,
        context: reviewContext('workflow_dispatch', {
          sha: CANDIDATE_SHA,
          dry_run: false,
          confirm_ref_update: MANUAL_CONFIRMATION,
          expected_release_sha: CURRENT_SHA,
          expected_controller_sha: NEXT_SHA,
        }),
        controllerSha: NEXT_SHA,
        sourceBranch: 'v3',
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        maxAttempts: 1,
        getRegistryDigest: async () => {
          throw new Error('must not resolve images')
        },
        gitRunner: refs.gitRunner,
      }),
      /staging CI evidence is incomplete/
    )
    assert.equal(refs.current(), CURRENT_SHA)
  }
})

test('filters run identities before choosing newest evidence and rejects duplicate jobs', async () => {
  const workflows = validWorkflows()
  const runs = evidenceRuns(workflows)
  runs[workflows[0].path].push(
    workflowRun({
      candidateSha: CANDIDATE_SHA,
      id: 999,
      path: workflows[0].path,
      headBranch: 'v3-other',
    })
  )
  const jobs = successfulJobs(workflows)
  const { github } = evidenceGithub({ workflows, runs, jobs })
  const args = {
    github,
    context: reviewContext(),
    workflows,
    candidateSha: CANDIDATE_SHA,
    sourceBranch: 'v3',
    maxAttempts: 1,
  }
  assert.equal((await collectBuildEvidence(args)).valid, true)
  runs[workflows[0].path].push(
    workflowRun({
      candidateSha: CANDIDATE_SHA,
      id: 1000,
      path: workflows[0].path,
      status: 'queued',
      conclusion: null,
    })
  )
  assert.equal((await collectBuildEvidence(args)).valid, false)
  runs[workflows[0].path].pop()
  jobs[100].push({ ...jobs[100][0], id: 9999 })
  assert.match((await collectBuildEvidence(args)).reason, /ambiguous/)
})

test('rejects manual apply when controller or release changed after dry run', async () => {
  const workflows = validWorkflows()
  const { github: base } = evidenceGithub({
    definitions: fixtureDefinitions(),
    workflows,
    jobs: successfulJobs(workflows),
  })
  const refs = refGithub(CURRENT_SHA)
  const github = { ...base, rest: { ...base.rest, git: refs.github.rest.git } }
  const args = {
    github,
    controllerSha: NEXT_SHA,
    sourceBranch: 'v3',
    expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
    maxAttempts: 1,
    getRegistryDigest: async () => `sha256:${'4'.repeat(64)}`,
  }
  for (const [expectedController, expectedRelease, error] of [
    [CURRENT_SHA, CURRENT_SHA, /controller SHA changed/],
    [NEXT_SHA, CANDIDATE_SHA, /stg-release changed/],
    [undefined, CURRENT_SHA, /manual writes require expected/],
  ]) {
    await assert.rejects(
      runPromotion({
        getCiEvidence: fixtureCiEvidence,
        getCandidateTargetIds: async () => FIXTURE_TARGET_IDS,
        getScanAdmission: fixtureScanAdmission,
        ...args,
        context: reviewContext('workflow_dispatch', {
          sha: CANDIDATE_SHA,
          dry_run: false,
          confirm_ref_update: MANUAL_CONFIRMATION,
          expected_controller_sha: expectedController,
          expected_release_sha: expectedRelease,
        }),
      }),
      error
    )
    assert.equal(refs.current(), CURRENT_SHA)
  }
})

test('selection evidence binds identities and proves the selected suite result', async () => {
  const definition = REQUIRED_CI_WORKFLOWS.find((w) =>
    w.path.endsWith('/test-unit.yml')
  )
  const workflow = {
    path: definition.path,
    jobs: [{ name: 'test-unit-status' }],
    run: { id: 504, attempt: 1 },
    observedJobs: ['test-unit', 'filter'].map((name) => ({
      name,
      status: 'completed',
      conclusion: 'success',
    })),
  }
  const evidence = await fixtureCiEvidence({ run: workflow.run })
  const validate = (value) =>
    validateCiSelection(value, workflow, REPOSITORY, CANDIDATE_SHA, 'v3')
  assert.equal(validate(evidence), evidence)
  for (const mutate of [
    (e) => {
      e.event.name = 'pull_request'
    },
    (e) => {
      e.run.attempt = 2
    },
    (e) => {
      e.event.sha = CURRENT_SHA
    },
    (e) => {
      e.reuse = { duplicateRunId: 123 }
    },
    (e) => {
      e.selection.state = 'unknown'
    },
    (e) => {
      e.jobs[0].result = 'skipped'
    },
    (e) => {
      e.jobs[1].result = 'failure'
    },
    (e) => {
      e.jobs[0].name = 'test-unit-status'
    },
    (e) => {
      e.jobs[1].name = 'test-unit'
    },
    (e) => {
      e.jobs = []
    },
  ]) {
    const invalid = structuredClone(evidence)
    mutate(invalid)
    assert.throws(() => validate(invalid))
  }
  const noChange = structuredClone(evidence)
  noChange.selection = { state: 'no-change', reason: 'no-change' }
  noChange.jobs[0].result = 'skipped'
  workflow.observedJobs[0].conclusion = 'skipped'
  assert.throws(() => validate(noChange))
})

test('manual bootstrap explicitly binds an absent release', async () => {
  const result = await resolveInputs({
    context: reviewContext('workflow_dispatch', {
      sha: CANDIDATE_SHA,
      dry_run: false,
      confirm_ref_update: MANUAL_CONFIRMATION,
      expected_release_sha: 'absent',
      expected_controller_sha: NEXT_SHA,
    }),
    sourceBranch: 'v3',
  })
  assert.equal(result.expectedReleaseSha, 'absent')
  assert.equal(result.allowWrite, true)
})

test('default CI evidence reader decodes bounded archives and rejects ambiguous artifacts', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-artifact-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const expected = await fixtureCiEvidence({ run: { id: 504, attempt: 1 } })
  fs.writeFileSync(
    path.join(dir, 'required-ci-evidence.json'),
    JSON.stringify(expected)
  )
  execFileSync('zip', ['-q', 'evidence.zip', 'required-ci-evidence.json'], {
    cwd: dir,
  })
  const archive = fs.readFileSync(path.join(dir, 'evidence.zip'))
  const artifacts = [
    {
      id: 1,
      name: 'required-ci-evidence',
      expired: false,
      size_in_bytes: archive.length,
    },
  ]
  const github = {
    paginate: async () => artifacts,
    rest: {
      actions: {
        listWorkflowRunArtifacts: async () => {},
        downloadArtifact: async () => ({ data: archive }),
      },
    },
  }
  const args = { github, context: reviewContext(), run: { id: 504 } }
  assert.deepEqual(await readCiEvidence(args), expected)
  artifacts.push({ ...artifacts[0], id: 2 })
  await assert.rejects(readCiEvidence(args), /ambiguous/)
  artifacts.pop()
  artifacts[0].size_in_bytes = 1048577
  await assert.rejects(readCiEvidence(args), /ambiguous/)
})
