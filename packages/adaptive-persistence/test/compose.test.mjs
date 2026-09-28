import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { composeAdaptivePrismaSchema } from '../src/compose.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'adaptive-compose-'))
  const hostSchemaDir = join(root, 'src/prisma/schema')
  const hostMigrationsDir = join(hostSchemaDir, 'migrations')
  const adaptiveSchemaDir = join(root, 'adaptive/schema')
  const adaptiveMigrationsDir = join(adaptiveSchemaDir, 'migrations')
  mkdirSync(hostMigrationsDir, { recursive: true })
  mkdirSync(adaptiveMigrationsDir, { recursive: true })
  writeFileSync(
    join(hostSchemaDir, 'js.prisma'),
    'generator client { output = "../client" }\n'
  )
  writeFileSync(
    join(hostSchemaDir, 'course.prisma'),
    'model Course { id String @id }\n'
  )
  writeFileSync(
    join(adaptiveSchemaDir, 'adaptive.prisma'),
    'model Adaptive { id String @id }\n'
  )
  writeFileSync(
    join(adaptiveSchemaDir, 'competence.prisma'),
    'model Competence { id String @id }\n'
  )
  migration(hostMigrationsDir, '20260101000000_host', '-- host\n')
  writeFileSync(
    join(hostMigrationsDir, 'migration_lock.toml'),
    'provider = "postgresql"\n'
  )
  migration(adaptiveMigrationsDir, '20260202000000_adaptive', '-- adaptive\n')
  return {
    root,
    hostSchemaDir,
    hostMigrationsDir,
    adaptiveSchemaDir,
    adaptiveMigrationsDir,
  }
}

function migration(directory, name, contents) {
  mkdirSync(join(directory, name), { recursive: true })
  writeFileSync(join(directory, name, 'migration.sql'), contents)
}

function compose(paths) {
  return composeAdaptivePrismaSchema({
    schemaDirectory: paths.hostSchemaDir,
    migrationsDirectory: paths.hostMigrationsDir,
    adaptiveSchemaDir: paths.adaptiveSchemaDir,
    adaptiveMigrationsDir: paths.adaptiveMigrationsDir,
  })
}

