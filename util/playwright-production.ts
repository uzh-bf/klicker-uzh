#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  type ChildProcess,
  execFileSync,
  type SpawnOptions,
  spawn,
  spawnSync,
} from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { productionSpecs } from '../.github/scripts/playwright-shards.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextApps = ['auth', 'frontend-pwa', 'frontend-manage'] as const
const ports = {
  'backend-docker': 3000,
  auth: 3010,
  'frontend-pwa': 3001,
  'frontend-manage': 3002,
} as const
const serviceApps = Object.keys(ports) as ProductionApp[]
const manifestPath = '.devcontainer/.runtime/production-artifacts.json'
const defaultCleanupTimeoutMs = 5000

type ProductionApp = keyof typeof ports
type Environment = NodeJS.ProcessEnv

type InputIdentity = {
  sourceSha: string | undefined
  sourceDigest: string | undefined
  architecture: string
  node: string
  lockfile: string
  buildInputs: Record<string, string | undefined>
}

type Artifact = {
  buildId?: string
  digest?: string
  bundler?: string
}

type ArtifactManifest = InputIdentity & {
  artifacts: Record<string, Artifact>
}

type ProfileManifest = {
  version: number
  groups: Array<{
    profile: string
    specs: string[]
    runtime?: string
  }>
}

type PlaywrightTest = {
  projectName?: unknown
  expectedStatus?: unknown
  status?: unknown
  results?: unknown
}

type PlaywrightTestRecord = {
  key: string
  file: string
  test: PlaywrightTest
}

