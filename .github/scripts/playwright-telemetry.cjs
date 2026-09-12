const fs = require('node:fs')

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function value(name, fallback = null) {
  return process.env[name] === undefined || process.env[name] === ''
    ? fallback
    : process.env[name]
}

function buildTelemetry() {
  return {
    schema: 1,
    phase: value('PLAYWRIGHT_TELEMETRY_PHASE', 'unknown'),
    route: value('PLAYWRIGHT_ROUTE', 'unknown'),
    mode: value('PLAYWRIGHT_MODE', 'unknown'),
    runner: value('RUNNER_NAME', 'unknown'),
    platform: value('RUNNER_OS', 'unknown'),
    architecture: value('RUNNER_ARCH', 'unknown'),
    cacheEnabled: value('PLAYWRIGHT_CACHE_ENABLED', 'false') === 'true',
    cacheContract: value('PLAYWRIGHT_CACHE_CONTRACT'),
    pnpmCacheHit: value('PNPM_CACHE_HIT') === 'true',
    pnpmCacheKey: value('PNPM_CACHE_KEY'),
    pnpmCacheMatchedKey: value('PNPM_CACHE_MATCHED_KEY'),
    turboCacheHit: value('TURBO_CACHE_HIT') === 'true',
    turboCacheKey: value('TURBO_CACHE_KEY'),
    turboCacheMatchedKey: value('TURBO_CACHE_MATCHED_KEY'),
    turboTasksSuccessful: numberOrNull(value('TURBO_TASKS_SUCCESSFUL')),
    turboTasksTotal: numberOrNull(value('TURBO_TASKS_TOTAL')),
    turboTasksCached: numberOrNull(value('TURBO_TASKS_CACHED')),
    turboCachedTotal: numberOrNull(value('TURBO_CACHED_TOTAL')),
    durationSeconds: numberOrNull(value('PLAYWRIGHT_DURATION_SECONDS')),
    estimatedDurationSeconds: numberOrNull(
      value('PLAYWRIGHT_ESTIMATED_DURATION_SECONDS')
    ),
    shardIndex: numberOrNull(value('PLAYWRIGHT_SHARD_INDEX')),
    shardTotal: numberOrNull(value('PLAYWRIGHT_SHARD_TOTAL')),
    selectedFileCount: numberOrNull(value('PLAYWRIGHT_SELECTED_FILE_COUNT')),
    conclusion: value('PLAYWRIGHT_CONCLUSION', 'unknown'),
  }
}

function main(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output')
  const output =
    outputIndex === -1 ? 'playwright-telemetry.json' : argv[outputIndex + 1]
  if (!output || output.startsWith('--')) {
    throw new Error('expected --output <path>')
  }

  fs.writeFileSync(output, `${JSON.stringify(buildTelemetry(), null, 2)}\n`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright telemetry failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { buildTelemetry, numberOrNull }
