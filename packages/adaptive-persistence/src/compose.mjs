import {
  closeSync,
  constants,
  cpSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectoryName = '.adaptive-schema'
const markerName = '.adaptive-persistence-marker.json'
const marker = {
  format: 1,
  owner: '@klicker-uzh/adaptive-persistence',
}

/**
 * Composes the host Prisma schema with the adaptive-learning persistence
 * fragments. This is a build-time filesystem operation only; it never reads a
 * datasource, invokes Prisma, or accesses a database.
 */
export function composeAdaptivePrismaSchema({
  schemaDirectory,
  migrationsDirectory,
  outputDirectory,
  adaptiveSchemaDir = join(packageRoot, 'src/prisma/schema'),
  adaptiveMigrationsDir = join(packageRoot, 'src/prisma/schema/migrations'),
} = {}) {
  const schemaDir = requiredDirectory(schemaDirectory, 'schemaDirectory')
  const migrationsDir = migrationsDirectory
    ? requiredDirectory(migrationsDirectory, 'migrationsDirectory')
    : undefined
  const sourceSchemaDir = requiredDirectory(
    adaptiveSchemaDir,
    'adaptiveSchemaDir'
  )
  const sourceMigrationsDir = migrationsDir
    ? requiredDirectory(adaptiveMigrationsDir, 'adaptiveMigrationsDir')
    : undefined
  const outputDir = outputDirectory
    ? resolve(outputDirectory)
    : join(dirname(schemaDir), outputDirectoryName)

  if (dirname(outputDir) !== dirname(schemaDir)) {
    throw new Error(
      `outputDirectory must be a sibling of schemaDirectory: ${schemaDir}`
    )
  }

  const hostSchemaFiles = prismaFiles(schemaDir)
  const adaptiveSchemaFiles = prismaFiles(sourceSchemaDir)
  assertNoCollisions(hostSchemaFiles, adaptiveSchemaFiles, 'schema fragment')

  const hostMigrationNames = migrationsDir ? migrationNames(migrationsDir) : []
  const adaptiveMigrationNames = sourceMigrationsDir
    ? migrationNames(sourceMigrationsDir)
    : []
  assertNoCollisions(hostMigrationNames, adaptiveMigrationNames, 'migration')
  const hostMigrationFiles = migrationsDir ? migrationFiles(migrationsDir) : []
  const adaptiveMigrationFiles = sourceMigrationsDir
    ? migrationFiles(sourceMigrationsDir)
    : []
  assertNoCollisions(
    hostMigrationFiles,
    adaptiveMigrationFiles,
    'migration metadata file'
  )

  const expectedRootEntries = new Set([
    markerName,
    ...hostSchemaFiles,
    ...adaptiveSchemaFiles,
    ...(migrationsDir ? ['migrations'] : []),
  ])
  const expectedMigrationEntries = new Set([
    ...hostMigrationNames,
    ...adaptiveMigrationNames,
    ...hostMigrationFiles,
    ...adaptiveMigrationFiles,
  ])
  assertOwnedOutput(outputDir, expectedRootEntries, expectedMigrationEntries)

  const lockDirectory = `${outputDir}.lock`
  try {
    mkdirSync(lockDirectory)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      throw new Error(
        `Another adaptive schema composition owns ${lockDirectory}. Wait for it to finish, or remove a stale lock after confirming no composer is running.`
      )
    }
    throw error
  }

  const temporaryOutputDir = mkdtempSync(
    join(dirname(outputDir), `.${basename(outputDir)}-`)
  )
  try {
    if (migrationsDir) {
      mkdirSync(join(temporaryOutputDir, 'migrations'))
    }
    copyFiles(schemaDir, hostSchemaFiles, temporaryOutputDir)
    copyFiles(sourceSchemaDir, adaptiveSchemaFiles, temporaryOutputDir)
    if (migrationsDir && sourceMigrationsDir) {
      copyMigrations(migrationsDir, hostMigrationNames, temporaryOutputDir)
      copyMigrations(
        sourceMigrationsDir,
        adaptiveMigrationNames,
        temporaryOutputDir
      )
      copyFiles(
        migrationsDir,
        hostMigrationFiles,
        join(temporaryOutputDir, 'migrations')
      )
      copyFiles(
        sourceMigrationsDir,
        adaptiveMigrationFiles,
        join(temporaryOutputDir, 'migrations')
      )
    }
    writeFileSync(
      join(temporaryOutputDir, markerName),
      `${JSON.stringify(marker, null, 2)}\n`,
      'utf8'
    )

    if (!existsSync(outputDir)) {
      renameSync(temporaryOutputDir, outputDir)
    } else if (!directoriesMatch(outputDir, temporaryOutputDir)) {
      rmSync(outputDir, { recursive: true, force: true })
      renameSync(temporaryOutputDir, outputDir)
    }
  } finally {
    rmSync(temporaryOutputDir, { recursive: true, force: true })
    rmSync(lockDirectory, { recursive: true, force: true })
  }

  return {
    schema: outputDir,
    migrations: migrationsDir ? join(outputDir, 'migrations') : undefined,
  }
}

