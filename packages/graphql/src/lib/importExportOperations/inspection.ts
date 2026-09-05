// Release-readiness evaluation is kept pure for deterministic verification.
import type { OperationsPrisma } from './database.js'
import {
  inspectImportExportDatabase,
  inspectImportExportFingerprintInvariant,
  type ImportExportDatabaseInspection,
  type ImportExportFingerprintInvariantInspection,
} from './databaseCatalog.js'
import {
  IMPORT_EXPORT_CHECK_CONSTRAINT_CONTRACT_PREFIX,
  IMPORT_EXPORT_MIGRATIONS,
  REQUIRED_IMPORT_EXPORT_COLUMNS,
  REQUIRED_IMPORT_EXPORT_CONSTRAINTS,
  REQUIRED_IMPORT_EXPORT_INDEXES,
  REQUIRED_IMPORT_EXPORT_TRIGGERS,
} from './databaseContract.js'
import { createOperationOutput, requireMasterGateOff } from './runtime.js'

function hasSameOrderedValues(
  actual: readonly string[],
  expected: readonly string[]
) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function hasSameValues(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  )
}

export function evaluateImportExportInspection(
  inspection: ImportExportDatabaseInspection
) {
  const activeMigrations = inspection.migrations.filter(
    (migration) => !migration.rolled_back_at
  )
  const successfulMigrations = activeMigrations.filter(
    (migration) => migration.finished_at
  )
  const successfulMigrationNames = new Set(
    successfulMigrations.map((migration) => migration.migration_name)
  )
  const activeMigrationAttemptsByName = new Map<string, number>()
  for (const migration of activeMigrations) {
    activeMigrationAttemptsByName.set(
      migration.migration_name,
      (activeMigrationAttemptsByName.get(migration.migration_name) ?? 0) + 1
    )
  }

  const columnsReady = REQUIRED_IMPORT_EXPORT_COLUMNS.every(
    ([tableName, columnName, dataType]) =>
      inspection.columns.some(
        (column) =>
          column.table_name === tableName &&
          column.column_name === columnName &&
          column.data_type === dataType &&
          column.is_nullable === 'YES' &&
          column.column_default === null &&
          column.is_identity === 'NO' &&
          column.is_generated === 'NEVER'
      )
  )
  const indexesReady = REQUIRED_IMPORT_EXPORT_INDEXES.every(
    ([tableName, indexName, isUnique, keyColumns, predicate]) =>
      inspection.indexes.some(
        (index) =>
          index.table_name === tableName &&
          index.index_name === indexName &&
          index.is_ready &&
          index.is_valid &&
          index.is_unique === isUnique &&
          index.access_method === 'btree' &&
          index.has_predicate === (typeof predicate === 'string') &&
          index.predicate === (predicate ?? null) &&
          !index.has_expressions &&
          !index.has_included_columns &&
          hasSameOrderedValues(index.key_columns, keyColumns)
      )
  )
  const constraintsValidated = REQUIRED_IMPORT_EXPORT_CONSTRAINTS.every(
    (expected) =>
      inspection.constraints.some((constraint) => {
        if (
          constraint.table_name !== expected.tableName ||
          constraint.constraint_name !== expected.constraintName ||
          constraint.constraint_type !== expected.constraintType ||
          !constraint.is_validated
        ) {
          return false
        }
        if (
          'definition' in expected &&
          constraint.definition !== expected.definition
        ) {
          return false
        }
        if (expected.constraintType === 'c') {
          return (
            hasSameValues(constraint.key_columns, expected.keyColumns) &&
            constraint.contract_comment ===
              `${IMPORT_EXPORT_CHECK_CONSTRAINT_CONTRACT_PREFIX}${constraint.definition}`
          )
        }
        if (expected.constraintType === 'f') {
          return (
            hasSameOrderedValues(constraint.key_columns, expected.keyColumns) &&
            constraint.referenced_schema === 'public' &&
            constraint.referenced_table === expected.referencedTable &&
            hasSameOrderedValues(
              constraint.referenced_columns,
              expected.referencedColumns
            ) &&
            constraint.update_action === expected.updateAction &&
            constraint.delete_action === expected.deleteAction
          )
        }
        return true
      })
  )
  const triggersReady = REQUIRED_IMPORT_EXPORT_TRIGGERS.every(
    ([tableName, triggerName, functionName, triggerType, updateColumns]) =>
      inspection.triggers.some(
        (trigger) =>
          trigger.table_name === tableName &&
          trigger.trigger_name === triggerName &&
          trigger.enabled === 'O' &&
          hasSameOrderedValues(trigger.update_columns, updateColumns) &&
          !trigger.has_when_clause &&
          !trigger.has_arguments &&
          !trigger.is_constraint &&
          !trigger.is_deferrable &&
          !trigger.is_initially_deferred &&
          trigger.function_schema === 'public' &&
          trigger.function_name === functionName &&
          trigger.function_language === 'plpgsql' &&
          !trigger.function_security_definer &&
          trigger.function_source_matches &&
          trigger.trigger_type === triggerType
      )
  )

  return {
    migrationsPresent: IMPORT_EXPORT_MIGRATIONS.every((migration) =>
      successfulMigrationNames.has(migration)
    ),
    migrationChecksumsMatch: inspection.migrations.every(
      (migration) => migration.checksum_matches
    ),
    migrationHistoryUnambiguous: IMPORT_EXPORT_MIGRATIONS.every(
      (migration) =>
        activeMigrationAttemptsByName.get(migration) === 1 &&
        successfulMigrationNames.has(migration)
    ),
    migrationStepsComplete: successfulMigrations.every(
      (migration) =>
        migration.applied_steps_count === 1 ||
        (migration.migration_name === IMPORT_EXPORT_MIGRATIONS[0] &&
          migration.applied_steps_count === 0)
    ),
    columnsReady,
    indexesReady,
    constraintsValidated,
    triggersReady,
    staleVersionsClear:
      inspection.staleVersions.elements === 0 &&
      inspection.staleVersions.answerCollections === 0 &&
      inspection.staleVersions.mediaFiles === 0,
    noWaitingLocks: inspection.locks.every((lock) => lock.granted),
  }
}

