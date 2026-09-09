import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import {
  buildPlanMetadata,
  buildSelectionPlan,
  choosePlaywrightRoute,
  parseNameStatusZ,
  type RouteInput,
  selectFromChanges,
  selectPlaywrightPlan,
} from './playwright-plan.ts'

import { productionSpecs } from './playwright-shards.ts'

const repositoryRoot = path.join(import.meta.dirname, '../..')
const nativeNode = process.execPath
const localGitEnvironmentVariables = execFileSync(
  'git',
  ['-C', repositoryRoot, 'rev-parse', '--local-env-vars'],
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')

// Git exports repository-local variables to hooks. Clear them before any
// fixture command or selector call so temporary repositories stay isolated.
for (const variable of localGitEnvironmentVariables) {
  delete process.env[variable]
}

const relevanceManifest = JSON.parse(
  fs.readFileSync(
    path.join(repositoryRoot, 'playwright/relevance-manifest.json'),
    'utf8'
  )
)
const trustedCandidateSpecs = fs
  .readdirSync(path.join(repositoryRoot, 'playwright/tests'))
  .filter((file: string) => file.endsWith('.spec.ts'))
  .sort()

function fixtureManifest() {
  return {
    ...relevanceManifest,
    groups: [
      {
        id: 'manage',
        pathPrefixes: ['apps/frontend-manage/'],
        specs: ['A-login.spec.ts'],
      },
      { id: 'chat', pathPrefixes: ['apps/chat/'], specs: ['Y-chat.spec.ts'] },
    ],
  }
}

function change(kind: string, ...paths: string[]) {
  return { kind, status: kind, paths }
}

function gitAtWithEnvironment(
  root: string,
  inheritedEnvironment: NodeJS.ProcessEnv,
  ...args: string[]
): string {
  // Git exports repository-local variables to hooks. Fixture repositories must
  // not inherit them, or `git -C` can still mutate the parent repository.
  const env = Object.fromEntries(
    Object.entries(inheritedEnvironment).filter(
      ([key]) => !key.startsWith('GIT_')
    )
  )

  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function gitAt(root: string, ...args: string[]): string {
  return gitAtWithEnvironment(root, process.env, ...args)
}

function commitFixture(root: string, message: string): string {
  return gitAt(
    root,
    '-c',
    'user.email=ci@example.invalid',
    '-c',
    'user.name=CI fixture',
    'commit',
    '-q',
    '-m',
    message
  )
}

function createCandidate(): { root: string; baseSha: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-selector-'))
  fs.mkdirSync(path.join(root, 'playwright/tests'), { recursive: true })
  for (const spec of [
    'A-login.spec.ts',
    'B-catalyst-request.spec.ts',
    'B-feature-access.spec.ts',
    'C-control.spec.ts',
    'D-elements-content.spec.ts',
    'E-elements-flashcards.spec.ts',
    'F-elements-sc.spec.ts',
    'G-elements-mc.spec.ts',
  ]) {
    fs.writeFileSync(path.join(root, 'playwright/tests', spec), 'test base\n')
  }
  gitAt(root, 'init', '-q', '-b', 'main')
  gitAt(root, 'add', '.')
  commitFixture(root, 'base')
  const baseSha = gitAt(root, 'rev-parse', 'HEAD').trim()
  return { root, baseSha }
}

function snapshotTree(root: string): string[] {
  const paths: string[] = []

  const visit = (directory: string, prefix = '') => {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const relativePath = path.join(prefix, entry.name)
      paths.push(relativePath)
      if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), relativePath)
      }
    }
  }

  visit(root)
  return paths
}

