import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { getNextBaseConfig } from '../packages/next-config/index.js'
import { buildRuntime } from './playwright-next-runtime.mjs'

const helper = fileURLToPath(
  new URL('./playwright-next-runtime.mjs', import.meta.url)
)

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'playwright-runtime-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const app = join(root, 'apps/synthetic')
  mkdirSync(app, { recursive: true })
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({ scripts: { build: 'next build --webpack' } })
  )
  return { root, app }
}

function write(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, value)
}

function syntheticBuild(app) {
  const standalone = join(app, '.next/standalone')
  const server = join(standalone, 'apps/synthetic')
  write(join(app, '.next/BUILD_ID'), 'synthetic-build')
  write(join(app, '.next/static/chunk.js'), 'static-asset')
  write(join(app, 'public/sw.js'), 'worker-asset')
  write(join(server, '.next/BUILD_ID'), 'synthetic-build')
  write(
    join(standalone, 'packages/dependency/index.cjs'),
    'module.exports = 42'
  )
  mkdirSync(join(server, 'node_modules'), { recursive: true })
  symlinkSync(
    '../../../packages/dependency',
    join(server, 'node_modules/dependency')
  )
  write(join(server, '.env'), 'SYNTHETIC_ENV_SHOULD_NOT_TRAVEL=1')
  write(
    join(server, 'server.js'),
    `
const { readFileSync, existsSync } = require('node:fs')
console.log(JSON.stringify({
  mode: process.env.NODE_ENV,
  port: process.env.PORT,
  dependency: require('dependency/index.cjs'),
  static: readFileSync('.next/static/chunk.js', 'utf8'),
  worker: readFileSync('public/sw.js', 'utf8'),
  envFile: existsSync('.env'),
}))
`
  )
}

test('production build survives trusted artifact filtering and relocation', (t) => {
  const { root, app } = fixture(t)
  let builds = 0
  buildRuntime(app, (command, args, options) => {
    builds += 1
    assert.equal(command, 'pnpm')
    assert.deepEqual(args, ['run', 'build'])
    assert.equal(options.cwd, app)
    assert.equal(options.env.NODE_ENV, 'production')
    assert.equal(options.env.KLICKER_PLAYWRIGHT_FIXTURES, '1')
    syntheticBuild(app)
  })
  assert.equal(builds, 1)
  const transfer = join(root, 'transfer.tar')
  assert.equal(
    spawnSync('tar', [
      '--exclude=.next/standalone',
      '-cf',
      transfer,
      '-C',
      app,
      '.next',
    ]).status,
    0
  )
  const relocated = join(root, 'shard/apps/synthetic')
  mkdirSync(relocated, { recursive: true })
  cpSync(join(app, 'package.json'), join(relocated, 'package.json'))
  assert.equal(spawnSync('tar', ['-xf', transfer, '-C', relocated]).status, 0)
  const result = spawnSync(process.execPath, [helper, 'start', '3012'], {
    cwd: relocated,
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout.trim().split('\n').at(-1))
  assert.deepEqual(output, {
    mode: 'production',
    port: '3012',
    dependency: 42,
    static: 'static-asset',
    worker: 'worker-asset',
    envFile: false,
  })
})

test('startup rejects missing production artifacts', (t) => {
  const { app } = fixture(t)
  const result = spawnSync(process.execPath, [helper, 'start', '3012'], {
    cwd: app,
  })
  assert.notEqual(result.status, 0)
})

test('startup rejects an artifact built with a different production command', (t) => {
  const { app } = fixture(t)
  buildRuntime(app, () => syntheticBuild(app))
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({ scripts: { build: 'next build --turbopack' } })
  )
  const result = spawnSync(process.execPath, [helper, 'start', '3012'], {
    cwd: app,
  })
  assert.notEqual(result.status, 0)
})

test('all Next app test entrypoints use the shared production runtime', () => {
  for (const app of [
    'auth',
    'chat',
    'frontend-control',
    'frontend-manage',
    'frontend-pwa',
  ]) {
    const { scripts } = JSON.parse(
      readFileSync(new URL(`../apps/${app}/package.json`, import.meta.url))
    )
    assert.equal(
      scripts['build:test'],
      'node ../../util/playwright-next-runtime.mjs build'
    )
    assert.match(
      scripts['start:test'],
      /^node \.\.\/\.\.\/util\/playwright-next-runtime\.mjs start \d+$/
    )
  }
})

test('local fixture images do not change production output or normal production policy', () => {
  const previous = process.env.KLICKER_PLAYWRIGHT_FIXTURES
  try {
    delete process.env.KLICKER_PLAYWRIGHT_FIXTURES
    const production = getNextBaseConfig({ NODE_ENV: 'production' })
    assert.equal(production.output, 'standalone')
    assert.equal(production.images.dangerouslyAllowLocalIP, false)
    process.env.KLICKER_PLAYWRIGHT_FIXTURES = '1'
    const fixtures = getNextBaseConfig({ NODE_ENV: 'production' })
    assert.equal(fixtures.output, 'standalone')
    assert.equal(fixtures.images.dangerouslyAllowLocalIP, true)
    assert.deepEqual(fixtures.transpilePackages, production.transpilePackages)
  } finally {
    if (previous === undefined) delete process.env.KLICKER_PLAYWRIGHT_FIXTURES
    else process.env.KLICKER_PLAYWRIGHT_FIXTURES = previous
  }
})
