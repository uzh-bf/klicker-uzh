const assert = require('node:assert/strict')
const test = require('node:test')
const {
  findEquivalentRun,
  reportEquivalentRun,
  coverageMatches,
  planMatches,
  listAll,
} = require('./ci-equivalent-run.cjs')

function fixture() {
  const pull = {
    number: 1,
    state: 'open',
    draft: false,
    head: {
      ref: 'v3-feature',
      sha: 'head',
      repo: { id: 1, full_name: 'uzh-bf/klicker-uzh' },
    },
    base: { sha: 'base', repo: { id: 1, full_name: 'uzh-bf/klicker-uzh' } },
  }
  const run = {
    id: 12,
    run_attempt: 2,
    workflow_id: 3,
    path: '.github/workflows/test-unit.yml',
    status: 'completed',
    conclusion: 'success',
    event: 'pull_request',
    head_branch: 'v3-feature',
    head_sha: 'head',
    repository: { full_name: 'uzh-bf/klicker-uzh' },
    head_repository: { full_name: 'uzh-bf/klicker-uzh' },
    pull_requests: [
      {
        number: 1,
        head: { sha: 'head', repo: { id: 1 } },
        base: { sha: 'base', repo: { id: 1 } },
      },
    ],
    html_url: 'https://github.com/uzh-bf/klicker-uzh/actions/runs/12',
  }
  const success = { status: 'completed', conclusion: 'success' }
  const jobs = [
    {
      name: 'test-unit',
      ...success,
      steps: [
        'Test Prisma disposable guard',
        'Test chat app',
        'Test frontend PWA',
        'Test grading package',
        'Test markdown package',
        'Test util package',
      ].map((name) => ({ name, ...success })),
    },
  ]
  const state = {
    pull,
    run,
    jobs,
    runs: [run],
    pulls: [pull],
    merge: {
      parents: [{ sha: 'base' }, { sha: 'head' }],
      commit: { tree: { sha: 'tree' } },
    },
  }
  const github = {
    rest: {
      pulls: {
        list: async () => ({ data: state.pulls }),
        get: async () => ({ data: state.freshPull ?? pull }),
      },
      repos: {
        getCommit: async ({ ref }) => ({
          data: ref.startsWith('refs/pull/')
            ? state.merge
            : { commit: { tree: { sha: 'tree' } } },
        }),
      },
      actions: {
        listWorkflowRuns: async () => ({
          data: { workflow_runs: state.runs, total_count: state.runs.length },
        }),
        getWorkflowRun: async () => ({ data: state.freshRun ?? run }),
        listJobsForWorkflowRunAttempt: async ({ attempt_number }) => {
          assert.equal(attempt_number, run.run_attempt)
          return { data: { jobs, total_count: jobs.length } }
        },
      },
    },
  }
  return {
    state,
    options: {
      github,
      context: {
        repo: { owner: 'uzh-bf', repo: 'klicker-uzh' },
        eventName: 'push',
        ref: 'refs/heads/v3-feature',
        sha: 'head',
      },
      kind: 'unit',
      readReceipt: async () => ({
        schemaVersion: 1,
        event: 'pull_request',
        runId: 12,
        runAttempt: 2,
        headSha: 'head',
        baseSha: 'base',
        treeSha: 'tree',
        controlSha: 'control',
      }),
    },
  }
}

test('reuses only actual successful latest-attempt unit coverage', async () => {
  const { options } = fixture()
  assert.equal((await findEquivalentRun(options)).id, 12)
})

