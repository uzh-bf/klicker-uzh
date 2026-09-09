import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  captureSeedSnapshot,
  composeRestoreSql,
  computeSeedSnapshotKey,
  DISPOSABLE_DATABASE,
  restoreSeedSnapshot,
  snapshotEnvironmentState,
} from './playwright-seed-snapshot.mjs'

const baseEnvironment = {
  DATABASE_URL: 'postgres://klicker_test:klicker@127.0.0.1:49153/klicker_test',
  KLICKER_PLAYWRIGHT_HOST_RUNNER: '1',
  KLICKER_PLAYWRIGHT_POSTGRES_CONTAINER: 'synthetic-postgres',
}

const schemaOnlyDumpLines = [
  '--Dumped by pg_dump version 15.8',
  '',
  'SET statement_timeout = 0;',
  'SET lock_timeout = 0;',
  "SET client_encoding = 'UTF8';",
  '',
  'CREATE SCHEMA public;',
  '',
  'CREATE TABLE public."User" (',
  '    "id" text NOT NULL',
  ');',
  '',
  'CREATE VIEW public."UserActivities" AS SELECT 1;',
  '',
]
const schemaOnlyDump = schemaOnlyDumpLines.join('\n')

const fullDump = schemaOnlyDumpLines
  .concat([
    '',
    '\\restrict randomtoken',
    'COPY public."User" ("id") FROM stdin;',
    'lecturer-user-id',
    '\\.',
    '',
    'SELECT pg_catalog.setval(public."User_id_seq", 1, false);',
    '\\unrestrict randomtoken',
  ])
  .join('\n')

function createDockerRunner({
  schemaDump = schemaOnlyDump,
  dump = fullDump,
  restoreStatus = 0,
  version = '150008',
  calls = [],
} = {}) {
  return (args, options = {}) => {
    calls.push({ args: [...args], options })
    if (args.includes('psql') && args.includes('-c')) {
      return { status: 0, stdout: version + '\n', stderr: '' }
    }
    if (args.includes('pg_dump')) {
      if (args.includes('--schema-only')) {
        return { status: 0, stdout: schemaDump, stderr: '' }
      }
      return { status: 0, stdout: dump, stderr: '' }
    }
    if (args.includes('psql') && args.includes('-q')) {
      return { status: restoreStatus, stdout: '', stderr: 'synthetic failure' }
    }
    return { status: 0, stdout: '', stderr: '' }
  }
}

function withCacheRoot(run) {
  const cacheRoot = mkdtempSync(join(tmpdir(), 'seed-snapshot-'))
  try {
    return run(cacheRoot)
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true })
  }
}

test('snapshot guards refuse CI, preservation, overrides, and foreign databases', () => {
  assert.equal(
    snapshotEnvironmentState({ ...baseEnvironment, CI: 'true' })?.startsWith(
      'refused'
    ),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      GITHUB_ACTIONS: 'true',
    })?.startsWith('refused'),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      KLICKER_PLAYWRIGHT_PRESERVE_DATABASE: '1',
    })?.startsWith('refused'),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      KLICKER_PLAYWRIGHT_HOST_RUNNER: undefined,
    })?.startsWith('refused'),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      PGUSER: 'postgres',
    })?.startsWith('refused'),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      DATABASE_URL:
        'postgres://klicker-prod:klicker@postgres:5432/klicker-prod',
    })?.startsWith('refused'),
    true
  )
  assert.equal(
    snapshotEnvironmentState({
      ...baseEnvironment,
      KLICKER_PLAYWRIGHT_POSTGRES_CONTAINER: undefined,
    })?.startsWith('refused'),
    true
  )
  assert.equal(snapshotEnvironmentState(baseEnvironment), null)
})