function createCliFixture(): {
  root: string
  controlRoot: string
  candidateRoot: string
  baseSha: string
  headSha: string
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-plan-cli-'))
  const controlRoot = path.join(root, 'trusted-control')
  const candidateRoot = path.join(root, 'candidate-checkout')
  const scriptDirectory = path.join(controlRoot, '.github/scripts')
  const controlTestsDirectory = path.join(controlRoot, 'playwright/tests')
  const candidateTestsDirectory = path.join(candidateRoot, 'playwright/tests')

  fs.mkdirSync(scriptDirectory, { recursive: true })
  fs.mkdirSync(controlTestsDirectory, { recursive: true })
  fs.mkdirSync(candidateTestsDirectory, { recursive: true })
  for (const script of ['playwright-plan.ts', 'playwright-shards.ts']) {
    fs.copyFileSync(
      path.join(repositoryRoot, '.github/scripts', script),
      path.join(scriptDirectory, script)
    )
  }

  fs.writeFileSync(
    path.join(controlTestsDirectory, 'A-login.spec.ts'),
    'export {}\n'
  )
  fs.writeFileSync(
    path.join(controlRoot, '.devrouter.yml'),
    'profiles:\n  full:\n'
  )
  fs.writeFileSync(
    path.join(controlRoot, 'playwright/runtime-contract.yml'),
    'apps:\n    full:\n'
  )
  fs.writeFileSync(
    path.join(controlRoot, 'playwright/profiles.json'),
    `${JSON.stringify(
      {
        version: 1,
        groups: [{ profile: 'full', specs: ['A-login.spec.ts'] }],
      },
      null,
      2
    )}\n`
  )
  fs.writeFileSync(
    path.join(controlRoot, 'playwright/relevance-manifest.json'),
    `${JSON.stringify(
      {
        version: 1,
        groups: [
          {
            id: 'account',
            pathPrefixes: ['apps/account/'],
            specs: ['A-login.spec.ts'],
          },
        ],
        docsOnlyPathPrefixes: ['docs/'],
        docsOnlyExtensions: ['.md'],
        fullPathPrefixes: [],
        fullPathEquals: [],
        fullPathSuffixes: [],
      },
      null,
      2
    )}\n`
  )
  fs.writeFileSync(
    path.join(controlRoot, 'playwright/timings.json'),
    `${JSON.stringify(
      { version: 1, durations: [{ spec: 'A-login.spec.ts', duration: 1 }] },
      null,
      2
    )}\n`
  )

  fs.writeFileSync(
    path.join(candidateTestsDirectory, 'A-login.spec.ts'),
    'export {}\n'
  )
  gitAt(candidateRoot, 'init', '-q', '-b', 'main')
  gitAt(candidateRoot, 'add', '.')
  commitFixture(candidateRoot, 'base')
  const baseSha = gitAt(candidateRoot, 'rev-parse', 'HEAD').trim()
  fs.appendFileSync(path.join(candidateTestsDirectory, 'A-login.spec.ts'), '\n')
  gitAt(candidateRoot, 'add', '.')
  commitFixture(candidateRoot, 'head')
  const headSha = gitAt(candidateRoot, 'rev-parse', 'HEAD').trim()

  return { root, controlRoot, candidateRoot, baseSha, headSha }
}

test('fixture git commands ignore an inherited parent repository', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'selector-parent-'))
  const candidate = fs.mkdtempSync(path.join(os.tmpdir(), 'selector-child-'))

  try {
    gitAt(parent, 'init', '-q', '-b', 'main')
    gitAt(candidate, 'init', '-q', '-b', 'main')
    gitAtWithEnvironment(
      candidate,
      {
        ...process.env,
        GIT_DIR: path.join(parent, '.git'),
        GIT_WORK_TREE: parent,
      },
      'config',
      'test.fixtureScope',
      'candidate'
    )
    assert.equal(
      gitAt(candidate, 'config', '--get', 'test.fixtureScope').trim(),
      'candidate'
    )
    assert.throws(() => gitAt(parent, 'config', '--get', 'test.fixtureScope'))
  } finally {
    fs.rmSync(parent, { recursive: true, force: true })
    fs.rmSync(candidate, { recursive: true, force: true })
  }
})

test('parses rename-aware null-delimited diff records', () => {
  assert.deepEqual(
    parseNameStatusZ(
      'M\0docs/notes with spaces.md\0R100\0old.spec.ts\0new.spec.ts\0'
    ),
    [
      { kind: 'M', status: 'M', paths: ['docs/notes with spaces.md'] },
      { kind: 'R', status: 'R100', paths: ['old.spec.ts', 'new.spec.ts'] },
    ]
  )
})