export const REQUIRED_ACCOUNT_SPECS = Object.freeze([
  'A-account-lti.spec.ts',
  'A-account-production.spec.ts',
  'A-account-registration.spec.ts',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function productionEnvironment(
  env: Environment,
  workspaceRoot = root
): Environment {
  assert.equal(
    env.NODE_ENV,
    'production',
    'Production runtime requires NODE_ENV=production'
  )
  assert.deepEqual((env.DEVROUTER_PROFILE ?? '').split(',').sort(), [
    'email',
    'manage',
    'pwa',
  ])
  assert.equal(
    env.EMAIL_HOST,
    'mailhog',
    'Production tests require local MailHog SMTP'
  )
  assert.equal(env.EMAIL_PORT, '1025')
  for (const key of ['TEAMS_WEBHOOK_URL', 'EMAIL_USER', 'EMAIL_PASS'])
    assert(!env[key], 'External integration must be absent: ' + key)
  assert.match(
    env.KLICKER_PRODUCTION_SOURCE_SHA ?? env.CANDIDATE_SHA ?? '',
    /^[a-f0-9]{40}$/
  )
  for (const key of [
    'APP_ORIGIN_API',
    'APP_ORIGIN_AUTH',
    'APP_ORIGIN_PWA',
    'APP_ORIGIN_MANAGE',
  ]) {
    const url = new URL(env[key] ?? '')
    assert(
      url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost'),
      'Nonlocal origin: ' + key
    )
  }
  assert.equal(env.NEXT_PUBLIC_API_URL, env.APP_ORIGIN_API + '/api/graphql')
  assert.equal(env.NEXT_PUBLIC_PWA_URL, env.APP_ORIGIN_PWA)
  assert.equal(env.NEXT_PUBLIC_MANAGE_URL, env.APP_ORIGIN_MANAGE)
  assert(
    !existsSync(
      join(workspaceRoot, '.devcontainer/.runtime/beta-enrollment-fixture')
    ),
    'Incompatible beta fixture'
  )
  return {
    ...env,
    EMAIL_FROM: 'account-tests@example.invalid',
    HOSTNAME: '0.0.0.0',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_MATOMO_URL: '',
    NEXT_PUBLIC_MATOMO_SITE_ID: '',
  }
}

function treeDigest(directory: string): string {
  const hash = createHash('sha256')
  function visit(dir: string, prefix = ''): void {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const relative = prefix + '/' + entry.name
      if (entry.isDirectory() && relative.endsWith('/.next/cache/images'))
        continue
      if (
        relative.includes('/.next/server/pages/') &&
        /\.(?:html|json)$/.test(relative) &&
        !relative.endsWith('.nft.json')
      )
        continue
      const file = join(dir, entry.name)
      if (entry.isDirectory()) visit(file, relative)
      else if (entry.isFile()) hash.update(relative).update(readFileSync(file))
      else if (entry.isSymbolicLink())
        hash.update(relative).update(readlinkSync(file))
    }
  }
  visit(directory)
  return hash.digest('hex')
}

export function inputIdentity(
  env: Environment,
  workspaceRoot = root
): InputIdentity {
  const buildInputs: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    if (
      key.startsWith('NEXT_PUBLIC_') ||
      [
        'COOKIE_DOMAIN',
        'API_DOMAIN',
        'APP_ORIGIN_API',
        'APP_ORIGIN_AUTH',
        'APP_ORIGIN_PWA',
        'APP_ORIGIN_MANAGE',
      ].includes(key)
    )
      buildInputs[key] = value
  }
  return {
    sourceSha: env.KLICKER_PRODUCTION_SOURCE_SHA ?? env.CANDIDATE_SHA,
    sourceDigest: env.KLICKER_PRODUCTION_SOURCE_DIGEST ?? env.CANDIDATE_SHA,
    architecture: process.arch,
    node: process.version,
    lockfile: digest(readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'))),
    buildInputs: Object.fromEntries(
      Object.entries(buildInputs).sort(([a], [b]) => a.localeCompare(b))
    ),
  }
}

function runPnpm(args: readonly string[], env: Environment, cwd: string): void {
  const result = spawnSync('pnpm', [...args], { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, 'Production build failed')
}

export function build(env = process.env, workspaceRoot = root): void {
  env = productionEnvironment(env, workspaceRoot)
  const identity = inputIdentity(env, workspaceRoot)
  const filters = serviceApps.map(
    (app) => '--filter=@klicker-uzh/' + app + '^...'
  )
  runPnpm(
    ['exec', 'turbo', 'run', 'build', '--force', ...filters],
    env,
    workspaceRoot
  )
  runPnpm(
    ['--filter', '@klicker-uzh/backend-docker', 'build'],
    env,
    workspaceRoot
  )
  for (const app of nextApps) {
    runPnpm(
      ['--filter', '@klicker-uzh/' + app, 'exec', 'next', 'build', '--webpack'],
      env,
      workspaceRoot
    )
    const appRoot = join(workspaceRoot, 'apps', app)
    const output = join(appRoot, '.next/standalone/apps', app)
    assert(existsSync(join(output, 'server.js')), 'Missing standalone server')
    cpSync(join(appRoot, '.next/static'), join(output, '.next/static'), {
      recursive: true,
    })
    if (existsSync(join(appRoot, 'public')))
      cpSync(join(appRoot, 'public'), join(output, 'public'), {
        recursive: true,
      })
  }
  const artifacts: Record<string, Artifact> = Object.fromEntries(
    nextApps.map((app) => [
      app,
      {
        buildId: readFileSync(
          join(workspaceRoot, 'apps', app, '.next/BUILD_ID'),
          'utf8'
        ).trim(),
        digest: treeDigest(
          join(workspaceRoot, 'apps', app, '.next/standalone')
        ),
        bundler: 'webpack',
      },
    ])
  )
  artifacts['backend-docker'] = {
    digest: treeDigest(join(workspaceRoot, 'apps/backend-docker/dist')),
    bundler: 'rollup',
  }
  const output = join(workspaceRoot, manifestPath)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(
    output,
    JSON.stringify({ ...identity, artifacts }, null, 2) + '\n'
  )
}

function artifactManifest(value: unknown): ArtifactManifest {
  assert(isRecord(value), 'Invalid production artifact manifest')
  assert(isRecord(value.artifacts), 'Missing production artifacts')
  return value as ArtifactManifest
}

export function verify(
  env: Environment,
  workspaceRoot = root
): ArtifactManifest {
  const manifest = artifactManifest(
    JSON.parse(readFileSync(join(workspaceRoot, manifestPath), 'utf8'))
  )
  const { artifacts, ...identity } = manifest
  assert.deepEqual(
    identity,
    inputIdentity(env, workspaceRoot),
    'Stale production build inputs'
  )
  for (const app of serviceApps) {
    const directory = join(
      workspaceRoot,
      'apps',
      app,
      app === 'backend-docker' ? 'dist' : '.next/standalone'
    )
    assert.equal(
      treeDigest(directory),
      artifacts[app]?.digest,
      'Changed production artifact: ' + app
    )
  }
  return manifest
}

export type ChildCommandOptions = {
  label?: string
  cwd?: string
  env?: Environment
  stdio?: SpawnOptions['stdio']
  detached?: boolean
}

export type ChildCommandExit = {
  code: number | null
  signal: NodeJS.Signals | null
}

export type RunningChild = {
  label: string
  child: ChildProcess | undefined
  completion: Promise<ChildCommandExit>
  isRunning: () => boolean
  stop: (signal?: NodeJS.Signals) => boolean
}

export type ProductionChildCommand = {
  label: string
  command: string
  args: readonly string[]
  cwd?: string
  env?: Environment
  stdio?: SpawnOptions['stdio']
  detached?: boolean
}

export function runChildCommand(
  command: string,
  args: readonly string[],
  options: ChildCommandOptions = {}
): RunningChild {
  const label = options.label ?? command
  let child: ChildProcess | undefined
  let settled = false
  let resolveCompletion: (exit: ChildCommandExit) => void = () => undefined
  let rejectCompletion: (error: unknown) => void = () => undefined
  const detached = options.detached ?? process.platform !== 'win32'
  const completion = new Promise<ChildCommandExit>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })
  const failToSpawn = (error: unknown): void => {
    if (settled) return
    settled = true
    rejectCompletion(
      new Error('Failed to spawn ' + label + ': ' + errorMessage(error), {
        cause: error,
      })
    )
  }
  try {
    child = spawn(command, [...args], {
      cwd: options.cwd,
      detached,
      env: options.env,
      stdio: options.stdio ?? 'inherit',
    })
    child.once('error', failToSpawn)
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      resolveCompletion({ code, signal })
    })
  } catch (error) {
    failToSpawn(error)
  }
  void completion.catch(() => undefined)
  return {
    label,
    child,
    completion,
    isRunning: () =>
      (child !== undefined &&
        child.exitCode === null &&
        child.signalCode === null) ||
      processGroupAlive(child, detached),
    stop: (signal = 'SIGTERM') => {
      if (child === undefined) return false
      const pid = child.pid
      try {
        if (pid !== undefined && processGroupAlive(child, detached)) {
          try {
            process.kill(-pid, signal)
            return true
          } catch {
            // The group may have exited between the state check and the signal.
          }
        }
        if (child.exitCode !== null || child.signalCode !== null) return false
        return child.kill(signal)
      } catch {
        return false
      }
    },
  }
}