for (const [name, change] of Object.entries({
  'default branch': (s, o) => {
    o.context.ref = 'refs/heads/v3'
  },
  'manual run': (s, o) => {
    o.context.eventName = 'workflow_dispatch'
  },
  'PR event': (s, o) => {
    o.context.eventName = 'pull_request'
  },
  'other repository': (s, o) => {
    o.context.repo.owner = 'other'
  },
  'standalone push': (s) => {
    s.pulls = []
  },
  'ambiguous PRs': (s) => {
    s.pulls.push(s.pull)
  },
  'draft PR': (s) => {
    s.pull.draft = true
  },
  'closed PR': (s) => {
    s.pull.state = 'closed'
  },
  'fork PR': (s) => {
    s.pull.head.repo.full_name = 'fork/repo'
  },
  'changed head': (s) => {
    s.pull.head.sha = 'new'
  },
  'changed base': (s) => {
    s.pull.base.sha = 'new'
  },
  'wrong workflow': (s) => {
    s.run.path = '.github/workflows/check.yml'
  },
  'failed run': (s) => {
    s.run.conclusion = 'failure'
  },
  'canceled run': (s) => {
    s.run.conclusion = 'cancelled'
  },
  'active rerun': (s) => {
    s.run.status = 'in_progress'
  },
  'newer failed attempt': (s) => {
    s.runs.push({ ...s.run, id: 13, conclusion: 'failure' })
    s.freshRun = s.runs[1]
  },
  'skipped test': (s) => {
    s.jobs[0].steps[0].conclusion = 'skipped'
  },
  'missing test step': (s) => {
    s.jobs[0].steps.pop()
  },
  'skipped job': (s) => {
    s.jobs[0].conclusion = 'skipped'
  },
  'different merge tree': (s) => {
    s.merge.commit.tree.sha = 'different'
  },
  'different merge base': (s) => {
    s.merge.parents[0].sha = 'old'
  },
  'wrong run PR': (s) => {
    s.run.pull_requests[0].number = 2
  },
  'wrong repository binding': (s) => {
    s.run.pull_requests[0].head.repo.id = 2
  },
  'PR closes during check': (s) => {
    s.freshPull = { ...s.pull, state: 'closed' }
  },
})) {
  test(`keeps validation for ${name}`, async () => {
    const { state, options } = fixture()
    change(state, options)
    assert.equal(await findEquivalentRun(options), null)
  })
}

test('API failures produce empty reuse output and normal validation', async () => {
  const { options } = fixture()
  options.github.rest.pulls.list = async () => {
    throw new Error('unavailable')
  }
  const outputs = {}
  options.core = {
    setOutput: (key, value) => {
      outputs[key] = value
    },
    info() {},
  }
  assert.equal(await reportEquivalentRun(options), null)
  assert.equal(outputs.duplicate_run_id, '')
})

test('pagination collects complete data and rejects incomplete evidence', async () => {
  const items = Array.from({ length: 101 }, (_, id) => ({ id }))
  assert.equal(
    (
      await listAll(
        async ({ page }) => ({
          data: {
            jobs: items.slice((page - 1) * 100, page * 100),
            total_count: 101,
          },
        }),
        'jobs'
      )
    ).length,
    101
  )
  await assert.rejects(
    listAll(async () => ({ data: { jobs: [], total_count: 2 } }), 'jobs'),
    /Incomplete/
  )
  await assert.rejects(
    listAll(async () => ({ data: Array(100).fill({}) })),
    /limit/
  )
})

function fullPlan() {
  return {
    schemaVersion: 1,
    mode: 'full',
    trustedRuntimeApps: ['app'],
    candidateSpecs: ['a'],
    selectedSpecs: ['a'],
    profileAssignments: { a: 'full' },
    selectedProfiles: ['full'],
    shardCount: 8,
    shards: Array.from({ length: 8 }, (_, i) => ({ shardIndex: i + 1 })),
  }
}

test('Playwright coverage rejects reduced, failed, duplicate and public shards', () => {
  const plan = fullPlan()
  const success = { status: 'completed', conclusion: 'success' }
  const jobs = [
    { name: 'execution / build-and-compile-hosted', ...success },
    ...Array.from({ length: 8 }, (_, i) => ({
      name: `execution / test-playwright-hosted (${i + 1}, 8)`,
      ...success,
    })),
  ]
  assert.equal(coverageMatches('playwright', jobs, plan), true)
  assert.equal(coverageMatches('playwright', jobs.slice(1), plan), false)
  assert.equal(
    coverageMatches('playwright', jobs, { ...plan, mode: 'selected' }),
    false
  )
  assert.equal(
    coverageMatches(
      'playwright',
      [...jobs, { name: 'execution / public-pr', ...success }],
      plan
    ),
    false
  )
  jobs[1].conclusion = 'skipped'
  assert.equal(coverageMatches('playwright', jobs, plan), false)
})

test('canonical plan comparison binds coverage and runtime assignments', () => {
  const plan = fullPlan()
  assert.equal(
    planMatches({ ...plan, baseSha: 'prior' }, { ...plan, baseSha: 'head' }),
    true
  )
  for (const key of [
    'schemaVersion',
    'candidateSpecs',
    'selectedSpecs',
    'profileAssignments',
    'selectedProfiles',
    'shards',
    'trustedRuntimeApps',
    'shardCount',
    'mode',
  ]) {
    assert.equal(planMatches({ ...plan, [key]: null }, plan), false, key)
  }
})