test('snapshot keys bind sources, PostgreSQL major, timezone, and year', () => {
  const sources = new Map([
    ['playwright/global-setup.ts', 'seed v1'],
    ['pnpm-lock.yaml', 'lock v1'],
  ])
  const basis = { sources, postgresMajor: 15, timezone: 'UTC', year: 2026 }
  const key = computeSeedSnapshotKey(basis)

  assert.equal(computeSeedSnapshotKey(basis), key)
  assert.notEqual(
    computeSeedSnapshotKey({
      ...basis,
      sources: new Map([
        ['playwright/global-setup.ts', 'seed v2'],
        ['pnpm-lock.yaml', 'lock v1'],
      ]),
    }),
    key
  )
  assert.notEqual(computeSeedSnapshotKey({ ...basis, postgresMajor: 16 }), key)
  assert.notEqual(computeSeedSnapshotKey({ ...basis, year: 2027 }), key)
  assert.notEqual(
    computeSeedSnapshotKey({ ...basis, timezone: 'Europe/Zurich' }),
    key
  )
})

test('restore SQL keeps one guarded transaction and strips unsafe dump lines', () => {
  const sql = composeRestoreSql(fullDump)

  assert.equal(sql.match(/BEGIN;/g)?.length, 1)
  assert.equal(sql.match(/COMMIT;/g)?.length, 1)
  assert.ok(sql.includes('SET LOCAL lock_timeout'))
  assert.ok(sql.includes("current_database() <> '" + DISPOSABLE_DATABASE + "'"))
  assert.ok(sql.includes('klicker-disposable-test-v1'))
  assert.ok(
    sql.includes(
      'rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls'
    )
  )
  assert.ok(sql.includes('pg_terminate_backend(pid)'))
  assert.ok(sql.includes('usename = session_user'))
  assert.ok(sql.includes('DROP SCHEMA public CASCADE;'))
  assert.ok(sql.includes('CREATE SCHEMA public;'))
  assert.ok(sql.includes('COPY public."User" ("id") FROM stdin;'))
  assert.ok(sql.includes('pg_catalog.setval'))
  assert.ok(sql.includes('\\set ON_ERROR_STOP on'))
  assert.ok(sql.includes('\\.'))
  assert.ok(!sql.includes('SET lock_timeout = 0;'))
  assert.ok(!sql.includes('SET statement_timeout = 0;'))
  assert.ok(!sql.match(/CREATE SCHEMA public;.*\n.*CREATE SCHEMA public;/))
  assert.ok(!sql.includes('\\restrict'))
  assert.ok(!sql.includes('\\unrestrict'))
})

test('capture and restore round-trip through the ignored cache directory', () => {
  withCacheRoot((cacheRoot) => {
    const restoreCalls = []
    const docker = createDockerRunner({ calls: restoreCalls })

    const captured = captureSeedSnapshot({
      env: baseEnvironment,
      runDocker: docker,
      cacheRoot,
    })
    assert.equal(captured.status, 'captured')

    const manifest = JSON.parse(
      readFileSync(join(cacheRoot, 'key.json'), 'utf8')
    )
    assert.equal(manifest.postgresMajor, 15)
    assert.equal(manifest.key.length, 64)
    assert.equal(manifest.schemaFingerprint.length, 64)
    assert.equal(manifest.snapshotSha256.length, 64)
    assert.ok(readFileSync(join(cacheRoot, 'snapshot.sql'), 'utf8').length > 0)

    const restored = restoreSeedSnapshot({
      env: baseEnvironment,
      runDocker: docker,
      cacheRoot,
    })
    assert.equal(restored.status, 'restored')

    const restore = restoreCalls.find(({ args }) => args.includes('-q'))
    assert.ok(restore)
    assert.ok(restore.args.includes('-i'))
    assert.ok(restore.args.includes('ON_ERROR_STOP=1'))
    assert.ok(restore.options.input.includes('DROP SCHEMA public CASCADE;'))
  })
})