test('selects a directly changed spec and assigns its trusted profile', () => {
  const plan = buildSelectionPlan({
    controlRoot: repositoryRoot,
    candidateSpecs: ['A-login.spec.ts', 'Y-chat.spec.ts'],
    changes: [change('M', 'playwright/tests/A-login.spec.ts')],
    baseSha: 'base',
    headSha: 'head',
    mergeBase: 'merge',
    prState: 'draft',
  })

  assert.equal(plan.mode, 'selected')
  assert.deepEqual(plan.selectedSpecs, ['tests/A-login.spec.ts'])
  assert.equal(plan.profileAssignments['tests/A-login.spec.ts'], 'chat,manage')
  assert.deepEqual(plan.selectedProfiles, ['chat,manage'])
  assert.equal(plan.shardCount, 1)
  assert.deepEqual(plan.shards[0].files, ['tests/A-login.spec.ts'])
})

test('maps known feature paths, skips documentation, and fails unknown paths closed', () => {
  const manifest = fixtureManifest()
  const base = {
    candidateSpecs: ['A-login.spec.ts', 'Y-chat.spec.ts'],
    manifest,
  }

  const feature = selectFromChanges({
    ...base,
    changes: [change('M', 'apps/chat/src/page.tsx')],
    prState: 'draft',
  })
  assert.equal(feature.mode, 'selected')
  assert.deepEqual(feature.selectedSpecs, ['Y-chat.spec.ts'])

  const docs = selectFromChanges({
    ...base,
    changes: [change('M', 'docs/ci.md')],
    prState: 'draft',
  })
  assert.equal(docs.mode, 'skip')
  assert.deepEqual(docs.selectedSpecs, [])

  const unknown = selectFromChanges({
    ...base,
    changes: [change('M', 'scripts/unmapped.sh')],
    prState: 'draft',
  })
  assert.equal(unknown.mode, 'full')
  assert.deepEqual(unknown.selectedSpecs, base.candidateSpecs)
  assert.ok(unknown.reasonCodes.includes('unknown-path'))

  const empty = selectFromChanges({
    ...base,
    changes: [],
    prState: 'draft',
  })
  assert.equal(empty.mode, 'full')
  assert.deepEqual(empty.selectedSpecs, base.candidateSpecs)
  assert.ok(empty.reasonCodes.includes('empty-diff'))
})

test('ready state overrides a documentation-only diff with the full candidate suite', () => {
  const plan = buildSelectionPlan({
    controlRoot: repositoryRoot,
    candidateSpecs: trustedCandidateSpecs,
    changes: [change('M', 'docs/ci.md')],
    baseSha: 'base',
    headSha: 'head',
    mergeBase: 'merge',
    prState: 'ready',
  })

  assert.equal(plan.mode, 'full')
  const production = productionSpecs(
    JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, 'playwright/profiles.json'),
        'utf8'
      )
    ),
    trustedCandidateSpecs
  )
  assert.deepEqual(
    plan.selectedSpecs,
    trustedCandidateSpecs
      .filter((spec: string) => !production.includes(spec))
      .map((spec: string) => `tests/${spec}`)
  )
  assert.equal(plan.shardCount, 8)
  assert.deepEqual(
    plan.shards.flatMap((shard: { files: string[] }) => shard.files).sort(),
    plan.selectedSpecs.slice().sort()
  )
  assert.ok(plan.reasonCodes.includes('ready-for-review'))
})

test('new and renamed specs receive the maximal trusted runtime profile', () => {
  const plan = buildSelectionPlan({
    controlRoot: repositoryRoot,
    candidateSpecs: ['new-flow.spec.ts'],
    changes: [
      change('R', 'tests/old-flow.ts', 'playwright/tests/new-flow.spec.ts'),
    ],
    baseSha: 'base',
    headSha: 'head',
    mergeBase: 'merge',
    prState: 'draft',
  })

  assert.equal(plan.mode, 'selected')
  assert.deepEqual(plan.selectedSpecs, ['tests/new-flow.spec.ts'])
  assert.equal(plan.shardCount, 1)
  assert.equal(plan.profileAssignments['tests/new-flow.spec.ts'], 'full')
})