function commandFromSpec(spec: ProductionChildCommand): RunningChild {
  return runChildCommand(spec.command, spec.args, spec)
}

function processGroupAlive(
  child: ChildProcess | undefined,
  detached: boolean
): boolean {
  if (
    child === undefined ||
    !detached ||
    process.platform === 'win32' ||
    child.pid === undefined
  )
    return false
  try {
    process.kill(-child.pid, 0)
    return true
  } catch (error) {
    return isRecord(error) && error.code === 'EPERM'
  }
}

function formatChildExit(child: RunningChild, exit: ChildCommandExit): string {
  if (exit.signal) return child.label + ' exited with signal ' + exit.signal
  return child.label + ' exited with code ' + (exit.code ?? 'unknown')
}

async function waitForSuccessfulChild(child: RunningChild): Promise<void> {
  const exit = await child.completion
  assert.equal(exit.code, 0, formatChildExit(child, exit))
  assert.equal(exit.signal, null, formatChildExit(child, exit))
}

async function waitForChildren(
  children: readonly RunningChild[],
  timeout: number
): Promise<RunningChild[]> {
  const pending = new Set(children.filter((child) => child.isRunning()))
  if (pending.size === 0) return []
  const deadline = Date.now() + timeout
  while (pending.size && Date.now() < deadline) {
    for (const child of pending) if (!child.isRunning()) pending.delete(child)
    if (pending.size === 0) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  for (const child of pending) if (!child.isRunning()) pending.delete(child)
  return [...pending]
}

async function cleanupChildren(
  children: readonly RunningChild[],
  timeout: number
): Promise<void> {
  const unique = [...new Set(children)]
  for (const child of unique) child.stop('SIGTERM')
  let pending = await waitForChildren(unique, timeout)
  if (pending.length > 0) {
    for (const child of pending) child.stop('SIGKILL')
    pending = await waitForChildren(pending, timeout)
  }
  assert.equal(
    pending.length,
    0,
    'Child cleanup timed out: ' + pending.map((child) => child.label).join(', ')
  )
}

export type ProductionLifecycleContext = {
  children: readonly RunningChild[]
  abort: Promise<never>
  run: (command: ProductionChildCommand) => Promise<void>
  assertRunning: () => void
}

class LifecycleSignalError extends Error {
  readonly signal: NodeJS.Signals
  readonly exitCode: number

  constructor(signal: NodeJS.Signals) {
    super('Received ' + signal)
    this.name = 'LifecycleSignalError'
    this.signal = signal
    this.exitCode = signal === 'SIGINT' ? 130 : 143
  }
}

export async function runProductionLifecycle(
  commands: readonly ProductionChildCommand[],
  task: (context: ProductionLifecycleContext) => Promise<void>,
  options: { cleanupTimeoutMs?: number } = {}
): Promise<void> {
  const timeout = options.cleanupTimeoutMs ?? defaultCleanupTimeoutMs
  assert(
    Number.isFinite(timeout) && timeout > 0,
    'Child cleanup timeout must be positive'
  )
  const children = commands.map(commandFromSpec)
  const activeChildren = [...children]
  let cleanupStarted = false
  let receivedSignal: NodeJS.Signals | undefined
  let rejectAbort: (error: unknown) => void = () => undefined
  const abort = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  void abort.catch(() => undefined)
  for (const child of children) {
    void child.completion.then(
      (exit) => {
        if (!cleanupStarted)
          rejectAbort(new Error(formatChildExit(child, exit)))
      },
      (error: unknown) => {
        if (!cleanupStarted) rejectAbort(error)
      }
    )
  }
  const signalHandlers = new Map<NodeJS.Signals, () => void>()
  for (const name of ['SIGINT', 'SIGTERM'] as const) {
    const handler = (): void => {
      if (receivedSignal) return
      receivedSignal = name
      rejectAbort(new LifecycleSignalError(name))
    }
    signalHandlers.set(name, handler)
    process.on(name, handler)
  }
  const assertRunning = (): void => {
    for (const child of children)
      assert(child.isRunning(), child.label + ' is not running')
  }
  const run = async (command: ProductionChildCommand): Promise<void> => {
    if (cleanupStarted)
      throw new Error('Production lifecycle is already stopping')
    const child = commandFromSpec(command)
    activeChildren.push(child)
    await Promise.race([waitForSuccessfulChild(child), abort])
  }
  const context: ProductionLifecycleContext = {
    children,
    abort,
    run,
    assertRunning,
  }
  let taskError: unknown
  let cleanupError: unknown
  const taskPromise = Promise.resolve().then(() => task(context))
  void taskPromise.catch(() => undefined)
  try {
    await Promise.race([taskPromise, abort])
  } catch (error) {
    taskError = error
  } finally {
    cleanupStarted = true
    try {
      await cleanupChildren(activeChildren, timeout)
    } catch (error) {
      cleanupError = error
    } finally {
      for (const [name, handler] of signalHandlers)
        process.removeListener(name, handler)
    }
  }
  if (cleanupError) throw cleanupError
  if (receivedSignal) throw new LifecycleSignalError(receivedSignal)
  if (taskError) throw taskError
}

function productionCommands(
  env: Environment,
  workspaceRoot: string
): ProductionChildCommand[] {
  return serviceApps.map((app) => {
    const appRoot = join(workspaceRoot, 'apps', app)
    return {
      label: app,
      command: process.execPath,
      args: [
        app === 'backend-docker'
          ? 'dist/index.js'
          : 'apps/' + app + '/server.js',
      ],
      cwd:
        app === 'backend-docker' ? appRoot : join(appRoot, '.next/standalone'),
      env: { ...env, PORT: String(ports[app]) },
      stdio: 'inherit',
    }
  })
}

export async function start(
  supplied = process.env,
  workspaceRoot = root
): Promise<void> {
  const env = productionEnvironment(supplied, workspaceRoot)
  verify(env, workspaceRoot)
  await runProductionLifecycle(
    productionCommands(env, workspaceRoot),
    async (context) => {
      await context.abort
    }
  )
}

async function readyWithAbort(
  aborts: readonly Promise<never>[]
): Promise<void> {
  const pending = new Set([
    'http://127.0.0.1:3000/healthz',
    'http://127.0.0.1:3010',
    'http://127.0.0.1:3001/en/createAccount',
    'http://127.0.0.1:3001/de/createAccount',
    'http://127.0.0.1:3002',
  ])
  const deadline = Date.now() + 120_000
  while (pending.size && Date.now() < deadline) {
    const attempt = Promise.all(
      [...pending].map(async (url) => {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
          })
          await response.body?.cancel()
          if (response.status === 200) pending.delete(url)
        } catch {
          // Retry until the bounded readiness deadline.
        }
      })
    )
    if (aborts.length > 0) await Promise.race([attempt, ...aborts])
    else await attempt
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  assert.equal(
    pending.size,
    0,
    'Production document readiness failed: ' + [...pending].join(', ')
  )
}

