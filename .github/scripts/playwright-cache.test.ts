import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import YAML from 'yaml'

import {
  BUILD_IMAGE_DIGEST,
  buildFingerprint,
  dependencyFingerprint,
  relevantFiles,
} from './playwright-cache.ts'

type CacheStep = { uses?: string; run?: string; with?: Record<string, string> }

function fixtureRoot(files: Record<string, string>) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'playwright-cache-contract-')
  )
  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(root, file)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }
  return root
}

test('the cache contract includes package manifests and fixed compatibility files', () => {
  assert.deepEqual(
    relevantFiles([
      'apps/auth/package.json',
      'packages/util/package.json',
      '.github/actions/playwright-build/action.yml',
      '.github/actions/playwright-shard/action.yml',
      'pnpm-lock.yaml',
      'turbo.json',
      '.npmrc',
      'README.md',
    ]),
    [
      '.github/actions/playwright-build/action.yml',
      '.github/actions/playwright-shard/action.yml',
      '.npmrc',
      'apps/auth/package.json',
      'packages/util/package.json',
      'pnpm-lock.yaml',
      'turbo.json',
    ]
  )
})

test('dependency cache survives orchestration changes but tracks installation inputs', (t) => {
  const files: Record<string, string> = {
    'package.json': '{"dependencies":{"example":"1.0.0"}}',
    'pnpm-lock.yaml': 'lockfileVersion: 9.0',
    'pnpm-workspace.yaml': 'packages: []',
    '.npmrc': 'verify-store-integrity=true',
    '.pnpmfile.cjs': 'export {}',
    'patches/example.patch': 'original patch',
    'turbo.json': '{"tasks":{}}',
    '.github/actions/playwright-build/action.yml': 'original workflow',
  }
  const root = fixtureRoot(files)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const input = { root, files: Object.keys(files) }
  const original = dependencyFingerprint(input)
  assert.notEqual(
    original,
    dependencyFingerprint({ ...input, buildImageDigest: 'different-image' })
  )
  assert.equal(
    original,
    dependencyFingerprint({ ...input, files: [...input.files].reverse() })
  )
  for (const file of [
    'turbo.json',
    '.github/actions/playwright-build/action.yml',
  ]) {
    fs.writeFileSync(path.join(root, file), 'changed orchestration')
  }
  assert.equal(original, dependencyFingerprint(input))
  for (const file of Object.keys(files).slice(0, 6)) {
    fs.writeFileSync(
      path.join(root, file),
      file === 'package.json'
        ? '{"dependencies":{"example":"2.0.0"}}'
        : `${files[file]}\nchanged`
    )
    assert.notEqual(original, dependencyFingerprint(input), file)
    fs.writeFileSync(path.join(root, file), files[file])
  }
})

test('task scripts preserve the store key while installation hooks invalidate it', (t) => {
  const root = fixtureRoot({ 'package.json': '{}' })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const input = { root, files: ['package.json'] }
  const original = dependencyFingerprint(input)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { 'test:dev-runtime': 'node test.mjs' } })
  )
  assert.equal(dependencyFingerprint(input), original)
  const build = buildFingerprint(input)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { 'test:dev-runtime': 'node other-test.mjs' } })
  )
  assert.equal(dependencyFingerprint(input), original)
  assert.notEqual(buildFingerprint(input), build)
  for (const hook of [
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'pnpm:devPreinstall',
  ]) {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { [hook]: 'node install.mjs' } })
    )
    assert.notEqual(dependencyFingerprint(input), original, hook)
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{invalid')
  assert.throws(() => dependencyFingerprint(input), SyntaxError)
})

