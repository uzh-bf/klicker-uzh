'use strict'

// A Playwright build step has to produce every application and package the
// shards will start, and nothing else. A full ready-state wave keeps building
// the whole graph, which is what it has always done. A bounded plan spends its
// shards on a subset of the runtime, so it only needs that subset: the profile
// each shard declares is the same devrouter profile the shard resolves at
// startup, and the union of the selected profiles is the smallest graph that
// can serve them.
//
// Everything here fails closed towards the full graph. An absent plan, a shard
// without a profile, a maximal profile, an incomplete profile runtime, an
// unavailable resolver, or a filter that is not a workspace package selector
// all keep the build as it was, because an incomplete graph fails the shards
// while a too large one only costs time.

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const PLAN_SCHEMA_VERSION = 1
const SUPPORTED_PLAN_MODES = ['skip', 'selected', 'full']
// One workspace package selector: the only filter shape this module accepts.
const TURBO_FILTER = /^--filter=@klicker-uzh\/[a-z0-9][a-z0-9-]*$/
// The trusted selector assigns 'full' to every spec it cannot place in a
// narrower group, and the devrouter runtime calls that maximal profile
// 'playwright'. Either component needs the complete application runtime.
const MAXIMAL_PROFILE_COMPONENTS = new Set(['full', 'playwright'])
// The shard runtime refuses to start from a partially present profile runtime,
// so a build graph that cannot see all three files assumes the legacy stack.
const PROFILE_RUNTIME_FILES = [
  'playwright/profiles.json',
  'playwright/runtime-contract.yml',
  'util/playwright-profile-runtime.mjs',
]
const RESOLVER_TIMEOUT_MS = 120000

function fail(message) {
  throw new Error(message)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${filePath}: ${error.message}`)
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`)
  }
  return value.trim()
}

// The distinct profiles of the selected shards, in plan order.
function planProfiles(plan) {
  if (!plan || plan.schemaVersion !== PLAN_SCHEMA_VERSION) {
    fail(`unsupported Playwright plan schema ${String(plan?.schemaVersion)}`)
  }
  if (!SUPPORTED_PLAN_MODES.includes(plan.mode)) {
    fail(`unsupported Playwright plan mode ${String(plan.mode)}`)
  }
  if (!Array.isArray(plan.shards) || plan.shards.length === 0) {
    fail('a narrowed build graph needs at least one shard profile')
  }
  const profiles = []
  for (const shard of plan.shards) {
    const profile = requireString(shard?.profile, 'every shard needs a profile')
    if (!profiles.includes(profile)) profiles.push(profile)
  }
  return profiles
}

// 'manage,pwa' and 'pwa' merge to 'manage,pwa', the same additive selection the
// devrouter profiles document.
function mergedProfile(profiles) {
  const components = new Set()
  for (const profile of profiles) {
    for (const component of profile.split(',')) {
      const value = component.trim()
      if (value.length === 0) {
        fail('a shard profile contains an empty component')
      }
      components.add(value)
    }
  }
  return {
    maximal: [...components].some((component) =>
      MAXIMAL_PROFILE_COMPONENTS.has(component)
    ),
    profile: [...components].sort().join(','),
  }
}

function profileRuntimeComplete(root) {
  return PROFILE_RUNTIME_FILES.every((file) =>
    fs.existsSync(path.join(root, file))
  )
}

// The decision the workflow needs before it installs anything: build the full
// graph, or resolve the bounded profile the shards already agree on.
function inspectPlan({ plan, root }) {
  if (plan?.mode !== 'selected') {
    return {
      mode: 'full',
      profile: '',
      reason: `plan-mode-${String(plan?.mode)}`,
    }
  }
  if (!profileRuntimeComplete(root)) {
    return { mode: 'full', profile: '', reason: 'profile-runtime-incomplete' }
  }
  let merged
  try {
    merged = mergedProfile(planProfiles(plan))
  } catch (error) {
    return {
      mode: 'full',
      profile: '',
      reason: 'plan-unusable',
      detail: error.message,
    }
  }
  if (merged.maximal) {
    return { mode: 'full', profile: '', reason: 'maximal-profile' }
  }
  return { mode: 'bounded', profile: merged.profile, reason: 'bounded-profile' }
}

