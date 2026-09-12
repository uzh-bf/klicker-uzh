import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertHostDependencies,
  checkTasks,
  cleanGitEnvironment,
  runHook,
} from './run-git-hook.mjs'

function fixture(t, native = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-routing-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bin = path.join(root, 'bin')
  fs.mkdirSync(bin)
  const log = path.join(root, 'calls.jsonl')
  for (const command of ['devrouter', 'pnpm']) {
    fs.writeFileSync(
      path.join(bin, command),
      `#!${process.execPath}\nconst fs = require('node:fs'); fs.appendFileSync(process.env.HOOK_TEST_LOG, JSON.stringify({command:${JSON.stringify(command)}, args:process.argv.slice(2), git:Object.keys(process.env).filter(k=>k.startsWith('GIT_'))})+'\\n'); process.exit(Number(process.env.HOOK_TEST_EXIT || 0))\n`,
      { mode: 0o755 }
    )
  }
  if (native) {
    fs.mkdirSync(path.join(root, 'node_modules'))
    fs.writeFileSync(path.join(root, 'node_modules/.modules.yaml'), '')
  }
  const env = {
    ...cleanGitEnvironment(process.env),
    KLICKER_GIT_HOOK_RUNTIME: '',
    PATH: `${bin}:${process.env.PATH}`,
    HOOK_TEST_LOG: log,
  }
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8' })
  git('init', '-q')
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        'check:all': 'run-p --npm-path pnpm check:format check',
        check: 'turbo run check',
      },
    })
  )
  fs.writeFileSync(
    path.join(root, '.lintstagedrc.mjs'),
    'export default { "*.{ts}": files => files.map(f => `biome format --no-errors-on-unmatched ${f}`) }'
  )
  return {
    root,
    env,
    git,
    calls: () =>
      fs.existsSync(log)
        ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
        : [],
  }
}

test('derives all checks and refuses unsupported syntax', () => {
  assert.deepEqual(checkTasks('run-p --npm-path pnpm check check:new'), [
    'check',
    'check:new',
  ])
  assert.throws(() => checkTasks('run-p check && true'))
})

test('Prisma checking waits for its output-producing build', () => {
  const root = new URL('../', import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('package.json', root)))
  const turbo = JSON.parse(fs.readFileSync(new URL('turbo.json', root)))
  assert.ok(!manifest.scripts.check.split(' ').includes('--parallel'))
  assert.ok(
    turbo.tasks['@klicker-uzh/prisma#check'].dependsOn.includes('build')
  )
})

test('container build targets exact checkout and removes inherited Git state', async (t) => {
  const f = fixture(t)
  await runHook('build', f.root, {
    ...f.env,
    GIT_DIR: '/invalid',
    GIT_INDEX_FILE: '/invalid',
  })
  assert.deepEqual(f.calls(), [
    {
      command: 'devrouter',
      args: ['exec', f.root, '--', 'pnpm', 'run', 'build'],
      git: [],
    },
  ])
})

test('native build retains dependency validation through pnpm', async (t) => {
  const f = fixture(t, true)
  await runHook('build', f.root, f.env)
  assert.deepEqual(f.calls()[0].args, ['run', 'build'])
  assert.equal(f.calls()[0].command, 'pnpm')
})

test('explicit container routing survives a partial host tooling install', async (t) => {
  const f = fixture(t, true)
  await runHook('build', f.root, {
    ...f.env,
    KLICKER_GIT_HOOK_RUNTIME: 'container',
  })
  assert.equal(f.calls()[0].command, 'devrouter')
  await assert.rejects(
    runHook('build', f.root, { ...f.env, KLICKER_GIT_HOOK_RUNTIME: 'invalid' })
  )
})

test('host dependencies reject ancestor resolution and accept checkout-local installation', (t) => {
  const f = fixture(t)
  const child = path.join(f.root, 'checkout')
  fs.mkdirSync(child)
  fs.writeFileSync(path.join(child, 'package.json'), '{}')
  const ancestorPackage = path.join(f.root, 'node_modules/yaml')
  fs.mkdirSync(ancestorPackage, { recursive: true })
  fs.writeFileSync(
    path.join(ancestorPackage, 'package.json'),
    '{"name":"yaml"}'
  )
  assert.throws(() => assertHostDependencies(child), /checkout-local yaml/)
  const installed = fixture(t)
  const localPackage = path.join(installed.root, 'node_modules/yaml')
  fs.mkdirSync(localPackage, { recursive: true })
  fs.writeFileSync(path.join(localPackage, 'package.json'), '{"name":"yaml"}')
  assert.doesNotThrow(() => assertHostDependencies(installed.root))
})

test('propagates failed check status', async (t) => {
  const f = fixture(t)
  await assert.rejects(
    runHook('build', f.root, { ...f.env, HOOK_TEST_EXIT: '7' }),
    { exitCode: 7 }
  )
})

test('formatting passes filenames literally without shell expansion', async (t) => {
  const f = fixture(t)
  const file = 'space $(touch unsafe).ts'
  fs.writeFileSync(path.join(f.root, file), 'const value = 1\n')
  f.git('add', '--', file)
  await runHook('check', f.root, f.env)
  assert.equal(f.calls()[0].args.at(-1), `./${file}`)
  assert.deepEqual(f.calls()[1].args, [
    'exec',
    f.root,
    '--',
    'pnpm',
    'run',
    'check',
  ])
  assert.equal(fs.existsSync(path.join(f.root, 'unsafe')), false)
})

test('partially staged files fail without changing index or worktree', async (t) => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.root, 'sample.ts'), 'const value = 1\n')
  f.git('add', 'sample.ts')
  fs.writeFileSync(path.join(f.root, 'sample.ts'), 'const value = 2\n')
  await assert.rejects(runHook('check', f.root, f.env), /Partially staged/)
  assert.equal(f.git('show', ':sample.ts'), 'const value = 1\n')
  assert.equal(
    fs.readFileSync(path.join(f.root, 'sample.ts'), 'utf8'),
    'const value = 2\n'
  )
  assert.deepEqual(f.calls(), [])
})
