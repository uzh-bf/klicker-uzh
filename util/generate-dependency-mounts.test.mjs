import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  createDependencyCompose,
  discoverWorkspacePackages,
  generateDependencyMounts,
  validateWorkspacePackagePaths,
} from './generate-dependency-mounts.mjs'

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'klicker-dependency-mounts-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'synthetic-root', private: true })
  )
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    `${['packages:', '  - apps/*', "  - '!apps/excluded'"].join('\n')}\n`
  )
  return root
}

function addPackage(root, packagePath) {
  const directory = join(root, ...packagePath.split('/'))
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ name: `synthetic-${packagePath.replaceAll('/', '-')}` })
  )
}

function appVolumeMap(compose) {
  return new Map(
    compose.services.app.volumes.map((mount) => {
      const [volume, target] = mount.split(':')
      return [target, volume]
    })
  )
}

test('cold real pnpm discovery follows workspace exclusions without installing', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/included')
    addPackage(root, 'apps/excluded')

    assert.deepEqual(discoverWorkspacePackages(root), ['apps/included'])
    assert.equal(existsSync(join(root, 'node_modules')), false)
    assert.equal(existsSync(join(root, 'pnpm-lock.yaml')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('discovery uses literal pinned-pnpm argv, explicit cwd, timeout, and guards', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/included')
    const canonicalFixtureRoot = realpathSync(root)
    let invocation
    const packages = discoverWorkspacePackages(root, {
      spawn(command, args, options) {
        invocation = { args, command, options }
        return {
          error: undefined,
          status: 0,
          stderr: '',
          stdout: JSON.stringify([
            { path: canonicalFixtureRoot },
            { path: join(canonicalFixtureRoot, 'apps/included') },
          ]),
        }
      },
    })

    assert.deepEqual(packages, ['apps/included'])
    assert.equal(invocation.command, 'pnpm')
    assert.deepEqual(invocation.args, [
      'list',
      '--recursive',
      '--depth',
      '-1',
      '--json',
    ])
    assert.equal(invocation.options.cwd, canonicalFixtureRoot)
    assert.equal(invocation.options.timeout, 55_000)
    assert.equal(
      invocation.options.env.pnpm_config_verify_deps_before_run,
      'error'
    )
    assert.equal(invocation.options.env.VOLTA_FEATURE_PNPM, '1')
    assert.deepEqual(invocation.options.stdio, ['ignore', 'pipe', 'pipe'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('additions and removals regenerate the overlay without stale mounts', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/first')
    let result = generateDependencyMounts(root)
    let compose = JSON.parse(readFileSync(result.outputPath, 'utf8'))
    assert.ok(
      appVolumeMap(compose).has(
        '/workspaces/klicker-uzh/apps/first/node_modules'
      )
    )

    addPackage(root, 'apps/second')
    result = generateDependencyMounts(root)
    compose = JSON.parse(readFileSync(result.outputPath, 'utf8'))
    assert.ok(
      appVolumeMap(compose).has(
        '/workspaces/klicker-uzh/apps/second/node_modules'
      )
    )

    rmSync(join(root, 'apps/first'), { recursive: true, force: true })
    result = generateDependencyMounts(root)
    compose = JSON.parse(readFileSync(result.outputPath, 'utf8'))
    assert.equal(
      appVolumeMap(compose).has(
        '/workspaces/klicker-uzh/apps/first/node_modules'
      ),
      false
    )
    assert.ok(
      appVolumeMap(compose).has(
        '/workspaces/klicker-uzh/apps/second/node_modules'
      )
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('output is deterministic and unchanged bytes preserve modification time', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/zulu')
    addPackage(root, 'apps/alpha')

    const first = generateDependencyMounts(root)
    const firstBytes = readFileSync(first.outputPath)
    const firstMtime = statSync(first.outputPath, { bigint: true }).mtimeNs
    const second = generateDependencyMounts(root)
    const secondBytes = readFileSync(second.outputPath)
    const secondMtime = statSync(second.outputPath, { bigint: true }).mtimeNs

    assert.equal(second.changed, false)
    assert.deepEqual(secondBytes, firstBytes)
    assert.equal(secondMtime, firstMtime)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('stable package names and hyphen-preserving names stay compatible', () => {
  const compose = createDependencyCompose([
    'packages/types',
    'apps/frontend-control',
    'packages/prisma',
    'playwright',
  ])
  const mounts = appVolumeMap(compose)

  assert.equal(
    mounts.get('/workspaces/klicker-uzh/node_modules'),
    'node_modules_root'
  )
  assert.equal(
    mounts.get('/workspaces/klicker-uzh/playwright/node_modules'),
    'node_modules_playwright'
  )
  assert.equal(
    mounts.get('/workspaces/klicker-uzh/packages/prisma/node_modules'),
    'node_modules_prisma'
  )
  assert.equal(
    mounts.get('/workspaces/klicker-uzh/packages/types/node_modules'),
    'node_modules_types'
  )
  assert.equal(
    mounts.get('/workspaces/klicker-uzh/apps/frontend-control/node_modules'),
    'node_modules_apps_frontend-control'
  )
  assert.deepEqual(
    Object.values(compose.volumes).map((value) => Object.keys(value)),
    Object.values(compose.volumes).map(() => [])
  )
})

test('unsafe, outside, symlinked, and colliding package paths fail closed', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/real')
    mkdirSync(join(root, 'apps'), { recursive: true })
    symlinkSync(join(root, 'apps/real'), join(root, 'apps/link'), 'dir')

    assert.throws(() => validateWorkspacePackagePaths(root, ['../outside']))
    assert.throws(() => validateWorkspacePackagePaths(root, ['apps/real:bad']))
    assert.throws(() => validateWorkspacePackagePaths(root, ['apps/link']))
    assert.throws(() => createDependencyCompose(['apps/a/b', 'apps/a_b']))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a discovery or validation failure preserves the previous artifact', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/valid')
    const first = generateDependencyMounts(root)
    const previousBytes = readFileSync(first.outputPath)
    const previousMtime = statSync(first.outputPath, { bigint: true }).mtimeNs

    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: [\n')
    assert.throws(() => generateDependencyMounts(root))

    assert.deepEqual(readFileSync(first.outputPath), previousBytes)
    assert.equal(
      statSync(first.outputPath, { bigint: true }).mtimeNs,
      previousMtime
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('retained Redis clauses preserve dependency mounts and alias expressions', () => {
  const packages = ['apps/frontend-control', 'packages/prisma']
  const ordinary = createDependencyCompose(packages)
  const retained = createDependencyCompose(packages, true)
  assert.deepEqual(retained.services, ordinary.services)
  for (const [key, value] of Object.entries(ordinary.volumes)) {
    assert.deepEqual(retained.volumes[key], value)
  }
  for (const kind of ['exec', 'assessment', 'cache']) {
    const key = `redis_${kind}_data`
    assert.equal(ordinary.volumes[key], undefined)
    assert.deepEqual(retained.volumes[key], {
      name: `\${KLICKER_REDIS_${kind.toUpperCase()}_VOLUME:-\${COMPOSE_PROJECT_NAME}_${key}}`,
    })
  }
})

test('alias or selector presence keeps retained clauses until absence is proved', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/valid')
    const options = { environment: {}, workingDirectory: root }
    const clean = generateDependencyMounts(root, options)
    for (const key of [
      'KLICKER_REDIS_EXEC_VOLUME',
      'KLICKER_REDIS_ASSESSMENT_VOLUME',
      'KLICKER_REDIS_CACHE_VOLUME',
      'COMPOSE_ENV_FILES',
      'COMPOSE_FILE',
      'COMPOSE_DISABLE_ENV_FILE',
    ]) {
      for (const value of ['', 'synthetic-retained-input']) {
        const retained = generateDependencyMounts(root, {
          ...options,
          environment: { [key]: value },
        })
        assert.deepEqual(
          retained.compose,
          createDependencyCompose(['apps/valid'], true)
        )
        assert.equal(
          readFileSync(retained.outputPath, 'utf8').includes(
            'synthetic-retained-input'
          ),
          false
        )
      }
    }
    const restored = generateDependencyMounts(root, options)
    assert.deepEqual(restored.compose, clean.compose)
    const bytes = readFileSync(restored.outputPath)
    assert.throws(() =>
      generateDependencyMounts(root, {
        ...options,
        workingDirectory: join(root, 'missing'),
      })
    )
    assert.deepEqual(readFileSync(restored.outputPath), bytes)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dotenv metadata in all invocation locations conservatively retains aliases', () => {
  const root = fixtureRoot()
  const invocationRoot = fixtureRoot()
  try {
    addPackage(root, 'apps/valid')
    const options = { environment: {}, workingDirectory: invocationRoot }
    const clean = generateDependencyMounts(root, options)
    for (const location of [
      join(root, '.env'),
      join(root, '.devcontainer', '.env'),
      join(invocationRoot, '.env'),
    ]) {
      writeFileSync(
        location,
        'KLICKER_REDIS_EXEC_VOLUME=synthetic-retained\n',
        {
          mode: 0o000,
        }
      )
      const opaqueFile = generateDependencyMounts(root, options)
      assert.deepEqual(
        opaqueFile.compose,
        createDependencyCompose(['apps/valid'], true)
      )
      rmSync(location)
      symlinkSync(join(root, 'missing-env-target'), location)
      const retained = generateDependencyMounts(root, options)
      assert.deepEqual(
        retained.compose,
        createDependencyCompose(['apps/valid'], true)
      )
      rmSync(location)
    }
    assert.deepEqual(
      generateDependencyMounts(root, options).compose,
      clean.compose
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(invocationRoot, { recursive: true, force: true })
  }
})

test('host prepare and provider initialize generate identical selected bytes', () => {
  const root = fixtureRoot()
  try {
    addPackage(root, 'apps/valid')
    mkdirSync(join(root, 'util'))
    mkdirSync(join(root, '.devcontainer'))
    mkdirSync(join(root, 'fake-bin'))
    writeFileSync(
      join(root, 'util', 'generate-dependency-mounts.mjs'),
      readFileSync(new URL('./generate-dependency-mounts.mjs', import.meta.url))
    )
    writeFileSync(
      join(root, '.devcontainer', 'initialize.sh'),
      readFileSync(new URL('../.devcontainer/initialize.sh', import.meta.url))
    )
    writeFileSync(join(root, 'fake-bin', 'docker'), '#!/bin/sh\nexit 0\n', {
      mode: 0o755,
    })
    writeFileSync(join(root, 'fake-bin', 'mkcert'), '#!/bin/sh\nexit 1\n', {
      mode: 0o755,
    })
    const environment = { ...process.env }
    for (const key of Object.keys(environment)) {
      if (key.startsWith('COMPOSE_') || key.startsWith('KLICKER_REDIS_')) {
        delete environment[key]
      }
    }
    environment.PATH = `${join(root, 'fake-bin')}:${environment.PATH}`
    for (const alias of [false, true]) {
      if (alias) environment.KLICKER_REDIS_EXEC_VOLUME = 'synthetic-retained'
      const prepare = spawnSync(
        process.execPath,
        ['util/generate-dependency-mounts.mjs'],
        { cwd: root, env: environment, encoding: 'utf8' }
      )
      assert.equal(prepare.status, 0, prepare.stderr)
      const output = join(
        root,
        '.devcontainer',
        'docker-compose.dependencies.yml'
      )
      const prepared = readFileSync(output)
      const initialize = spawnSync('bash', ['.devcontainer/initialize.sh'], {
        cwd: root,
        env: environment,
        encoding: 'utf8',
      })
      assert.equal(initialize.status, 0, initialize.stderr)
      assert.deepEqual(readFileSync(output), prepared)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