test('composes schema fragments and migration bytes without changing generator-relative output', () => {
  const paths = fixture()
  try {
    const output = compose(paths)
    assert.equal(typeof output.then, 'undefined')
    assert.equal(output.schema, join(paths.root, 'src/prisma/.adaptive-schema'))
    assert.equal(output.migrations, join(output.schema, 'migrations'))
    assert.deepEqual(
      [
        'adaptive.prisma',
        'competence.prisma',
        'course.prisma',
        'js.prisma',
      ].map((file) => readFileSync(join(output.schema, file), 'utf8')),
      [
        'model Adaptive { id String @id }\n',
        'model Competence { id String @id }\n',
        'model Course { id String @id }\n',
        'generator client { output = "../client" }\n',
      ]
    )
    assert.equal(
      readFileSync(
        join(output.migrations, '20260202000000_adaptive/migration.sql'),
        'utf8'
      ),
      '-- adaptive\n'
    )
    assert.equal(
      readFileSync(join(output.migrations, 'migration_lock.toml'), 'utf8'),
      'provider = "postgresql"\n'
    )
    assert.equal(
      resolve(output.schema, '../client'),
      join(paths.root, 'src/prisma/client')
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('rejects schema and migration filename collisions before updating output', () => {
  const paths = fixture()
  try {
    writeFileSync(
      join(paths.hostSchemaDir, 'adaptive.prisma'),
      'model HostAdaptive { id String @id }\n'
    )
    assert.throws(
      () => compose(paths),
      /schema fragment collision: adaptive\.prisma/
    )
    rmSync(join(paths.hostSchemaDir, 'adaptive.prisma'))
    migration(
      paths.hostMigrationsDir,
      '20260202000000_adaptive',
      '-- host duplicate\n'
    )
    assert.throws(
      () => compose(paths),
      /migration collision: 20260202000000_adaptive/
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('refuses unowned output and preserves unknown generated migrations', () => {
  const paths = fixture()
  try {
    const unownedOutput = join(paths.root, 'src/prisma/.adaptive-schema')
    mkdirSync(unownedOutput, { recursive: true })
    assert.throws(() => compose(paths), /unowned composed schema output/)
    rmSync(unownedOutput, { recursive: true, force: true })

    const output = compose(paths)
    migration(
      output.migrations,
      '20269999999999_local_authored',
      '-- do not remove\n'
    )
    assert.throws(
      () => compose(paths),
      /unknown generated migration directories: 20269999999999_local_authored/
    )
    assert.equal(
      readFileSync(
        join(output.migrations, '20269999999999_local_authored/migration.sql'),
        'utf8'
      ),
      '-- do not remove\n'
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('is deterministic across repeated composition', () => {
  const paths = fixture()
  try {
    const first = compose(paths)
    const firstSchema = readFileSync(
      join(first.schema, 'adaptive.prisma'),
      'utf8'
    )
    const firstMigration = readFileSync(
      join(first.migrations, '20260202000000_adaptive/migration.sql'),
      'utf8'
    )
    const firstModifiedAt = statSync(first.schema).mtimeMs
    const second = compose(paths)
    assert.deepEqual(second, first)
    assert.equal(
      readFileSync(join(second.schema, 'adaptive.prisma'), 'utf8'),
      firstSchema
    )
    assert.equal(
      readFileSync(
        join(second.migrations, '20260202000000_adaptive/migration.sql'),
        'utf8'
      ),
      firstMigration
    )
    assert.equal(statSync(second.schema).mtimeMs, firstModifiedAt)
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('does not delete a preexisting fixed temporary directory', () => {
  const paths = fixture()
  try {
    const fixedTemporaryDirectory = join(
      paths.root,
      'src/prisma/.adaptive-schema.tmp'
    )
    mkdirSync(fixedTemporaryDirectory)
    writeFileSync(join(fixedTemporaryDirectory, 'keep.txt'), 'keep\n')
    compose(paths)
    assert.equal(existsSync(join(fixedTemporaryDirectory, 'keep.txt')), true)
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('fails fast while another composer owns the output lock', () => {
  const paths = fixture()
  try {
    mkdirSync(join(paths.root, 'src/prisma/.adaptive-schema.lock'))
    assert.throws(
      () => compose(paths),
      /Another adaptive schema composition owns/
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('supports schema-only composition for analytics generation', () => {
  const paths = fixture()
  try {
    const output = composeAdaptivePrismaSchema({
      schemaDirectory: paths.hostSchemaDir,
      adaptiveSchemaDir: paths.adaptiveSchemaDir,
    })
    assert.equal(output.migrations, undefined)
    assert.equal(existsSync(join(output.schema, 'migrations')), false)
    assert.equal(
      readFileSync(join(output.schema, 'adaptive.prisma'), 'utf8'),
      'model Adaptive { id String @id }\n'
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})

test('accepts only a sibling explicit output directory', () => {
  const paths = fixture()
  try {
    const outputDirectory = join(paths.root, 'src/prisma/.generated-adaptive')
    const output = composeAdaptivePrismaSchema({
      schemaDirectory: paths.hostSchemaDir,
      migrationsDirectory: paths.hostMigrationsDir,
      outputDirectory,
      adaptiveSchemaDir: paths.adaptiveSchemaDir,
      adaptiveMigrationsDir: paths.adaptiveMigrationsDir,
    })
    assert.equal(output.schema, outputDirectory)
    assert.throws(
      () =>
        composeAdaptivePrismaSchema({
          schemaDirectory: paths.hostSchemaDir,
          migrationsDirectory: paths.hostMigrationsDir,
          outputDirectory: join(paths.root, '.adaptive-schema'),
          adaptiveSchemaDir: paths.adaptiveSchemaDir,
          adaptiveMigrationsDir: paths.adaptiveMigrationsDir,
        }),
      /outputDirectory must be a sibling/
    )
  } finally {
    rmSync(paths.root, { recursive: true, force: true })
  }
})
