import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  inputIdentity,
  type ProductionChildCommand,
  productionEnvironment,
  report,
  runChildCommand,
  runProductionLifecycle,
  verify,
  verifyProductionReport,
} from './playwright-production.ts'

type JsonRecord = Record<string, unknown>

function fixture(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DEVROUTER_PROFILE: 'manage,pwa,email',
    EMAIL_HOST: 'mailhog',
    EMAIL_PORT: '1025',
    CANDIDATE_SHA: 'a'.repeat(40),
    APP_ORIGIN_API: 'http://127.0.0.1:3000',
    APP_ORIGIN_AUTH: 'http://127.0.0.1:3010',
    APP_ORIGIN_PWA: 'http://127.0.0.1:3001',
    APP_ORIGIN_MANAGE: 'http://127.0.0.1:3002',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3000/api/graphql',
    NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:3001',
    NEXT_PUBLIC_MANAGE_URL: 'http://127.0.0.1:3002',
  }
}

test('accepts a production build with local synthetic services', () => {
  const env = productionEnvironment({
    ...fixture(),
    NEXT_PUBLIC_MATOMO_URL: 'https://example.invalid',
    NEXT_PUBLIC_MATOMO_SITE_ID: '1',
  })
  assert.equal(env.NODE_ENV, 'production')
  assert.equal(env.NEXT_PUBLIC_MATOMO_URL, '')
  assert.equal(env.NEXT_PUBLIC_MATOMO_SITE_ID, '')
})

test('rejects development, external origins, stale public inputs and external SMTP', () => {
  for (const change of [
    { NODE_ENV: 'test' },
    { DEVROUTER_PROFILE: 'full' },
    { EMAIL_HOST: 'smtp.example.com' },
    { EMAIL_PORT: '465' },
    { EMAIL_USER: 'external' },
    { EMAIL_PASS: 'external' },
    { TEAMS_WEBHOOK_URL: 'https://example.com' },
    { CANDIDATE_SHA: '' },
    { APP_ORIGIN_PWA: 'https://example.com' },
    { NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:9999' },
  ])
    assert.throws(() => productionEnvironment({ ...fixture(), ...change }))
})

test('artifact verification rejects changed inputs and replaced standalone output', () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'account-artifact-'))
  const env = fixture()
  writeFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'synthetic-lock')
  const artifacts: Record<string, { digest: string }> = {}
  for (const app of [
    'auth',
    'frontend-pwa',
    'frontend-manage',
    'backend-docker',
  ]) {
    const dir = join(
      workspaceRoot,
      'apps',
      app,
      app === 'backend-docker' ? 'dist' : '.next/standalone'
    )
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'server.js'), 'synthetic-entry')
    artifacts[app] = {
      digest: createHash('sha256')
        .update('/server.js')
        .update('synthetic-entry')
        .digest('hex'),
    }
  }
  mkdirSync(join(workspaceRoot, '.devcontainer/.runtime'), { recursive: true })
  writeFileSync(
    join(workspaceRoot, '.devcontainer/.runtime/production-artifacts.json'),
    JSON.stringify({ ...inputIdentity(env, workspaceRoot), artifacts })
  )
  assert.equal(verify(env, workspaceRoot).sourceSha, env.CANDIDATE_SHA)
  const imageCache = join(
    workspaceRoot,
    'apps/frontend-pwa/.next/standalone/apps/frontend-pwa/.next/cache/images'
  )
  mkdirSync(imageCache, { recursive: true })
  writeFileSync(join(imageCache, 'request.webp'), 'optimized-image')
  const pageCache = join(
    workspaceRoot,
    'apps/frontend-pwa/.next/standalone/apps/frontend-pwa/.next/server/pages/en'
  )
  mkdirSync(pageCache, { recursive: true })
  writeFileSync(join(pageCache, 'request.html'), 'rendered-page')
  writeFileSync(join(pageCache, 'request.json'), 'rendered-data')
  assert.equal(verify(env, workspaceRoot).sourceSha, env.CANDIDATE_SHA)
  assert.throws(
    () =>
      verify(
        { ...env, NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:9999' },
        workspaceRoot
      ),
    /Stale/
  )
  writeFileSync(
    join(workspaceRoot, 'apps/frontend-pwa/.next/standalone/server.js'),
    'replaced-entry'
  )
  assert.throws(() => verify(env, workspaceRoot), /Changed production artifact/)
})

