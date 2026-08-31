const fs = require('node:fs')

function numberOrNull(value) {
  if (value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseTurboOutput(output) {
  const tasks = output.match(/Tasks:\s+(\d+)\s+successful,\s+(\d+)\s+total/i)
  const cached = output.match(/Cached:\s+(\d+)\s+cached,\s+(\d+)\s+total/i)

  return {
    tasksSuccessful: tasks ? numberOrNull(tasks[1]) : null,
    tasksTotal: tasks ? numberOrNull(tasks[2]) : null,
    tasksCached: cached ? numberOrNull(cached[1]) : null,
    cachedTotal: cached ? numberOrNull(cached[2]) : null,
  }
}

function main(argv = process.argv.slice(2)) {
  const logIndex = argv.indexOf('--log')
  const logPath = logIndex === -1 ? null : argv[logIndex + 1]
  if (!logPath || logPath.startsWith('--')) {
    throw new Error('expected --log <path>')
  }

  const parsed = parseTurboOutput(
    fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
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
      fs.appendFileSync(output, `${name.toLowerCase()}=${value ?? ''}\n`)
    }
  }
  if (environment) {
    for (const [name, value] of Object.entries(values)) {
      fs.appendFileSync(environment, `${name}=${value ?? ''}\n`)
    }
  }

  console.log(JSON.stringify(parsed))
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Turbo telemetry failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = { numberOrNull, parseTurboOutput }
