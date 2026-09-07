import assert from 'node:assert/strict'
import { existsSync, globSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
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

function discoverWorkspacePackages(root = repoRoot) {
  const workspace = parseYaml(
    readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
  )

  assert.ok(
    Array.isArray(workspace?.packages),
    'pnpm-workspace.yaml has no packages list'
  )

  return [
    ...new Set(
      workspace.packages.flatMap((pattern) => {
        assert.equal(
          typeof pattern,
          'string',
          'workspace patterns must be strings'
        )
        assert.ok(
          !pattern.startsWith('!'),
          'workspace exclusions require explicit discovery support'
        )

        return globSync(pattern, { cwd: root })
          .filter((candidate) => {
            const absolutePath = join(root, candidate)
            return (
              statSync(absolutePath).isDirectory() &&
              existsSync(join(absolutePath, 'package.json'))
            )
          })
          .map((candidate) => candidate.replaceAll('\\', '/'))
      })
    ),
  ].sort()
}

function parseDependencyMounts(compose) {
  const appVolumes = compose?.services?.app?.volumes

  assert.ok(
    Array.isArray(appVolumes),
    'compose app service has no volumes list'
  )

  const mounts = appVolumes
    .filter((mount) => typeof mount === 'string')
    .flatMap((mount) => {
      const match = mount.match(
        /^([a-zA-Z0-9_.-]+):\/workspaces\/klicker-uzh\/([^:]+)(?::[^:]*)?$/
      )

      return match ? [[match[2], match[1]]] : []
    })
    .filter(
      ([target]) =>
        target === 'node_modules' || target.endsWith('/node_modules')
    )

  assert.equal(
    new Set(mounts.map(([target]) => target)).size,
    mounts.length,
    'app dependency mount targets must be distinct'
  )

  return new Map(mounts)
}

function assertDependencyMountCoverage(compose, workspacePackages) {
  const mounts = parseDependencyMounts(compose)
  const declarations = compose?.volumes

  assert.ok(
    declarations && typeof declarations === 'object',
    'compose file has no top-level volumes section'
  )

  for (const [target, volume] of [
    ['node_modules', 'node_modules_root'],
    ['playwright/node_modules', 'node_modules_playwright'],
    ['packages/prisma/node_modules', 'node_modules_prisma'],
    ['packages/types/node_modules', 'node_modules_types'],
  ]) {
    assert.equal(
      mounts.get(target),
      volume,
      `${target} must keep its existing ${volume} volume`
    )
    assert.ok(Object.hasOwn(declarations, volume), `${volume} is not declared`)
  }

  const packageVolumes = workspacePackages.map((workspacePackage) => {
    const target = `${workspacePackage}/node_modules`
    const volume = mounts.get(target)

    assert.ok(volume, `${target} is not isolated from the host`)
    assert.ok(Object.hasOwn(declarations, volume), `${volume} is not declared`)

    return volume
  })

  assert.equal(
    new Set(['node_modules_root', ...packageVolumes]).size,
    workspacePackages.length + 1,
    'root and workspace package dependency volumes must be distinct'
  )
  assert.ok(
    packageVolumes.every(
      (volume) =>
        volume.startsWith('node_modules_') && volume !== 'node_modules'
    ),
    'workspace package dependency volumes must use package-scoped names'
  )

  const expectedDependencyVolumes = new Set([
    'node_modules_root',
    ...packageVolumes,
  ])
  assert.deepEqual(
    Object.keys(declarations)
      .filter((volume) => volume.startsWith('node_modules_'))
      .sort(),
    [...expectedDependencyVolumes].sort(),
    'dependency volume declarations must match app service mounts'
  )

  for (const volume of expectedDependencyVolumes) {
    const declaration = declarations[volume] ?? {}
    assert.equal(
      declaration.external,
      undefined,
      `${volume} must remain project-scoped`
    )
    assert.equal(
      declaration.name,
      undefined,
      `${volume} must remain project-scoped`
    )
  }

  const store = declarations.pnpm_store
  assert.deepEqual(store, {
    external: true,
    name: 'klicker-uzh-pnpm-store-v1',
  })
}

function createOriginalMountFixture(compose) {
  const original = structuredClone(compose)
  const legacyTargets = new Set([
    'playwright/node_modules',
    'packages/prisma/node_modules',
    'packages/types/node_modules',
  ])
  const mounts = parseDependencyMounts(compose)
  const removedVolumes = new Set()

  original.services.app.volumes = original.services.app.volumes.filter(
    (mount) => {
      const match = mount.match(
        /^([a-zA-Z0-9_.-]+):\/workspaces\/klicker-uzh\/([^:]+)(?::[^:]*)?$/
      )
      const dependencyMount = mounts.get(match?.[2])

      if (!dependencyMount) return true

      const target = match[2]
      if (legacyTargets.has(target) || target === 'node_modules') return true

      removedVolumes.add(dependencyMount)
      return false
    }
  )

  for (const volume of removedVolumes) delete original.volumes[volume]

  return original
}

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

test('devcontainer dependency mounts isolate every workspace package', () => {
  const compose = parseYaml(
    readFileSync(join(repoRoot, '.devcontainer', 'docker-compose.yml'), 'utf8')
  )
  const workspacePackages = discoverWorkspacePackages()

  assertDependencyMountCoverage(compose, workspacePackages)

  assert.throws(
    () =>
      assertDependencyMountCoverage(
        createOriginalMountFixture(compose),
        workspacePackages
      ),
    /is not isolated from the host/
  )
})