test('the fingerprint is deterministic and includes the image digest', (t) => {
  const root = fixtureRoot({
    'package.json': '{"engines":{"node":"24"}}',
    'pnpm-lock.yaml': 'lockfileVersion: 9.0',
    'turbo.json': '{"tasks":{}}',
    '.github/actions/playwright-build/action.yml': 'build-action',
    '.github/actions/playwright-shard/action.yml': 'shard-action',
    '.github/scripts/playwright-cache.ts': 'contract',
    '.github/scripts/playwright-telemetry.ts': 'telemetry',
    '.github/workflows/playwright-cache-seed.yml': 'seed',
    '.github/workflows/public-pr-playwright-shards.yml': 'public',
    '.github/workflows/test-playwright.yml': 'hosted',
    '.npmrc': 'public-hoist-pattern[]=*',
    'playwright/profiles.json': '{}',
    'playwright/runtime-contract.yml': 'version: 1',
    'pnpm-workspace.yaml': 'packages:',
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const files = Object.keys({
    'package.json': true,
    'pnpm-lock.yaml': true,
    'turbo.json': true,
    '.github/actions/playwright-build/action.yml': true,
    '.github/actions/playwright-shard/action.yml': true,
    '.github/scripts/playwright-cache.ts': true,
    '.github/scripts/playwright-telemetry.ts': true,
    '.github/workflows/playwright-cache-seed.yml': true,
    '.github/workflows/public-pr-playwright-shards.yml': true,
    '.github/workflows/test-playwright.yml': true,
    '.npmrc': true,
    'playwright/profiles.json': true,
    'playwright/runtime-contract.yml': true,
    'pnpm-workspace.yaml': true,
  })

  const fingerprint = buildFingerprint({ root, files })
  assert.equal(fingerprint, buildFingerprint({ root, files }))
  assert.match(BUILD_IMAGE_DIGEST, /^sha256:[0-9a-f]{64}$/)
  assert.notEqual(
    fingerprint,
    buildFingerprint({
      root,
      files,
      buildImageDigest: `sha256:${'0'.repeat(64)}`,
    })
  )

  fs.writeFileSync(path.join(root, 'turbo.json'), '{"tasks":{"build":{}}}')
  assert.notEqual(fingerprint, buildFingerprint({ root, files }))
})

const root = path.resolve(import.meta.dirname, '../..')
const actionPath = '.github/actions/setup-node-pnpm/action.yml'
const readYaml = (file: string) =>
  YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const action = readYaml(actionPath)
const [setup, locate, restore] = action.runs.steps

// These expressions use only string comparisons and boolean operators, whose
// semantics match JavaScript for the string-valued inputs tested here.
function evaluate(expression: string, requested: string, event: string) {
  const source = expression
    .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
    .replaceAll('inputs.cache-write', "inputs['cache-write']")
  return vm.runInNewContext(source, {
    inputs: { 'cache-write': requested },
    github: { event_name: event },
  })
}

test('only explicitly enabled push jobs write; all other cases restore only', () => {
  assert.equal(action.inputs['cache-write'].default, 'false')
  assert.equal(setup.uses, 'actions/setup-node@v4')
  assert.equal(setup.with['node-version-file'], 'package.json')
  assert.equal(setup.with['cache-dependency-path'], 'pnpm-lock.yaml')
  assert.equal(restore.uses, 'actions/cache/restore@v4')
  assert.equal(restore.with['restore-keys'], undefined)
  assert.equal(restore.with['fail-on-cache-miss'], undefined)
  assert.equal(restore.with.path, `\${{ steps.cache.outputs.path }}`)
  assert.equal(restore.with.key, `\${{ steps.cache.outputs.key }}`)
  for (const requested of ['true', 'false', '', 'unexpected']) {
    for (const event of [
      'push',
      'pull_request',
      'pull_request_target',
      'workflow_dispatch',
      'schedule',
    ]) {
      const writer = requested === 'true' && event === 'push'
      assert.equal(
        evaluate(setup.with.cache, requested, event),
        writer ? 'pnpm' : ''
      )
      assert.equal(evaluate(locate.if, requested, event), !writer)
      assert.equal(evaluate(restore.if, requested, event), !writer)
    }
  }
})

test('readers retain setup-node v4 cache keys and reject missing cache inputs', (t) => {
  assert.equal(locate.env.LOCKFILE_HASH, `\${{ hashFiles('pnpm-lock.yaml') }}`)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hosted-cache-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const output = path.join(directory, 'outputs')
  fs.writeFileSync(
    path.join(directory, 'pnpm'),
    '#!/bin/sh\n[ "$*" = "store path --silent" ] || exit 1\nprintf "%s\\n" "$TEST_STORE"\n',
    { mode: 0o755 }
  )
  const run = (hash: string, store: string) =>
    spawnSync('bash', ['-c', locate.run], {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        GITHUB_OUTPUT: output,
        LOCKFILE_HASH: hash,
        RUNNER_OS: 'Linux',
        TEST_STORE: store,
      },
    })
  assert.equal(run('synthetic-hash', '/synthetic/store/v11').status, 0)
  assert.equal(
    fs.readFileSync(output, 'utf8'),
    `path=/synthetic/store/v11\nkey=node-cache-Linux-${os.arch()}-pnpm-synthetic-hash\n`
  )
  assert.notEqual(run('', '/synthetic/store/v11').status, 0)
  assert.notEqual(run('synthetic-hash', '').status, 0)
})

test('the check push is the only configured hosted writer and helper edits reach tests', () => {
  const workflows = ['check', 'test-graphql', 'test-unit'].map((name) =>
    readYaml(`.github/workflows/${name}.yml`)
  )
  for (const [index, workflow] of workflows.entries()) {
    const steps = Object.values(
      workflow.jobs as Record<string, { steps?: CacheStep[] }>
    ).flatMap((job) => job.steps ?? [])
    const callers = steps.filter(
      (step: CacheStep) => step.uses === './.github/actions/setup-node-pnpm'
    )
    assert.equal(callers.length, 1)
    assert.equal(
      callers[0].with?.['cache-write'] ?? 'false',
      index === 0 ? 'true' : 'false'
    )
    assert.ok(
      !steps.some(
        (step) =>
          step.uses?.startsWith('actions/setup-node@') ||
          step.uses?.startsWith('actions/cache/save@')
      )
    )
    assert.ok(
      steps.some((step) => step.run === 'pnpm install --frozen-lockfile')
    )
  }
  assert.deepEqual(workflows[0].on.push.branches, ['v3', 'v3*'])
  const filter = workflows[1].jobs.filter.steps.find(
    (step: CacheStep) => step.uses === './.github/actions/changed-paths'
  )
  assert.match(actionPath, new RegExp(filter.with.pattern))
  for (const event of ['push', 'pull_request']) {
    assert.ok(
      workflows[2].on[event].paths.includes(
        '.github/actions/setup-node-pnpm/**'
      )
    )
  }
})

test('cache identity runs before install from isolated trusted control', (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'playwright-cache-cli-')
  )
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const control = path.join(directory, 'control')
  const candidate = path.join(directory, 'candidate')
  fs.mkdirSync(control)
  fs.mkdirSync(candidate)
  fs.copyFileSync(
    path.join(import.meta.dirname, 'playwright-cache.ts'),
    path.join(control, 'playwright-cache.ts')
  )
  fs.writeFileSync(path.join(candidate, 'package.json'), '{}')
  for (const args of [
    ['init', '-q'],
    ['add', 'package.json'],
  ]) {
    assert.equal(spawnSync('git', args, { cwd: candidate }).status, 0)
  }
  const output = path.join(directory, 'output')
  const run = spawnSync(
    process.execPath,
    [path.join(control, 'playwright-cache.ts'), '--root', candidate],
    {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    }
  )
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /^v2-[a-f0-9]{32}\n$/)
  assert.match(
    fs.readFileSync(output, 'utf8'),
    /^fingerprint=v2-[a-f0-9]{32}\ndependency-fingerprint=v2-[a-f0-9]{32}\n$/
  )
})