// The filters the build step passes to Turbo. The resolver is the checkout's
// own profile runtime, so the graph is the same set of applications the shards
// resolve from that revision.
function resolveProfileFilters({
  profile,
  root,
  devrouterBin,
  outputPath,
  run = spawnSync,
}) {
  const result = run(
    process.execPath,
    [
      path.join(root, 'util', 'playwright-profile-runtime.mjs'),
      'resolve',
      '--repo',
      root,
      '--profile',
      profile,
      '--output',
      outputPath,
      ...(devrouterBin ? ['--devrouter-bin', devrouterBin] : []),
    ],
    { cwd: root, encoding: 'utf8', timeout: RESOLVER_TIMEOUT_MS }
  )
  if (result.error) {
    fail(`the profile resolver could not start: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '')
      .trim()
      .split(/\r?\n/)
      .slice(-3)
      .join(' ')
    fail(`the profile resolver failed: ${detail}`)
  }
  const resolved = readJson(outputPath, 'resolved runtime plan')
  const bindings = resolved?.bindings
  if (!bindings || typeof bindings !== 'object') {
    fail('the resolved runtime plan declares no bindings')
  }
  if (
    !Array.isArray(bindings.turboFilters) ||
    bindings.turboFilters.length === 0
  ) {
    fail('the resolved runtime plan declares no turbo filters')
  }
  const filters = [...new Set(bindings.turboFilters)].sort()
  for (const filter of filters) {
    if (!TURBO_FILTER.test(filter)) fail(`unexpected turbo filter ${filter}`)
  }
  return {
    apps: Array.isArray(resolved.apps) ? [...resolved.apps].sort() : [],
    filters,
  }
}

function planBuildGraph({ plan, root, devrouterBin, outputPath, run }) {
  const inspection = inspectPlan({ plan, root })
  if (inspection.mode === 'full') {
    return { ...inspection, apps: [], filters: [] }
  }
  try {
    const resolved = resolveProfileFilters({
      profile: inspection.profile,
      root,
      devrouterBin,
      outputPath,
      run,
    })
    return { ...inspection, apps: resolved.apps, filters: resolved.filters }
  } catch (error) {
    return {
      mode: 'full',
      profile: inspection.profile,
      reason: 'resolver-unavailable',
      detail: error.message,
      apps: [],
      filters: [],
    }
  }
}

function writeGithubOutputs(values, outputPath) {
  const lines = Object.entries(values).map(
    ([name, value]) => `${name}=${String(value).replace(/\r?\n/g, ' ')}`
  )
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

// The build step reads this file with mapfile. A full graph must remove it
// instead of leaving a previous filter list behind, because a stale list would
// silently bound a wave that decided to stay complete.
function writeBuildFilters(filtersPath, graph) {
  if (!filtersPath) return
  if (graph.mode === 'bounded' && graph.filters.length > 0) {
    fs.writeFileSync(filtersPath, `${graph.filters.join('\n')}\n`)
    return
  }
  fs.rmSync(filtersPath, { force: true })
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (
      typeof name !== 'string' ||
      !name.startsWith('--') ||
      value === undefined
    ) {
      fail(`expected an option value after ${String(name)}`)
    }
    args[name.slice(2)] = value
  }
  return args
}

function runCli(argv) {
  const args = parseArgs(argv)
  const root = path.resolve(requireString(args.root, '--root'))
  const plan = readJson(requireString(args.plan, '--plan'), 'Playwright plan')
  const runnerTemp = args['runner-temp'] || '/tmp'
  const graph = planBuildGraph({
    plan,
    root,
    // The build job installs the planner and exports this exact path.
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: workflow contract
    devrouterBin: args.devrouter || process.env.KLICKER_DEVROUTER_BIN,
    outputPath: path.join(runnerTemp, 'playwright-build-runtime.json'),
  })
  if (args['filters-path']) {
    writeBuildFilters(args['filters-path'], graph)
  }
  if (args.output) {
    writeGithubOutputs(
      {
        apps: graph.apps.join(','),
        filters: graph.filters.join(' '),
        mode: graph.mode,
        profile: graph.profile,
        reason: graph.reason,
      },
      args.output
    )
  }
  console.log(JSON.stringify(graph))
  if (graph.mode === 'full' && graph.reason !== 'plan-mode-full') {
    console.log(
      '::warning::the minimum build graph stays full (' +
        String(graph.reason) +
        '); the wave builds every package and application'
    )
  }
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2))
  } catch (error) {
    console.error(`::error::${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  MAXIMAL_PROFILE_COMPONENTS,
  PLAN_SCHEMA_VERSION,
  PROFILE_RUNTIME_FILES,
  TURBO_FILTER,
  inspectPlan,
  mergedProfile,
  planBuildGraph,
  planProfiles,
  profileRuntimeComplete,
  resolveProfileFilters,
  writeBuildFilters,
  writeGithubOutputs,
}