export async function ready(): Promise<void> {
  await readyWithAbort([])
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function readStringArray(filePath: string): string[] {
  const value = readJson(filePath)
  assert(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
    'Expected a string array at ' + filePath
  )
  return value
}

function productionSpecList(workspaceRoot: string): string[] {
  const manifest = readJson(
    join(workspaceRoot, 'playwright/profiles.json')
  ) as ProfileManifest
  const files = readdirSync(join(workspaceRoot, 'playwright/tests')).filter(
    (file) => file.endsWith('.spec.ts')
  )
  const specs = productionSpecs(manifest, files).sort()
  assert.deepEqual(specs, [...REQUIRED_ACCOUNT_SPECS])
  return specs
}

async function runPlaywrightTests(
  context: ProductionLifecycleContext,
  env: Environment,
  workspaceRoot: string,
  specs: readonly string[]
): Promise<void> {
  const specArgs = specs.map((file) => 'tests/' + file)
  const inventoryPath = join(workspaceRoot, 'account-production-inventory.json')
  const resultPath = join(workspaceRoot, 'account-production-result.json')
  await context.run({
    label: 'Playwright inventory',
    command: 'pnpm',
    args: [
      '--filter',
      '@klicker-uzh/playwright',
      'exec',
      'playwright',
      'test',
      '--project=chromium',
      '--reporter=json',
      '--list',
      ...specArgs,
    ],
    cwd: workspaceRoot,
    env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: inventoryPath },
    stdio: 'inherit',
  })
  await context.run({
    label: 'Playwright production tests',
    command: 'pnpm',
    args: [
      '--filter',
      '@klicker-uzh/playwright',
      'exec',
      'playwright',
      'test',
      '--project=chromium',
      '--reporter=json',
      '--retries=0',
      ...specArgs,
    ],
    cwd: workspaceRoot,
    env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: resultPath },
    stdio: 'inherit',
  })
}

