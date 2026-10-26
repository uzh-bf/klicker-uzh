const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  CHANGE_CLASS,
  DECISION,
  ENVELOPE,
  REASON,
  classifyPaths,
  classifyRecords,
  decisionsFor,
  emit,
  isKnownClass,
  isSafeRepoPath,
  main,
  parsePathList,
  parseNameStatusRecords,
} = require('./minimum-validation-class.cjs')

function modified(...paths) {
  return paths.map((changedPath) => ({ kind: 'M', paths: [changedPath] }))
}

test('documentation-only changes skip every suite a doc change cannot falsify', () => {
  const result = classifyRecords(
    modified('docs/ci-and-deployment.md', 'project/2026-09-13-ci.md')
  )
  assert.equal(result.changeClass, CHANGE_CLASS.documentationAndPlanning)
  assert.equal(result.reason, REASON.documentationAndPlanning)
  assert.equal(result.decisions.playwright, DECISION.playwrightSkip)
  assert.equal(result.decisions.codebaseCheck, DECISION.codebaseCheckBounded)
  assert.equal(result.decisions.staticAnalysis, DECISION.staticAnalysisSkip)
  // A skip is admissible only with the paths that justified it.
  assert.deepEqual(result.paths, [
    'docs/ci-and-deployment.md',
    'project/2026-09-13-ci.md',
  ])
})

test('agent-guidance markdown stays inside the documentation class', () => {
  const result = classifyRecords(modified('.agents/skills/devrouter/SKILL.md'))
  assert.equal(result.changeClass, CHANGE_CLASS.documentationAndPlanning)
})

test('a non-markdown asset in a documentation tree stays documentation', () => {
  const result = classifyPaths(['docs/assets/diagram.png'])
  assert.equal(result.changeClass, CHANGE_CLASS.documentationAndPlanning)
})

test('an executable file inside a documentation tree expands the envelope', () => {
  for (const changedPath of [
    '.agents/skills/example/run.sh',
    'docs/scripts/generate.py',
    'project/util/helper.cjs',
    'docs/data/manifest.json',
    'docs/config/tool.yml',
  ]) {
    const result = classifyPaths([changedPath])
    assert.equal(result.changeClass, CHANGE_CLASS.application, changedPath)
    assert.equal(result.reason, REASON.applicationSurface, changedPath)
  }
})

test('CI orchestration changes keep the bounded envelope that class requires', () => {
  const result = classifyRecords(
    modified(
      '.github/workflows/check.yml',
      '.github/scripts/minimum-validation-class.cjs'
    )
  )
  assert.equal(result.changeClass, CHANGE_CLASS.ciOrchestration)
  assert.equal(result.reason, REASON.ciOrchestration)
  // The bounded Playwright smoke selection runs because CI input can change
  // which specs a plan selects, and the static analysis runs because the
  // workflow and CI script sources are analyzed input.
  assert.equal(result.decisions.playwright, DECISION.playwrightBounded)
  assert.equal(result.decisions.codebaseCheck, DECISION.codebaseCheckBounded)
  assert.equal(result.decisions.staticAnalysis, DECISION.staticAnalysisRun)
})

test('a mixed documentation and CI change takes the wider class', () => {
  const result = classifyRecords(
    modified('docs/ci-and-deployment.md', '.github/workflows/check.yml')
  )
  assert.equal(result.changeClass, CHANGE_CLASS.application)
  assert.equal(result.reason, REASON.mixedClasses)
  assert.deepEqual(result.paths, [
    'docs/ci-and-deployment.md',
    '.github/workflows/check.yml',
  ])
})

test('any application path expands every decision to the full envelope', () => {
  const result = classifyRecords(
    modified('docs/ci-and-deployment.md', 'apps/frontend-pwa/pages/index.tsx')
  )
  assert.equal(result.changeClass, CHANGE_CLASS.application)
  assert.equal(result.reason, REASON.applicationSurface)
  assert.deepEqual(result.decisions, {
    playwright: DECISION.playwrightFull,
    codebaseCheck: DECISION.codebaseCheckFull,
    staticAnalysis: DECISION.staticAnalysisRun,
  })
  assert.deepEqual(result.paths, ['apps/frontend-pwa/pages/index.tsx'])
})

