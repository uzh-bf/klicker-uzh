const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')
const {
  fingerprint,
  runnerMatches,
  findVerifiedRun,
  reportVerifiedRun,
  verifyPromotionReuse,
} = require('./ci-verified-reuse.cjs')
const { readArtifactJson } = require('./ci-equivalent-run.cjs')
const sha = (digit) => digit.repeat(40)
const repository = 'uzh-bf/klicker-uzh'
const success = { status: 'completed', conclusion: 'success' }
function fixture(push = false) {
  const control = sha('c'),
    head = sha('a'),
    base = sha('b'),
    merge = sha('d'),
    tree = sha('e'),
    squash = sha('f')
  const pull = {
    number: 42,
    state: push ? 'closed' : 'open',
    draft: false,
    head: { sha: head, ref: 'feature', repo: { full_name: repository } },
    base: { sha: base, ref: 'v3', repo: { full_name: repository } },
    merge_commit_sha: push ? squash : merge,
    ...(push ? { merged_at: '2026-10-21T09:00:00Z' } : {}),
  }
  const run = {
    id: 123,
    workflow_id: 321,
    run_attempt: 1,
    ...success,
    event: 'pull_request',
    head_sha: head,
    head_branch: 'feature',
    path: '.github/workflows/test-playwright.yml',
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    referenced_workflows: [
      {
        path: `${repository}/.github/workflows/public-pr-playwright-shards.yml@v3`,
        sha: control,
      },
    ],
    updated_at: '2026-10-21T08:00:00Z',
  }
  const plan = {
    schemaVersion: 1,
    mode: 'full',
    trustedRuntimeApps: ['auth'],
    candidateSpecs: ['one.spec.ts'],
    selectedSpecs: ['one.spec.ts'],
    profileAssignments: {},
    selectedProfiles: ['full'],
    shardCount: 8,
    shards: Array.from({ length: 8 }, (_, i) => ({ shardIndex: i + 1 })),
    headSha: head,
    baseSha: base,
  }
  const receipt = {
    schemaVersion: 2,
    repository,
    event: 'pull_request',
    runId: 123,
    runAttempt: 1,
    headSha: head,
    baseSha: base,
    testedSha: merge,
    treeSha: tree,
    controlSha: control,
    route: 'hosted',
    provider: 'github',
    runnerOs: 'Linux',
    runnerArch: 'X64',
    workers: '1',
  }
  const jobs = [
    {
      name: 'test-playwright-execution / build-and-compile-hosted',
      ...success,
      steps: [{ name: 'Upload tested source receipt', ...success }],
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      name: `test-playwright-execution / test-playwright-hosted (${i + 1}, 8)`,
      ...success,
    })),
  ]
  const commits = {
    [merge]: {
      sha: merge,
      parents: [{ sha: base }, { sha: head }],
      commit: { tree: { sha: tree } },
    },
    [squash]: {
      sha: squash,
      parents: [{ sha: base }],
      commit: { tree: { sha: tree } },
    },
  }
  const state = {
    pull,
    run,
    receipt,
    plan,
    jobs,
    commits,
    runs: [run],
    tree: {
      truncated: false,
      tree: [
        {
          path: '.github/scripts/unknown-transitive-helper.cjs',
          type: 'blob',
          mode: '100644',
          sha: sha('1'),
        },
      ],
    },
  }
  const github = {
    rest: {
      git: { getTree: async () => ({ data: state.tree }) },
      repos: {
        getContent: async () => ({ data: { type: 'file', sha: sha('2') } }),
        getCommit: async ({ ref }) => ({
          data:
            ref === control
              ? { sha: control, commit: { tree: { sha: sha('9') } } }
              : (commits[ref] ?? commits[push ? squash : merge]),
        }),
        listPullRequestsAssociatedWithCommit: async () => ({ data: [pull] }),
      },
      pulls: { get: async () => ({ data: pull }) },
      actions: {
        listWorkflowRuns: async () => ({
          data: { workflow_runs: state.runs, total_count: state.runs.length },
        }),
        getWorkflowRun: async ({ run_id }) => ({
          data: state.pushRun?.id === run_id ? state.pushRun : state.run,
        }),
        listJobsForWorkflowRunAttempt: async () => ({
          data: { jobs, total_count: jobs.length },
        }),
      },
    },
  }
  const context = {
    repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
    runId: 124,
    eventName: push ? 'push' : 'pull_request',
    sha: push ? squash : merge,
    ref: 'refs/heads/v3',
    payload: {
      action: 'ready_for_review',
      pull_request: structuredClone(pull),
    },
  }
  const options = {
    github,
    context,
    controlSha: control,
    plan: structuredClone(plan),
    route: 'hosted',
    workers: '1',
    enabled: true,
    now: Date.parse('2026-10-21T10:00:00Z'),
    readArtifact: async (_g, _r, run, name) =>
      name === 'ci-validation-receipt'
        ? receipt
        : state.pushRun?.id === run.id
          ? { ...plan, headSha: squash, baseSha: squash }
          : plan,
  }
  return { state, options }
}
test('draft-ready full proof binds exact tested merge and attempt', async () => {
  const { options } = fixture()
  const proof = await findVerifiedRun(options)
  assert.equal(proof.id, 123)
  assert.match(proof.url, /runs\/123\/attempts\/1$/)
})
test('squash and ordinary merges use API association and exact tree', async () => {
  for (const ordinary of [false, true]) {
    const { state, options } = fixture(true)
    if (ordinary)
      state.commits[options.context.sha].parents.push({
        sha: state.pull.head.sha,
      })
    assert.equal((await findVerifiedRun(options)).id, 123)
  }
})
for (const [name, mutate, reason] of [
  [
    'disabled rollout',
    (s, o) => {
      o.enabled = false
    },
    'reuse-disabled',
  ],
  [
    'reduced current plan',
    (s, o) => {
      o.plan.mode = 'selected'
    },
    'coverage-not-full',
  ],
  [
    'reduced previous plan',
    (s) => {
      s.plan.mode = 'selected'
    },
    'full-plan-changed',
  ],
  [
    'missing shard',
    (s) => {
      s.jobs.pop()
    },
    'actual-full-coverage-missing',
  ],
  [
    'duplicate shard',
    (s) => {
      s.jobs.push(s.jobs[1])
    },
    'actual-full-coverage-missing',
  ],
  [
    'skipped placeholder',
    (s) => {
      s.jobs[1].conclusion = 'skipped'
    },
    'actual-full-coverage-missing',
  ],
  [
    'running source',
    (s) => {
      s.run.status = 'in_progress'
    },
    'source-run-in-progress-success',
  ],
  [
    'failed source',
    (s) => {
      s.run.conclusion = 'failure'
    },
    'source-run-completed-failure',
  ],
  [
    'cancelled source',
    (s) => {
      s.run.conclusion = 'cancelled'
    },
    'source-run-completed-cancelled',
  ],
  [
    'expired source',
    (s) => {
      s.run.updated_at = '2026-01-01'
    },
    'source-run-expired',
  ],
  [
    'forged repository',
    (s) => {
      s.receipt.repository = 'attacker/repo'
    },
    'receipt-binding-invalid',
  ],
  [
    'forged attempt',
    (s) => {
      s.receipt.runAttempt = 2
    },
    'receipt-binding-invalid',
  ],
  [
    'legacy receipt',
    (s) => {
      s.receipt.schemaVersion = 1
    },
    'receipt-binding-invalid',
  ],
  [
    'changed source tree',
    (s) => {
      s.receipt.treeSha = sha('3')
    },
    'receipt-binding-invalid',
  ],
  [
    'changed head',
    (s) => {
      s.pull.head.sha = sha('4')
    },
    'pull-request-stale',
  ],
  [
    'changed base',
    (s) => {
      s.receipt.baseSha = sha('5')
    },
    'tested-merge-unproven',
  ],
  [
    'architecture mismatch',
    (s) => {
      s.receipt.runnerArch = 'ARM64'
    },
    'runner-or-environment-incompatible',
  ],
  [
    'route mismatch',
    (s) => {
      s.receipt.route = 'public-pr'
    },
    'runner-or-environment-incompatible',
  ],
  [
    'provider mismatch',
    (s) => {
      s.receipt.provider = 'warpbuild'
    },
    'runner-or-environment-incompatible',
  ],
  [
    'worker environment mismatch',
    (s) => {
      s.receipt.workers = '2'
    },
    'runner-or-environment-incompatible',
  ],
  [
    'missing trusted reference',
    (s) => {
      s.run.referenced_workflows = []
    },
    'trusted-workflow-binding-missing',
  ],
  [
    'forged caller',
    (s, o) => {
      let count = 0
      o.github.rest.repos.getContent = async () => ({
        data: { type: 'file', sha: sha(String(++count)) },
      })
    },
    'caller-workflow-untrusted',
  ],
  [
    'missing producer',
    (s) => {
      s.jobs[0].steps = []
    },
    'receipt-producer-missing',
  ],
  [
    'truncated closure',
    (s) => {
      s.tree.truncated = true
    },
    'control-tree-incomplete',
  ],
  [
    'control input change',
    (s, o) => {
      let count = 0
      o.github.rest.git.getTree = async () => ({
        data: {
          ...s.tree,
          tree: s.tree.tree.map((e) => ({ ...e, sha: sha(String(++count)) })),
        },
      })
    },
    'control-closure-changed',
  ],
  [
    'new attempt during proof',
    (s, o) => {
      let count = 0
      o.github.rest.actions.getWorkflowRun = async () => ({
        data: { ...s.run, run_attempt: ++count },
      })
    },
    'source-attempt-changed',
  ],
]) {
  test(`rejects ${name}`, async () => {
    const { state, options } = fixture()
    mutate(state, options)
    await assert.rejects(findVerifiedRun(options), new RegExp(reason))
  })
}
test('does not search past a newer failure for older success', async () => {
  const { state, options } = fixture()
  state.runs.unshift({ ...state.run, id: 125 })
  options.github.rest.actions.getWorkflowRun = async ({ run_id }) => ({
    data: {
      ...state.run,
      id: run_id,
      conclusion: run_id === 125 ? 'failure' : 'success',
    },
  })
  await assert.rejects(findVerifiedRun(options), /source-run-completed-failure/)
})
test('rejects squash without unique trusted PR association, stale branch and changed parent', async () => {
  for (const mode of ['association', 'tip', 'parent']) {
    const { state, options } = fixture(true)
    if (mode === 'association')
      options.github.rest.repos.listPullRequestsAssociatedWithCommit =
        async () => ({ data: [] })
    if (mode === 'tip') {
      const get = options.github.rest.repos.getCommit
      options.github.rest.repos.getCommit = async (args) =>
        args.ref.startsWith('refs/heads/')
          ? { data: { sha: sha('8') } }
          : get(args)
    }
    if (mode === 'parent')
      state.commits[options.context.sha].parents[0].sha = sha('8')
    await assert.rejects(
      findVerifiedRun(options),
      /merged-pr-association-ambiguous|push-no-longer-current|merge-base-changed/
    )
  }
})
test('control closure covers the complete materialized boundary and keeps candidate input separate', () => {
  const { state } = fixture()
  const original = fingerprint(state.tree)
  state.tree.tree.push({
    path: 'deploy/env-uzh-stg/values.yaml',
    mode: '100644',
    type: 'blob',
    sha: sha('4'),
  })
  assert.equal(fingerprint(state.tree), original)
  for (const file of [
    '.github/actions/new/action.yml',
    '.github/scripts/new-helper.cjs',
    '.github/toolchains/new/package-lock.json',
    'playwright/config.ts',
    '.github/unknown-config.json',
  ]) {
    const changed = structuredClone(state.tree)
    changed.tree.push({
      path: file,
      mode: '100644',
      type: 'blob',
      sha: sha('4'),
    })
    assert.notEqual(fingerprint(changed), original)
  }
  state.tree.tree.push({
    path: 'apps/chat/src/new.ts',
    mode: '100644',
    type: 'blob',
    sha: sha('4'),
  })
  assert.equal(fingerprint(state.tree), original)
  state.tree.tree[0].mode = '100755'
  assert.notEqual(fingerprint(state.tree), original)
})
test('runner policy never crosses architecture or silently accepts unknown routes', () => {
  assert.equal(
    runnerMatches(
      {
        route: 'public-pr',
        runnerOs: 'Linux',
        runnerArch: 'ARM64',
        workers: '1',
      },
      'hosted',
      '1'
    ),
    false
  )
  assert.equal(runnerMatches({}, 'unknown', '1'), false)
})
test('API scope errors fall back with a readable sanitized miss', async () => {
  const { options } = fixture()
  const messages = [],
    outputs = []
  options.github.rest.pulls.get = async () => {
    throw new Error('403 private response')
  }
  options.core = {
    info: (m) => messages.push(m),
    setOutput: (...args) => outputs.push(args),
  }
  assert.equal(await reportVerifiedRun(options), null)
  assert.deepEqual(outputs, [['duplicate_run_id', '']])
  assert.deepEqual(messages, [
    'CI reuse miss: evidence-unavailable; executing validation.',
  ])
})
test('immutable artifacts reject expiry, forgery, wrong source and ambiguity before extraction', async () => {
  for (const mode of ['expired', 'wrong-run', 'digest', 'ambiguous']) {
    const artifact = {
      id: 7,
      name: 'proof',
      size_in_bytes: 2,
      expired: mode === 'expired',
      digest: 'sha256:' + 'a'.repeat(64),
      workflow_run: { id: mode === 'wrong-run' ? 8 : 9, head_sha: sha('a') },
    }
    const artifacts = mode === 'ambiguous' ? [artifact, artifact] : [artifact]
    const github = {
      rest: {
        actions: {
          listWorkflowRunArtifacts: async () => ({
            data: { artifacts, total_count: artifacts.length },
          }),
          downloadArtifact: async () => ({ data: Buffer.from('{}') }),
        },
      },
    }
    await assert.rejects(
      readArtifactJson(
        github,
        {},
        { id: 9, head_sha: sha('a') },
        'proof',
        'proof.json',
        true
      ),
      /artifact|Artifact/
    )
  }
})
test('promotion independently reconstructs hosted squash proof and rejects forged push caller', async () => {
  const { state, options } = fixture(true)
  // Use the current clock for the production verifier's freshness policy.
  state.run.updated_at = new Date().toISOString()
  state.pushRun = {
    ...state.run,
    id: 124,
    event: 'push',
    head_sha: options.context.sha,
    head_branch: 'v3',
  }
  const args = {
    ...options,
    run: state.pushRun,
    candidateSha: options.context.sha,
    sourceBranch: 'v3',
  }
  assert.equal((await verifyPromotionReuse(args)).id, 123)
  const summaryRun = { ...state.pushRun }
  delete summaryRun.referenced_workflows
  assert.equal(
    (await verifyPromotionReuse({ ...args, run: summaryRun })).id,
    123
  )
  options.github.rest.repos.getContent = async ({ ref }) => ({
    data: {
      type: 'file',
      sha: ref === options.context.sha ? sha('9') : sha('2'),
    },
  })
  await assert.rejects(verifyPromotionReuse(args), /push-caller-untrusted/)
  await assert.rejects(
    verifyPromotionReuse({ ...args, enabled: false }),
    /promotion-reuse-disabled/
  )
})
test('workflow preserves readiness in-flight, pins execution inputs and defaults rollout off', () => {
  const root = path.join(__dirname, '..')
  const caller = YAML.parse(
    fs.readFileSync(path.join(root, 'workflows/test-playwright.yml'), 'utf8')
  )
  assert.equal(
    caller.jobs['test-playwright-execution'].concurrency['cancel-in-progress'],
    "${{ github.event.action != 'ready_for_review' }}"
  )
  const reusable = YAML.parse(
    fs.readFileSync(
      path.join(root, 'workflows/public-pr-playwright-shards.yml'),
      'utf8'
    )
  )
  const lookup = reusable.jobs.prepare.steps.find((s) => s.id === 'equivalent')
  assert.match(
    lookup.with.script,
    /enabled: process.env.CI_VERIFIED_REUSE_ENABLED === 'true'/
  )
  for (const [name, job] of Object.entries(reusable.jobs)) {
    if (job.container)
      assert.match(job.container.image, /@sha256:[a-f0-9]{64}$/)
    for (const service of Object.values(job.services ?? {}))
      assert.match(service.image, /@sha256:[a-f0-9]{64}$/)
    for (const step of job.steps)
      if (step.uses && !step.uses.startsWith('./'))
        assert.match(step.uses, /@[a-f0-9]{40}$/)
    if (
      name.startsWith('build-and-compile-') ||
      name.startsWith('test-playwright-')
    ) {
      const checkout = job.steps.find(
        (s) => s.name === 'Check out immutable execution actions'
      )
      assert.equal(checkout.with.ref, '${{ job.workflow_sha }}')
      assert.equal(checkout.with['sparse-checkout-cone-mode'], false)
      assert.equal(
        checkout.with['sparse-checkout'],
        '/.github/\n/playwright/\n/.devrouter.yml\n'
      )
    }
  }
})

