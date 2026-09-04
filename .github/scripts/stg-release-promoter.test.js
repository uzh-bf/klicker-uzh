const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  FIXTURE_STAGING_WORKFLOWS,
  fixtureDefinitions,
  workflowJobs,
  workflowRun,
} = require('./stg-release-promoter-fixtures')
const {
  MANUAL_CONFIRMATION,
  PROMOTION_REF,
  STAGING_WORKFLOWS,
  STAGING_WORKFLOW_PATHS,
  checksumReceipt,
  collectBuildEvidence,
  compareAndSwapReleaseRef,
  fetchRegistryDigest,
  planReleaseRef,
  pushReleaseRefWithLease,
  resolveStableRegistryDigests,
  runPromotion,
  validateCandidateAncestry,
  validateStagingWorkflows,
} = require('./stg-release-promoter')

const REPOSITORY = 'uzh-bf/klicker-uzh'
const CANDIDATE_SHA = 'a'.repeat(40)
const CURRENT_SHA = 'b'.repeat(40)
const NEXT_SHA = 'c'.repeat(40)

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

function validWorkflows() {
  return validateStagingWorkflows({
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
}) {
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
        listJobsForWorkflowRun: jobEndpoint,
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
      return response.data.workflow_runs ?? response.data.jobs ?? []
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
          includeMigrator: workflow.jobs.some(
            (job) => job.id === 'build-migrator-arm'
          ),
          path: workflow.path,
        }),
      ]
    })
  )
}

