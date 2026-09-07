import assert from 'node:assert/strict'
import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { resolveDevrouter } from './devrouter-cli.mjs'
import {
  assertPlaywrightHostBoundary,
  HOST_RUNNER_ENV,
} from './playwright-host-policy.mjs'
import {
  PNPM_VERIFY_DEPS_ENV,
  parsePublishedPort,
  resolvePlaywrightEnvironment,
  main as runPlaywrightHost,
} from './run-playwright-host.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const simulatedHostCwd = '/Users/test/klicker-uzh'

const noContainerPaths = () => false

function createLauncherHarness({
  playwrightCli = true,
  prismaDist = true,
  typesDist = true,
  failWhen,
} = {}) {
  const calls = []
  const logs = []
  const root = '/synthetic/klicker-uzh'
  const workspaceGitDir = '/synthetic/git/worktrees/launcher'

  const commandRunner = (command, args, options = {}) => {
    calls.push({ command, args: [...args], options })
    if (failWhen?.({ command, args, options })) {
      throw new Error('synthetic launcher failure')
    }

    if (command === 'git' && args.at(-1) === '--git-dir') {
      return workspaceGitDir
    }
    if (command === 'git' && args.at(-1) === '--git-common-dir') {
      return '/synthetic/git'
    }
    if (command === 'docker' && args[0] === 'ps') return 'container-id'
    if (command === 'docker' && args[0] === 'port') {
      return '127.0.0.1:49153'
    }

    return ''
  }

  const pathExists = (path) => {
    if (path.endsWith('/.dockerenv') || path.endsWith('/.containerenv')) {
      return false
    }
    if (path.endsWith('/playwright/node_modules/@playwright/test/cli.js')) {
      return playwrightCli
    }
    if (path.endsWith('/packages/prisma/dist/index.js')) return prismaDist
    if (path.endsWith('/packages/types/dist/index.js')) return typesDist
    if (path.endsWith('/devrouter-workspace')) return true
    return false
  }

  const readFile = (path) => {
    if (path.endsWith('/devrouter-workspace')) return 'synthetic-launcher\n'
    if (path.endsWith('/devcontainer.env')) {
      return [
        'DATABASE_URL=postgres://user:password@postgres:5432/database',
        'APP_SECRET=synthetic-app-secret',
      ].join('\n')
    }
    throw new Error(`unexpected synthetic file: ${path}`)
  }

  return {
    calls,
    logs,
    dependencies: {
      resolveDevrouterFn: () => '/synthetic/bin/devrouter',
      commandExistsFn: () => false,
      commandRunner,
      environment: { PATH: '/synthetic/bin' },
      log: (message) => logs.push(message),
      pathExists,
      readFile,
      root,
    },
  }
}

function commandIndex(calls, command, firstArg) {
  return calls.findIndex(
    ({ command: actualCommand, args }) =>
      actualCommand === command &&
      (firstArg === undefined || args[0] === firstArg)
  )
}

function pnpmCalls(calls) {
  return calls.filter(({ command }) => command === 'pnpm')
}

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

test('cold runs stop before host preparation and reconcile afterward', () => {
  const harness = createLauncherHarness({ playwrightCli: false })

  runPlaywrightHost(['--list'], harness.dependencies)

  const stop = commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop')
  const install = commandIndex(harness.calls, 'pnpm', 'install')
  const ensure = commandIndex(
    harness.calls,
    '/synthetic/bin/devrouter',
    'ensure'
  )
  assert.ok(stop >= 0)
  assert.ok(install > stop)
  assert.ok(ensure > install)
  assert.equal(
    harness.calls.filter(
      ({ command, args }) => command === 'pnpm' && args.includes('playwright')
    ).length,
    1,
    'list mode must not install a browser'
  )
  assert.ok(
    pnpmCalls(harness.calls).every(
      ({ options }) => options.env?.[PNPM_VERIFY_DEPS_ENV] === 'error'
    )
  )
})

test('cold runs complete builds and browser preparation before reconciliation', () => {
  const harness = createLauncherHarness({
    playwrightCli: false,
    prismaDist: false,
    typesDist: false,
  })

  runPlaywrightHost(['--headed', '--project=chromium'], harness.dependencies)

  const stop = commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop')
  const install = commandIndex(harness.calls, 'pnpm', 'install')
  const prismaBuild = harness.calls.findIndex(
    ({ command, args }) =>
      command === 'pnpm' &&
      args.includes('@klicker-uzh/prisma') &&
      args.includes('build')
  )
  const typesBuild = harness.calls.findIndex(
    ({ command, args }) =>
      command === 'pnpm' &&
      args.includes('@klicker-uzh/types') &&
      args.includes('build')
  )
  const browserInstall = harness.calls.findIndex(
    ({ command, args }) =>
      command === 'pnpm' &&
      args.includes('playwright') &&
      args.includes('install')
  )
  const ensure = commandIndex(
    harness.calls,
    '/synthetic/bin/devrouter',
    'ensure'
  )

  assert.ok(stop >= 0)
  assert.ok(stop < install)
  assert.ok(install < prismaBuild)
  assert.ok(prismaBuild < typesBuild)
  assert.ok(typesBuild < browserInstall)
  assert.ok(browserInstall < ensure)
})

