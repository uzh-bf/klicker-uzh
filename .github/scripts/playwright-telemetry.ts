import fs from 'node:fs'

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function value(name: string, fallback: string | null = null) {
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

function writeTelemetry(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output')
  const output =
    outputIndex === -1 ? 'playwright-telemetry.json' : argv[outputIndex + 1]
  if (!output || output.startsWith('--')) {
    throw new Error('expected --output <path>')
  }

  fs.writeFileSync(output, `${JSON.stringify(buildTelemetry(), null, 2)}\n`)
}

function parseTurboOutput(output: string) {
  const tasks = output.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/i)
  const cached = output.match(/Cached:\s+(\d+)\s+cached,\s+(\d+)\s+total/i)

  return {
    tasksSuccessful: tasks ? numberOrNull(tasks[1]) : null,
    tasksTotal: tasks ? numberOrNull(tasks[2]) : null,
    tasksCached: cached ? numberOrNull(cached[1]) : null,
    cachedTotal: cached ? numberOrNull(cached[2]) : null,
  }
}

function writeTurboTelemetry(argv = process.argv.slice(2)) {
  const logIndex = argv.indexOf('--log')
  const logPath = logIndex === -1 ? null : argv[logIndex + 1]
  if (!logPath || logPath.startsWith('--')) {
    throw new Error('expected --log <path>')
  }

  const logExists = fs.existsSync(logPath)
  if (!logExists) {
    console.warn(`Turbo telemetry log is missing: ${logPath}`)
  }
  const parsed = parseTurboOutput(
    logExists ? fs.readFileSync(logPath, 'utf8') : ''
  )
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions output contract
  const output = process.env.GITHUB_OUTPUT
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions environment contract
  const environment = process.env.GITHUB_ENV
  const values = {
    TURBO_TASKS_SUCCESSFUL: parsed.tasksSuccessful,
    TURBO_TASKS_TOTAL: parsed.tasksTotal,
    TURBO_TASKS_CACHED: parsed.tasksCached,
    TURBO_CACHED_TOTAL: parsed.cachedTotal,
  }

  if (output) {
    for (const [name, value] of Object.entries(values)) {
      fs.appendFileSync(output, `${name}=${value ?? ''}\n`)
    }
  }
  if (environment) {
    for (const [name, value] of Object.entries(values)) {
      fs.appendFileSync(environment, `${name}=${value ?? ''}\n`)
    }
  }

  console.log(JSON.stringify(parsed))
}

export {
  buildTelemetry,
  numberOrNull,
  parseTurboOutput,
  writeTelemetry,
  writeTurboTelemetry,
}

if (import.meta.main) {
  try {
    const [command, ...args] = process.argv.slice(2)
    if (command === 'turbo') writeTurboTelemetry(args)
    else if (command === 'record') writeTelemetry(args)
    else throw new Error('expected record or turbo subcommand')
  } catch (error) {
    console.error(
      `Playwright telemetry failed: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}