export function evaluateImportExportBackfillInvariant(
  staleVersions: ImportExportFingerprintInvariantInspection
) {
  return {
    elementFingerprintsCurrentAndNonNull: staleVersions.elements === 0,
    answerCollectionFingerprintsCurrentAndNonNull:
      staleVersions.answerCollections === 0,
    mediaClassificationsCurrent: staleVersions.mediaFiles === 0,
  }
}

export async function createImportExportInspectionOutput({
  prisma,
  env = process.env,
  requireReady = false,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
  requireReady?: boolean
}) {
  requireMasterGateOff(env)
  const inspection = await inspectImportExportDatabase(prisma)
  const checks = evaluateImportExportInspection(inspection)
  const ready = Object.values(checks).every(Boolean)

  return createOperationOutput(
    requireReady ? 'import-export-readiness' : 'import-export-inspect',
    {
      outcome: requireReady && !ready ? 'incomplete' : 'success',
      code: requireReady && !ready ? 'TARGET_NOT_READY' : 'INSPECTION_COMPLETE',
      checks: {
        ...checks,
        masterGateOff:
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
        triggers: inspection.triggers.length,
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
        triggers: inspection.triggers,
        locks: inspection.locks,
      },
    },
    env
  )
}

export async function createImportExportBackfillVerificationOutput({
  prisma,
  env = process.env,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
}) {
  requireMasterGateOff(env)
  const staleVersions = await inspectImportExportFingerprintInvariant(prisma)
  const checks = evaluateImportExportBackfillInvariant(staleVersions)
  const ready = Object.values(checks).every(Boolean)

  return createOperationOutput(
    'import-export-backfill-verify',
    {
      outcome: ready ? 'success' : 'incomplete',
      code: ready
        ? 'FINGERPRINT_INVARIANT_VERIFIED'
        : 'FINGERPRINT_INVARIANT_VIOLATED',
      checks: {
        ...checks,
        masterGateOff: true,
      },
      counts: {
        invalidActiveElements: staleVersions.elements ?? -1,
        invalidActiveAnswerCollections: staleVersions.answerCollections ?? -1,
        staleMediaClassifications: staleVersions.mediaFiles ?? -1,
      },
    },
    env
  )
}
