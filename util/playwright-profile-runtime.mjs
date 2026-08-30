#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA_VERSION = 1
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_DEVROUTER_BIN = resolve(
  REPOSITORY_ROOT,
  'node_modules/.bin/devrouter'
)

const APP_RUNTIME = Object.freeze({
  api: {
    packages: ['@klicker-uzh/backend-docker'],
    endpoint: 'http://127.0.0.1:3000/healthz',
  },
  auth: {
    packages: ['@klicker-uzh/auth'],
    endpoint: 'http://127.0.0.1:3010',
  },
  chat: {
    packages: ['@klicker-uzh/chat'],
    endpoint: 'http://127.0.0.1:3004/noLogin',
  },
  control: {
    packages: ['@klicker-uzh/frontend-control'],
    endpoint: 'http://127.0.0.1:3003',
  },
  manage: {
    packages: ['@klicker-uzh/frontend-manage'],
    endpoint: 'http://127.0.0.1:3002',
  },
  pwa: {
    packages: ['@klicker-uzh/frontend-pwa'],
    endpoint: 'http://127.0.0.1:3001',
  },
  'response-api': {
    packages: [
      '@klicker-uzh/response-api',
      '@klicker-uzh/hatchet-worker-general',
      '@klicker-uzh/hatchet-worker-response-processor',
    ],
    endpoint: 'http://127.0.0.1:7078/healthz',
  },
})

const ALLOWED_MANAGED_SERVICES = new Set([
  'hatchet',
  'postgres',
  'redis_assessment',
  'redis_cache',
  'redis_exec',
])

function fail(message) {
  throw new Error(message)
}

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`)
  }
  return value
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${label} must be an array of strings`)
  }
  if (new Set(value).size !== value.length) {
    fail(`${label} must not contain duplicates`)
  }
  return value
}

function requireCanonicalArray(value, label) {
  const items = requireStringArray(value, label)
  if (items.some((item, index) => item !== [...items].sort()[index])) {
    fail(`${label} must be sorted`)
  }
  return items
}

function exactArray(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => item !== expected[index])
  ) {
    fail(`${label} does not match the selected apps`)
  }
}

function runtimeForApps(apps) {
  const packages = []
  const serviceEndpoints = []

  for (const app of apps) {
    const runtime = APP_RUNTIME[app]
    if (!runtime) fail(`unsupported Playwright app ${app}`)
    packages.push(...runtime.packages)
    serviceEndpoints.push(runtime.endpoint)
  }

  return {
    turboFilters: sortedUnique(packages).map((name) => `--filter=${name}`),
    serviceEndpoints: sortedUnique(serviceEndpoints),
  }
}

export function buildRuntimePlan(report) {
  if (!report || report.schemaVersion !== SCHEMA_VERSION) {
    fail(`unsupported Devrouter profile schema ${report?.schemaVersion}`)
  }

  const profile = requireString(report.profile, 'profile')
  const apps = requireCanonicalArray(report.apps, 'apps')
  if (apps.length === 0) fail('profile must select at least one Playwright app')

  const dependencies = requireCanonicalArray(
    report.dependencies,
    'dependencies'
  )
  if (dependencies.length > 0) {
    fail(`unsupported Devrouter dependencies: ${dependencies.join(', ')}`)
  }

  const readiness = requireCanonicalArray(report.readiness, 'readiness')
  for (const app of readiness) {
    if (!apps.includes(app)) fail(`readiness app ${app} is not selected`)
  }

  const managedRuntime = report.managedRuntime
  if (!managedRuntime || typeof managedRuntime !== 'object') {
    fail('managedRuntime must be an object')
  }
  const managedServices = requireCanonicalArray(
    managedRuntime.services,
    'managedRuntime.services'
  )
  for (const service of managedServices) {
    if (!ALLOWED_MANAGED_SERVICES.has(service)) {
      fail(`unsupported managed service ${service}`)
    }
  }
  const processes = requireCanonicalArray(
    managedRuntime.processes,
    'managedRuntime.processes'
  )
  exactArray(processes, ['klicker-dev'], 'managedRuntime.processes')

  const runtime = runtimeForApps(apps)
  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    apps,
    upstreamReadiness: readiness,
    managedServices,
    ...runtime,
  }
}

