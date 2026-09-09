import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildTelemetry,
  numberOrNull,
  parseTurboOutput,
  writeTurboTelemetry,
} from './playwright-telemetry.ts'

test('telemetry is values-free and preserves measurable fields', (t) => {
  const old = { ...process.env }
  t.after(() => {
    for (const key of Object.keys(process.env)) {
      if (!Object.hasOwn(old, key)) delete process.env[key]
    }
    Object.assign(process.env, old)
  })

  Object.assign(process.env, {
    PLAYWRIGHT_TELEMETRY_PHASE: 'build',
    PLAYWRIGHT_ROUTE: 'public-pr',
    PLAYWRIGHT_MODE: 'full',
    RUNNER_NAME: 'runner-01',
    RUNNER_OS: 'Linux',
    RUNNER_ARCH: 'ARM64',
    PLAYWRIGHT_CACHE_ENABLED: 'true',
    PLAYWRIGHT_CACHE_CONTRACT: 'v2-test',
    PNPM_CACHE_HIT: 'true',
    TURBO_CACHE_HIT: 'false',
    PLAYWRIGHT_DURATION_SECONDS: '12.5',
    PLAYWRIGHT_SHARD_INDEX: '2',
    PLAYWRIGHT_SHARD_TOTAL: '8',
    PLAYWRIGHT_CONCLUSION: 'success',
  })

  assert.deepEqual(buildTelemetry(), {
    schema: 1,
    phase: 'build',
    route: 'public-pr',
    mode: 'full',
    runner: 'runner-01',
    platform: 'Linux',
    architecture: 'ARM64',
    cacheEnabled: true,
    cacheContract: 'v2-test',
    pnpmCacheHit: true,
    pnpmCacheKey: null,
    pnpmCacheMatchedKey: null,
    turboCacheHit: false,
    turboCacheKey: null,
    turboCacheMatchedKey: null,
    turboTasksSuccessful: null,
    turboTasksTotal: null,
    turboTasksCached: null,
    turboCachedTotal: null,
    durationSeconds: 12.5,
    estimatedDurationSeconds: null,
    shardIndex: 2,
    shardTotal: 8,
    selectedFileCount: null,
    conclusion: 'success',
  })
})

test('invalid numeric telemetry becomes null', () => {
  assert.equal(numberOrNull('not-a-number'), null)
  assert.equal(numberOrNull(''), null)
  assert.equal(numberOrNull('4'), 4)
  assert.equal(numberOrNull(' 4 '), 4)
  assert.equal(numberOrNull('-3.5'), -3.5)
  assert.equal(numberOrNull('Infinity'), null)
  assert.equal(numberOrNull('NaN'), null)
})
test('parses the standard Turbo task and cache summary', () => {
  assert.deepEqual(
    parseTurboOutput(`
Tasks:    21 successful, 21 total
Cached:    17 cached, 21 total
`),
    {
      tasksSuccessful: 21,
      tasksTotal: 21,
      tasksCached: 17,
      cachedTotal: 21,
    }
  )
})

test('missing or unsuccessful Turbo summaries remain bounded', () => {
  assert.deepEqual(
    parseTurboOutput('build failed before Turbo printed a summary'),
    {
      tasksSuccessful: null,
      tasksTotal: null,
      tasksCached: null,
      cachedTotal: null,
    }
  )
})

test('partial Turbo summaries preserve present values and zeroes', () => {
  assert.deepEqual(parseTurboOutput(`Tasks:    0 successful, 21 total`), {
    tasksSuccessful: 0,
    tasksTotal: 21,
    tasksCached: null,
    cachedTotal: null,
  })
  assert.deepEqual(parseTurboOutput(`Cached:    0 cached, 21 total`), {
    tasksSuccessful: null,
    tasksTotal: null,
    tasksCached: 0,
    cachedTotal: 21,
  })
})

test('CLI writes the same uppercase telemetry fields to both GitHub files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turbo-telemetry-'))
  const log = path.join(root, 'turbo.log')
  const output = path.join(root, 'output')
  const environment = path.join(root, 'environment')
  const old = { ...process.env }
  t.after(() => {
    for (const key of Object.keys(process.env)) {
      if (!Object.hasOwn(old, key)) delete process.env[key]
    }
    Object.assign(process.env, old)
    fs.rmSync(root, { recursive: true, force: true })
  })

  fs.writeFileSync(
    log,
    'Tasks:    2 successful, 3 total\nCached:    1 cached, 3 total\n'
  )
  process.env.GITHUB_OUTPUT = output
  process.env.GITHUB_ENV = environment

  writeTurboTelemetry(['--log', log])

  const expected = [
    'TURBO_TASKS_SUCCESSFUL=2',
    'TURBO_TASKS_TOTAL=3',
    'TURBO_TASKS_CACHED=1',
    'TURBO_CACHED_TOTAL=3',
  ].join('\n')
  assert.equal(fs.readFileSync(output, 'utf8').trim(), expected)
  assert.equal(fs.readFileSync(environment, 'utf8').trim(), expected)
})

test('both telemetry commands run before install from isolated control', (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'playwright-telemetry-cli-')
  )
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const script = path.join(directory, 'playwright-telemetry.ts')
  fs.copyFileSync(
    path.join(import.meta.dirname, 'playwright-telemetry.ts'),
    script
  )
  const output = path.join(directory, 'record.json')
  const record = spawnSync(
    process.execPath,
    [script, 'record', '--output', output],
    { cwd: directory, encoding: 'utf8' }
  )
  assert.equal(record.status, 0, record.stderr)
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).schema, 1)
  const log = path.join(directory, 'turbo.log')
  fs.writeFileSync(
    log,
    'Tasks: 1 successful, 1 total\nCached: 0 cached, 1 total\n'
  )
  const turbo = spawnSync(process.execPath, [script, 'turbo', '--log', log], {
    cwd: directory,
    encoding: 'utf8',
    env: {},
  })
  assert.equal(turbo.status, 0, turbo.stderr)
  assert.equal(JSON.parse(turbo.stdout).tasksSuccessful, 1)
})