function refGithub(initialSha = null, { afterUpdateSha } = {}) {
  let currentSha = initialSha
  const calls = []
  const github = {
    calls,
    rest: {
      git: {
        getRef: async (params) => {
          calls.push({ method: 'getRef', params })
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

test('validates the candidate workflow set and only inventories active ARM publishers', () => {
  const workflows = validWorkflows()
  assert.deepEqual(
    workflows.map((workflow) => workflow.jobs.map((job) => job.id)),
    [['build-arm'], ['build-arm', 'build-migrator-arm'], ['build-arm']]
  )
  assert.equal(
    workflows.some((workflow) =>
      workflow.jobs.some((job) => job.id === 'build-amd')
    ),
    false
  )
  assert.equal(
    workflows.every((workflow) => workflow.name.endsWith('(stg)')),
    true
  )
})

test('rejects unsafe workflow publication changes', () => {
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: fixtureDefinitions({ pushBranches: ["'v3'"] }),
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /approved push triggers/
  )

  const filteredPush = fixtureDefinitions()
  filteredPush[0].content = filteredPush[0].content.replace(
    "      - 'v3*'\n  pull_request:",
    "      - 'v3*'\n    paths:\n      - 'apps/auth/**'\n  pull_request:"
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: filteredPush,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /approved push triggers/
  )

  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: fixtureDefinitions({ fullShaTag: false }),
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /full source SHA tag/
  )

  const prefixedSha = fixtureDefinitions()
  prefixedSha[0].content = prefixedSha[0].content.replace(
    'type=raw,value=${{ github.sha }}',
    'type=sha,format=long'
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: prefixedSha,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /full source SHA tag/
  )

  const definitions = fixtureDefinitions()
  definitions[0].content = definitions[0].content.replace(
    'if: ${{ false }}',
    'if: github.event.pull_request.draft == false'
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /must remain disabled/
  )

  const misleadingDisabledStep = fixtureDefinitions()
  misleadingDisabledStep[0].content = misleadingDisabledStep[0].content
    .replace(
      '  build-amd:\n    if: ${{ false }}',
      "  build-amd:\n    if: github.event_name != 'pull_request'"
    )
    .replace(
      '      - uses: docker/metadata-action@v4\n',
      '      - if: ${{ false }}\n        uses: docker/metadata-action@v4\n'
    )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: misleadingDisabledStep,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /must remain disabled/
  )

  const fakePublisherText = fixtureDefinitions()
  fakePublisherText[0].content = fakePublisherText[0].content.replace(
    `      - uses: docker/build-push-action@v5
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}`,
    `      - name: Fake publisher text
        run: |
          uses: docker/build-push-action@v5
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}`
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: fakePublisherText,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /must use exactly one docker\/build-push-action/
  )

  const renamed = fixtureDefinitions()
  renamed[0].content = renamed[0].content.replace(
    'Build Docker image for auth (stg)',
    'Build Docker image for renamed-auth (stg)'
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: renamed,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /trusted workflow name/
  )

  const retargeted = fixtureDefinitions()
  retargeted[0].content = retargeted[0].content.replace(
    '${{ github.repository }}/auth',
    '${{ github.repository }}/other-auth'
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: retargeted,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /runtime image inventory changed/
  )

  const noMigrator = fixtureDefinitions()
  noMigrator[1].content = noMigrator[1].content.replace(
    /^  build-migrator-arm:[\s\S]*?(?=^  build-migrator-amd:)/m,
    ''
  )
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: noMigrator,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /active ARM job inventory changed/
  )

  const extraPublisher = fixtureDefinitions()
  extraPublisher[0].content += `  publish-extra:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
`
  assert.throws(
    () =>
      validateStagingWorkflows({
        definitions: extraPublisher,
        expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
        repository: REPOSITORY,
        sourceBranch: 'v3',
      }),
    /unexpected active image publisher/
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
    jobState: { 'build-arm': { status: 'in_progress' } },
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
  assert.match(runningResult.reason, /build-arm is running/)

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
      jobState: { 'build-arm': jobState },
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
  const digest = `sha256:${'5'.repeat(64)}`
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
    {
      headers: new Headers({ 'docker-content-digest': digest }),
      ok: true,
      status: 200,
    },
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

test('uses an exact remote lease for create and prevalidated fast-forward updates', async () => {
  const context = reviewContext()
  const create = refGithub()
  assert.equal(
    await compareAndSwapReleaseRef({
      github: create.github,
      context,
      expectedSha: null,
      candidateSha: CANDIDATE_SHA,
      gitRunner: create.gitRunner,
      gitToken: 'fixture-token',
    }),
    CANDIDATE_SHA
  )
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
  await assert.rejects(
    compareAndSwapReleaseRef({
      github: raced.github,
      context,
      expectedSha: CURRENT_SHA,
      candidateSha: NEXT_SHA,
      gitRunner: raced.gitRunner,
      gitToken: 'fixture-token',
    }),
    /changed during the compare-and-swap/
  )

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

test('exercises create, fast-forward, and race rejection against a bare remote', (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'stg-release-cas-')
  )
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }))

  const remote = path.join(temporaryDirectory, 'remote.git')
  const client = path.join(temporaryDirectory, 'client')
  execFileSync('git', ['init', '--bare', '--quiet', remote])
  execFileSync('git', ['init', '--quiet', client])
  const fixtureEnvironment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
  }
  const makeCommit = (label, parent = null) => {
    const blob = execFileSync(
      'git',
      ['--git-dir', remote, 'hash-object', '-w', '--stdin'],
      { encoding: 'utf8', input: `${label}\n` }
    ).trim()
    const tree = execFileSync('git', ['--git-dir', remote, 'mktree'], {
      encoding: 'utf8',
      input: `100644 blob ${blob}\tfixture.txt\n`,
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
      github: rerunGithub,
      context: reviewContext('workflow_dispatch', {
        confirm: MANUAL_CONFIRMATION,
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
    assert.equal(
      rerunRefs.calls.some((call) => call.method === 'updateRef'),
      false
    )

    const automatic = await runPromotion({
      github,
      context: reviewContext('workflow_run'),
      sourceBranch: 'v3',
      promotionEnabled: 'false',
    })
    assert.equal(automatic.decision, 'disabled')
    assert.equal(refs.current(), null)

    const enabled = await runPromotion({
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
    assert.equal(refs.current(), CANDIDATE_SHA)
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  }

  await assert.rejects(
    runPromotion({
      github,
      context: reviewContext('workflow_dispatch', {
        confirm: 'wrong',
        dry_run: false,
        sha: CANDIDATE_SHA,
      }),
      sourceBranch: 'v3',
      candidateSha: CANDIDATE_SHA,
      expectedWorkflows: FIXTURE_STAGING_WORKFLOWS,
    }),
    new RegExp(`exact confirmation ${MANUAL_CONFIRMATION}`)
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
  assert.match(workflow, /confirm/)
  assert.match(workflow, /stg-release/)
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/)
  assert.doesNotMatch(workflow, /STG_PROMOTE_TOKEN|git commit|git push|gh pr/)
  assert.doesNotMatch(workflow, /promote-stg-writer/)
  assert.doesNotMatch(workflow, /ref: \$\{\{[^}]*head_sha/)
  assert.doesNotMatch(workflow, /actions\/cache@|actions\/download-artifact@/)
  assert.match(workflow, /actions\/upload-artifact@/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/)

  const workflowRunNames = [
    ...workflow.matchAll(/^      - '([^']+ \(stg\))'$/gm),
  ].map((match) => match[1])
  assert.deepEqual(
    workflowRunNames.sort(),
    STAGING_WORKFLOWS.map((entry) => entry.name).sort()
  )

  const permissions = [
    ...workflow
      .match(/\npermissions:\n((?:  [a-z-]+: (?:read|write)\n)+)/)[1]
      .matchAll(/^  ([a-z-]+): (read|write)$/gm),
  ].map((match) => match[1])
  assert.deepEqual([...new Set(permissions)].sort(), ['actions', 'contents'])

  const promoter = fs.readFileSync(
    `${__dirname}/stg-release-promoter.js`,
    'utf8'
  )
  assert.match(promoter, /--force-with-lease=/)
  assert.doesNotMatch(promoter, /['"]--force['"]|git commit|gh pr/)
  assert.doesNotMatch(promoter, /createRef|updateRef|pulls\.create/)
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
  assert.equal(STAGING_WORKFLOW_PATHS.length, 15)
  assert.equal(STAGING_WORKFLOWS.length, 15)
  assert.deepEqual(
    STAGING_WORKFLOW_PATHS,
    STAGING_WORKFLOWS.map((workflow) => workflow.path)
  )
})