test('spec deletion and malformed diff records fail closed to full mode', () => {
  const manifest = fixtureManifest()
  const deleted = selectFromChanges({
    candidateSpecs: ['A-login.spec.ts'],
    manifest,
    changes: [change('D', 'playwright/tests/A-login.spec.ts')],
    prState: 'draft',
  })
  assert.equal(deleted.mode, 'full')
  assert.ok(deleted.reasonCodes.includes('spec-deleted'))

  assert.throws(
    () => parseNameStatusZ('R100\0only-one-path\0'),
    /malformed diff path/
  )
})

test('uses the exact merge-base and diff range, with history failures falling back to full', () => {
  const { root, baseSha } = createCandidate()
  try {
    const empty = selectPlaywrightPlan({
      controlRoot: repositoryRoot,
      candidateRoot: root,
      baseSha,
      headSha: baseSha,
      prState: 'draft',
    })
    assert.equal(empty.mode, 'full')
    assert.deepEqual(empty.reasonCodes, ['empty-diff'])

    fs.writeFileSync(
      path.join(root, 'playwright/tests/A-login.spec.ts'),
      'test head\n'
    )
    gitAt(root, 'add', '.')
    commitFixture(root, 'head')
    const headSha = gitAt(root, 'rev-parse', 'HEAD').trim()

    const selected = selectPlaywrightPlan({
      controlRoot: repositoryRoot,
      candidateRoot: root,
      baseSha,
      headSha,
      prState: 'draft',
    })
    assert.equal(selected.mode, 'selected')
    assert.deepEqual(selected.selectedSpecs, ['tests/A-login.spec.ts'])
    assert.equal(selected.mergeBase, baseSha)

    const fallback = selectPlaywrightPlan({
      controlRoot: repositoryRoot,
      candidateRoot: root,
      baseSha: '0000000000000000000000000000000000000000',
      headSha,
      prState: 'draft',
    })
    assert.equal(fallback.mode, 'full')
    assert.deepEqual(fallback.reasonCodes, ['history-unavailable'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('the unified Node24 CLI uses trusted control and has no import side effect', () => {
  const { root, controlRoot, candidateRoot, baseSha, headSha } =
    createCliFixture()
  const outputRoot = path.join(root, 'outputs')
  const planOutput = path.join(outputRoot, 'plan.json')
  const routeOutput = path.join(outputRoot, 'route.json')
  const githubOutput = path.join(outputRoot, 'github-output')
  const planModule = path.join(
    controlRoot,
    '.github/scripts/playwright-plan.ts'
  )

  fs.mkdirSync(outputRoot)

  const environment: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )
  Object.assign(environment, {
    EVENT_NAME: 'pull_request',
    REPOSITORY: 'uzh-bf/klicker-uzh',
    REPOSITORY_PRIVATE: 'false',
    HEAD_REPOSITORY: 'uzh-bf/klicker-uzh',
    PR_AUTHOR: 'contributor',
    PR_DRAFT: 'true',
    PR_NUMBER: '1234',
    PUBLIC_ROLLOUT_ENABLED: 'true',
    SMART_DRAFT_CANARY_PR: '1234',
    ROUTE_HINT: 'auto',
  })

  try {
    assert.deepEqual(
      fs.readdirSync(path.join(controlRoot, '.github/scripts')).sort(),
      ['playwright-plan.ts', 'playwright-shards.ts']
    )
    assert.equal(fs.existsSync(path.join(controlRoot, 'node_modules')), false)

    execFileSync(
      nativeNode,
      [
        planModule,
        '--control-root',
        controlRoot,
        '--candidate-root',
        candidateRoot,
        '--base-sha',
        baseSha,
        '--head-sha',
        headSha,
        '--output',
        planOutput,
        '--route-output',
        routeOutput,
        '--github-output',
        githubOutput,
      ],
      { cwd: controlRoot, env: environment, encoding: 'utf8' }
    )

    const planText = fs.readFileSync(planOutput, 'utf8')
    const routeText = fs.readFileSync(routeOutput, 'utf8')
    const plan = JSON.parse(planText)
    const route = JSON.parse(routeText)
    assert.equal(planText, `${JSON.stringify(plan, null, 2)}\n`)
    assert.equal(routeText, `${JSON.stringify(route, null, 2)}\n`)
    assert.deepEqual(route, {
      schemaVersion: 1,
      route: 'public-pr',
      selectorPrState: 'draft',
      reasonCodes: ['public-pr-rollout', 'smart-draft-enabled'],
    })
    assert.equal(plan.mode, 'selected')
    assert.deepEqual(plan.selectedSpecs, ['tests/A-login.spec.ts'])
    assert.equal(plan.shardCount, 1)
    assert.deepEqual(plan.shards[0].files, ['tests/A-login.spec.ts'])
    assert.equal(
      fs.readFileSync(githubOutput, 'utf8'),
      [
        'route=public-pr',
        'mode=selected',
        'selector_pr_state=draft',
        'should_run=true',
        'shard_matrix={"include":[{"shardIndex":1,"shardTotal":1}]}',
        'reason_codes=spec-changed',
        '',
      ].join('\n')
    )

    const beforeImport = snapshotTree(root)
    execFileSync(
      nativeNode,
      [
        '--input-type=module',
        '-e',
        `import(${JSON.stringify(pathToFileURL(planModule).href)}).then(() => {}, (error) => { console.error(error); process.exitCode = 1 })`,
      ],
      { cwd: controlRoot, env: environment, encoding: 'utf8' }
    )
    assert.deepEqual(snapshotTree(root), beforeImport)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function pullRequest(overrides: Partial<RouteInput> = {}): RouteInput {
  return {
    eventName: 'pull_request',
    repository: 'uzh-bf/klicker-uzh',
    repositoryPrivate: 'false',
    headRepository: 'uzh-bf/klicker-uzh',
    prAuthor: 'contributor',
    prDraft: 'false',
    pullRequestNumber: '1234',
    publicRolloutEnabled: 'true',
    publicRolloutCanaryPr: '',
    smartDraftEnabled: '',
    smartDraftCanaryPr: '',
    forceHostedCanaryPr: '',
    ...overrides,
  }
}

test('pushes always use a hosted full plan', () => {
  assert.deepEqual(choosePlaywrightRoute({ eventName: 'push' }), {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['push'],
  })
})

test('ready same-repository public PRs use the public route when enabled', () => {
  const route = choosePlaywrightRoute(pullRequest())
  assert.equal(route.route, 'public-pr')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('public-pr-rollout'))
})

test('ready same-repository public PRs fall back to hosted when rollout is off', () => {
  const route = choosePlaywrightRoute(pullRequest({ publicRolloutEnabled: '' }))
  assert.deepEqual(route, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['hosted-fallback'],
  })
})

test('smart draft canary enables selection without changing the full default', () => {
  const disabled = choosePlaywrightRoute(
    pullRequest({ prDraft: 'true', publicRolloutEnabled: 'true' })
  )
  assert.deepEqual(disabled, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['hosted-fallback', 'smart-draft-disabled'],
  })

  const enabled = choosePlaywrightRoute(
    pullRequest({ prDraft: 'true', smartDraftCanaryPr: '1234' })
  )
  assert.equal(enabled.route, 'public-pr')
  assert.equal(enabled.selectorPrState, 'draft')
  assert.ok(enabled.reasonCodes.includes('smart-draft-enabled'))
})

test('smart drafts fall back to hosted selection when public rollout is disabled', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      prDraft: 'true',
      publicRolloutEnabled: '',
      smartDraftEnabled: 'true',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'draft')
  assert.ok(route.reasonCodes.includes('hosted-fallback'))
})

test('false, malformed, and non-matching controls keep drafts hosted and full', () => {
  for (const overrides of [
    { smartDraftEnabled: 'false' },
    { smartDraftEnabled: 'enabled' },
    { smartDraftCanaryPr: '9999' },
  ]) {
    const route = choosePlaywrightRoute(
      pullRequest({ prDraft: 'true', ...overrides })
    )
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
    assert.ok(route.reasonCodes.includes('smart-draft-disabled'))
  }
})

test('forks, bots, and private repositories remain hosted and full', () => {
  for (const overrides of [
    { headRepository: 'external/example' },
    { prAuthor: 'dependabot[bot]' },
    { repositoryPrivate: 'true' },
  ]) {
    const route = choosePlaywrightRoute(pullRequest(overrides))
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
  }
})

test('ineligible smart-draft requests report the eligibility reason, not disabled smart drafts', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      headRepository: 'external/example',
      smartDraftEnabled: 'true',
      prDraft: 'true',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('fork'))
  assert.ok(!route.reasonCodes.includes('smart-draft-disabled'))
})