export async function test(
  supplied = process.env,
  workspaceRoot = root
): Promise<void> {
  assert.equal(
    supplied.GITHUB_ACTIONS,
    'true',
    'Production tests require GitHub Actions'
  )
  assert.equal(supplied.CI, 'true', 'Production tests require CI=true')
  const env = productionEnvironment(supplied, workspaceRoot)
  const specs = productionSpecList(workspaceRoot)
  writeFileSync(
    join(workspaceRoot, 'account-production-specs.json'),
    JSON.stringify(specs)
  )
  await runProductionLifecycle(
    productionCommands(env, workspaceRoot),
    async (context) => {
      await readyWithAbort([context.abort])
      context.assertRunning()
      await runPlaywrightTests(context, env, workspaceRoot, specs)
      context.assertRunning()
    }
  )
}

function reportTests(report: unknown): PlaywrightTestRecord[] {
  assert(isRecord(report), 'Missing Playwright report')
  assert(Array.isArray(report.suites), 'Missing Playwright suites')
  assert(
    Array.isArray(report.errors) && report.errors.length === 0,
    'Playwright reported global errors'
  )
  const tests: PlaywrightTestRecord[] = []
  function visit(suite: unknown): void {
    assert(isRecord(suite), 'Invalid Playwright suite')
    assert(Array.isArray(suite.specs), 'Invalid Playwright specs')
    for (const spec of suite.specs) {
      assert(isRecord(spec), 'Invalid Playwright spec')
      assert(typeof spec.id === 'string' && spec.id, 'Missing test identity')
      assert(typeof spec.file === 'string', 'Missing test file')
      assert(Array.isArray(spec.tests), 'Invalid Playwright tests')
      for (const test of spec.tests) {
        assert(isRecord(test), 'Invalid Playwright test')
        assert.equal(test.projectName, 'chromium', 'Unexpected browser project')
        const file = spec.file.split('/').pop() ?? spec.file
        tests.push({
          key: file + ':' + spec.id + ':' + test.projectName,
          file,
          test,
        })
      }
    }
    assert(
      suite.suites === undefined || Array.isArray(suite.suites),
      'Invalid nested Playwright suites'
    )
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites) visit(suite)
  assert(tests.length > 0, 'No production tests were discovered')
  assert.equal(
    new Set(tests.map(({ key }) => key)).size,
    tests.length,
    'Duplicate test identities'
  )
  return tests
}

