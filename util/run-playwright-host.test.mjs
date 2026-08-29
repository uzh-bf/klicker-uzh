import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
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
    semanticEvaluatorToken: 'synthetic-evaluator-token',
    workspace: 'rs-host-playwright',
  })

  assert.equal(
    environment.URL_MANAGE,
    'https://manage.klicker.rs-host-playwright.localhost'
  )
  assert.equal(
    environment.DATABASE_URL,
    'postgres://user:password@127.0.0.1:49153/database'
  )
  assert.equal(environment.PLAYWRIGHT_SEMANTIC_EVALUATOR_HOST, '0.0.0.0')
  assert.equal(
    environment.CATALYST_FORMATIVE_EVALUATOR_TOKEN,
    'synthetic-evaluator-token'
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
