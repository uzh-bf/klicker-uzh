#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const SCHEMA_VERSION = 1
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_DEVROUTER_BIN = resolve(
  REPOSITORY_ROOT,
  'node_modules/.bin/devrouter'
)
const PROFILE_PLAN_CONTRACT = 'playwright/runtime-contract.yml'
const PLAYWRIGHT_FULL_PROFILE = 'playwright'
const TRUSTED_FULL_PROFILE_COMPONENTS = new Set([
  'chat',
  'full',
  'live-quiz',
  'manage',
  'pwa',
])
const PROFILE_PLAN_BINDINGS = ['serviceEndpoints', 'turboFilters']
const TURBO_FILTER = /^--filter=@klicker-uzh\/[a-z0-9][a-z0-9-]*$/
const LOOPBACK_ENDPOINT =
  /^http:\/\/127\.0\.0\.1:[0-9]{1,5}(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?$/

function fail(message) {
  throw new Error(message)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`)
  }
  return value
}

function requireStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    fail(`${label} must be an array of non-empty strings`)
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

function requireExactArray(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => item !== expected[index])
  ) {
    fail(`${label} must equal ${expected.join(', ')}`)
  }
}

export function validateRuntimePlan(plan) {
  if (!plan || plan.schemaVersion !== SCHEMA_VERSION) {
    fail(`unsupported Playwright runtime schema ${plan?.schemaVersion}`)
  }

  requireString(plan.repoPath, 'repoPath')
  const profile = requireString(plan.profile, 'profile')
  const apps = requireCanonicalArray(plan.apps, 'apps')
  if (apps.length === 0) fail('runtime plan must select at least one app')
  const dependencies = requireCanonicalArray(plan.dependencies, 'dependencies')
  if (dependencies.length > 0) {
    fail(
      `Playwright runtime does not support dependencies: ${dependencies.join(', ')}`
    )
  }
  const upstreamReadiness = requireCanonicalArray(plan.readiness, 'readiness')
  for (const app of upstreamReadiness) {
    if (!apps.includes(app)) fail(`readiness app ${app} is not selected`)
  }
  if (!plan.managedRuntime || typeof plan.managedRuntime !== 'object') {
    fail('managedRuntime must be an object')
  }
  const managedServices = requireCanonicalArray(
    plan.managedRuntime.services,
    'managedRuntime.services'
  )
  requireCanonicalArray(
    plan.managedRuntime.processes,
    'managedRuntime.processes'
  )

  const contractPath = requireString(plan.contractPath, 'contractPath')
  if (contractPath !== PROFILE_PLAN_CONTRACT) {
    fail(`contractPath must equal ${PROFILE_PLAN_CONTRACT}`)
  }
  if (!plan.bindings || typeof plan.bindings !== 'object') {
    fail('bindings must be an object')
  }
  requireExactArray(
    Object.keys(plan.bindings).sort(),
    PROFILE_PLAN_BINDINGS,
    'binding keys'
  )

  const turboFilters = requireStringArray(
    plan.bindings.turboFilters,
    'bindings.turboFilters'
  )
  if (turboFilters.length === 0) fail('bindings.turboFilters must not be empty')
  for (const filter of turboFilters) {
    if (!TURBO_FILTER.test(filter)) fail(`unsafe Turbo filter ${filter}`)
  }
  const serviceEndpoints = requireStringArray(
    plan.bindings.serviceEndpoints,
    'bindings.serviceEndpoints'
  )
  if (serviceEndpoints.length === 0) {
    fail('bindings.serviceEndpoints must not be empty')
  }
  for (const endpoint of serviceEndpoints) {
    if (!LOOPBACK_ENDPOINT.test(endpoint)) {
      fail(`unsafe service endpoint ${endpoint}`)
    }
    let port
    try {
      port = Number(new URL(endpoint).port)
    } catch {
      fail(`unsafe service endpoint ${endpoint}`)
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail(`unsafe service endpoint ${endpoint}`)
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    apps,
    upstreamReadiness,
    managedServices,
    turboFilters: [...turboFilters].sort(),
    serviceEndpoints: [...serviceEndpoints].sort(),
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
  contract = PROFILE_PLAN_CONTRACT,
}) {
  requireString(profile, 'profile selection')
  requireString(output, 'output path')
  requireString(contract, 'contract path')

  const profileComponents = profile.split(',')
  const runtimeProfile =
    profileComponents.includes('full') &&
    profileComponents.every((component) =>
      TRUSTED_FULL_PROFILE_COMPONENTS.has(component)
    )
      ? PLAYWRIGHT_FULL_PROFILE
      : profile

  const result = spawnSync(
    devrouterBin,
    [
      'profile',
      'plan',
      '--repo',
      repo,
      '--profile',
      runtimeProfile,
      '--contract',
      contract,
      '--output',
      output,
      '--json',
    ],
    { encoding: 'utf8' }
  )
  if (result.error) {
    fail(`Devrouter profile planning could not start: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || `exit status ${result.status}`
    fail(`Devrouter profile planning failed: ${detail}`)
  }

  let stdoutPlan
  try {
    stdoutPlan = JSON.parse(result.stdout)
  } catch (error) {
    fail(`Devrouter returned invalid JSON: ${error.message}`)
  }

  const filePlan = readJson(output, 'Devrouter profile plan')
  if (!isDeepStrictEqual(stdoutPlan, filePlan)) {
    fail('Devrouter stdout and output plans differ')
  }
  const runtime = validateRuntimePlan(filePlan)
  if (resolve(filePlan.repoPath) !== resolve(repo)) {
    fail(`Devrouter resolved unexpected repository ${filePlan.repoPath}`)
  }
  return runtime
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

export function buildStartCommand(plan) {
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

// The profile runtime replaces the legacy "run-p --race" startup, which
// always ran the mock GrowthBook feature-flag server next to the test apps.
// Server-side flag resolution points at 127.0.0.1:4010, so a runtime without
// this process silently disables every AI/beta feature under test.
export function buildGrowthBookCommand() {
  return {
    command: 'node',
    args: ['./playwright/util/mockGrowthBookServer.mjs'],
  }
}

// 'exit' and 'error' can both fire for one child, so each child's terminal
// outcome is recorded at most once. The first non-benign failure wins, and
// the final code is only produced after every child has been recorded.
export function createTerminalAccounting(childCount) {
  const settled = new Array(childCount).fill(false)
  let remaining = childCount
  let failureCode = null
  return {
    record(index, code) {
      if (settled[index]) {
        return undefined
      }
      settled[index] = true
      remaining -= 1
      if (code !== null && failureCode === null) {
        failureCode = code
      }
      return remaining === 0 ? (failureCode ?? 0) : undefined
    },
  }
}

// A child that already terminated on its own must keep its real exit
// classification. Only still-running children are marked as stopped by us
// and killed; re-marking an exited child could mask its non-zero code.
export function stopRunningChildren(children, signal) {
  for (const entry of children) {
    if (
      entry.child.exitCode !== null ||
      entry.child.signalCode !== null ||
      entry.child.killed
    ) {
      continue
    }
    // Only a successful kill makes the later exit benign; a failed kill
    // must leave the child's own terminal classification intact.
    if (!entry.child.kill(signal)) {
      continue
    }
    entry.stoppedByUs = true
  }
}

function startRuntime(plan) {
  console.log(
    `Starting Playwright profile ${plan.profile}: ${plan.apps.join(', ')}`
  )
  console.log(`Turbo filters: ${plan.turboFilters.join(' ')}`)

  const commands = [
    ['test apps', buildStartCommand(plan)],
    ['mock GrowthBook server', buildGrowthBookCommand()],
  ]
  const children = commands.map(([name, command]) => {
    const child = spawn(command.command, command.args, {
      cwd: REPOSITORY_ROOT,
      env: process.env,
      stdio: 'inherit',
    })
    return { name, child, stoppedByUs: false }
  })

  const stopAll = (signal) => stopRunningChildren(children, signal)
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => stopAll(signal))
  }

  let failureCode = null
  const accounting = createTerminalAccounting(children.length)
  const settle = (index, code) => {
    if (code !== null && failureCode === null) {
      failureCode = code
      // Mirror run-p --race: stop the remaining runtime processes on the
      // first failure so the shard fails loudly instead of limping.
      stopAll('SIGTERM')
    }
    const finalCode = accounting.record(index, code)
    if (finalCode !== undefined) {
      process.exitCode = finalCode
    }
  }

  for (const [index, { name, child }] of children.entries()) {
    child.on('error', (error) => {
      console.error(`Could not start ${name}: ${error.message}`)
      settle(index, 1)
    })
    child.on('exit', (code, signal) => {
      const entry = children.find((candidate) => candidate.child === child)
      if (entry?.stoppedByUs) {
        settle(index, null)
        return
      }
      settle(index, code === null ? (signal === 'SIGTERM' ? 143 : 130) : code)
    })
  }
}

function main(args = process.argv.slice(2)) {
  const [command, ...options] = args
  if (command === 'resolve') {
    rejectUnknownOptions(
      options,
      new Set([
        '--profile',
        '--output',
        '--repo',
        '--devrouter-bin',
        '--contract',
      ])
    )
    const plan = resolveRuntimePlan({
      profile: option(options, '--profile'),
      output: option(options, '--output'),
      repo: option(options, '--repo', REPOSITORY_ROOT),
      devrouterBin: option(options, '--devrouter-bin', DEFAULT_DEVROUTER_BIN),
      contract: option(options, '--contract', PROFILE_PLAN_CONTRACT),
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