function reportFixture(): {
  inventory: JsonRecord
  result: JsonRecord
  expectedSpecs: string[]
} {
  const result: JsonRecord = {
    errors: [],
    suites: [
      {
        specs: [
          {
            id: 'synthetic',
            file: 'synthetic.spec.ts',
            tests: [
              {
                projectName: 'chromium',
                expectedStatus: 'passed',
                status: 'expected',
                results: [{ status: 'passed', errors: [] }],
              },
            ],
          },
        ],
      },
    ],
    stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  }
  return {
    inventory: structuredClone(result),
    result,
    expectedSpecs: ['synthetic.spec.ts'],
  }
}

function firstReportTest(input: ReturnType<typeof reportFixture>): JsonRecord {
  const suites = input.result.suites as JsonRecord[]
  const specs = suites[0].specs as JsonRecord[]
  const tests = specs[0].tests as JsonRecord[]
  return tests[0]
}

test('accepts complete execution and emits values-free counts', () => {
  assert.deepEqual(verifyProductionReport(reportFixture()), {
    specs: ['synthetic.spec.ts'],
    tests: 1,
  })
})

test('rejects skipped, failed, expected-failure and unexecuted tests', () => {
  for (const mutate of [
    (playwrightTest: JsonRecord) => {
      playwrightTest.results = []
    },
    (playwrightTest: JsonRecord) => {
      const results = playwrightTest.results as JsonRecord[]
      results[0].status = 'skipped'
    },
    (playwrightTest: JsonRecord) => {
      const results = playwrightTest.results as JsonRecord[]
      results[0].status = 'failed'
    },
    (playwrightTest: JsonRecord) => {
      playwrightTest.expectedStatus = 'failed'
    },
    (playwrightTest: JsonRecord) => {
      playwrightTest.status = 'flaky'
    },
  ]) {
    const input = reportFixture()
    mutate(firstReportTest(input))
    assert.throws(() => verifyProductionReport(input))
  }
})

test('rejects missing specs, missing tests, duplicates and setup failures', () => {
  for (const mutate of [
    (input: ReturnType<typeof reportFixture>) => {
      input.expectedSpecs.push('missing.spec.ts')
    },
    (input: ReturnType<typeof reportFixture>) => {
      input.result.suites = []
    },
    (input: ReturnType<typeof reportFixture>) => {
      const suites = input.result.suites as JsonRecord[]
      suites.push(suites[0])
    },
    (input: ReturnType<typeof reportFixture>) => {
      input.result.errors = [{ message: 'setup failed' }]
    },
    (input: ReturnType<typeof reportFixture>) => {
      const stats = input.result.stats as JsonRecord
      stats.skipped = 1
    },
  ]) {
    const input = reportFixture()
    mutate(input)
    assert.throws(() => verifyProductionReport(input))
  }
})

function longRunningScript(marker: string, ignoreTerm = false): string {
  return [
    "const fs = require('node:fs')",
    'const marker = ' + JSON.stringify(marker),
    'fs.writeFileSync(marker, String(process.pid))',
    ignoreTerm
      ? "process.on('SIGTERM', () => undefined)"
      : "process.on('SIGTERM', () => { fs.appendFileSync(marker, ':stopped'); process.exit(0) })",
    "process.on('SIGINT', () => { fs.appendFileSync(marker, ':interrupted'); process.exit(0) })",
    'setInterval(() => undefined, 1000)',
  ].join(';')
}

function syntheticCommand(
  label: string,
  script: string,
  stdio: ProductionChildCommand['stdio'] = 'ignore',
  command = process.execPath
): ProductionChildCommand {
  return { label, command, args: ['-e', script], stdio }
}

function waitForLifecycleAbort(context: {
  abort: Promise<never>
}): Promise<never> {
  return context.abort
}

test('reports synthetic spawn failures through lifecycle cleanup', async () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-spawn-')
  )
  await assert.rejects(
    runProductionLifecycle(
      [
        syntheticCommand(
          'spawn failure',
          '',
          'ignore',
          join(workspaceRoot, 'missing-command')
        ),
      ],
      async (context) => waitForLifecycleAbort(context),
      { cleanupTimeoutMs: 250 }
    ),
    /Failed to spawn spawn failure/
  )
})

test('reports early service exit and cleans all other children', async () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-early-')
  )
  const marker = join(workspaceRoot, 'survivor')
  await assert.rejects(
    runProductionLifecycle(
      [
        syntheticCommand('early exit', 'setTimeout(() => process.exit(7), 40)'),
        syntheticCommand('survivor', longRunningScript(marker)),
      ],
      async (context) => waitForLifecycleAbort(context),
      { cleanupTimeoutMs: 250 }
    ),
    /early exit exited with code 7/
  )
  assert.match(readFileSync(marker, 'utf8'), /:stopped/)
})