test('cold preparation aborts before reconciliation when stopping fails', () => {
  const harness = createLauncherHarness({
    playwrightCli: false,
    failWhen: ({ command, args }) =>
      command === '/synthetic/bin/devrouter' && args[0] === 'stop',
  })

  assert.throws(
    () => runPlaywrightHost(['--list'], harness.dependencies),
    /synthetic launcher failure/
  )
  assert.equal(commandIndex(harness.calls, 'pnpm', 'install'), -1)
  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'ensure'),
    -1
  )
})

test('cold preparation aborts before reconciliation when install fails', () => {
  const harness = createLauncherHarness({
    playwrightCli: false,
    failWhen: ({ command, args }) =>
      command === 'pnpm' && args[0] === 'install',
  })

  assert.throws(
    () => runPlaywrightHost(['--list'], harness.dependencies),
    /synthetic launcher failure/
  )
  assert.ok(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop') >= 0
  )
  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'ensure'),
    -1
  )
})

test('warm preparation aborts before reconciliation when a host build fails', () => {
  const harness = createLauncherHarness({
    failWhen: ({ command, args }) =>
      command === 'pnpm' &&
      args.includes('@klicker-uzh/prisma') &&
      args.includes('build'),
    prismaDist: false,
  })

  assert.throws(
    () => runPlaywrightHost(['--list'], harness.dependencies),
    /synthetic launcher failure/
  )
  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop'),
    -1
  )
  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'ensure'),
    -1
  )
})

test('warm runs skip stop and package installation but preserve browser mode', () => {
  const harness = createLauncherHarness()

  runPlaywrightHost(['--headed', '--project=chromium'], harness.dependencies)

  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop'),
    -1
  )
  assert.equal(commandIndex(harness.calls, 'pnpm', 'install'), -1)
  const browserInstall = harness.calls.find(
    ({ command, args }) =>
      command === 'pnpm' &&
      args.includes('playwright') &&
      args.includes('install')
  )
  assert.deepEqual(browserInstall?.args.slice(-1), ['chromium'])
  assert.ok(
    pnpmCalls(harness.calls).every(
      ({ options }) => options.env?.[PNPM_VERIFY_DEPS_ENV] === 'error'
    )
  )
})

test('print-env reconciles without dependency preparation', () => {
  const harness = createLauncherHarness({
    playwrightCli: false,
    prismaDist: false,
    typesDist: false,
  })

  runPlaywrightHost(['--print-env'], harness.dependencies)

  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop'),
    -1
  )
  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'ensure') >= 0,
    true
  )
  assert.equal(pnpmCalls(harness.calls).length, 0)
})

test('show-report does not reconcile the runtime', () => {
  const harness = createLauncherHarness({
    playwrightCli: false,
    prismaDist: false,
    typesDist: false,
  })

  runPlaywrightHost(['--show-report'], harness.dependencies)

  assert.equal(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'ensure'),
    -1
  )
  assert.ok(
    commandIndex(harness.calls, '/synthetic/bin/devrouter', 'stop') >= 0
  )
  const report = harness.calls.find(
    ({ command, args }) => command === 'pnpm' && args.includes('show-report')
  )
  assert.ok(report)
  assert.ok(
    pnpmCalls(harness.calls).every(
      ({ options }) => options.env?.[PNPM_VERIFY_DEPS_ENV] === 'error'
    )
  )
})

test('Volta-routed pnpm commands retain the lowercase dependency guard', () => {
  const harness = createLauncherHarness()
  harness.dependencies.commandExistsFn = () => true

  runPlaywrightHost(['--list'], harness.dependencies)

  const pnpmChildren = harness.calls.filter(
    ({ command, args }) => command === 'corepack' && args[0] === 'pnpm'
  )
  assert.ok(pnpmChildren.length > 0)
  assert.ok(
    pnpmChildren.every(
      ({ options }) => options.env?.[PNPM_VERIFY_DEPS_ENV] === 'error'
    )
  )
})
