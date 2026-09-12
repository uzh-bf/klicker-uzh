const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const {
  EXPECTED_CALL,
  validateCallerLifecycle,
  validatePublicPlaywrightWorkflow,
} = require('./validate-public-playwright-workflow.cjs')

test('the current public workflow satisfies the runner trust boundary', () => {
  const root = path.join(__dirname, '../..')
  const result = validatePublicPlaywrightWorkflow(root)

  assert.equal(result.ok, true, result.issues.join('\n'))
  const sources = [
    fs.readFileSync(
      path.join(root, '.github/workflows/test-playwright.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/workflows/public-pr-playwright-shards.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/actions/playwright-build/action.yml'),
      'utf8'
    ),
    fs.readFileSync(
      path.join(root, '.github/actions/playwright-shard/action.yml'),
      'utf8'
    ),
  ]
  assert.ok(sources[0].includes(EXPECTED_CALL))
  assert.match(sources[1], /playwright-build@refs\/heads\/v3/)
  assert.match(sources[1], /playwright-shard@refs\/heads\/v3/)
  assert.match(sources[2], /repository: \$\{\{ job\.workflow_repository \}\}/)
  assert.match(sources[2], /ref: \$\{\{ job\.workflow_sha \}\}/)
  // The build artifact archives every workspace package through one wildcard,
  // so a new package like packages/audit/dist is covered without editing a list.
  assert.match(sources[2], /^\s+packages\/\*\/dist$/m)
  assert.doesNotMatch(sources[2], /packages\/[^/*\s]+\/dist/)
  assert.match(sources[3], /repository: \$\{\{ job\.workflow_repository \}\}/)
  assert.match(sources[3], /ref: \$\{\{ job\.workflow_sha \}\}/)

  const seedWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/playwright-cache-seed.yml'),
    'utf8'
  )
  assert.match(
    seedWorkflow,
    /git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/
  )
})

test('the reusable envelope owns lifecycle routing and selector shadow planning', () => {
  const workflow = fs.readFileSync(
    path.join(
      path.join(__dirname, '../..'),
      '.github/workflows/test-playwright.yml'
    ),
    'utf8'
  )

  const parsed = YAML.parse(workflow)
  assert.deepEqual(parsed.on.push.branches, ['v3', 'v3*'])
  assert.deepEqual(parsed.on.pull_request.types, [
    'opened',
    'synchronize',
    'reopened',
    'ready_for_review',
    'edited',
    'converted_to_draft',
    'closed',
  ])
  assert.match(workflow, /test-playwright-execution:/)
  assert.match(
    workflow,
    /uses: uzh-bf\/klicker-uzh\/.github\/workflows\/public-pr-playwright-shards\.yml@v3/
  )
  assert.doesNotMatch(workflow, /group: public-pr-arm64/)
  assert.match(workflow, /test-playwright-status:/)
})

test('lifecycle policy rejects cancellation outside the exact closed-PR boundary and any draft gate', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../workflows/test-playwright.yml'),
    'utf8'
  )
  const mutations = {
    'wrong close key': (w) => {
      w.jobs['cancel-closed-pr'].concurrency.group = 'other'
    },
    'wrong execution key': (w) => {
      w.jobs['test-playwright-execution'].concurrency.group = 'other'
    },
    'missing cancellation': (w) => {
      w.jobs['cancel-closed-pr'].concurrency['cancel-in-progress'] = false
    },
    'workflow concurrency': (w) => {
      w.concurrency = 'other'
    },
    'reporter concurrency': (w) => {
      w.jobs['test-playwright-status'].concurrency = 'other'
    },
    'missing close job': (w) => {
      delete w.jobs['cancel-closed-pr']
    },
    'missing close guard': (w) => {
      delete w.jobs['cancel-closed-pr'].if
    },
    'cancels on draft conversion': (w) => {
      w.jobs['cancel-closed-pr'].if =
        "github.event_name == 'pull_request' && (github.event.action == 'converted_to_draft' || github.event.action == 'closed')"
    },
    'execution gated on draft state': (w) => {
      w.jobs['test-playwright-execution'].if =
        "github.event_name != 'pull_request' || (github.event.action != 'closed' && github.event.pull_request.draft != true)"
    },
    'execution on close': (w) => {
      delete w.jobs['test-playwright-execution'].if
    },
    'status on close': (w) => {
      w.jobs['test-playwright-status'].if = 'always()'
    },
    'status without always wrapper': (w) => {
      w.jobs['test-playwright-status'].if =
        "(github.event_name != 'pull_request' || github.event.action != 'closed')"
    },
    'status gated on cancellation': (w) => {
      w.jobs['test-playwright-status'].if =
        "always() && !cancelled() && (github.event_name != 'pull_request' || github.event.action != 'closed')"
    },
    'telemetry missing cancellation guard': (w) => {
      w.jobs['test-playwright-status'].steps.find(
        (step) => step.id === 'queue_telemetry'
      ).if = "always() && needs.test-playwright-execution.result == 'failure'"
    },
    'telemetry not best effort': (w) => {
      delete w.jobs['test-playwright-status'].steps.find(
        (step) => step.id === 'queue_telemetry'
      )['continue-on-error']
    },
    'telemetry upload on cancellation': (w) => {
      w.jobs['test-playwright-status'].steps.find(
        (step) => step.name === 'Upload queue telemetry'
      ).if = 'always()'
    },
    'standalone telemetry job': (w) => {
      w.jobs['playwright-queue-telemetry'] = {
        if: 'always()',
      }
    },
    'missing converted_to_draft trigger': (w) => {
      w.on.pull_request.types = w.on.pull_request.types.filter(
        (type) => type !== 'converted_to_draft'
      )
    },
    'elevated token': (w) => {
      w.jobs['cancel-closed-pr'].permissions = { actions: 'write' }
    },
    'candidate checkout': (w) => {
      w.jobs['cancel-closed-pr'].steps = [{ uses: 'actions/checkout@v4' }]
    },
    'self-hosted runner': (w) => {
      w.jobs['cancel-closed-pr']['runs-on'] = ['self-hosted']
    },
    'waits for obsolete execution': (w) => {
      w.jobs['cancel-closed-pr'].needs = 'test-playwright-execution'
    },
  }
  for (const [name, mutate] of Object.entries(mutations)) {
    const workflow = YAML.parse(source)
    mutate(workflow)
    assert.notDeepEqual(validateCallerLifecycle(workflow), [], name)
  }
})

function readStatusScript() {
  const root = path.join(__dirname, '../..')
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(root, '.github/workflows/test-playwright.yml'),
      'utf8'
    )
  )
  return workflow.jobs['test-playwright-status'].steps.find(
    (step) => step.name === 'Check result'
  ).run
}

// Synthetic fixture using the buildPlanMetadata shardMatrix output schema.
function fullShardMatrix() {
  return {
    include: Array.from({ length: 8 }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: 8,
    })),
  }
}

function runStatusReporter(t, overrides = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'playwright-status-reporter-')
  )
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const summaryPath = path.join(directory, 'summary.md')
  const result = spawnSync(
    'bash',
    ['-euo', 'pipefail', '-c', readStatusScript()],
    {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        GITHUB_STEP_SUMMARY: summaryPath,
        EXECUTION_RESULT: 'success',
        ROUTE: 'public-pr',
        MODE: 'full',
        SHOULD_RUN: 'true',
        SHARD_MATRIX: JSON.stringify(fullShardMatrix()),
        IS_PULL_REQUEST: 'true',
        ...overrides,
      },
      encoding: 'utf8',
      timeout: 120_000,
    }
  )
  const metadataPath = path.join(directory, 'playwright-run-metadata.txt')
  return {
    ...result,
    output: `${result.stdout}${result.stderr}`,
    metadata: fs.existsSync(metadataPath)
      ? Object.fromEntries(
          fs
            .readFileSync(metadataPath, 'utf8')
            .trim()
            .split('\n')
            .map((line) => {
              const separator = line.indexOf('=')
              return [line.slice(0, separator), line.slice(separator + 1)]
            })
        )
      : {},
  }
}

test('status reporter accepts one full plan for drafts and ready and rejects anything less', (t) => {
  // A draft runs the same full plan as a ready pull request, so both pass.
  const draft = runStatusReporter(t, { IS_DRAFT: 'true' })
  assert.equal(draft.status, 0, draft.output)
  assert.equal(draft.metadata.execution_result, 'success')
  assert.equal(draft.metadata.mode, 'full')

  const ready = runStatusReporter(t)
  assert.equal(ready.status, 0, ready.output)
  assert.equal(ready.metadata.execution_result, 'success')
  assert.equal(ready.metadata.mode, 'full')
  assert.equal(ready.metadata.should_run, 'true')
  assert.deepEqual(JSON.parse(ready.metadata.shard_matrix), fullShardMatrix())

  const rejected = [
    {
      name: 'skipped ready execution',
      overrides: { EXECUTION_RESULT: 'skipped' },
    },
    {
      name: 'cancelled ready execution',
      overrides: { EXECUTION_RESULT: 'cancelled' },
    },
    {
      name: 'invalid route',
      overrides: { ROUTE: 'candidate' },
    },
    {
      name: 'non-full mode',
      overrides: { MODE: 'focused' },
    },
    {
      name: 'selection skipped',
      overrides: { SHOULD_RUN: 'false' },
    },
    {
      name: 'incomplete shard matrix',
      overrides: {
        SHARD_MATRIX: JSON.stringify({
          include: fullShardMatrix().include.slice(0, 4),
        }),
      },
    },
  ]
  for (const scenario of rejected) {
    const result = runStatusReporter(t, scenario.overrides)
    assert.equal(result.status, 1, scenario.name)
  }

  for (const [name, overrides] of [
    ['mode=selected', { MODE: 'selected' }],
    ['mode=skip', { MODE: 'skip' }],
    ['mode empty', { MODE: '' }],
    ['execution failure', { EXECUTION_RESULT: 'failure' }],
    ['execution cancelled', { EXECUTION_RESULT: 'cancelled' }],
    ['execution skipped', { EXECUTION_RESULT: 'skipped' }],
  ]) {
    assert.equal(runStatusReporter(t, overrides).status, 1, name)
  }
  const duplicate = fullShardMatrix()
  duplicate.include[7].shardIndex = 1
  const wrongTotal = fullShardMatrix()
  wrongTotal.include[7].shardTotal = 7
  for (const SHARD_MATRIX of [
    '',
    '{',
    '{}',
    'null',
    JSON.stringify(duplicate),
    JSON.stringify(wrongTotal),
    JSON.stringify({ shard: [1, 2, 3, 4, 5, 6, 7, 8] }),
    JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
    JSON.stringify({
      include: Array.from({ length: 8 }, (_, i) => ({ shard: i + 1 })),
    }),
  ]) {
    assert.equal(runStatusReporter(t, { SHARD_MATRIX }).status, 1, SHARD_MATRIX)
  }
  // A push must attest the same complete eight-shard plan, so the selector may
  // not skip it.
  const push = runStatusReporter(t, {
    IS_PULL_REQUEST: 'false',
    ROUTE: 'hosted',
    SHOULD_RUN: 'true',
  })
  assert.equal(push.status, 0, push.output)
  assert.equal(push.metadata.is_pull_request, 'false')
  assert.equal(push.metadata.execution_result, 'success')
  const pushSkippedSelection = runStatusReporter(t, {
    IS_PULL_REQUEST: 'false',
    ROUTE: 'hosted',
    SHOULD_RUN: 'false',
  })
  assert.equal(pushSkippedSelection.status, 1, pushSkippedSelection.output)
})

test('status reporter rejects every equivalent-run reuse', (t) => {
  // The reusable workflow pinned at @v3 can still offer a duplicate run id from
  // older code, so the caller rejects every push and pull request duplicate.
  const rejected = {
    'numeric push run id': {
      IS_PULL_REQUEST: 'false',
      ROUTE: 'hosted',
      DUPLICATE_RUN_ID: '123',
    },
    'non-numeric run id': {
      IS_PULL_REQUEST: 'false',
      ROUTE: 'hosted',
      DUPLICATE_RUN_ID: '123abc',
    },
    'pull request reuse': { DUPLICATE_RUN_ID: '123' },
  }
  for (const [name, overrides] of Object.entries(rejected)) {
    const result = runStatusReporter(t, overrides)
    assert.equal(result.status, 1, `${name}: ${result.output}`)
    assert.equal(result.metadata.duplicate_run_id, overrides.DUPLICATE_RUN_ID)
  }
})

test('missing policy files produce actionable validator issues', (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'public-playwright-policy-')
  )
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const result = validatePublicPlaywrightWorkflow(root)

  assert.equal(result.ok, false)
  assert.ok(
    result.issues.some((issue) =>
      issue.includes('.github/workflows/test-playwright.yml')
    )
  )
})

test('the build artifact must keep wildcard package coverage', (t) => {
  const repository = path.join(__dirname, '../..')
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'public-playwright-artifact-')
  )
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const file of [
    '.github/workflows/test-playwright.yml',
    '.github/workflows/public-pr-playwright-shards.yml',
    '.github/workflows/playwright-cache-seed.yml',
    '.github/actions/playwright-build/action.yml',
    '.github/actions/playwright-shard/action.yml',
  ]) {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(repository, file), target)
  }
  assert.equal(validatePublicPlaywrightWorkflow(root).ok, true)

  const actionPath = path.join(
    root,
    '.github/actions/playwright-build/action.yml'
  )
  // An explicit package list silently drops a package with its own build
  // output, so the wildcard must stay.
  fs.writeFileSync(
    actionPath,
    fs
      .readFileSync(actionPath, 'utf8')
      .replace('packages/*/dist', 'packages/feature-flags/dist')
  )
  const result = validatePublicPlaywrightWorkflow(root)
  assert.equal(result.ok, false)
  assert.ok(
    result.issues.some((issue) => issue.includes('packages/*/dist')),
    result.issues.join('\n')
  )
})

test('exact-base workflow fetch preserves a divergent PR merge-base', (t) => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../workflows/public-pr-playwright-shards.yml'),
      'utf8'
    )
  )
  const fetchStep = workflow.jobs.prepare.steps.find((step) =>
    step.run?.includes('git -C .candidate fetch')
  )
  const fetchCommand = fetchStep.run
    .match(/^\s*git -C \.candidate fetch .+$/m)[0]
    .trim()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-history-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )
  Object.assign(env, {
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  })
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '-q', '-b', 'base', 'source')
  git('-C', 'source', 'commit', '-q', '--allow-empty', '-m', 'root')
  const ancestor = git('-C', 'source', 'rev-parse', 'HEAD')
  git('-C', 'source', 'branch', 'candidate')
  git('-C', 'source', 'commit', '-q', '--allow-empty', '-m', 'base-advance')
  env.BASE_SHA = git('-C', 'source', 'rev-parse', 'HEAD')
  git('-C', 'source', 'checkout', '-q', 'candidate')
  git(
    '-C',
    'source',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'candidate-advance'
  )
  git('clone', '-q', `file://${root}/source`, '.candidate')
  git('-C', '.candidate', 'remote', 'add', 'base', `file://${root}/source`)
  execFileSync('bash', ['-euc', fetchCommand], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(
    git('-C', '.candidate', 'merge-base', env.BASE_SHA, 'HEAD'),
    ancestor
  )
})
