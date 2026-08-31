const assert = require('node:assert/strict')
const test = require('node:test')

const { buildTelemetry, numberOrNull } = require('./playwright-telemetry.cjs')

test('telemetry is values-free and preserves measurable fields', () => {
  const old = { ...process.env }
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

  for (const key of Object.keys(process.env)) {
    if (!(key in old)) delete process.env[key]
  }
  Object.assign(process.env, old)
})

test('invalid numeric telemetry becomes null', () => {
  assert.equal(numberOrNull('not-a-number'), null)
  assert.equal(numberOrNull(''), null)
  assert.equal(numberOrNull('4'), 4)
})
