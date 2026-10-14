import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  classifyTestFile,
  inspectTestFile,
  inventory,
  summarize,
} from './test-hygiene-inventory.mjs'

const gitEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
)

test('separates active Playwright from references and recognizes runner conventions', () => {
  assert.equal(
    classifyTestFile('playwright/tests/A.spec.ts'),
    'playwright-active'
  )
  assert.equal(
    classifyTestFile('playwright/retained/A.spec.ts'),
    'playwright-reference'
  )
  assert.equal(
    classifyTestFile('playwright/example/A.spec.ts'),
    'playwright-reference'
  )
  for (const file of ['a.test.tsx', 'a.spec.mjs', 'a.test.cjs']) {
    assert.equal(classifyTestFile(file), 'javascript-typescript')
  }
  assert.equal(classifyTestFile('evaluation/test_contract.py'), 'python')
  assert.equal(classifyTestFile('evaluation/contract_test.py'), 'python')
  assert.equal(classifyTestFile('util/test-runtime.sh'), 'shell')
  for (const file of [
    'playwright/util/fixtures.ts',
    'package.json',
    'smoke.ts',
    'contest.py',
  ]) {
    assert.equal(classifyTestFile(file), null)
  }
})

test('reports indicator positions, including comments, without outputting source', () => {
  const result = inspectTestFile(
    'playwright/tests/A.spec.ts',
    [
      '// @ts-nocheck',
      '// page.waitForTimeout(500) is a review lead, not an executed wait',
      'await page.waitForTimeout(500); await page.waitForTimeout(100)',
      "test.skip(!mailhog, 'environment-dependent');",
      "test.describe.serial('workflow', () => {});",
      'await expect(button).toHaveClass(/primary/)',
      'await expect(button).toBeFocused()',
      'const secret = "PRIVATE_FIXTURE_CONTENT"',
    ].join('\n')
  )
  assert.deepEqual(result.signals.fixedWait, { count: 3, lines: [2, 3] })
  assert.deepEqual(result.signals.serialGroup, { count: 1, lines: [5] })
  assert.equal(result.signals.disabledOrConditional.count, 1)
  assert.equal(result.signals.styleAssertion.count, 1)
  assert.equal(
    JSON.stringify(result).includes('PRIVATE_FIXTURE_CONTENT'),
    false
  )
  assert.equal(inspectTestFile('source.ts', 'waitForTimeout(1)'), null)
})

test('aggregation counts files separately from occurrences and has no pass threshold', () => {
  const file = inspectTestFile(
    'a.test.ts',
    'page.waitForTimeout(1);page.waitForTimeout(1)'
  )
  assert.deepEqual(summarize([file]).signals.fixedWait, {
    occurrences: 2,
    files: 1,
  })
  assert.deepEqual(summarize([]), { files: 0, categories: {}, signals: {} })
})

test('read-only CLI uses tracked working-tree files and rejects incomplete reads', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'klicker-hygiene-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: gitEnvironment,
    })
  const cli = fileURLToPath(
    new URL('./test-hygiene-inventory.mjs', import.meta.url)
  )
  try {
    git('init', '-q')
    mkdirSync(path.join(root, 'playwright/tests'), { recursive: true })
    writeFileSync(
      path.join(root, 'playwright/tests/A.spec.ts'),
      'await page.waitForTimeout(1)'
    )
    writeFileSync(path.join(root, 'removed.test.mjs'), '')
    symlinkSync('removed.test.mjs', path.join(root, 'linked.test.mjs'))
    git('add', '--all')
    git(
      '-c',
      'user.name=Test Hygiene Fixture',
      '-c',
      'user.email=test-hygiene@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '-q',
      '-m',
      'Synthetic inventory fixture'
    )
    writeFileSync(
      path.join(root, 'playwright/tests/A.spec.ts'),
      'await expect(button).toBeFocused()'
    )
    writeFileSync(
      path.join(root, 'untracked.test.mjs'),
      'PRIVATE_FIXTURE_CONTENT'
    )
    rmSync(path.join(root, 'removed.test.mjs'))
    const before = git('status', '--porcelain')
    const result = inventory(root)
    assert.match(result.contentsSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.activePlaywright.files, 1)
    assert.deepEqual(result.files[0].signals, {})
    assert.deepEqual(result.unreadable, ['linked.test.mjs', 'removed.test.mjs'])
    assert.equal(result.summary.files, 1)
    const run = spawnSync(process.execPath, [cli, '--root', root, '--json'], {
      env: { ...process.env, GIT_DIR: '/invalid-inherited-git-dir' },
      encoding: 'utf8',
    })
    assert.equal(run.status, 1)
    assert.deepEqual(JSON.parse(run.stdout), result)
    assert.equal(git('status', '--porcelain'), before)
    assert.throws(
      () => inventory(path.join(root, 'playwright')),
      /repository root/
    )
    const badArgs = spawnSync(process.execPath, [cli, '--fix'], {
      encoding: 'utf8',
    })
    assert.equal(badArgs.status, 1)
    assert.match(badArgs.stderr, /Usage:/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('CLI succeeds with indicators and never invokes configured Git hooks/filters', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'klicker-hygiene-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: gitEnvironment,
    })
  const cli = fileURLToPath(
    new URL('./test-hygiene-inventory.mjs', import.meta.url)
  )
  try {
    git('init', '-q')
    writeFileSync(
      path.join(root, 'a.test.ts'),
      'await page.waitForTimeout(1000)'
    )
    git('add', '--all')
    git(
      '-c',
      'user.name=Test Hygiene Fixture',
      '-c',
      'user.email=test-hygiene@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '-q',
      '-m',
      'Synthetic inventory fixture'
    )
    const marker = path.join(root, 'hook-invoked')
    const hook = path.join(root, 'hook.sh')
    writeFileSync(hook, `#!/bin/sh\nprintf invoked > '${marker}'\n`, {
      mode: 0o755,
    })
    git('config', 'core.fsmonitor', hook)
    git('config', 'filter.hygiene.clean', hook)
    writeFileSync(
      path.join(root, '.gitattributes'),
      '*.test.ts filter=hygiene\n'
    )
    writeFileSync(
      path.join(root, 'a.test.ts'),
      'await page.waitForTimeout(999)'
    )
    const run = spawnSync(process.execPath, [cli, '--root', root], {
      encoding: 'utf8',
    })
    assert.equal(run.status, 0)
    assert.match(run.stdout, /fixedWait/)
    assert.match(run.stdout, /Not runner discovery/)
    assert.equal(
      existsSync(marker),
      false,
      'inventory must not invoke Git hooks/filters'
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