function requiredDirectory(path, name) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error(`${name} is required`)
  }
  const resolvedPath = resolve(path)
  if (!existsSync(resolvedPath)) {
    throw new Error(`${name} does not exist: ${resolvedPath}`)
  }
  return resolvedPath
}

function prismaFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.prisma'))
    .map((entry) => entry.name)
    .sort()
}

function migrationNames(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function migrationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
}

function assertNoCollisions(hostNames, adaptiveNames, kind) {
  const collisions = hostNames.filter((name) => adaptiveNames.includes(name))
  if (collisions.length > 0) {
    throw new Error(
      `Adaptive ${kind} collision: ${collisions.join(', ')}. Rename or promote the host source first.`
    )
  }
}

function assertOwnedOutput(
  outputDir,
  expectedRootEntries,
  expectedMigrationEntries
) {
  if (!existsSync(outputDir)) {
    return
  }

  const markerPath = join(outputDir, markerName)
  if (!existsSync(markerPath)) {
    throw new Error(
      `Refusing to update unowned composed schema output: ${outputDir}. Remove it manually or restore the adaptive-persistence marker.`
    )
  }
  if (
    readFileSync(markerPath, 'utf8') !== `${JSON.stringify(marker, null, 2)}\n`
  ) {
    throw new Error(
      `Refusing to update output with an invalid ownership marker: ${outputDir}`
    )
  }

  const unexpectedRootEntries = readdirSync(outputDir).filter(
    (entry) => !expectedRootEntries.has(entry)
  )
  if (unexpectedRootEntries.length > 0) {
    throw new Error(
      `Refusing to remove unknown composed schema files: ${unexpectedRootEntries.join(', ')}. Promote them into the host schema source first.`
    )
  }

  if (expectedMigrationEntries.size === 0) {
    return
  }
  const outputMigrationsDir = join(outputDir, 'migrations')
  if (!existsSync(outputMigrationsDir)) {
    throw new Error(
      `Refusing to update output without migrations directory: ${outputDir}`
    )
  }
  const unknownMigrations = readdirSync(outputMigrationsDir).filter(
    (name) => !expectedMigrationEntries.has(name)
  )
  if (unknownMigrations.length > 0) {
    throw new Error(
      `Refusing to remove unknown generated migration directories: ${unknownMigrations.join(', ')}. Promote each migration into the host source migrations directory first.`
    )
  }
}

function directoriesMatch(left, right) {
  const entries = (directory) =>
    readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  const leftEntries = entries(left)
  const rightEntries = entries(right)
  if (leftEntries.length !== rightEntries.length) return false
  for (let index = 0; index < leftEntries.length; index += 1) {
    const leftEntry = leftEntries[index]
    const rightEntry = rightEntries[index]
    if (leftEntry.name !== rightEntry.name) return false
    const leftPath = join(left, leftEntry.name)
    const rightPath = join(right, rightEntry.name)
    if (leftEntry.isDirectory() && rightEntry.isDirectory()) {
      if (!directoriesMatch(leftPath, rightPath)) return false
    } else if (leftEntry.isFile() && rightEntry.isFile()) {
      if (!readRegularFile(leftPath).equals(readRegularFile(rightPath)))
        return false
    } else {
      return false
    }
  }
  return true
}

function readRegularFile(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    if (!fstatSync(fd).isFile()) throw new Error(`Not a regular file: ${path}`)
    return readFileSync(fd)
  } finally {
    closeSync(fd)
  }
}

function copyFiles(sourceDir, files, destinationDir) {
  for (const file of files) {
    cpSync(join(sourceDir, file), join(destinationDir, file))
  }
}

function copyMigrations(sourceDir, names, outputDir) {
  for (const name of names) {
    cpSync(join(sourceDir, name), join(outputDir, 'migrations', name), {
      recursive: true,
      force: false,
      errorOnExist: true,
    })
  }
}

export const adaptiveSchemaOutputDirectoryName = outputDirectoryName