test('promoter gate accepts only independently verified skipped shards', async (t) => {
  const { execFileSync } = require('node:child_process')
  const { createHash } = require('node:crypto')
  const os = require('node:os')
  const {
    collectBuildEvidence,
    REQUIRED_CI_WORKFLOWS,
  } = require('./stg-release-promoter.js')
  const before = {
    enabled: process.env.CI_VERIFIED_REUSE_ENABLED,
    control: process.env.TRUSTED_WORKFLOW_SHA,
  }
  t.after(() => {
    for (const [key, value] of [
      ['CI_VERIFIED_REUSE_ENABLED', before.enabled],
      ['TRUSTED_WORKFLOW_SHA', before.control],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  for (const mode of [
    'valid',
    'disabled',
    'forged',
    'missing',
    'failed',
    'architecture',
  ]) {
    const { state, options } = fixture(true)
    state.run.updated_at = new Date().toISOString()
    state.pushRun = {
      ...state.run,
      id: 124,
      event: 'push',
      head_sha: options.context.sha,
      head_branch: 'v3',
    }
    const policy = REQUIRED_CI_WORKFLOWS.find((w) =>
      w.path.endsWith('/test-playwright.yml')
    )
    const pushJobs = policy.jobs.map((j, i) => ({
      id: 800 + i,
      name: j.id,
      head_sha: options.context.sha,
      ...success,
      conclusion: i === 0 ? 'success' : 'skipped',
    }))
    const records = [
      [state.run, 'ci-validation-receipt', state.receipt],
      [state.run, 'playwright-execution-plan', state.plan],
      [
        state.pushRun,
        'playwright-execution-plan',
        {
          ...state.plan,
          headSha: options.context.sha,
          baseSha: options.context.sha,
        },
      ],
    ]
    if (mode === 'forged') state.receipt.runId = 666
    if (mode === 'failed') state.run.conclusion = 'failure'
    if (mode === 'architecture') state.receipt.runnerArch = 'ARM64'
    const archives = new Map(),
      artifacts = new Map()
    for (const [index, [run, name, data]] of records.entries()) {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'verified-ci-test-')
      )
      try {
        const filename = `${name}.json`
        fs.writeFileSync(path.join(directory, filename), JSON.stringify(data))
        execFileSync('zip', ['-q', 'artifact.zip', filename], {
          cwd: directory,
        })
        const archive = fs.readFileSync(path.join(directory, 'artifact.zip'))
        archives.set(index + 1, archive)
        const entries = artifacts.get(run.id) ?? []
        entries.push({
          id: index + 1,
          name,
          expired: false,
          size_in_bytes: archive.length,
          digest:
            'sha256:' + createHash('sha256').update(archive).digest('hex'),
          workflow_run: { id: run.id, head_sha: run.head_sha },
        })
        artifacts.set(run.id, entries)
      } finally {
        fs.rmSync(directory, { recursive: true, force: true })
      }
    }
    options.github.rest.actions.listWorkflowRuns = async ({ event }) => {
      const runs = event === 'push' ? [state.pushRun] : [state.run]
      return { data: { workflow_runs: runs, total_count: runs.length } }
    }
    options.github.rest.actions.listJobsForWorkflowRunAttempt = async ({
      run_id,
    }) => {
      const jobs = run_id === state.pushRun.id ? pushJobs : state.jobs
      return { data: { jobs, total_count: jobs.length } }
    }
    options.github.rest.actions.listWorkflowRunArtifacts = async ({
      run_id,
    }) => {
      const entries = mode === 'missing' ? [] : artifacts.get(run_id)
      return { data: { artifacts: entries, total_count: entries.length } }
    }
    options.github.rest.actions.downloadArtifact = async ({ artifact_id }) => ({
      data: archives.get(artifact_id),
    })
    options.github.paginate = async (endpoint, args) => {
      const { data } = await endpoint(args)
      return data.workflow_runs ?? data.jobs
    }
    process.env.CI_VERIFIED_REUSE_ENABLED =
      mode === 'disabled' ? 'false' : 'true'
    process.env.TRUSTED_WORKFLOW_SHA = options.controlSha
    const result = await collectBuildEvidence({
      github: options.github,
      context: options.context,
      workflows: [policy],
      candidateSha: options.context.sha,
      sourceBranch: 'v3',
      maxAttempts: 1,
    })
    assert.equal(result.valid, mode === 'valid', `${mode}: ${result.reason}`)
    if (mode === 'valid')
      assert.equal(result.workflows[0].validationReuse.id, 123)
    else assert.match(result.reason, /lack independently verified reuse/)
  }
})

test('readiness preserves an in-flight run and accepts it only after completion', async () => {
  const { state, options } = fixture()
  state.run.status = 'in_progress'
  await assert.rejects(
    findVerifiedRun(options),
    /source-run-in-progress-success/
  )
  state.run.status = 'completed'
  assert.equal((await findVerifiedRun(options)).id, state.run.id)
  const caller = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/test-playwright.yml'),
      'utf8'
    )
  )
  const expression = caller.jobs['test-playwright-execution'].concurrency[
    'cancel-in-progress'
  ].slice(3, -2)
  const cancel = new Function('github', `return (${expression})`)
  assert.equal(cancel({ event: { action: 'ready_for_review' } }), false)
  assert.equal(cancel({ event: { action: 'synchronize' } }), true)
  assert.deepEqual(caller.jobs['test-playwright-execution'].permissions, {
    contents: 'read',
    actions: 'read',
    'pull-requests': 'read',
    'id-token': 'write', // Existing trusted WarpBuild admission capability.
  })
})

