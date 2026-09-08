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

export function runPnpm(
  args,
  env = process.env,
  { exists = commandExists, execute = run } = {}
) {
  // The host has deliberately filtered dependencies; only explicit installs
  // may change them, never pnpm's workspace-wide pre-run repair.
  const hostEnvironment = {
    ...env,
    pnpm_config_verify_deps_before_run: 'false',
  }
  if (exists('volta')) {
    const nodeBinary = execute('volta', ['which', 'node'], { capture: true })
    const toolchainDirectory = dirname(nodeBinary)
    const toolchainEnvironment = {
      ...hostEnvironment,
      PATH: `${toolchainDirectory}${delimiter}${env.PATH ?? ''}`,
    }

    return execute(join(toolchainDirectory, 'corepack'), ['pnpm', ...args], {
      env: toolchainEnvironment,
    })
  }

  return execute('pnpm', args, { env: hostEnvironment })
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

function resolveWorkspace() {
  const gitDir = run(
    'git',
    ['-C', repoRoot, 'rev-parse', '--path-format=absolute', '--git-dir'],
    { capture: true }
  )
  const commonDir = run(
    'git',
    ['-C', repoRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    { capture: true }
  )

  if (gitDir === commonDir) return ''

  const workspaceFile = join(gitDir, 'devrouter-workspace')
  if (!existsSync(workspaceFile)) {
    fail('devrouter did not persist a workspace token for this worktree')
  }

  return readFileSync(workspaceFile, 'utf8').trim()
}

function resolveDatabasePort() {
  const workingDirectory = join(repoRoot, '.devcontainer')
  const containerIds = run(
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

  const publishedPort = run('docker', ['port', containerIds[0], '5432/tcp'], {
    capture: true,
  })

  return parsePublishedPort(publishedPort)
}

function ensureHostDependencies(playwrightArgs) {
  const playwrightCli = join(
    repoRoot,
    'playwright',
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
  )

  if (!existsSync(playwrightCli)) {
    console.log('[playwright:host] Installing host Playwright dependencies')
    runPnpm([
      'install',
      '--filter',
      '@klicker-uzh/playwright...',
      '--frozen-lockfile',
    ])
  }

  if (!existsSync(join(repoRoot, 'packages', 'prisma', 'dist', 'index.js'))) {
    console.log('[playwright:host] Building host Prisma test dependency')
    runPnpm(['--filter', '@klicker-uzh/prisma', 'build'])
  }

  if (!existsSync(join(repoRoot, 'packages', 'types', 'dist', 'index.js'))) {
    console.log('[playwright:host] Building host shared test types')
    runPnpm(['--filter', '@klicker-uzh/types', 'build'])
  }

  if (playwrightArgs.includes('--list')) return

  const headed =
    playwrightArgs.includes('--headed') || playwrightArgs.includes('--ui')
  const installArgs = headed ? ['chromium'] : ['--only-shell', 'chromium']

  console.log('[playwright:host] Ensuring the host Chromium binary')
  runPnpm([
    '--filter',
    '@klicker-uzh/playwright',
    'exec',
    'playwright',
    'install',
    ...installArgs,
  ])
}

function parseLauncherArgs(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  let profile
  let mode
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
  return { args, profile, mode }
}

export function main(
  argv = process.argv.slice(2),
  {
    resolveCli = resolveDevrouter,
    execute = run,
    workspaceFor = resolveWorkspace,
    databasePortFor = resolveDatabasePort,
    readEnvironment = () =>
      readCommittedEnvironment(
        readFileSync(
          join(repoRoot, '.devcontainer', 'devcontainer.env'),
          'utf8'
        )
      ),
    dependenciesFor = ensureHostDependencies,
    pnpm = runPnpm,
    log = console.log,
  } = {}
) {
  const { args, profile, mode } = parseLauncherArgs(argv)
  const hostEnvironment = { ...process.env, [HOST_RUNNER_ENV]: '1' }
  assertPlaywrightHostBoundary({ env: hostEnvironment })

  if (mode === '--show-report') {
    dependenciesFor(['--list'])
    pnpm(
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

  const devrouter = resolveCli({ repo: repoRoot })
  log('[playwright:host] Reconciling the devcontainer runtime')
  execute(devrouter, [
    'ensure',
    repoRoot,
    ...(profile === undefined ? [] : ['--profile', profile]),
  ])

  const workspace = workspaceFor()
  const databasePort = databasePortFor()
  const committedEnvironment = readEnvironment()
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

  if (mode === '--print-env') {
    log(
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

  dependenciesFor(args)
  log(
    `[playwright:host] Running on the host against ${resolvedEnvironment.URL_MANAGE}`
  )
  pnpm(
    [
      '--filter',
      '@klicker-uzh/playwright',
      'exec',
      'playwright',
      'test',
      ...args,
    ],
    { ...process.env, ...resolvedEnvironment }
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