test('Playwright reuse binds the trusted control revision and prior full plan', async () => {
  const { state, options } = fixture()
  options.kind = 'playwright'
  options.controlSha = 'control'
  options.plan = fullPlan()
  options.readPlan = async () => ({
    ...fullPlan(),
    headSha: 'head',
    baseSha: 'base',
  })
  state.run.path = '.github/workflows/test-playwright.yml'
  state.run.referenced_workflows = [
    {
      path: 'uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@v3',
      sha: 'control',
    },
  ]
  state.jobs.splice(
    0,
    state.jobs.length,
    {
      name: 'execution / build-and-compile-hosted',
      status: 'completed',
      conclusion: 'success',
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      name: `execution / test-playwright-hosted (${i + 1}, 8)`,
      status: 'completed',
      conclusion: 'success',
    }))
  )
  assert.equal((await findEquivalentRun(options)).id, 12)
  state.run.referenced_workflows[0].sha = 'older-control'
  assert.equal(await findEquivalentRun(options), null)
  state.run.referenced_workflows[0].sha = 'control'
  options.readPlan = async () => ({
    ...fullPlan(),
    headSha: 'head',
    baseSha: 'old-base',
  })
  assert.equal(await findEquivalentRun(options), null)
  options.readPlan = async () => {
    throw new Error('expired artifact')
  }
  const outputs = {}
  options.core = {
    setOutput: (k, v) => {
      outputs[k] = v
    },
    info() {},
  }
  await reportEquivalentRun(options)
  assert.equal(outputs.duplicate_run_id, '')
})

test('a rerun started during proof invalidates an earlier success', async () => {
  const { state, options } = fixture()
  let reads = 0
  options.github.rest.actions.getWorkflowRun = async () => ({
    data:
      ++reads === 1
        ? structuredClone(state.run)
        : { ...state.run, run_attempt: 3, status: 'queued' },
  })
  assert.equal(await findEquivalentRun(options), null)
})

test('a newer PR workflow run appearing during proof invalidates reuse', async () => {
  const { state, options } = fixture()
  let reads = 0
  options.github.rest.actions.listWorkflowRuns = async () => ({
    data: {
      total_count: 1,
      workflow_runs: [
        ++reads === 1 ? state.run : { ...state.run, id: 13, status: 'queued' },
      ],
    },
  })
  assert.equal(await findEquivalentRun(options), null)
})

test('reuse wiring keeps execution tokens read-only and the canonical plan intact', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const YAML = require('yaml')
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/public-pr-playwright-shards.yml'),
      'utf8'
    )
  )
  assert.deepEqual(workflow.jobs.prepare.permissions, {
    contents: 'read',
    actions: 'read',
    'pull-requests': 'read',
  })
  assert.equal(
    workflow.jobs.prepare.outputs.should_run,
    '${{ steps.metadata.outputs.should_run }}'
  )
  assert.equal(
    workflow.jobs.prepare.outputs.duplicate_run_id,
    '${{ steps.equivalent.outputs.duplicate_run_id }}'
  )
  for (const name of [
    'build-and-compile-hosted',
    'build-and-compile-public-pr',
    'test-playwright-hosted',
    'test-playwright-public-pr',
  ]) {
    assert.deepEqual(workflow.jobs[name].permissions, { contents: 'read' })
    assert.ok(
      workflow.jobs[name].if.includes(
        "needs.prepare.outputs.duplicate_run_id == ''"
      )
    )
  }
  const units = YAML.parse(
    fs.readFileSync(path.join(__dirname, '../workflows/test-unit.yml'), 'utf8')
  )
  assert.equal(
    units.jobs['equivalent-validation'].if,
    "github.event_name == 'push' && github.ref != 'refs/heads/v3' && github.run_attempt > 1"
  )
  assert.equal(units.jobs['test-unit'].needs, 'equivalent-validation')
  assert.ok(units.jobs['test-unit'].if.includes('!cancelled()'))
  assert.ok(
    units.jobs['test-unit'].if.includes(
      "needs.equivalent-validation.outputs.duplicate_run_id == ''"
    )
  )
})

for (const field of [
  'treeSha',
  'headSha',
  'baseSha',
  'runId',
  'runAttempt',
  'event',
  'schemaVersion',
]) {
  test(`rejects a tested-source receipt with mismatched ${field}`, async () => {
    const { options } = fixture()
    const receipt = await options.readReceipt()
    options.readReceipt = async () => ({ ...receipt, [field]: 'mismatch' })
    assert.equal(await findEquivalentRun(options), null)
  })
}
