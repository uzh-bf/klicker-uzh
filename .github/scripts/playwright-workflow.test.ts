import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import YAML from 'yaml'

import {
  EXPECTED_CALL,
  validateCallerLifecycle,
  validatePublicPlaywrightWorkflow,
} from './playwright-workflow.ts'

test('the current public workflow satisfies the runner trust boundary', () => {
  const root = path.join(import.meta.dirname, '../..')
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
  assert.match(sources[2], /packages\/feature-flags\/dist/)
  assert.match(sources[2], /packages\/knowledge-graph\/dist/)
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
      path.join(import.meta.dirname, '../..'),
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

test('lifecycle policy rejects cancellation outside the exact closed-PR boundary', () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, '../workflows/test-playwright.yml'),
    'utf8'
  )
  type MutableJob = {
    concurrency: { group?: string; 'cancel-in-progress'?: boolean } | string
    if?: string
    permissions?: Record<string, string>
    steps?: { uses?: string }[]
    'runs-on'?: string | string[]
    needs?: string
  }
  type MutableWorkflow = {
    jobs: Record<string, MutableJob>
    concurrency?: string
  }
  const mutations: Record<string, (w: MutableWorkflow) => void> = {
    'wrong close key': (w) => {
      ;(w.jobs['cancel-closed-pr'].concurrency as { group: string }).group =
        'other'
    },
    'wrong execution key': (w) => {
      ;(
        w.jobs['test-playwright-execution'].concurrency as { group: string }
      ).group = 'other'
    },
    'missing cancellation': (w) => {
      ;(
        w.jobs['cancel-closed-pr'].concurrency as {
          'cancel-in-progress': boolean
        }
      )['cancel-in-progress'] = false
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
    'execution on close': (w) => {
      delete w.jobs['test-playwright-execution'].if
    },
    'status on close': (w) => {
      w.jobs['test-playwright-status'].if = 'always()'
    },
    'telemetry on close': (w) => {
      w.jobs['playwright-queue-telemetry'].if = 'always()'
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

test('exact-base workflow fetch preserves a divergent PR merge-base', (t) => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(
        import.meta.dirname,
        '../workflows/public-pr-playwright-shards.yml'
      ),
      'utf8'
    )
  )
  const fetchStep = workflow.jobs.prepare.steps.find((step: { run?: string }) =>
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
  const git = (...args: string[]) =>
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