test('full public ARM64 coverage reuses only within its own provider and route', async () => {
  const { state, options } = fixture()
  options.route = 'public-pr'
  state.receipt.route = 'public-pr'
  state.receipt.provider = 'public-pool'
  state.receipt.runnerArch = 'ARM64'
  for (const job of state.jobs)
    job.name = job.name.replaceAll('hosted', 'public-pr')
  assert.equal((await findVerifiedRun(options)).id, 123)
  state.receipt.provider = 'warpbuild'
  await assert.rejects(
    findVerifiedRun(options),
    /runner-or-environment-incompatible/
  )
})

test('application control changes outside the materialized boundary preserve proven squash equivalence', async () => {
  const { state, options } = fixture(true)
  const priorControl = options.controlSha
  const currentControl = sha('6')
  options.controlSha = currentControl
  const getCommit = options.github.rest.repos.getCommit
  options.github.rest.repos.getCommit = async (args) =>
    args.ref === currentControl
      ? { data: { sha: currentControl, commit: { tree: { sha: sha('7') } } } }
      : getCommit(args)
  options.github.rest.git.getTree = async ({ tree_sha }) => ({
    data: {
      ...state.tree,
      tree: [
        ...state.tree.tree,
        {
          path: 'apps/chat/src/application.ts',
          type: 'blob',
          mode: '100644',
          sha: tree_sha === sha('7') ? sha('1') : sha('2'),
        },
      ],
    },
  })
  assert.notEqual(priorControl, currentControl)
  assert.equal((await findVerifiedRun(options)).id, 123)
})