test('missing identity fields fail closed to hosted full execution', () => {
  for (const overrides of [
    { repository: undefined },
    { headRepository: undefined },
    { prAuthor: undefined },
    { pullRequestNumber: undefined },
  ]) {
    const route = choosePlaywrightRoute(pullRequest(overrides))
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
  }
})

test('the exact force-hosted canary overrides public execution', () => {
  const route = choosePlaywrightRoute(
    pullRequest({ forceHostedCanaryPr: '1234' })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('force-hosted-canary'))
})

test('a non-matching force-hosted canary does not override public execution', () => {
  const route = choosePlaywrightRoute(
    pullRequest({ forceHostedCanaryPr: '9999' })
  )
  assert.equal(route.route, 'public-pr')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(!route.reasonCodes.includes('force-hosted-canary'))
})

test('the force-hosted canary rolls a selected draft back to hosted execution', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      prDraft: 'true',
      smartDraftEnabled: 'true',
      forceHostedCanaryPr: '1234',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'draft')
  assert.ok(route.reasonCodes.includes('force-hosted-canary'))
  assert.ok(route.reasonCodes.includes('hosted-fallback'))
})

test('inconsistent caller route hints are rejected', () => {
  assert.throws(
    () => choosePlaywrightRoute(pullRequest({ requestedRoute: 'public-pr' })),
    /unsupported requested route/
  )
})