test('schema fingerprints ignore volatile pg_dump restrict tokens', () => {
  withCacheRoot((cacheRoot) => {
    const withToken = (token) =>
      schemaOnlyDumpLines
        .concat(['', '\\restrict ' + token, '', '\\unrestrict ' + token])
        .join('\n')

    captureSeedSnapshot({
      env: baseEnvironment,
      runDocker: createDockerRunner({
        schemaDump: withToken('capturetoken'),
      }),
      cacheRoot,
    })

    const restored = restoreSeedSnapshot({
      env: baseEnvironment,
      runDocker: createDockerRunner({
        schemaDump: withToken('differenttoken'),
      }),
      cacheRoot,
    })
    assert.equal(restored.status, 'restored')
  })
})

test('restore keeps COPY payload rows verbatim and strips only meta lines', () => {
  const dump = [
    'SET statement_timeout = 0;',
    'COPY public."Element" ("id", "content") FROM stdin;',
    'elt1\tSET content that must survive verbatim',
    '\\restrict insidetokenmustsurvive',
    '\\.',
    'SELECT pg_catalog.setval(public."Element_id_seq", 1, false);',
  ].join('\n')
  const sql = composeRestoreSql(dump)

  assert.ok(sql.includes('COPY public."Element" ("id", "content") FROM stdin;'))
  assert.ok(sql.includes('elt1\tSET content that must survive verbatim'))
  assert.ok(sql.includes('\\restrict insidetokenmustsurvive'))
  assert.ok(sql.includes('\\.'))
  assert.ok(!sql.includes('SET statement_timeout = 0;'))
  assert.ok(sql.includes('pg_catalog.setval'))
})

test('restore reports a controlled miss for every invalid cache state', () => {
  withCacheRoot((cacheRoot) => {
    const docker = createDockerRunner()

    assert.equal(
      restoreSeedSnapshot({
        env: baseEnvironment,
        runDocker: docker,
        cacheRoot,
      }).status,
      'miss'
    )

    captureSeedSnapshot({
      env: baseEnvironment,
      runDocker: docker,
      cacheRoot,
    })

    assert.equal(
      restoreSeedSnapshot({
        env: {
          ...baseEnvironment,
          TZ:
            Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC'
              ? 'Europe/Zurich'
              : 'UTC',
        },
        runDocker: docker,
        cacheRoot,
      }).status,
      'miss'
    )

    assert.equal(
      restoreSeedSnapshot({
        env: baseEnvironment,
        runDocker: createDockerRunner({
          schemaDump: schemaOnlyDump.replace(
            'CREATE TABLE',
            'CREATE TABLE IF NOT EXISTS'
          ),
        }),
        cacheRoot,
      }).status,
      'miss'
    )

    const manifestPath = join(cacheRoot, 'key.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.snapshotSha256 = '0'.repeat(64)
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    assert.equal(
      restoreSeedSnapshot({
        env: baseEnvironment,
        runDocker: docker,
        cacheRoot,
      }).status,
      'miss'
    )
  })
})

test('restore failures surface as errors instead of partial continuation', () => {
  withCacheRoot((cacheRoot) => {
    const docker = createDockerRunner()
    captureSeedSnapshot({ env: baseEnvironment, runDocker: docker, cacheRoot })

    const failed = restoreSeedSnapshot({
      env: baseEnvironment,
      runDocker: createDockerRunner({ restoreStatus: 1 }),
      cacheRoot,
    })
    assert.equal(failed.status, 'error')
    assert.ok(failed.message.includes('left the previous state intact'))

    const badVersion = restoreSeedSnapshot({
      env: baseEnvironment,
      runDocker: createDockerRunner({ version: 'not-a-number' }),
      cacheRoot,
    })
    assert.equal(badVersion.status, 'error')
  })
})

test('refused environments degrade to misses and skipped captures', () => {
  const calls = []
  const docker = createDockerRunner({ calls })

  assert.equal(
    restoreSeedSnapshot({
      env: { ...baseEnvironment, CI: 'true' },
      runDocker: docker,
    }).status,
    'miss'
  )
  assert.equal(
    captureSeedSnapshot({
      env: { ...baseEnvironment, CI: 'true' },
      runDocker: docker,
    }).status,
    'skipped'
  )
  assert.equal(calls.length, 0)
})