export function verifyProductionReport({
  inventory,
  result,
  expectedSpecs,
}: {
  inventory: unknown
  result: unknown
  expectedSpecs: readonly string[]
}): { specs: string[]; tests: number } {
  assert(
    Array.isArray(expectedSpecs) && expectedSpecs.length > 0,
    'Missing production spec obligations'
  )
  const planned = reportTests(inventory)
  const executed = reportTests(result)
  assert.deepEqual(
    [...new Set(planned.map(({ file }) => file))].sort(),
    [...expectedSpecs].sort(),
    'Incomplete production spec inventory'
  )
  assert.deepEqual(
    executed.map(({ key }) => key).sort(),
    planned.map(({ key }) => key).sort(),
    'Execution does not match discovered tests'
  )
  for (const record of executed) {
    assert.equal(
      record.test.expectedStatus,
      'passed',
      'Expected failures cannot satisfy production coverage'
    )
    assert.equal(
      record.test.status,
      'expected',
      'Production test did not pass consistently'
    )
    const results = record.test.results
    assert(
      Array.isArray(results) && results.length > 0,
      'Production test never ran'
    )
    assert(
      results.every((entry: unknown) => {
        if (!isRecord(entry)) return false
        return (
          entry.status === 'passed' &&
          !entry.error &&
          (entry.errors === undefined ||
            (Array.isArray(entry.errors) && entry.errors.length === 0))
        )
      }),
      'Failed, skipped or interrupted production attempt'
    )
  }
  const stats =
    isRecord(result) && isRecord(result.stats) ? result.stats : undefined
  assert.equal(stats?.unexpected, 0)
  assert.equal(stats?.skipped, 0)
  assert.equal(stats?.flaky, 0)
  assert.equal(stats?.expected, executed.length)
  return { specs: [...expectedSpecs].sort(), tests: executed.length }
}

export function report(
  inventoryPath: string,
  resultPath: string,
  specsPath: string,
  outputPath: string,
  supplied = process.env,
  workspaceRoot = root
): void {
  const read = (file: string): unknown => readJson(join(workspaceRoot, file))
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    env: supplied,
    encoding: 'utf8',
  }).trim()
  assert.equal(sourceSha, supplied.CANDIDATE_SHA, 'Wrong candidate checkout')
  const expectedSpecs = readStringArray(join(workspaceRoot, specsPath))
  assert.deepEqual(expectedSpecs.slice().sort(), REQUIRED_ACCOUNT_SPECS)
  const receipt = verifyProductionReport({
    inventory: read(inventoryPath),
    result: read(resultPath),
    expectedSpecs,
  })
  const build = artifactManifest(readJson(join(workspaceRoot, manifestPath)))
  assert.equal(build.sourceSha, sourceSha, 'Wrong production artifact revision')
  for (const app of nextApps) {
    assert.equal(build.artifacts[app]?.bundler, 'webpack')
    assert.match(build.artifacts[app]?.digest ?? '', /^[a-f0-9]{64}$/)
    assert(build.artifacts[app]?.buildId, 'Missing production build identity')
  }
  writeFileSync(
    join(workspaceRoot, outputPath),
    JSON.stringify(
      { sourceSha, ...receipt, artifacts: build.artifacts },
      null,
      2
    ) + '\n'
  )
}

function requireNoArgs(action: string, args: readonly string[]): void {
  assert.equal(args.length, 0, 'Expected no arguments for ' + action)
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [action, ...args] = argv
  if (action === 'build') {
    requireNoArgs(action, args)
    build()
  } else if (action === 'start') {
    requireNoArgs(action, args)
    await start()
  } else if (action === 'ready') {
    requireNoArgs(action, args)
    await ready()
  } else if (action === 'verify') {
    requireNoArgs(action, args)
    verify(productionEnvironment(process.env))
    console.log('Production artifacts verified')
  } else if (action === 'test') {
    requireNoArgs(action, args)
    await test()
  } else if (action === 'report') {
    assert.equal(
      args.length,
      4,
      'Expected report <inventory> <result> <specs> <output>'
    )
    report(args[0], args[1], args[2], args[3])
  } else {
    throw new Error(
      'Expected build, start, ready, verify, test, or report <inventory> <result> <specs> <output>'
    )
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error))
    process.exitCode =
      error instanceof LifecycleSignalError ? error.exitCode : 1
  })
}
