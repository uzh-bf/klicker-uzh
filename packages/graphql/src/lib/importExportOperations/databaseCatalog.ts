import { Prisma } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../importExportFingerprintCanonicalization.js'
import type { OperationsPrisma } from './database.js'
import {
  IMPORT_EXPORT_MIGRATIONS,
  REQUIRED_IMPORT_EXPORT_TRIGGERS,
} from './databaseContract.js'
import { ImportExportOperationError } from './runtime.js'

type MigrationRow = {
  migration_name: string
  checksum: string
  started_at: Date
  finished_at: Date | null
  rolled_back_at: Date | null
  applied_steps_count: number
}

type TableSizeRow = {
  table_name: string
  estimated_live_rows: string
  heap_bytes: string
  index_bytes: string
  total_bytes: string
}

type ColumnRow = {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
  is_identity: 'YES' | 'NO'
  is_generated: 'ALWAYS' | 'NEVER'
}

type IndexRow = {
  table_name: string
  index_name: string
  is_ready: boolean
  is_valid: boolean
  is_unique: boolean
  access_method: string
  key_columns: string[]
  has_predicate: boolean
  predicate: string | null
  has_expressions: boolean
  has_included_columns: boolean
  definition: string
}

type ConstraintRow = {
  table_name: string
  constraint_name: string
  constraint_type: string
  is_validated: boolean
  definition: string
  contract_comment: string | null
  key_columns: string[]
  referenced_schema: string | null
  referenced_table: string | null
  referenced_columns: string[]
  update_action: string
  delete_action: string
}

type LockRow = {
  table_name: string
  mode: string
  granted: boolean
  count: string
}

type TriggerRow = {
  table_name: string
  trigger_name: string
  enabled: string
  update_columns: string[]
  has_when_clause: boolean
  has_arguments: boolean
  is_constraint: boolean
  is_deferrable: boolean
  is_initially_deferred: boolean
  function_schema: string
  function_name: string
  function_language: string
  function_security_definer: boolean
  function_source_matches: boolean
  trigger_type: number
}

type RawTriggerRow = Omit<TriggerRow, 'function_source_matches'> & {
  function_source: string
}

export type ImportExportFingerprintInvariantInspection = Readonly<{
  elements: number | null
  answerCollections: number | null
  mediaFiles: number | null
}>

export type ImportExportDatabaseInspection = Readonly<{
  migrations: ReadonlyArray<
    MigrationRow & {
      repository_checksum: string
      checksum_matches: boolean
    }
  >
  missingMigrations: readonly string[]
  tableSizes: readonly TableSizeRow[]
  columns: readonly ColumnRow[]
  indexes: readonly IndexRow[]
  constraints: readonly ConstraintRow[]
  triggers: readonly TriggerRow[]
  locks: readonly LockRow[]
  staleVersions: ImportExportFingerprintInvariantInspection
}>

function repositoryMigrationUrl(migrationName: string) {
  return new URL(
    `../../../../prisma/src/prisma/schema/migrations/${migrationName}/migration.sql`,
    import.meta.url
  )
}

function normalizeSqlSource(source: string) {
  return source.replace(/\s+/g, ' ').trim()
}

async function repositoryMigrationChecksums() {
  const entries = await Promise.all(
    IMPORT_EXPORT_MIGRATIONS.map(async (migrationName) => {
      const contents = await readFile(repositoryMigrationUrl(migrationName))
      return [
        migrationName,
        createHash('sha256').update(contents).digest('hex'),
      ] as const
    })
  )
  return new Map(entries)
}