test('an unknown or non-application path expands instead of narrowing', () => {
  for (const changedPath of [
    'README.md',
    'util/some-tool.sh',
    'playwright/tests/0-baseline-ops.spec.ts',
    'some-new-top-level-dir/file.md',
  ]) {
    const result = classifyPaths([changedPath])
    assert.equal(result.changeClass, CHANGE_CLASS.application, changedPath)
    assert.equal(
      result.decisions.playwright,
      DECISION.playwrightFull,
      changedPath
    )
  }
})

test('root-level markdown is not silently treated as documentation', () => {
  // AGENTS.md and README.md are repository-root operational files; a bounded
  // class covers the named documentation trees only.
  const result = classifyPaths(['AGENTS.md'])
  assert.equal(result.changeClass, CHANGE_CLASS.application)
})

test('an empty diff expands to the full envelope', () => {
  const result = classifyRecords([])
  assert.equal(result.changeClass, CHANGE_CLASS.application)
  assert.equal(result.reason, REASON.emptyDiff)
  assert.equal(result.decisions.playwright, DECISION.playwrightFull)
})

test('renames, copies and deletions never stay bounded', () => {
  for (const kind of ['R', 'C', 'D', 'T', 'X']) {
    const result = classifyRecords([
      { kind, paths: ['docs/old.md', 'docs/new.md'] },
    ])
    assert.equal(result.changeClass, CHANGE_CLASS.application, kind)
    assert.equal(result.reason, REASON.unknownRecordKind, kind)
  }
})

test('a malformed record expands rather than being skipped', () => {
  for (const record of [
    null,
    {},
    { kind: 'M' },
    { kind: 'M', paths: [] },
    { paths: ['docs/a.md'] },
    { kind: '', paths: ['docs/a.md'] },
  ]) {
    const result = classifyRecords([record])
    assert.equal(result.changeClass, CHANGE_CLASS.application)
    assert.equal(result.reason, REASON.malformedRecord)
  }
})

test('an unresolvable path expands rather than being classified', () => {
  for (const changedPath of [
    '/etc/passwd',
    '../../outside.md',
    'docs/../apps/frontend-pwa/pages/index.tsx',
    'docs/with\nnewline.md',
    'docs//double-slash.md',
    '',
  ]) {
    const result = classifyRecords([{ kind: 'M', paths: [changedPath] }])
    assert.equal(result.changeClass, CHANGE_CLASS.application, changedPath)
    assert.ok(
      result.reason === REASON.unsafePath,
      `${changedPath}: ${result.reason}`
    )
  }
})

test('the safe-path guard accepts repository-relative paths only', () => {
  assert.equal(isSafeRepoPath('docs/ci-and-deployment.md'), true)
  assert.equal(isSafeRepoPath('.agents/skills/x/SKILL.md'), true)
  assert.equal(isSafeRepoPath('/absolute.md'), false)
  assert.equal(isSafeRepoPath('../escape.md'), false)
  assert.equal(isSafeRepoPath('docs//empty-segment.md'), false)
  assert.equal(isSafeRepoPath('docs/./dot.md'), false)
  assert.equal(isSafeRepoPath(''), false)
  assert.equal(isSafeRepoPath(null), false)
  assert.equal(isSafeRepoPath('a'.repeat(4097)), false)
})

test('an unknown class or absent decision read resolves to the full envelope', () => {
  assert.deepEqual(
    decisionsFor('not-a-class'),
    ENVELOPE[CHANGE_CLASS.application]
  )
  assert.deepEqual(decisionsFor(undefined), ENVELOPE[CHANGE_CLASS.application])
  assert.deepEqual(
    decisionsFor(CHANGE_CLASS.ciOrchestration),
    ENVELOPE[CHANGE_CLASS.ciOrchestration]
  )
})

test('class membership is explicit, so a lane can validate its input', () => {
  assert.equal(isKnownClass(CHANGE_CLASS.documentationAndPlanning), true)
  assert.equal(isKnownClass(CHANGE_CLASS.ciOrchestration), true)
  assert.equal(isKnownClass(CHANGE_CLASS.application), true)
  assert.equal(isKnownClass('narrower-than-agreed'), false)
  // Prototype keys must not read as a class.
  assert.equal(isKnownClass('constructor'), false)
  assert.equal(isKnownClass('toString'), false)
})

