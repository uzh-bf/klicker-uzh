const assert = require('node:assert/strict')
const childProcess = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  buildSelectionPlan,
  parseNameStatusZ,
  selectFromChanges,
  selectPlaywrightPlan,
} = require('./playwright-selector.cjs')

const repositoryRoot = path.join(__dirname, '../..')
const relevanceManifest = JSON.parse(
  fs.readFileSync(
    path.join(repositoryRoot, 'playwright/relevance-manifest.json'),
    'utf8'
  )
)
const trustedCandidateSpecs = fs
  .readdirSync(path.join(repositoryRoot, 'playwright/tests'))
  .filter((file) => file.endsWith('.spec.ts'))
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

function change(kind, ...paths) {
  return { kind, status: kind, paths }
}

function gitAt(root, ...args) {
  // Git exports repository-local variables to hooks. Fixture repositories must
  // not inherit them, or `git -C` can still mutate the parent repository.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  )

  return childProcess.execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function commitFixture(root, message) {
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

function createCandidate() {
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
  assert.deepEqual(
    plan.selectedSpecs,
    trustedCandidateSpecs.map((spec) => `tests/${spec}`)
  )
  assert.equal(plan.shardCount, 8)
  assert.deepEqual(
    plan.shards.flatMap((shard) => shard.files).sort(),
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