test('aborts a running test when a service fails and cleans the test child', async () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-during-')
  )
  const serviceMarker = join(workspaceRoot, 'service')
  const testMarker = join(workspaceRoot, 'test')
  await assert.rejects(
    runProductionLifecycle(
      [
        syntheticCommand(
          'during-test failure',
          longRunningScript(serviceMarker) +
            ';setTimeout(() => process.exit(9), 60)'
        ),
      ],
      async (context) => {
        await context.run(
          syntheticCommand('test child', longRunningScript(testMarker))
        )
      },
      { cleanupTimeoutMs: 250 }
    ),
    /during-test failure exited with code 9/
  )
  assert.match(readFileSync(testMarker, 'utf8'), /:stopped/)
})

async function runSignalLifecycle(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-' + signal + '-')
  )
  const markers = ['one', 'two', 'three', 'four'].map((name) =>
    join(workspaceRoot, name)
  )
  const moduleUrl = pathToFileURL(
    fileURLToPath(new URL('./playwright-production.ts', import.meta.url))
  ).href
  const commandSource = markers
    .map(
      (marker, index) =>
        '{label:' +
        JSON.stringify('child-' + index) +
        ',command:process.execPath,args:["-e",' +
        JSON.stringify(longRunningScript(marker)) +
        '],stdio:"ignore"}'
    )
    .join(',')
  const source =
    'import { runProductionLifecycle } from ' +
    JSON.stringify(moduleUrl) +
    '; const commands=[' +
    commandSource +
    ']; void runProductionLifecycle(commands, async (context) => { console.log("READY"); await context.abort; }, { cleanupTimeoutMs: 250 }).catch((error) => { process.exitCode = typeof error.exitCode === "number" ? error.exitCode : 1 })'
  const child = runChildCommand(
    process.execPath,
    ['--input-type=module', '-e', source],
    {
      label: 'supervisor ' + signal,
      cwd: rootForTests(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  const output = child.child?.stdout
  child.child?.stderr?.on('data', () => undefined)
  const ready = new Promise<void>((resolveReady, reject) => {
    output?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('READY')) resolveReady()
    })
    void child.completion.then(
      () => reject(new Error('Supervisor exited before READY')),
      reject
    )
  })
  await ready
  await waitForFiles(markers)
  assert(child.child)
  child.child.kill(signal)
  const exit = await child.completion
  assert.equal(exit.code, signal === 'SIGINT' ? 130 : 143)
  for (const marker of markers)
    assert.match(readFileSync(marker, 'utf8'), /:stopped/)
}

function rootForTests(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..')
}

async function waitForFiles(paths: readonly string[]): Promise<void> {
  const deadline = Date.now() + 1000
  while (Date.now() < deadline) {
    if (
      paths.every((path) => {
        try {
          readFileSync(path)
          return true
        } catch {
          return false
        }
      })
    )
      return
    await new Promise((resolveFile) => setTimeout(resolveFile, 10))
  }
  assert.fail('Synthetic children did not become ready')
}

function processGroupScript(marker: string, childMarker: string): string {
  const childScript = longRunningScript(childMarker, true)
  return [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    'const marker = ' + JSON.stringify(marker),
    'const child = spawn(process.execPath, ["-e", ' +
      JSON.stringify(childScript) +
      '], { stdio: "ignore" })',
    'fs.writeFileSync(marker, String(process.pid) + ":" + String(child.pid))',
    "process.on('SIGTERM', () => undefined)",
    'setInterval(() => undefined, 1000)',
  ].join(';')
}

function exitingParentScript(marker: string, childMarker: string): string {
  const childScript = longRunningScript(childMarker, true)
  return [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    'const marker = ' + JSON.stringify(marker),
    'const child = spawn(process.execPath, ["-e", ' +
      JSON.stringify(childScript) +
      '], { stdio: "ignore" })',
    'fs.writeFileSync(marker, String(process.pid) + ":" + String(child.pid))',
    'const waitForChild = setInterval(() => { if (fs.existsSync(' +
      JSON.stringify(childMarker) +
      ')) { clearInterval(waitForChild); process.exit(0) } }, 5)',
  ].join(';')
}

async function assertProcessGone(pid: number): Promise<void> {
  const deadline = Date.now() + 1000
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise((resolveGone) => setTimeout(resolveGone, 25))
  }
  assert.fail('Process remained after bounded cleanup: ' + pid)
}

test('handles SIGINT with bounded cleanup and no orphaned children', async () => {
  await runSignalLifecycle('SIGINT')
})

test('handles SIGTERM with bounded cleanup and no orphaned children', async () => {
  await runSignalLifecycle('SIGTERM')
})

