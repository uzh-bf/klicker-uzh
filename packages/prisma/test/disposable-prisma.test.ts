import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { guardedPrismaCommand } from '../scripts/disposable-prisma.js'

test('allows only the supported operation flags', () => {
  assert.deepEqual(guardedPrismaCommand('reset', ['--force']), [
    'migrate',
    'reset',
    '--force',
  ])
  assert.deepEqual(guardedPrismaCommand('push', ['--accept-data-loss']), [
    'db',
    'push',
    '--accept-data-loss',
  ])
  assert.deepEqual(
    guardedPrismaCommand('migrate', ['--create-only', '--name', 'test_change']),
    ['migrate', 'dev', '--create-only', '--name', 'test_change']
  )
  assert.deepEqual(guardedPrismaCommand('seed', []), ['db', 'seed'])
  assert.deepEqual(guardedPrismaCommand('diff', ['--script']), [
    'migrate',
    'diff',
    '--from-config-datasource',
    '--to-migrations',
    'src/prisma/schema/migrations',
    '--script',
  ])
})

test('rejects alternate destinations, schemas, configuration and positional arguments', () => {
  for (const operation of ['reset', 'push', 'migrate', 'seed', 'diff']) {
    for (const args of [
      ['--config', 'other.ts'],
      ['--schema', 'other.prisma'],
      ['--url', 'postgres://other'],
      ['--from-url=postgres://other'],
      ['--to-migrations', 'other'],
      ['--', '--config', 'other.ts'],
      ['--force=true'],
      ['other'],
    ]) {
      assert.throws(() => guardedPrismaCommand(operation, args))
    }
  }
  assert.throws(() => guardedPrismaCommand('deploy', []))
  assert.throws(() => guardedPrismaCommand('migrate', ['--name']))
  assert.throws(() => guardedPrismaCommand('migrate', ['--name', '--config']))
})

test('refuses every destructive entrypoint with a retained destination without exposing its credentials', () => {
  const runner = fileURLToPath(
    new URL('../scripts/disposable-prisma.ts', import.meta.url)
  )
  const tsx = fileURLToPath(
    new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)
  )
  for (const operation of ['reset', 'push', 'migrate', 'seed', 'diff']) {
    const result = spawnSync(process.execPath, [tsx, runner, operation], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL:
          'postgres://klicker-prod:synthetic-secret@127.0.0.1:1/klicker-prod',
        SHADOW_DATABASE_URL:
          'postgres://klicker-prod:synthetic-secret@127.0.0.1:1/shadow',
      },
    })
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /synthetic-secret/)
    assert.equal(result.stdout, '')
  }
})
