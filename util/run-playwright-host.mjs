#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveDevrouter } from './devrouter-cli.mjs'
import {
  assertPlaywrightHostBoundary,
  HOST_RUNNER_ENV,
  preserveLocalDatabase,
} from './playwright-host-policy.mjs'

const require = createRequire(import.meta.url)
const {
  parseProfileManifest,
} = require('../.github/scripts/get-shard-files.js')

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PNPM_VERIFY_DEPS_ENV = 'pnpm_config_verify_deps_before_run'
export const PLAYWRIGHT_PROFILE_FALLBACK = 'playwright'
// Marks the root install as the launcher's Playwright-only filtered install so
// util/run-hook-pnpm.sh does not mistake it for a full host install.
export const FILTERED_INSTALL_MARKER = join(
  'node_modules',
  '.playwright-host-filtered-install'
)

const PLAYWRIGHT_OPTIONS_WITH_VALUES = new Set([
  '--browser',
  '--config',
  '--grep',
  '--grep-invert',
  '--global-timeout',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--shard',
  '--timeout',
  '--trace',
  '--ui-host',
  '--ui-port',
  '--update-source-method',
  '--websocket',
  '--workers',
  '-c',
  '-g',
  '-p',
])

const PLAYWRIGHT_BOOLEAN_OPTIONS = new Set([
  '--debug',
  '--fail-on-flaky-tests',
  '--forbid-only',
  '--fully-parallel',
  '--headed',
  '--ignore-snapshots',
  '--last-failed',
  '--list',
  '--no-deps',
  '--pass-with-no-tests',
  '--quiet',
  '--ui',
  '--update-snapshots',
  '--version',
  '--help',
])

function defaultClock() {
  return Number(process.hrtime.bigint()) / 1_000_000
}

function fail(message) {
  throw new Error(`[playwright:host] ${message}`)
}

