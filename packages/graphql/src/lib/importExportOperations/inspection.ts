// Release-readiness evaluation is kept pure for deterministic verification.
import {
  IMPORT_EXPORT_MIGRATIONS,
  REQUIRED_IMPORT_EXPORT_CONSTRAINTS,
  REQUIRED_IMPORT_EXPORT_INDEXES,
  inspectImportExportDatabase,
  type ImportExportDatabaseInspection,
  type OperationsPrisma,
} from './database.js'
import {
  createOperationOutput,
  parseDatabaseTarget,
  requireMasterGateOff,
} from './runtime.js'

export function evaluateImportExportInspection(
  inspection: ImportExportDatabaseInspection
) {
  const successfulMigrations = inspection.migrations.filter(
    (migration) => migration.finished_at && !migration.rolled_back_at
  )
  const successfulMigrationNames = new Set(
    successfulMigrations.map((migration) => migration.migration_name)
  )
  const migrationAttemptsByName = new Map<string, number>()
  for (const migration of successfulMigrations) {
    migrationAttemptsByName.set(
      migration.migration_name,
      (migrationAttemptsByName.get(migration.migration_name) ?? 0) + 1
    )
  }

  const readyIndexes = new Set(
    inspection.indexes
      .filter((index) => index.is_ready && index.is_valid)
      .map((index) => index.index_name)
  )
  const validatedConstraints = new Set(
    inspection.constraints
      .filter((constraint) => constraint.is_validated)
      .map((constraint) => constraint.constraint_name)
  )

  return {
    migrationsPresent: IMPORT_EXPORT_MIGRATIONS.every((migration) =>
      successfulMigrationNames.has(migration)
    ),
    migrationChecksumsMatch: successfulMigrations.every(
      (migration) => migration.checksum_matches
    ),
    migrationHistoryUnambiguous: IMPORT_EXPORT_MIGRATIONS.every(
      (migration) => migrationAttemptsByName.get(migration) === 1
    ),
    indexesReady: REQUIRED_IMPORT_EXPORT_INDEXES.every((index) =>
      readyIndexes.has(index)
    ),
    constraintsValidated: REQUIRED_IMPORT_EXPORT_CONSTRAINTS.every(
      (constraint) => validatedConstraints.has(constraint)
    ),
    staleVersionsClear:
      inspection.staleVersions.elements === 0 &&
      inspection.staleVersions.answerCollections === 0 &&
      inspection.staleVersions.mediaFiles === 0,
    noWaitingLocks: inspection.locks.every((lock) => lock.granted),
  }
}

export async function createImportExportInspectionOutput({
  prisma,
  env = process.env,
  verify = false,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
  verify?: boolean
}) {
  requireMasterGateOff(env)
  const inspection = await inspectImportExportDatabase(prisma)
  const checks = evaluateImportExportInspection(inspection)
  const ready = Object.values(checks).every(Boolean)

  return createOperationOutput(
    verify ? 'import-export-backfill-verify' : 'import-export-inspect',
    {
      outcome: verify && !ready ? 'incomplete' : 'success',
      code: verify && !ready ? 'TARGET_NOT_READY' : 'INSPECTION_COMPLETE',
      checks: {
        ...checks,
        masterGateOff:
          typeof env.IMPORT_EXPORT_ENABLED === 'undefined' ||
          env.IMPORT_EXPORT_ENABLED === 'false',
        assessmentResponsibilityOff:
          parseDatabaseTarget(env) !== 'assessment' ||
          typeof env.IMPORT_EXPORT_ENABLED === 'undefined' ||
          env.IMPORT_EXPORT_ENABLED === 'false',
      },
      counts: {
        migrationRows: inspection.migrations.length,
        missingMigrations: inspection.missingMigrations.length,
        tables: inspection.tableSizes.length,
        columns: inspection.columns.length,
        indexes: inspection.indexes.length,
        constraints: inspection.constraints.length,
        locks: inspection.locks.length,
        staleElements: inspection.staleVersions.elements ?? -1,
        staleAnswerCollections:
          inspection.staleVersions.answerCollections ?? -1,
        staleMediaFiles: inspection.staleVersions.mediaFiles ?? -1,
      },
      details: {
        migrations: inspection.migrations,
        missingMigrations: inspection.missingMigrations,
        tableSizes: inspection.tableSizes,
        columns: inspection.columns,
        indexes: inspection.indexes,
        constraints: inspection.constraints,
        locks: inspection.locks,
      },
    },
    env
  )
}
