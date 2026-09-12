#!/usr/bin/env node
/**
 * Synthetic seed snapshot capture and restore for the disposable klicker_test
 * database. A snapshot replaces the per-run cleanup + reseed round trip with a
 * single-transaction public-schema restore, but only on the local
 * host-launcher path and only for the seeded baseline this repository defines.
 * Cache entries bind the Prisma schema, migrations, seed implementation, seed
 * constants, lockfile, PostgreSQL major version, timezone and year, plus a
 * fingerprint of the live database schema so drifted local state is never
 * mistaken for a hit.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRootDefault = join(repoRoot, 'playwright', '.cache', 'seed-snapshot')
const KEY_SEPARATOR = String.fromCharCode(0)

export const SNAPSHOT_MISS_EXIT = 3
export const DISPOSABLE_DATABASE = 'klicker_test'
export const DISPOSABLE_MARKER = 'klicker-disposable-test-v1'

const KEY_SOURCE_FILES = [
  'packages/prisma/src/prisma/schema/migrations/**',
  'packages/prisma/src/prisma/schema/*.prisma',
  'playwright/global-setup.ts',
  'playwright/util/constants.ts',
  'pnpm-lock.yaml',
]

function fail(message) {
  throw new Error('[seed-snapshot] ' + message)
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function listMigrationFiles(root) {
  const migrationsRoot = join(
    root,
    'packages/prisma/src/prisma/schema/migrations'
  )
  const files = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  walk(migrationsRoot)
  return files.sort()
}

export function collectKeySources({
  root = repoRoot,
  readFile = readFileSync,
} = {}) {
  const sources = new Map()
  for (const pattern of KEY_SOURCE_FILES) {
    if (pattern === 'packages/prisma/src/prisma/schema/migrations/**') {
      for (const path of listMigrationFiles(root)) {
        sources.set(relative(root, path), readFile(path, 'utf8'))
      }
    } else if (pattern.endsWith('/*.prisma')) {
      const schemaRoot = dirname(join(root, pattern))
      for (const name of readdirSync(schemaRoot)
        .filter((file) => file.endsWith('.prisma'))
        .sort()) {
        const path = join(schemaRoot, name)
        sources.set(relative(root, path), readFile(path, 'utf8'))
      }
    } else {
      sources.set(pattern, readFile(join(root, pattern), 'utf8'))
    }
  }
  return sources
}

export function computeSeedSnapshotKey({
  sources,
  postgresMajor,
  timezone,
  year,
} = {}) {
  const hash = createHash('sha256')
  for (const [path, contents] of [...sources.entries()].sort(([a], [b]) =>
    a < b ? -1 : 1
  )) {
    hash.update(path)
    hash.update(KEY_SEPARATOR)
    hash.update(contents)
    hash.update(KEY_SEPARATOR)
  }
  hash.update('postgres-major=' + postgresMajor + KEY_SEPARATOR)
  hash.update('timezone=' + timezone + KEY_SEPARATOR)
  hash.update('year=' + year + KEY_SEPARATOR)
  return hash.digest('hex')
}

function validateDisposableUrl(connectionString) {
  try {
    const url = new URL(connectionString)
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hash ||
      decodeURIComponent(url.username) !== DISPOSABLE_DATABASE ||
      !url.password ||
      decodeURIComponent(url.pathname) !== '/' + DISPOSABLE_DATABASE
    ) {
      return false
    }
    const seen = new Set()
    for (const [key, value] of url.searchParams) {
      if (seen.has(key)) return false
      seen.add(key)
      if (key === 'schema' && value === 'public') continue
      if (
        key === 'sslmode' &&
        ['disable', 'require', 'verify-ca', 'verify-full'].includes(value)
      ) {
        continue
      }
      return false
    }
    return true
  } catch {
    return false
  }
}

export function snapshotEnvironmentState(env = process.env) {
  if (env.CI || env.GITHUB_ACTIONS) {
    return 'refused: CI environments never capture or restore seed snapshots'
  }
  if (env.KLICKER_PLAYWRIGHT_PRESERVE_DATABASE === '1') {
    return 'refused: database preservation never captures or restores snapshots'
  }
  if (env.KLICKER_PLAYWRIGHT_HOST_RUNNER !== '1') {
    return 'refused: snapshots require the local Playwright host launcher'
  }
  if (Object.keys(env).some((key) => key.startsWith('PG'))) {
    return 'refused: PostgreSQL environment overrides are forbidden'
  }
  if (!validateDisposableUrl(env.DATABASE_URL)) {
    return 'refused: DATABASE_URL must target the disposable klicker_test database'
  }
  if (!env.KLICKER_PLAYWRIGHT_POSTGRES_CONTAINER) {
    return 'refused: the host launcher did not provide the postgres container id'
  }
  return null
}

function defaultRunDocker(args, { input } = {}) {
  const result = spawnSync('docker', args, {
    input,
    encoding: 'utf8',
    cwd: repoRoot,
  })
  if (result.error) {
    fail('docker could not start: ' + result.error.message)
  }
  return result
}

function psqlQuery(runDocker, container, sql) {
  const result = runDocker([
    'exec',
    container,
    'psql',
    '-U',
    DISPOSABLE_DATABASE,
    '-d',
    DISPOSABLE_DATABASE,
    '-v',
    'ON_ERROR_STOP=1',
    '-t',
    '-A',
    '-c',
    sql,
  ])
  if (result.status !== 0) {
    fail('identity query failed: ' + String(result.stderr).trim())
  }
  return result.stdout.trim()
}

function pgDump(runDocker, container, schemaOnly) {
  const result = runDocker([
    'exec',
    container,
    'pg_dump',
    '-U',
    DISPOSABLE_DATABASE,
    '-d',
    DISPOSABLE_DATABASE,
    '--schema=public',
    '--no-owner',
    '--no-privileges',
    ...(schemaOnly ? ['--schema-only'] : []),
  ])
  if (result.status !== 0) {
    fail('pg_dump failed: ' + String(result.stderr).trim())
  }
  return result.stdout
}

function normalizeSchemaDump(dump) {
  return dump
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() !== '' &&
        !line.startsWith('--') &&
        // pg_dump emits \restrict/\unrestrict with a random per-invocation
        // token; the schema content is unchanged between runs.
        !line.startsWith('\\restrict ') &&
        !line.startsWith('\\unrestrict ')
    )
    .join('\n')
}

function schemaFingerprint(schemaOnlyDump) {
  return sha256(normalizeSchemaDump(schemaOnlyDump))
}

const RESTORE_GUARD_SQL = [
  'DO $seed_snapshot_guard$',
  'BEGIN',
  "  IF current_database() <> '" + DISPOSABLE_DATABASE + "' THEN",
  '    RAISE EXCEPTION ' + "'seed snapshot restore requires klicker_test';",
  '  END IF;',
  "  IF session_user <> '" +
    DISPOSABLE_DATABASE +
    "' OR current_user <> '" +
    DISPOSABLE_DATABASE +
    "' THEN",
  '    RAISE EXCEPTION ' +
    "'seed snapshot restore requires the non-privileged test role';",
  '  END IF;',
  '  IF shobj_description(',
  '       (SELECT oid FROM pg_database WHERE datname = current_database()),',
  "       'pg_database'",
  "     ) <> '" + DISPOSABLE_MARKER + "' THEN",
  '    RAISE EXCEPTION ' +
    "'seed snapshot restore requires the marked disposable database';",
  '  END IF;',
  '  IF EXISTS (',
  '    SELECT 1 FROM pg_roles',
  '    WHERE rolname = session_user',
  '      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)',
  '  ) THEN',
  '    RAISE EXCEPTION ' + "'seed snapshot restore refuses privileged roles';",
  '  END IF;',
  'END',
  '$seed_snapshot_guard$;',
].join('\n')

function stripSnapshotMetaLines(snapshotDump) {
  const kept = []
  let inCopyPayload = false
  for (const line of snapshotDump.split(/\r?\n/)) {
    if (inCopyPayload) {
      // COPY payload rows are data; a row value can legitimately start with
      // "SET " or a backslash, so only the exact terminator ends the block.
      kept.push(line)
      if (line === '\\.') inCopyPayload = false
      continue
    }
    if (line.startsWith('COPY ') && line.endsWith('FROM stdin;')) {
      inCopyPayload = true
    }
    if (
      !line.startsWith('SET ') &&
      !line.startsWith('CREATE SCHEMA public;') &&
      !line.startsWith('COMMENT ON SCHEMA public') &&
      !line.startsWith('\\restrict ') &&
      !line.startsWith('\\unrestrict ')
    ) {
      kept.push(line)
    }
  }
  return kept.join('\n')
}

export function composeRestoreSql(snapshotDump) {
  const body = stripSnapshotMetaLines(snapshotDump)

  return [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    "SET LOCAL lock_timeout = '10s';",
    RESTORE_GUARD_SQL,
    'SELECT pg_terminate_backend(pid)',
    'FROM pg_stat_activity',
    // Terminating another role's backend would need privileged rights and
    // abort the whole transaction, so only same-role sessions are targeted.
    'WHERE datname = current_database()',
    '  AND usename = session_user',
    '  AND pid <> pg_backend_pid();',
    'DROP SCHEMA public CASCADE;',
    'CREATE SCHEMA public;',
    body,
    'COMMIT;',
    '',
  ].join('\n')
}

function readCacheManifest(
  cacheRoot,
  readFile = readFileSync,
  pathExists = existsSync
) {
  const manifestPath = join(cacheRoot, 'key.json')
  if (!pathExists(manifestPath)) return null
  try {
    const manifest = JSON.parse(readFile(manifestPath, 'utf8'))
    if (
      typeof manifest?.key === 'string' &&
      typeof manifest?.schemaFingerprint === 'string' &&
      typeof manifest?.snapshotSha256 === 'string' &&
      Number.isInteger(manifest?.postgresMajor)
    ) {
      return manifest
    }
  } catch {
    // Corrupt manifests are cache misses, never errors.
  }
  return null
}

function postgresMajorFrom(runDocker, container) {
  const value = psqlQuery(runDocker, container, 'SHOW server_version_num')
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 100000) {
    fail('unexpected server_version_num response')
  }
  return Math.floor(numeric / 10000)
}

function resolveContext({
  env = process.env,
  runDocker = defaultRunDocker,
  cacheRoot = cacheRootDefault,
  root = repoRoot,
  readFile = readFileSync,
  pathExists = existsSync,
} = {}) {
  const refusal = snapshotEnvironmentState(env)
  if (refusal) return { refusal }

  return {
    container: env.KLICKER_PLAYWRIGHT_POSTGRES_CONTAINER,
    runDocker,
    cacheRoot,
    sources: collectKeySources({ root, readFile }),
    timezone: env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    // The seed derives course dates from the local year, so the key must use
    // the same clock to stay valid across local/UTC year rollover.
    year: new Date().getFullYear(),
    readFile,
    pathExists,
  }
}

export function captureSeedSnapshot(options = {}) {
  const startedAt = Date.now()
  const context = resolveContext(options)
  if (context.refusal) {
    return { status: 'skipped', message: context.refusal }
  }

  try {
    const postgresMajor = postgresMajorFrom(
      context.runDocker,
      context.container
    )
    const fingerprint = schemaFingerprint(
      pgDump(context.runDocker, context.container, true)
    )
    const key = computeSeedSnapshotKey({
      sources: context.sources,
      postgresMajor,
      timezone: context.timezone,
      year: context.year,
    })
    const snapshot = pgDump(context.runDocker, context.container, false)

    mkdirSync(context.cacheRoot, { recursive: true })
    const snapshotTmp = join(context.cacheRoot, 'snapshot.sql.tmp')
    const snapshotFinal = join(context.cacheRoot, 'snapshot.sql')
    const manifestTmp = join(context.cacheRoot, 'key.json.tmp')
    const manifestFinal = join(context.cacheRoot, 'key.json')

    writeFileSync(snapshotTmp, snapshot)
    renameSync(snapshotTmp, snapshotFinal)
    const manifest = {
      key,
      schemaFingerprint: fingerprint,
      snapshotSha256: sha256(snapshot),
      postgresMajor,
      capturedAt: new Date().toISOString(),
    }
    writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2) + '\n')
    renameSync(manifestTmp, manifestFinal)

    return {
      status: 'captured',
      message: 'captured seed snapshot for PostgreSQL ' + postgresMajor,
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    }
  }
}

export function restoreSeedSnapshot(options = {}) {
  const startedAt = Date.now()
  const context = resolveContext(options)
  if (context.refusal) {
    return { status: 'miss', message: context.refusal }
  }

  const miss = (message) => ({
    status: 'miss',
    message,
    elapsedMs: Date.now() - startedAt,
  })

  try {
    const postgresMajor = postgresMajorFrom(
      context.runDocker,
      context.container
    )
    const liveFingerprint = schemaFingerprint(
      pgDump(context.runDocker, context.container, true)
    )
    const manifest = readCacheManifest(
      context.cacheRoot,
      context.readFile,
      context.pathExists
    )
    if (!manifest) return miss('no valid snapshot manifest; seeding normally')

    const key = computeSeedSnapshotKey({
      sources: context.sources,
      postgresMajor,
      timezone: context.timezone,
      year: context.year,
    })
    if (manifest.key !== key) {
      return miss('snapshot key mismatch; seeding normally')
    }
    if (manifest.postgresMajor !== postgresMajor) {
      return miss('PostgreSQL major version changed; seeding normally')
    }
    if (manifest.schemaFingerprint !== liveFingerprint) {
      return miss('live schema fingerprint drifted; seeding normally')
    }

    const snapshotPath = join(context.cacheRoot, 'snapshot.sql')
    if (!context.pathExists(snapshotPath)) {
      return miss('snapshot payload missing; seeding normally')
    }
    const snapshot = context.readFile(snapshotPath, 'utf8')
    if (sha256(snapshot) !== manifest.snapshotSha256) {
      return miss('snapshot payload corrupt; seeding normally')
    }

    const result = context.runDocker(
      [
        'exec',
        '-i',
        context.container,
        'psql',
        '-U',
        DISPOSABLE_DATABASE,
        '-d',
        DISPOSABLE_DATABASE,
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
      ],
      { input: composeRestoreSql(snapshot) }
    )
    if (result.status !== 0) {
      fail(
        'restore failed and left the previous state intact: ' +
          String(result.stderr).trim()
      )
    }

    return {
      status: 'restored',
      message: 'restored the synthetic seed snapshot in one transaction',
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    }
  }
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command === 'capture' || command === 'restore') {
    const result =
      command === 'capture' ? captureSeedSnapshot() : restoreSeedSnapshot()
    console.log('[seed-snapshot] ' + result.status + ': ' + result.message)
    process.exitCode =
      result.status === 'error'
        ? 1
        : command === 'restore' && result.status === 'restored'
          ? 0
          : SNAPSHOT_MISS_EXIT
    return
  }
  console.error('usage: node util/playwright-seed-snapshot.mjs capture|restore')
  process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