test('escalates bounded cleanup for a child that ignores SIGTERM', async () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-kill-')
  )
  const parentMarker = join(workspaceRoot, 'stubborn')
  const childMarker = join(workspaceRoot, 'descendant')
  await assert.rejects(
    runProductionLifecycle(
      [
        syntheticCommand('trigger', 'setTimeout(() => process.exit(3), 40)'),
        syntheticCommand(
          'stubborn',
          processGroupScript(parentMarker, childMarker)
        ),
      ],
      async (context) => {
        await waitForLifecycleAbort(context)
      },
      { cleanupTimeoutMs: 50 }
    ),
    /trigger exited with code 3/
  )
  const [parentPid, childPid] = readFileSync(parentMarker, 'utf8')
    .split(':')
    .map((value) => Number(value))
  assert(parentPid)
  assert(childPid)
  await assertProcessGone(parentPid)
  await assertProcessGone(childPid)
})

test('cleans descendants after the service leader exits', async () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-exited-parent-')
  )
  const parentMarker = join(workspaceRoot, 'parent')
  const childMarker = join(workspaceRoot, 'child')
  await assert.rejects(
    runProductionLifecycle(
      [
        syntheticCommand(
          'exited parent',
          exitingParentScript(parentMarker, childMarker)
        ),
      ],
      async (context) => {
        await waitForFiles([parentMarker, childMarker])
        await waitForLifecycleAbort(context)
      },
      { cleanupTimeoutMs: 50 }
    ),
    /exited parent exited with code 0/
  )
  const [parentPid, childPid] = readFileSync(parentMarker, 'utf8')
    .split(':')
    .map((value) => Number(value))
  assert(parentPid)
  assert(childPid)
  await assertProcessGone(parentPid)
  await assertProcessGone(childPid)
})

test('report validation retains the four positional artifact contract', () => {
  const workspaceRoot = mkdtempSync(
    join(tmpdir(), 'playwright-production-report-')
  )
  const sourceSha = 'b'.repeat(40)
  const fakeGit = join(workspaceRoot, 'git')
  writeFileSync(fakeGit, '#!/bin/sh\nprintf "%s\\\\n" "$SYNTHETIC_SHA"\n')
  chmodSync(fakeGit, 0o755)
  const env = {
    CANDIDATE_SHA: sourceSha,
    SYNTHETIC_SHA: sourceSha,
    PATH: workspaceRoot + ':' + (process.env.PATH ?? ''),
  }
  const specsPath = 'specs.json'
  const inventoryPath = 'inventory.json'
  const resultPath = 'result.json'
  const outputPath = 'receipt.json'
  writeFileSync(
    join(workspaceRoot, specsPath),
    JSON.stringify([
      'A-account-lti.spec.ts',
      'A-account-production.spec.ts',
      'A-account-registration.spec.ts',
    ])
  )
  const specFiles = [
    'A-account-lti.spec.ts',
    'A-account-production.spec.ts',
    'A-account-registration.spec.ts',
  ]
  const reportData = {
    errors: [],
    suites: [
      {
        specs: specFiles.map((file, index) => ({
          id: 'synthetic-' + index,
          file,
          tests: [
            {
              projectName: 'chromium',
              expectedStatus: 'passed',
              status: 'expected',
              results: [{ status: 'passed', errors: [] }],
            },
          ],
        })),
      },
    ],
    stats: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 },
  }
  writeFileSync(join(workspaceRoot, inventoryPath), JSON.stringify(reportData))
  writeFileSync(join(workspaceRoot, resultPath), JSON.stringify(reportData))
  mkdirSync(join(workspaceRoot, '.devcontainer/.runtime'), { recursive: true })
  writeFileSync(
    join(workspaceRoot, '.devcontainer/.runtime/production-artifacts.json'),
    JSON.stringify({
      sourceSha,
      artifacts: {
        auth: { bundler: 'webpack', digest: 'a'.repeat(64), buildId: 'auth' },
        'frontend-pwa': {
          bundler: 'webpack',
          digest: 'b'.repeat(64),
          buildId: 'pwa',
        },
        'frontend-manage': {
          bundler: 'webpack',
          digest: 'c'.repeat(64),
          buildId: 'manage',
        },
      },
    })
  )
  report(inventoryPath, resultPath, specsPath, outputPath, env, workspaceRoot)
  const receipt = JSON.parse(
    readFileSync(join(workspaceRoot, outputPath), 'utf8')
  )
  assert.deepEqual(receipt.specs, [
    'A-account-lti.spec.ts',
    'A-account-production.spec.ts',
    'A-account-registration.spec.ts',
  ])
  assert.equal(receipt.tests, 3)
})