test('empty route hints use the automatic route', () => {
  for (const requestedRoute of ['', '   ']) {
    const route = choosePlaywrightRoute(pullRequest({ requestedRoute }))
    assert.equal(route.route, 'public-pr')
  }
})

function plan(
  mode: 'skip' | 'selected' | 'full',
  shardCount = mode === 'skip' ? 0 : 1
) {
  return {
    schemaVersion: 1,
    mode,
    shardCount,
    reasonCodes: [] as string[],
    shards: Array.from({ length: shardCount }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: shardCount,
      files: [`tests/spec-${index}.spec.ts`],
    })),
  }
}

test('metadata exposes one matrix for selected plans and no matrix for skips', () => {
  const selected = buildPlanMetadata(plan('selected', 2), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(selected.shouldRun, true)
  assert.deepEqual(selected.shardMatrix, {
    include: [
      { shardIndex: 1, shardTotal: 2 },
      { shardIndex: 2, shardTotal: 2 },
    ],
  })

  const skipped = buildPlanMetadata(plan('skip'), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(skipped.shouldRun, false)
  assert.deepEqual(skipped.shardMatrix, { include: [] })
})

test('ready execution fails closed unless the plan is full', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('selected'), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /ready execution must use the full/
  )
})

test('ready execution fails closed unless the full plan has eight shards', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('full', 4), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /exactly eight/
  )
})

test('valid full ready execution exposes all eight matrix entries', () => {
  const metadata = buildPlanMetadata(plan('full', 8), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })

  assert.equal(metadata.shouldRun, true)
  assert.equal(metadata.shardMatrix.include.length, 8)
  assert.deepEqual(
    metadata.shardMatrix.include,
    Array.from({ length: 8 }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: 8,
    }))
  )
})

test('invalid shard metadata fails closed', () => {
  const invalid = plan('full', 8)
  invalid.shards[0].files = []
  assert.throws(
    () =>
      buildPlanMetadata(invalid, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /invalid shard/
  )
})

test('duplicate shard indices and unsafe reason codes fail closed', () => {
  const duplicate = plan('full', 8)
  duplicate.shards[1].shardIndex = 1
  assert.throws(
    () =>
      buildPlanMetadata(duplicate, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /duplicate shard indices/
  )

  const unsafeReason = plan('selected', 1)
  unsafeReason.reasonCodes = ['ok\nforged=value']
  assert.throws(
    () =>
      buildPlanMetadata(unsafeReason, {
        route: 'hosted',
        selectorPrState: 'draft',
      }),
    /reason codes/
  )
})