export function validateRuntimePlan(plan) {
  if (!plan || plan.schemaVersion !== SCHEMA_VERSION) {
    fail(`unsupported Playwright runtime schema ${plan?.schemaVersion}`)
  }

  const profile = requireString(plan.profile, 'profile')
  const apps = requireCanonicalArray(plan.apps, 'apps')
  if (apps.length === 0) fail('runtime plan must select at least one app')
  const upstreamReadiness = requireCanonicalArray(
    plan.upstreamReadiness,
    'upstreamReadiness'
  )
  for (const app of upstreamReadiness) {
    if (!apps.includes(app)) fail(`readiness app ${app} is not selected`)
  }
  const managedServices = requireCanonicalArray(
    plan.managedServices,
    'managedServices'
  )
  for (const service of managedServices) {
    if (!ALLOWED_MANAGED_SERVICES.has(service)) {
      fail(`unsupported managed service ${service}`)
    }
  }

  const expected = runtimeForApps(apps)
  const turboFilters = requireCanonicalArray(plan.turboFilters, 'turboFilters')
  const serviceEndpoints = requireCanonicalArray(
    plan.serviceEndpoints,
    'serviceEndpoints'
  )
  exactArray(turboFilters, expected.turboFilters, 'turboFilters')
  exactArray(serviceEndpoints, expected.serviceEndpoints, 'serviceEndpoints')

  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    apps,
    upstreamReadiness,
    managedServices,
    turboFilters,
    serviceEndpoints,
  }
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${path}: ${error.message}`)
  }
}

export function resolveRuntimePlan({
  profile,
  output,
  repo = REPOSITORY_ROOT,
  devrouterBin = DEFAULT_DEVROUTER_BIN,
}) {
  requireString(profile, 'profile selection')
  requireString(output, 'output path')

  const result = spawnSync(
    devrouterBin,
    ['profile', 'resolve', '--repo', repo, '--profile', profile, '--json'],
    { encoding: 'utf8' }
  )
  if (result.error) {
    fail(
      `Devrouter profile resolution could not start: ${result.error.message}`
    )
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || `exit status ${result.status}`
    fail(`Devrouter profile resolution failed: ${detail}`)
  }

  let report
  try {
    report = JSON.parse(result.stdout)
  } catch (error) {
    fail(`Devrouter returned invalid JSON: ${error.message}`)
  }

  const plan = buildRuntimePlan(report)
  writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return plan
}

function option(args, name, fallback) {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} needs a value`)
  return value
}

function rejectUnknownOptions(args, allowed) {
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.has(args[index])) fail(`unknown option ${args[index]}`)
  }
}

function planPath(args) {
  // GitHub provides this path only for the service-start subprocess.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: workflow contract
  return option(args, '--plan', process.env.PLAYWRIGHT_RUNTIME_PLAN)
}

export function buildStartCommand(input) {
  const plan = validateRuntimePlan(input)
  return {
    command: 'bash',
    args: [
      './util/_with_local_test_origins.sh',
      'cross-env',
      'NODE_ENV=test',
      'turbo',
      'run',
      'start:test',
      ...plan.turboFilters,
    ],
  }
}

function startRuntime(plan) {
  console.log(
    `Starting Playwright profile ${plan.profile}: ${plan.apps.join(', ')}`
  )
  console.log(`Turbo filters: ${plan.turboFilters.join(' ')}`)

  const startCommand = buildStartCommand(plan)
  const child = spawn(startCommand.command, startCommand.args, {
    cwd: REPOSITORY_ROOT,
    env: process.env,
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }
  child.on('error', (error) => {
    console.error(`Could not start the Playwright runtime: ${error.message}`)
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    if (code !== null) {
      process.exitCode = code
      return
    }
    process.exitCode = signal === 'SIGTERM' ? 143 : 130
  })
}

function main(args = process.argv.slice(2)) {
  const [command, ...options] = args
  if (command === 'resolve') {
    rejectUnknownOptions(
      options,
      new Set(['--profile', '--output', '--repo', '--devrouter-bin'])
    )
    const plan = resolveRuntimePlan({
      profile: option(options, '--profile'),
      output: option(options, '--output'),
      repo: option(options, '--repo', REPOSITORY_ROOT),
      devrouterBin: option(options, '--devrouter-bin', DEFAULT_DEVROUTER_BIN),
    })
    console.log(
      `Resolved Playwright profile ${plan.profile}: ${plan.apps.join(', ')}`
    )
    return
  }

  if (command === 'endpoints') {
    rejectUnknownOptions(options, new Set(['--plan']))
    const plan = validateRuntimePlan(
      readJson(planPath(options), 'Playwright runtime plan')
    )
    console.log(plan.serviceEndpoints.join(' '))
    return
  }

  if (command === 'start') {
    rejectUnknownOptions(options, new Set(['--plan']))
    const plan = validateRuntimePlan(
      readJson(planPath(options), 'Playwright runtime plan')
    )
    startRuntime(plan)
    return
  }

  fail(`unknown command ${command ?? '(missing)'}`)
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(`Invalid Playwright runtime input: ${error.message}`)
    process.exitCode = 1
  }
}