async function repositoryTriggerFunctionSources() {
  const functionSources = new Map<string, string>()
  for (const migrationName of IMPORT_EXPORT_MIGRATIONS) {
    const contents = await readFile(
      repositoryMigrationUrl(migrationName),
      'utf8'
    )
    const functionPattern =
      /CREATE FUNCTION "public"\."([^"]+)"\(\)\s+RETURNS TRIGGER\s+LANGUAGE plpgsql\s+AS \$\$(.*?)\$\$;/gs
    for (const match of contents.matchAll(functionPattern)) {
      const [, functionName, functionSource] = match
      if (!functionName || typeof functionSource === 'undefined') continue
      if (functionSources.has(functionName)) {
        throw new ImportExportOperationError('MIGRATION_STATE_UNEXPECTED')
      }
      functionSources.set(functionName, normalizeSqlSource(functionSource))
    }
  }

  for (const [, , functionName] of REQUIRED_IMPORT_EXPORT_TRIGGERS) {
    if (!functionSources.has(functionName)) {
      throw new ImportExportOperationError('MIGRATION_STATE_UNEXPECTED')
    }
  }
  return functionSources
}

export async function inspectImportExportDatabase(
  prisma: OperationsPrisma
): Promise<ImportExportDatabaseInspection> {
  // PostgreSQL system catalogs expose identifiers as the internal `name` type
  // (and `name[]` for aggregated attributes), which Prisma's driver adapter
  // cannot deserialize. Cast those outputs at the SQL boundary.
  const [
    migrationRows,
    tableSizes,
    columns,
    indexes,
    constraints,
    rawTriggers,
    locks,
    repositoryChecksums,
    repositoryFunctionSources,
  ] = await Promise.all([
    prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, checksum, started_at, finished_at,
             rolled_back_at, applied_steps_count
      FROM "public"."_prisma_migrations"
      WHERE migration_name IN (${Prisma.join([...IMPORT_EXPORT_MIGRATIONS])})
      ORDER BY migration_name, started_at
    `,
    prisma.$queryRawUnsafe<TableSizeRow[]>(`
      SELECT relname::text AS table_name,
             n_live_tup::text AS estimated_live_rows,
             pg_relation_size(relid)::text AS heap_bytes,
             pg_indexes_size(relid)::text AS index_bytes,
             pg_total_relation_size(relid)::text AS total_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY relname
    `),
    prisma.$queryRawUnsafe<ColumnRow[]>(`
      SELECT table_name::text AS table_name,
             column_name::text AS column_name,
             data_type::text AS data_type,
             is_nullable::text AS is_nullable,
             column_default::text AS column_default,
             is_identity::text AS is_identity,
             is_generated::text AS is_generated
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_name, ordinal_position
    `),
    prisma.$queryRawUnsafe<IndexRow[]>(`
      SELECT table_rel.relname::text AS table_name,
             index_rel.relname::text AS index_name,
             index_state.indisready AS is_ready,
             index_state.indisvalid AS is_valid,
             index_state.indisunique AS is_unique,
             access_method.amname::text AS access_method,
             ARRAY(
               SELECT attribute.attname::text
               FROM unnest(index_state.indkey::smallint[]) WITH ORDINALITY
                    AS key_column(attribute_number, position)
               JOIN pg_attribute attribute
                 ON attribute.attrelid = index_state.indrelid
                AND attribute.attnum = key_column.attribute_number
               WHERE key_column.position <= index_state.indnkeyatts
               ORDER BY key_column.position
             ) AS key_columns,
             index_state.indpred IS NOT NULL AS has_predicate,
             pg_get_expr(index_state.indpred, index_state.indrelid) AS predicate,
             index_state.indexprs IS NOT NULL AS has_expressions,
             index_state.indnatts <> index_state.indnkeyatts AS has_included_columns,
             pg_get_indexdef(index_state.indexrelid) AS definition
      FROM pg_index index_state
      JOIN pg_class index_rel ON index_rel.oid = index_state.indexrelid
      JOIN pg_class table_rel ON table_rel.oid = index_state.indrelid
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      JOIN pg_am access_method ON access_method.oid = index_rel.relam
      WHERE table_ns.nspname = 'public'
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_rel.relname, index_rel.relname
    `),
    prisma.$queryRawUnsafe<ConstraintRow[]>(`
      SELECT table_rel.relname::text AS table_name,
             constraint_state.conname::text AS constraint_name,
             constraint_state.contype::text AS constraint_type,
             constraint_state.convalidated AS is_validated,
             CASE
               WHEN constraint_state.contype = 'c'
               THEN pg_get_expr(
                 constraint_state.conbin,
                 constraint_state.conrelid,
                 true
               )
               ELSE pg_get_constraintdef(constraint_state.oid, true)
             END AS definition,
             obj_description(constraint_state.oid, 'pg_constraint') AS contract_comment,
             ARRAY(
               SELECT attribute.attname::text
               FROM unnest(constraint_state.conkey) WITH ORDINALITY
                    AS key_column(attribute_number, position)
               JOIN pg_attribute attribute
                 ON attribute.attrelid = constraint_state.conrelid
                AND attribute.attnum = key_column.attribute_number
               ORDER BY key_column.position
             ) AS key_columns,
             referenced_ns.nspname::text AS referenced_schema,
             referenced_rel.relname::text AS referenced_table,
             ARRAY(
               SELECT attribute.attname::text
               FROM unnest(constraint_state.confkey) WITH ORDINALITY
                    AS key_column(attribute_number, position)
               JOIN pg_attribute attribute
                 ON attribute.attrelid = constraint_state.confrelid
                AND attribute.attnum = key_column.attribute_number
               ORDER BY key_column.position
             ) AS referenced_columns,
             constraint_state.confupdtype::text AS update_action,
             constraint_state.confdeltype::text AS delete_action
      FROM pg_constraint constraint_state
      JOIN pg_class table_rel ON table_rel.oid = constraint_state.conrelid
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      LEFT JOIN pg_class referenced_rel
        ON referenced_rel.oid = constraint_state.confrelid
      LEFT JOIN pg_namespace referenced_ns
        ON referenced_ns.oid = referenced_rel.relnamespace
      WHERE table_ns.nspname = 'public'
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_rel.relname, constraint_state.conname
    `),
    prisma.$queryRawUnsafe<RawTriggerRow[]>(`
      SELECT table_rel.relname::text AS table_name,
             trigger_state.tgname::text AS trigger_name,
             trigger_state.tgenabled::text AS enabled,
             ARRAY(
               SELECT attribute.attname::text
               FROM unnest(trigger_state.tgattr::smallint[]) WITH ORDINALITY
                    AS update_column(attribute_number, position)
               JOIN pg_attribute attribute
                 ON attribute.attrelid = trigger_state.tgrelid
                AND attribute.attnum = update_column.attribute_number
               ORDER BY update_column.position
             ) AS update_columns,
             trigger_state.tgqual IS NOT NULL AS has_when_clause,
             octet_length(trigger_state.tgargs) > 0 AS has_arguments,
             trigger_state.tgconstraint <> 0 AS is_constraint,
             trigger_state.tgdeferrable AS is_deferrable,
             trigger_state.tginitdeferred AS is_initially_deferred,
             function_ns.nspname::text AS function_schema,
             function_state.proname::text AS function_name,
             language_state.lanname::text AS function_language,
             function_state.prosecdef AS function_security_definer,
             function_state.prosrc AS function_source,
             trigger_state.tgtype::integer AS trigger_type
      FROM pg_trigger trigger_state
      JOIN pg_class table_rel ON table_rel.oid = trigger_state.tgrelid
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      JOIN pg_proc function_state ON function_state.oid = trigger_state.tgfoid
      JOIN pg_namespace function_ns ON function_ns.oid = function_state.pronamespace
      JOIN pg_language language_state ON language_state.oid = function_state.prolang
      WHERE table_ns.nspname = 'public'
        AND NOT trigger_state.tgisinternal
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_rel.relname, trigger_state.tgname
    `),
    prisma.$queryRawUnsafe<LockRow[]>(`
      SELECT table_rel.relname::text AS table_name,
             lock_state.mode::text AS mode,
             lock_state.granted, count(*)::text AS count
      FROM pg_locks lock_state
      JOIN pg_class table_rel ON table_rel.oid = lock_state.relation
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      WHERE table_ns.nspname = 'public'
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging', '_prisma_migrations'
        )
      GROUP BY table_rel.relname, lock_state.mode, lock_state.granted
      ORDER BY table_rel.relname, lock_state.mode, lock_state.granted
    `),
    repositoryMigrationChecksums(),
    repositoryTriggerFunctionSources(),
  ])

  const triggers: TriggerRow[] = rawTriggers.map(
    ({ function_source: functionSource, ...trigger }) => ({
      ...trigger,
      function_source_matches:
        normalizeSqlSource(functionSource) ===
        repositoryFunctionSources.get(trigger.function_name),
    })
  )

  const appliedMigrationNames = new Set(
    migrationRows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name)
  )
  const columnSet = new Set(
    columns.map((column) => `${column.table_name}.${column.column_name}`)
  )

  const staleVersions = await countImportExportFingerprintInvariant(
    prisma,
    columnSet
  )

  return {
    migrations: migrationRows.map((row) => {
      const repositoryChecksum = repositoryChecksums.get(
        row.migration_name as (typeof IMPORT_EXPORT_MIGRATIONS)[number]
      )
      if (!repositoryChecksum) {
        throw new ImportExportOperationError('MIGRATION_STATE_UNEXPECTED')
      }
      return {
        ...row,
        repository_checksum: repositoryChecksum,
        checksum_matches: row.checksum === repositoryChecksum,
      }
    }),
    missingMigrations: IMPORT_EXPORT_MIGRATIONS.filter(
      (migration) => !appliedMigrationNames.has(migration)
    ),
    tableSizes,
    columns,
    indexes,
    constraints,
    triggers,
    locks,
    staleVersions,
  }
}

async function countImportExportFingerprintInvariant(
  prisma: OperationsPrisma,
  columns: ReadonlySet<string>
): Promise<ImportExportFingerprintInvariantInspection> {
  const countExpression = (
    alias: 'answerCollections' | 'elements' | 'mediaFiles',
    table: 'AnswerCollection' | 'Element' | 'MediaFile',
    deletedColumn?: 'isDeleted'
  ) => {
    if (!columns.has(`${table}.importFingerprintVersion`)) {
      return `NULL::text AS "${alias}"`
    }
    if (table !== 'MediaFile' && !columns.has(`${table}.importFingerprint`)) {
      return `NULL::text AS "${alias}"`
    }

    const expectedVersion =
      table === 'MediaFile'
        ? IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
        : IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION
    const activePredicate = deletedColumn
      ? `AND "${deletedColumn}" = false`
      : ''
    const nonNullFingerprintPredicate =
      table === 'MediaFile'
        ? ''
        : `OR "importFingerprint" IS NULL
           OR "importFingerprint" !~ '^[a-f0-9]{64}$'`
    return `(
      SELECT count(*)::text
      FROM "public"."${table}"
      WHERE (
        "importFingerprintVersion" IS NULL
        OR "importFingerprintVersion" <> ${expectedVersion}
        ${nonNullFingerprintPredicate}
      )
      ${activePredicate}
    ) AS "${alias}"`
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      answerCollections: string | null
      elements: string | null
      mediaFiles: string | null
    }>
  >(`
    SELECT
      ${countExpression('elements', 'Element', 'isDeleted')},
      ${countExpression('answerCollections', 'AnswerCollection', 'isDeleted')},
      ${countExpression('mediaFiles', 'MediaFile')}
  `)
  const row = rows[0]
  const parseCount = (value: string | null | undefined) =>
    typeof value === 'string' ? Number(value) : null
  return {
    elements: parseCount(row?.elements),
    answerCollections: parseCount(row?.answerCollections),
    mediaFiles: parseCount(row?.mediaFiles),
  }
}

export async function inspectImportExportFingerprintInvariant(
  prisma: OperationsPrisma
): Promise<ImportExportFingerprintInvariantInspection> {
  const columns = await prisma.$queryRawUnsafe<
    Array<{ table_name: string; column_name: string }>
  >(`
    SELECT table_name::text AS table_name,
           column_name::text AS column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Element', 'AnswerCollection', 'MediaFile')
      AND column_name IN ('importFingerprint', 'importFingerprintVersion')
  `)
  return await countImportExportFingerprintInvariant(
    prisma,
    new Set(
      columns.map((column) => `${column.table_name}.${column.column_name}`)
    )
  )
}
