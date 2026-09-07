import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveDevrouter } from './devrouter-cli.mjs'
import {
  assertPlaywrightHostBoundary,
  HOST_RUNNER_ENV,
} from './playwright-host-policy.mjs'
import {
  parsePublishedPort,
  resolvePlaywrightEnvironment,
} from './run-playwright-host.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const simulatedHostCwd = '/Users/test/klicker-uzh'

const noContainerPaths = () => false

function cliFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'klicker-host-cli-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const calls = join(root, 'calls.jsonl')
  function binary(directory, version = '0.0.55', status = 0) {
    const folder = join(root, directory)
    mkdirSync(folder, { recursive: true })
    const path = join(folder, 'devrouter')
    writeFileSync(
      path,
      `#!${process.execPath}\nconst fs = require('node:fs')\nfs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n')\nconsole.log(${JSON.stringify(`Installed CLI version: ${version}\nLocal repo version (${root}/.devrouter.yml): 0.0.55`)})\nprocess.exitCode = ${status}\n`,
      { mode: 0o755 }
    )
    return path
  }
  return { root, calls, binary }
}

test('host CLI selection skips stale worktree bins and symlinked bin directories', (t) => {
  const { root, calls, binary } = cliFixture(t)
  const stale = binary('old-worktree/node_modules/.bin', '0.0.51')
  const host = binary('host/bin')
  symlinkSync(dirname(stale), join(root, 'alias-bin'))
  const env = {
    PATH: [dirname(stale), join(root, 'alias-bin'), dirname(host)].join(
      delimiter
    ),
  }
  assert.equal(resolveDevrouter({ repo: root, env }), host)
  assert.deepEqual(
    readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse),
    [['-V', '--repo', root]]
  )
})

test('a host override resolves multiple global installations without silently selecting another', (t) => {
  const { root, binary } = cliFixture(t)
  const old = binary('old-host/bin', '0.0.51')
  const current = binary('new-host/bin', '0.0.56')
  const env = { PATH: [dirname(old), dirname(current)].join(delimiter) }
  assert.throws(() => resolveDevrouter({ repo: root, env }), /too old/)
  assert.equal(
    resolveDevrouter({
      repo: root,
      env: { ...env, KLICKER_DEVROUTER_BIN: current },
    }),
    current
  )
})

test('missing, workspace-local, non-executable and broken explicit CLIs fail before runtime access', (t) => {
  const { root, calls, binary } = cliFixture(t)
  const stale = binary('node_modules/.bin')
  const broken = binary('broken/bin', '0.0.55', 1)
  const nonExecutable = join(root, 'not-executable')
  writeFileSync(nonExecutable, 'not an executable')
  for (const executable of [
    join(root, 'missing'),
    stale,
    nonExecutable,
    './devrouter',
  ]) {
    assert.throws(
      () => resolveDevrouter({ repo: root, executable }),
      /No executable host Devrouter/
    )
  }
  assert.throws(
    () => resolveDevrouter({ repo: root, executable: broken }),
    /version check failed/
  )
  assert.deepEqual(
    readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse),
    [['-V', '--repo', root]]
  )
})

test('unparseable CLI versions cannot pass compatibility checks', (t) => {
  const { root, binary } = cliFixture(t)
  for (const version of ['unknown', '0.0.55-rc.1']) {
    const executable = binary('host/bin', version)
    assert.throws(
      () => resolveDevrouter({ repo: root, executable }),
      /Cannot determine/
    )
  }
})

test('local Playwright rejects direct host execution', () => {
  assert.throws(
    () =>
      assertPlaywrightHostBoundary({
        cwd: simulatedHostCwd,
        env: {},
        pathExists: noContainerPaths,
      }),
    /must use the host launcher/
  )
})

test('local Playwright accepts the host launcher marker', () => {
  assert.doesNotThrow(() =>
    assertPlaywrightHostBoundary({
      cwd: simulatedHostCwd,
      env: { [HOST_RUNNER_ENV]: '1' },
      pathExists: noContainerPaths,
    })
  )
})

test('local containers are rejected even with the host marker', () => {
  assert.throws(
    () =>
      assertPlaywrightHostBoundary({
        cwd: '/workspaces/klicker-uzh',
        env: {
          KLICKER_DEVCONTAINER: '1',
          [HOST_RUNNER_ENV]: '1',
        },
        pathExists: noContainerPaths,
      }),
    /host-only/
  )
})

test('the existing GitHub Actions container remains allowed', () => {
  assert.doesNotThrow(() =>
    assertPlaywrightHostBoundary({
      cwd: '/__w/klicker-uzh/klicker-uzh',
      env: { CI: 'true', GITHUB_ACTIONS: 'true' },
      pathExists: () => true,
    })
  )
})

test('a local container cannot use an incomplete GitHub Actions marker', () => {
  assert.throws(
    () =>
      assertPlaywrightHostBoundary({
        cwd: '/workspaces/klicker-uzh',
        env: { GITHUB_ACTIONS: 'true' },
        pathExists: noContainerPaths,
      }),
    /host-only/
  )
})

test('workspace URLs and the loopback database port resolve together', () => {
  const environment = resolvePlaywrightEnvironment({
    appSecret: 'synthetic-test-value',
    databaseTemplate: 'postgres://user:password@postgres:5432/database',
    databasePort: 49153,
    workspace: 'rs-host-playwright',
  })

  assert.equal(
    environment.URL_MANAGE,
    'https://manage.klicker.rs-host-playwright.localhost'
  )
  assert.equal(
    environment.NEXT_PUBLIC_GROWTHBOOK_API_HOST,
    'https://manage.klicker.rs-host-playwright.localhost/__growthbook__'
  )
  assert.equal(environment.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY, 'sdk-test')
  assert.equal(
    environment.DATABASE_URL,
    'postgres://user:password@127.0.0.1:49153/database'
  )
})

test('Docker port output resolves IPv4 and IPv6 bindings', () => {
  assert.equal(parsePublishedPort('127.0.0.1:49153'), 49153)
  assert.equal(parsePublishedPort('[::1]:49154'), 49154)
})

test('every local Playwright package script routes through the host launcher', () => {
  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, 'playwright', 'package.json'), 'utf8')
  )
  const localScripts = [
    'show-report',
    'test',
    'test:headed',
    'test:headed:raw',
    'test:host',
    'test:raw',
    'test:run',
    'test:run:raw',
    'test:ui',
    'test:ui:raw',
  ]

  for (const script of localScripts) {
    assert.match(
      packageJson.scripts[script],
      /run-playwright-host\.mjs/,
      `${script} bypasses the host launcher`
    )
  }
})

test('devcontainer dependency mounts cannot overwrite the host runner links', () => {
  const compose = readFileSync(
    join(repoRoot, '.devcontainer', 'docker-compose.yml'),
    'utf8'
  )

  for (const dependencyPath of [
    'playwright/node_modules',
    'packages/prisma/node_modules',
    'packages/types/node_modules',
  ]) {
    assert.ok(
      compose.includes(`:/workspaces/klicker-uzh/${dependencyPath}`),
      `${dependencyPath} is not isolated from the host`
    )
  }
})
