#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
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

function logPhaseTimings(runtime, timer) {
  const elapsed = timer.values()
  runtime.log(
    `[playwright:host] elapsed preparation=${elapsed.preparation.toFixed(1)}ms runtime=${elapsed.runtime.toFixed(1)}ms browser=${elapsed.browser.toFixed(1)}ms`
  )
}

export function readCommittedEnvironment(contents) {
  const values = new Map()

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values.set(match[1], match[2])
  }

  return values
}

export function parsePublishedPort(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/:(\d+)$/)
    if (match) return Number(match[1])
  }

  fail('the workspace Postgres container has no loopback host port')
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
  databasePort,
  postgresContainer,
  workspace,
}) {
  const namespace = workspace ? `.${workspace}` : ''
  const appUrl = (app) => `https://${app}.klicker${namespace}.localhost`
  const databaseUrl = new URL(databaseTemplate)

  databaseUrl.hostname = '127.0.0.1'
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

function resolveWorkspace(runtime) {
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

  if (gitDir === commonDir) return ''

  const workspaceFile = join(gitDir, 'devrouter-workspace')
  if (!runtime.pathExists(workspaceFile)) {
    fail('devrouter did not persist a workspace token for this worktree')
  }

  return runtime.readFile(workspaceFile, 'utf8').trim()
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

export function resolveDatabasePort(runtime, containerId) {
  if (!containerId) fail('a Postgres container id is required')

  const publishedPort = runtime.commandRunner(
    'docker',
    ['port', containerId, '5432/tcp'],
    { capture: true }
  )

  return parsePublishedPort(publishedPort)
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
    runtime.log('[playwright:host] Stopping the devcontainer before install')
    runtime.commandRunner(runtime.devrouter(), ['stop', runtime.repoRoot])
    runtime.log('[playwright:host] Installing host Playwright dependencies')
    runtime.runPnpm([
      'install',
      '--filter',
      '@klicker-uzh/playwright...',
      '--frozen-lockfile',
    ])
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
    runtime.commandRunner(runtime.devrouter(), [
      'ensure',
      runtime.repoRoot,
      '--profile',
      runtimeProfile,
    ])

    const workspace = resolveWorkspace(runtime)
    const postgresContainer = resolvePostgresContainer(runtime)
    const databasePort = resolveDatabasePort(runtime, postgresContainer)
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
      databasePort,
      postgresContainer,
      workspace,
    })

    if (printEnvironment) {
      runtime.log(
        JSON.stringify(
          {
            databaseHost: `127.0.0.1:${databasePort}`,
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
    logPhaseTimings(runtime, timer)
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