function run(command, args, { capture = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.error) fail(`${command} could not start: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = capture ? result.stderr.trim() : ''
    fail(
      `${command} exited with ${result.status}${detail ? `: ${detail}` : ''}`
    )
  }

  return capture ? result.stdout.trim() : ''
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

function optionName(option) {
  return option.split('=', 1)[0]
}

function isWithinDirectory(directory, candidate) {
  const relativePath = relative(directory, candidate)
  return (
    relativePath !== '' &&
    !relativePath.startsWith(`..${sep}`) &&
    relativePath !== '..' &&
    !isAbsolute(relativePath)
  )
}

function resolveExistingSpecFile(
  argument,
  { root, pathExists = existsSync } = {}
) {
  if (
    typeof argument !== 'string' ||
    !argument.endsWith('.spec.ts') ||
    /[*?[\]]/.test(argument)
  ) {
    return undefined
  }

  const repositoryRoot = resolve(root)
  const packageRoot = join(repositoryRoot, 'playwright')
  const testsRoot = join(packageRoot, 'tests')
  const candidates = isAbsolute(argument)
    ? [resolve(argument)]
    : [
        resolve(repositoryRoot, argument),
        resolve(packageRoot, argument),
        ...(argument.includes('/') ? [] : [resolve(testsRoot, argument)]),
      ]

  for (const candidate of candidates) {
    if (isWithinDirectory(testsRoot, candidate) && pathExists(candidate)) {
      return candidate.slice(testsRoot.length + 1)
    }
  }

  return null
}

function selectedSpecFiles(args, { root, pathExists = existsSync } = {}) {
  const selected = []

  const addFilter = (argument) => {
    const file = resolveExistingSpecFile(argument, { root, pathExists })
    if (!file) return false
    selected.push(file)
    return true
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    if (argument === '--') {
      for (const filter of args.slice(index + 1)) {
        if (!addFilter(filter)) return null
      }
      break
    }

    if (!argument.startsWith('-')) {
      if (!addFilter(argument)) return null
      continue
    }

    const name = optionName(argument)
    if (argument.includes('=')) {
      if (
        !PLAYWRIGHT_OPTIONS_WITH_VALUES.has(name) &&
        !PLAYWRIGHT_BOOLEAN_OPTIONS.has(name)
      ) {
        return null
      }
      continue
    }

    if (PLAYWRIGHT_OPTIONS_WITH_VALUES.has(name)) {
      index++
      continue
    }

    if (PLAYWRIGHT_BOOLEAN_OPTIONS.has(name)) continue

    return null
  }

  return [...new Set(selected)]
}

export function inferPlaywrightProfile({
  args,
  root = repoRoot,
  pathExists = existsSync,
  readDirectory = readdirSync,
  readFile = readFileSync,
  parseProfileManifestFn = parseProfileManifest,
} = {}) {
  const selected = selectedSpecFiles(args, { root, pathExists })
  if (!selected?.length) return PLAYWRIGHT_PROFILE_FALLBACK

  try {
    const testsRoot = join(root, 'playwright', 'tests')
    const allFiles = readDirectory(testsRoot)
      .filter((file) => typeof file === 'string' && file.endsWith('.spec.ts'))
      .sort()
    const manifest = JSON.parse(
      readFile(join(root, 'playwright', 'profiles.json'), 'utf8')
    )
    const profiles = parseProfileManifestFn(manifest, allFiles)
    const apps = new Set()

    for (const file of selected) {
      const profile = profiles.get(file)
      if (!profile) return PLAYWRIGHT_PROFILE_FALLBACK
      for (const app of profile.split(',')) apps.add(app)
    }

    return [...apps].sort().join(',') || PLAYWRIGHT_PROFILE_FALLBACK
  } catch {
    return PLAYWRIGHT_PROFILE_FALLBACK
  }
}

function runPnpm(
  args,
  env = process.env,
  { runCommand = run, commandExistsFn = commandExists } = {}
) {
  const pnpmEnvironment = {
    ...env,
    [PNPM_VERIFY_DEPS_ENV]: 'error',
  }

  if (commandExistsFn('volta')) {
    const nodeBinary = runCommand('volta', ['which', 'node'], {
      capture: true,
    })
    const toolchainDirectory = dirname(nodeBinary)
    const toolchainEnvironment = {
      ...pnpmEnvironment,
      PATH: `${toolchainDirectory}${delimiter}${env.PATH ?? ''}`,
    }

    return runCommand(join(toolchainDirectory, 'corepack'), ['pnpm', ...args], {
      env: toolchainEnvironment,
    })
  }

  return runCommand('pnpm', args, { env: pnpmEnvironment })
}

function createRuntime({
  commandRunner = run,
  resolveDevrouterFn = resolveDevrouter,
  commandExistsFn = (command) => commandExists(command),
  pathExists = existsSync,
  readFile = readFileSync,
  writeFile = writeFileSync,
  readDirectory = readdirSync,
  parseProfileManifestFn = parseProfileManifest,
  clock = defaultClock,
  root = repoRoot,
  environment = process.env,
  log = console.log,
} = {}) {
  let devrouter
  return {
    devrouter: () =>
      (devrouter ??= resolveDevrouterFn({ repo: root, env: environment })),
    commandRunner,
    commandExistsFn,
    environment,
    log,
    pathExists,
    readFile,
    writeFile,
    readDirectory,
    parseProfileManifestFn,
    clock,
    repoRoot: root,
    runPnpm: (args, env = environment) =>
      runPnpm(args, env, { runCommand: commandRunner, commandExistsFn }),
  }
}

function createPhaseTimer(clock) {
  const elapsed = {
    preparation: 0,
    runtime: 0,
    browser: 0,
  }
  let active = 'preparation'
  let started = clock()

  const finish = () => {
    if (!active) return
    elapsed[active] += Math.max(0, clock() - started)
    active = undefined
  }

  return {
    begin(phase) {
      finish()
      active = phase
      started = clock()
    },
    finish,
    values: () => elapsed,
  }
}

function logPhaseTimings(runtime, timer, queueWaitSeconds = 0) {
  const elapsed = timer.values()
  const queueSuffix =
    queueWaitSeconds >= 1 ? ` queue-wait≈${queueWaitSeconds}s` : ''
  runtime.log(
    `[playwright:host] elapsed preparation=${elapsed.preparation.toFixed(1)}ms runtime=${elapsed.runtime.toFixed(1)}ms browser=${elapsed.browser.toFixed(1)}ms${queueSuffix}`
  )
}

const ENSURE_TELEMETRY_ENV = 'KLICKER_ENSURE_TELEMETRY'

function runRuntimeEnsure(runtime, args) {
  // The runtime reconciliation must keep streaming its progress live, so it
  // runs through a tee instead of a captured pipe; the devrouter helper
  // reports provider-queue contention on that output and the wait belongs in
  // the phase summary separately from real work.
  const telemetryFile = join(
    tmpdir(),
    `playwright-host-ensure-${process.pid}.log`
  )
  runtime.commandRunner(
    'sh',
    [
      '-c',
      'set -o pipefail; ensure_bin="$1"; shift; "$ensure_bin" "$@" 2>&1 | tee "$' +
        ENSURE_TELEMETRY_ENV +
        '"',
      'playwright-host-ensure',
      runtime.devrouter(),
      ...args,
    ],
    {
      env: {
        ...runtime.environment,
        [ENSURE_TELEMETRY_ENV]: telemetryFile,
      },
    }
  )
  return telemetryFile
}

function queueWaitSecondsFrom(readFile, telemetryFile) {
  try {
    const contents = readFile(telemetryFile, 'utf8')
    const waits = [...contents.matchAll(/waited (\d+)s so far/g)].map((match) =>
      Number(match[1])
    )
    return waits.length > 0 ? Math.max(...waits) : 0
  } catch {
    return 0
  } finally {
    rmSync(telemetryFile, { force: true })
  }
}

export function readCommittedEnvironment(contents) {
  const values = new Map()

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values.set(match[1], match[2])
  }

  return values
}

// `devrouter env --json` (report version 1) attributes the loopback port to
// this checkout's own devcontainer and names the reason when it cannot.
export function parseHostEnvironment(output) {
  let report
  try {
    report = JSON.parse(output)
  } catch {
    fail('devrouter env did not return a JSON report')
  }
  if (report?.version !== 1) {
    fail(`unsupported devrouter env report version ${report?.version}`)
  }
  const databases = (report.apps ?? []).filter(
    (app) => app.protocol === 'tcp' && app.tcpProtocol === 'postgres'
  )
  if (databases.length !== 1) {
    fail(
      `expected one Postgres app in devrouter env, found ${databases.length}`
    )
  }
  const [{ loopback, loopbackReason }] = databases
  if (!loopback) {
    fail(`the workspace Postgres has no loopback host port (${loopbackReason})`)
  }
  if (typeof loopback.host !== 'string' || !Number.isInteger(loopback.port)) {
    fail('the workspace Postgres loopback endpoint lacks a host or port')
  }
  return {
    workspace: report.workspace ?? '',
    databaseHost: loopback.host.includes(':')
      ? `[${loopback.host}]`
      : loopback.host,
    databasePort: loopback.port,
  }
}

export function parseLocalOptions(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  let profile
  let mode
  let preserveDatabase = false
  while (args.length) {
    const option = args[0]
    if (option === '--') {
      args.shift()
      break
    }
    if (
      option === '--runtime-profile' ||
      option.startsWith('--runtime-profile=')
    ) {
      if (profile !== undefined) fail('Specify --runtime-profile only once')
      args.shift()
      profile = option === '--runtime-profile' ? args.shift() : option.slice(18)
      const names = profile?.split(',') ?? []
      if (
        !names.length ||
        names.some((name) => !/^[a-z][a-z0-9-]*$/.test(name)) ||
        new Set(names).size !== names.length
      ) {
        fail('Invalid runtime profile list')
      }
    } else if (option === '--preserve-database') {
      args.shift()
      preserveDatabase = true
    } else if (option === '--print-env' || option === '--show-report') {
      if (mode) fail('Specify only one launcher mode')
      mode = args.shift()
    } else {
      break
    }
  }
  if (mode === '--show-report' && profile !== undefined) {
    fail('--show-report cannot select a runtime profile')
  }
  for (const option of args) {
    if (option.startsWith('--preserve-database=')) {
      fail(
        '--preserve-database does not accept a value; use space syntax before Playwright arguments'
      )
    }
    if (option === '--preserve-database') {
      fail(`${option} must appear before Playwright arguments`)
    }
  }
  return { args, profile, mode, preserveDatabase }
}

export function resolvePlaywrightEnvironment({
  appSecret,
  databaseTemplate,
  databaseHost = '127.0.0.1',
  databasePort,
  postgresContainer,
  workspace,
}) {
  const namespace = workspace ? `.${workspace}` : ''
  const appUrl = (app) => `https://${app}.klicker${namespace}.localhost`
  const databaseUrl = new URL(databaseTemplate)

  databaseUrl.hostname = databaseHost
  databaseUrl.port = String(databasePort)

  const studentUrl = appUrl('pwa')

  return {
    APP_ORIGIN_AUTH: appUrl('auth'),
    APP_SECRET: appSecret,
    COOKIE_DOMAIN: `klicker${namespace}.localhost`,
    DATABASE_URL: databaseUrl.toString(),
    KLICKER_PLAYWRIGHT_POSTGRES_CONTAINER: postgresContainer,
    [HOST_RUNNER_ENV]: '1',
    PLAYWRIGHT_BASE_URL: studentUrl,
    NEXT_PUBLIC_GROWTHBOOK_API_HOST: `${appUrl('manage')}/__growthbook__`,
    NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY: 'sdk-test',
    URL_AUTH: appUrl('auth'),
    URL_CHAT: appUrl('chat'),
    URL_CONTROL: appUrl('control'),
    URL_MANAGE: appUrl('manage'),
    URL_STUDENT: studentUrl,
    URL_STUDENT_LOGIN: `${studentUrl}/login`,
  }
}

function resolveGitDirectories(runtime) {
  const gitDir = runtime.commandRunner(
    'git',
    [
      '-C',
      runtime.repoRoot,
      'rev-parse',
      '--path-format=absolute',
      '--git-dir',
    ],
    { capture: true }
  )
  const commonDir = runtime.commandRunner(
    'git',
    [
      '-C',
      runtime.repoRoot,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ],
    { capture: true }
  )
  return { gitDir, commonDir }
}

// A linked worktree gets its devrouter workspace identity on its first ensure.
// Before that no devcontainer can exist, so there is nothing to stop.
function hasLinkedWorkspaceIdentity(runtime) {
  const { gitDir, commonDir } = resolveGitDirectories(runtime)
  return (
    gitDir === commonDir ||
    runtime.pathExists(join(gitDir, 'devrouter-workspace'))
  )
}

export function resolvePostgresContainer(runtime) {
  const workingDirectory = join(runtime.repoRoot, '.devcontainer')
  const containerIds = runtime
    .commandRunner(
      'docker',
      [
        'ps',
        '--filter',
        `label=com.docker.compose.project.working_dir=${workingDirectory}`,
        '--filter',
        'label=com.docker.compose.service=postgres',
        '--format',
        '{{.ID}}',
      ],
      { capture: true }
    )
    .split(/\r?\n/)
    .filter(Boolean)

  if (containerIds.length !== 1) {
    fail(
      `expected one Postgres container for ${workingDirectory}, found ${containerIds.length}`
    )
  }
  return containerIds[0]
}

function resolveHostEnvironment(runtime) {
  return parseHostEnvironment(
    runtime.commandRunner(
      runtime.devrouter(),
      ['env', runtime.repoRoot, '--json'],
      { capture: true }
    )
  )
}

function ensureHostDependencies(runtime, playwrightArgs) {
  const playwrightCli = join(
    runtime.repoRoot,
    'playwright',
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
  )

  if (!runtime.pathExists(playwrightCli)) {
    if (hasLinkedWorkspaceIdentity(runtime)) {
      runtime.log('[playwright:host] Stopping the devcontainer before install')
      runtime.commandRunner(runtime.devrouter(), ['stop', runtime.repoRoot])
    }
    runtime.log('[playwright:host] Installing host Playwright dependencies')
    runtime.runPnpm([
      'install',
      '--filter',
      '@klicker-uzh/playwright...',
      '--frozen-lockfile',
    ])
    runtime.writeFile(join(runtime.repoRoot, FILTERED_INSTALL_MARKER), '')
  }

  if (
    !runtime.pathExists(
      join(runtime.repoRoot, 'packages', 'prisma', 'dist', 'index.js')
    )
  ) {
    runtime.log('[playwright:host] Building host Prisma test dependency')
    runtime.runPnpm(['--filter', '@klicker-uzh/prisma', 'build'])
  }

  if (
    !runtime.pathExists(
      join(runtime.repoRoot, 'packages', 'types', 'dist', 'index.js')
    )
  ) {
    runtime.log('[playwright:host] Building host shared test types')
    runtime.runPnpm(['--filter', '@klicker-uzh/types', 'build'])
  }

  if (playwrightArgs.includes('--list')) return

  const headed =
    playwrightArgs.includes('--headed') || playwrightArgs.includes('--ui')
  const installArgs = headed ? ['chromium'] : ['--only-shell', 'chromium']

  runtime.log('[playwright:host] Ensuring the host Chromium binary')
  runtime.runPnpm([
    '--filter',
    '@klicker-uzh/playwright',
    'exec',
    'playwright',
    'install',
    ...installArgs,
  ])
}

export function main(argv = process.argv.slice(2), dependencies = {}) {
  const runtime = createRuntime(dependencies)
  const timer = createPhaseTimer(runtime.clock)
  let queueWaitSeconds = 0

  try {
    const { args, profile, mode, preserveDatabase } = parseLocalOptions(argv)
    const hostEnvironment = {
      ...runtime.environment,
      [HOST_RUNNER_ENV]: '1',
    }
    preserveLocalDatabase({
      ...hostEnvironment,
      KLICKER_PLAYWRIGHT_PRESERVE_DATABASE: preserveDatabase ? '1' : '0',
    })
    assertPlaywrightHostBoundary({
      cwd: dependencies.cwd,
      env: hostEnvironment,
      pathExists: runtime.pathExists,
    })

    if (mode === '--show-report') {
      ensureHostDependencies(runtime, ['--list'])
      timer.begin('browser')
      runtime.runPnpm(
        [
          '--filter',
          '@klicker-uzh/playwright',
          'exec',
          'playwright',
          'show-report',
          ...args,
        ],
        hostEnvironment
      )
      return
    }

    const printEnvironment = mode === '--print-env'

    if (!printEnvironment) ensureHostDependencies(runtime, args)

    const runtimeProfile =
      profile ??
      inferPlaywrightProfile({
        args,
        root: runtime.repoRoot,
        pathExists: runtime.pathExists,
        readDirectory: runtime.readDirectory,
        readFile: runtime.readFile,
        parseProfileManifestFn: runtime.parseProfileManifestFn,
      })

    timer.begin('runtime')
    runtime.log('[playwright:host] Reconciling the devcontainer runtime')
    const ensureTelemetry = runRuntimeEnsure(runtime, [
      'ensure',
      runtime.repoRoot,
      '--profile',
      runtimeProfile,
    ])
    queueWaitSeconds = queueWaitSecondsFrom(runtime.readFile, ensureTelemetry)

    const { workspace, databaseHost, databasePort } =
      resolveHostEnvironment(runtime)
    const postgresContainer = resolvePostgresContainer(runtime)
    const committedEnvironment = readCommittedEnvironment(
      runtime.readFile(
        join(runtime.repoRoot, '.devcontainer', 'devcontainer.env'),
        'utf8'
      )
    )
    const databaseTemplate = committedEnvironment.get('DATABASE_URL')
    const appSecret = committedEnvironment.get('APP_SECRET')

    if (!databaseTemplate || !appSecret) {
      fail('devcontainer.env must define DATABASE_URL and APP_SECRET')
    }

    const resolvedEnvironment = resolvePlaywrightEnvironment({
      appSecret,
      databaseTemplate,
      databaseHost,
      databasePort,
      postgresContainer,
      workspace,
    })

    if (printEnvironment) {
      runtime.log(
        JSON.stringify(
          {
            databaseHost: `${databaseHost}:${databasePort}`,
            postgresContainer,
            manageUrl: resolvedEnvironment.URL_MANAGE,
            studentUrl: resolvedEnvironment.URL_STUDENT,
            workspace: workspace || null,
          },
          null,
          2
        )
      )
      return
    }

    timer.begin('browser')
    runtime.log(
      `[playwright:host] Running on the host against ${resolvedEnvironment.URL_MANAGE}`
    )
    runtime.log(
      `[playwright:host] Stack: Next dev servers (CI tests production builds), profile=${runtimeProfile}, database=${databaseHost}:${databasePort}`
    )
    runtime.runPnpm(
      [
        '--filter',
        '@klicker-uzh/playwright',
        'exec',
        'playwright',
        'test',
        ...args,
      ],
      {
        ...runtime.environment,
        ...resolvedEnvironment,
        KLICKER_PLAYWRIGHT_PRESERVE_DATABASE: preserveDatabase ? '1' : '0',
      }
    )
  } finally {
    timer.finish()
    logPhaseTimings(runtime, timer, queueWaitSeconds)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
