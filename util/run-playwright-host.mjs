#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveDevrouter } from './devrouter-cli.mjs'
import {
  assertPlaywrightHostBoundary,
  HOST_RUNNER_ENV,
} from './playwright-host-policy.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PNPM_VERIFY_DEPS_ENV = 'pnpm_config_verify_deps_before_run'

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
    repoRoot: root,
    runPnpm: (args, env = environment) =>
      runPnpm(args, env, { runCommand: commandRunner, commandExistsFn }),
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

export function parsePublishedPort(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/:(\d+)$/)
    if (match) return Number(match[1])
  }

  fail('the workspace Postgres container has no loopback host port')
}

export function resolvePlaywrightEnvironment({
  appSecret,
  databaseTemplate,
  databasePort,
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

function resolveDatabasePort(runtime) {
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

  const publishedPort = runtime.commandRunner(
    'docker',
    ['port', containerIds[0], '5432/tcp'],
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

export function parseHostArguments(argv) {
  const input = argv[0] === '--' ? argv.slice(1) : argv
  const args = []
  let profile
  for (let index = 0; index < input.length; index += 1) {
    const arg = input[index]
    if (arg === '--profile' || arg.startsWith('--profile=')) {
      if (profile !== undefined) fail('Specify --profile only once')
      profile = arg === '--profile' ? input[++index] : arg.slice(10)
      if (
        !profile ||
        !/^[a-z0-9][a-z0-9-]*(?:,[a-z0-9][a-z0-9-]*)*$/.test(profile)
      ) {
        fail('--profile requires a comma-separated profile selection')
      }
    } else {
      args.push(arg)
    }
  }
  return { profile, args }
}

export function main(argv = process.argv.slice(2), dependencies = {}) {
  const runtime = createRuntime(dependencies)
  const hostEnvironment = {
    ...runtime.environment,
    [HOST_RUNNER_ENV]: '1',
  }
  assertPlaywrightHostBoundary({
    cwd: dependencies.cwd,
    env: hostEnvironment,
    pathExists: runtime.pathExists,
  })

  const { profile, args } = parseHostArguments(argv)
  if (args[0] === '--install-browser') {
    if (profile) fail('--profile cannot be combined with --install-browser')
    const installArgs = args.slice(1)
    if (installArgs.some((arg) => !['--force', '--dry-run'].includes(arg))) {
      fail('--install-browser accepts only --force and --dry-run')
    }
    const cli = join(
      runtime.repoRoot,
      'playwright/node_modules/@playwright/test/cli.js'
    )
    if (!runtime.pathExists(cli)) {
      fail(
        'Playwright CLI is missing; prepare host test dependencies separately. No workspace dependencies were changed.'
      )
    }
    runtime.commandRunner(process.execPath, [
      cli,
      'install',
      'chromium',
      ...installArgs,
    ])
    return
  }
  const showReport = args[0] === '--show-report'
  if (showReport) args.shift()

  if (showReport) {
    ensureHostDependencies(runtime, ['--list'])
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

  const printEnvironment = args[0] === '--print-env'
  if (printEnvironment) args.shift()

  if (!printEnvironment) ensureHostDependencies(runtime, args)

  runtime.log('[playwright:host] Reconciling the devcontainer runtime')
  runtime.commandRunner(runtime.devrouter(), [
    'ensure',
    runtime.repoRoot,
    ...(profile ? ['--profile', profile] : []),
  ])

  const workspace = resolveWorkspace(runtime)
  const databasePort = resolveDatabasePort(runtime)
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
    workspace,
  })

  if (printEnvironment) {
    runtime.log(
      JSON.stringify(
        {
          databaseHost: `127.0.0.1:${databasePort}`,
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
    { ...runtime.environment, ...resolvedEnvironment }
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