test('every class carries the complete envelope the roadmap declares', () => {
  assert.deepEqual(ENVELOPE[CHANGE_CLASS.documentationAndPlanning], {
    playwright: 'skip',
    codebaseCheck: 'bounded',
    staticAnalysis: 'skip',
  })
  assert.deepEqual(ENVELOPE[CHANGE_CLASS.ciOrchestration], {
    playwright: 'bounded',
    codebaseCheck: 'bounded',
    staticAnalysis: 'run',
  })
  assert.deepEqual(ENVELOPE[CHANGE_CLASS.application], {
    playwright: 'full',
    codebaseCheck: 'full',
    staticAnalysis: 'run',
  })
})

test('a changed-path listing parses into records with blank lines ignored', () => {
  const records = parsePathList('docs/a.md\n\n  project/b.md  \n')
  assert.deepEqual(records, [
    { kind: 'M', paths: ['docs/a.md'] },
    { kind: 'M', paths: ['project/b.md'] },
  ])
  assert.deepEqual(parsePathList(''), [])
  assert.deepEqual(parsePathList('   \n'), [])
  assert.deepEqual(parsePathList(undefined), [])
  assert.equal(classifyRecords(parsePathList('')).reason, REASON.emptyDiff)
  assert.equal(
    classifyRecords(parsePathList('docs/a.md')).changeClass,
    CHANGE_CLASS.documentationAndPlanning
  )
})

test('the CLI reports the class and writes the machine-readable decisions', (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'minimum-validation-class-')
  )
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const changedPathsFile = path.join(directory, 'changed-files.txt')
  const outputFile = path.join(directory, 'outputs.txt')
  const summaryFile = path.join(directory, 'summary.md')
  fs.writeFileSync(changedPathsFile, '.github/workflows/check.yml\n')
  fs.writeFileSync(outputFile, '')
  fs.writeFileSync(summaryFile, '')

  const classification = main(['--changed-paths-file', changedPathsFile], {
    GITHUB_OUTPUT: outputFile,
    GITHUB_STEP_SUMMARY: summaryFile,
  })

  assert.equal(classification.changeClass, CHANGE_CLASS.ciOrchestration)
  const outputs = fs.readFileSync(outputFile, 'utf8')
  assert.match(outputs, /^change_class=ci-orchestration$/m)
  assert.match(outputs, /^playwright=bounded$/m)
  assert.match(outputs, /^codebase_check=bounded$/m)
  assert.match(outputs, /^static_analysis=run$/m)
  assert.match(outputs, /^changed_path_count=1$/m)
  assert.match(fs.readFileSync(summaryFile, 'utf8'), /ci-orchestration/)
})

test('the emitter without a summary file still reports the decision', () => {
  const classification = classifyPaths(['docs/a.md'])
  // No GITHUB_OUTPUT or GITHUB_STEP_SUMMARY: the decision must not be lost.
  emit(classification, {})
  assert.equal(classification.decisions.playwright, DECISION.playwrightSkip)
})

test('rename-aware diff records carry every path a rename touched', () => {
  const records = parseNameStatusRecords(
    'M\0docs/a.md\0A\0docs/b.md\0R100\0docs/old.md\0docs/new.md\0'
  )
  assert.deepEqual(records, [
    { status: 'M', kind: 'M', paths: ['docs/a.md'] },
    { status: 'A', kind: 'A', paths: ['docs/b.md'] },
    {
      status: 'R100',
      kind: 'R',
      paths: ['docs/old.md', 'docs/new.md'],
    },
  ])
  assert.deepEqual(parseNameStatusRecords(''), [])
})

test('a diff record the parser cannot resolve fails instead of narrowing', () => {
  for (const raw of [
    'm\0docs/a.md\0',
    'MM\0docs/a.md\0',
    '1\0docs/a.md\0',
    'M\0/etc/passwd\0',
    'M\0\0',
    'M\0docs/../outside.md\0',
  ]) {
    assert.throws(() => parseNameStatusRecords(raw), /malformed diff/, raw)
  }
})

test('a rename between trees never stays bounded', () => {
  // Only the destination path of a rename would look like documentation, so
  // the deleted source must win the classification.
  const records = parseNameStatusRecords(
    'R100\0apps/frontend-manage/pages/index.tsx\0docs/index.md\0'
  )
  const result = classifyRecords(records)
  assert.equal(result.changeClass, CHANGE_CLASS.application)
  assert.equal(result.reason, REASON.unknownRecordKind)
})
