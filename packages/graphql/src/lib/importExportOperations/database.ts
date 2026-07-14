import { PrismaClient, type Prisma } from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { ImportExportOperationError, resolveDatabaseUrl } from './runtime.js'

export const IMPORT_EXPORT_MIGRATIONS = [
  '20260707120000_import_export_fingerprints',
  '20260712205147_import_export_durable_state',
  '20260712223000_import_export_media_fingerprint_state',
  '20260713003000_element_import_receipt_identity_immutable',
  '20260713013000_import_export_result_and_target_immutability',
  '20260713130636_import_export_duplicate_lookup_indexes',
] as const

export const REQUIRED_IMPORT_EXPORT_INDEXES = [
  'AnswerCollection_owner_fpv_fp_idx',
  'AnswerCollection_owner_fpv_fp_id_idx',
  'Element_owner_fpv_fp_idx',
  'Element_owner_fpv_fp_id_idx',
  'MediaFile_import_fpv_id_idx',
  'PackageArtifact_storage_target_key',
  'ElementImportReceipt_jti_key',
  'ImportMediaStaging_receipt_ref_key',
  'ImportMediaStaging_storage_target_key',
] as const

export const REQUIRED_IMPORT_EXPORT_CONSTRAINTS = [
  'MediaFile_contentHash_check',
  'MediaFile_importFingerprintVersion_check',
  'Element_importFingerprintVersion_check',
  'AnswerCollection_importFingerprintVersion_check',
] as const

export type OperationsPrisma = PrismaClient

export function createOperationsPrisma(env: NodeJS.ProcessEnv = process.env) {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(env),
    max: 1,
  })
  return new PrismaClient({ adapter, log: [] })
}

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
  definition: string
}

type ConstraintRow = {
  table_name: string
  constraint_name: string
  constraint_type: string
  is_validated: boolean
  definition: string
}

type LockRow = {
  table_name: string
  mode: string
  granted: boolean
  count: string
}

type CountRow = { count: string }

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
  locks: readonly LockRow[]
  staleVersions: Readonly<{
    elements: number | null
    answerCollections: number | null
    mediaFiles: number | null
  }>
}>

async function repositoryMigrationChecksums() {
  const entries = await Promise.all(
    IMPORT_EXPORT_MIGRATIONS.map(async (migrationName) => {
      const path = new URL(
        `../../../../prisma/src/prisma/schema/migrations/${migrationName}/migration.sql`,
        import.meta.url
      )
      const contents = await readFile(path)
      return [
        migrationName,
        createHash('sha256').update(contents).digest('hex'),
      ] as const
    })
  )
  return new Map(entries)
}

export async function inspectImportExportDatabase(
  prisma: OperationsPrisma
): Promise<ImportExportDatabaseInspection> {
  const [
    migrationRows,
    tableSizes,
    columns,
    indexes,
    constraints,
    locks,
    repositoryChecksums,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<MigrationRow[]>(`
      SELECT migration_name, checksum, started_at, finished_at,
             rolled_back_at, applied_steps_count
      FROM "_prisma_migrations"
      WHERE migration_name IN (
        '20260707120000_import_export_fingerprints',
        '20260712205147_import_export_durable_state',
        '20260712223000_import_export_media_fingerprint_state',
        '20260713003000_element_import_receipt_identity_immutable',
        '20260713013000_import_export_result_and_target_immutability',
        '20260713130636_import_export_duplicate_lookup_indexes'
      )
      ORDER BY migration_name, started_at
    `),
    prisma.$queryRawUnsafe<TableSizeRow[]>(`
      SELECT relname AS table_name,
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
      SELECT table_name, column_name, data_type, is_nullable,
             column_default, is_identity, is_generated
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
      SELECT table_rel.relname AS table_name,
             index_rel.relname AS index_name,
             index_state.indisready AS is_ready,
             index_state.indisvalid AS is_valid,
             pg_get_indexdef(index_state.indexrelid) AS definition
      FROM pg_index index_state
      JOIN pg_class index_rel ON index_rel.oid = index_state.indexrelid
      JOIN pg_class table_rel ON table_rel.oid = index_state.indrelid
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      WHERE table_ns.nspname = 'public'
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_rel.relname, index_rel.relname
    `),
    prisma.$queryRawUnsafe<ConstraintRow[]>(`
      SELECT table_rel.relname AS table_name,
             constraint_state.conname AS constraint_name,
             constraint_state.contype::text AS constraint_type,
             constraint_state.convalidated AS is_validated,
             pg_get_constraintdef(constraint_state.oid, true) AS definition
      FROM pg_constraint constraint_state
      JOIN pg_class table_rel ON table_rel.oid = constraint_state.conrelid
      JOIN pg_namespace table_ns ON table_ns.oid = table_rel.relnamespace
      WHERE table_ns.nspname = 'public'
        AND table_rel.relname IN (
          'Element', 'AnswerCollection', 'MediaFile',
          'ImportExportPackageArtifact', 'ElementImportReceipt',
          'ImportMediaStaging'
        )
      ORDER BY table_rel.relname, constraint_state.conname
    `),
    prisma.$queryRawUnsafe<LockRow[]>(`
      SELECT table_rel.relname AS table_name, lock_state.mode,
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
  ])

  const appliedMigrationNames = new Set(
    migrationRows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name)
  )
  const columnSet = new Set(
    columns.map((column) => `${column.table_name}.${column.column_name}`)
  )

  const staleVersions = {
    elements: await staleVersionCount(
      prisma,
      columnSet,
      'Element',
      'isDeleted'
    ),
    answerCollections: await staleVersionCount(
      prisma,
      columnSet,
      'AnswerCollection',
      'isDeleted'
    ),
    mediaFiles: await staleVersionCount(prisma, columnSet, 'MediaFile'),
  }

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
    locks,
    staleVersions,
  }
}

async function staleVersionCount(
  prisma: OperationsPrisma,
  columns: ReadonlySet<string>,
  table: 'Element' | 'AnswerCollection' | 'MediaFile',
  deletedColumn?: 'isDeleted'
) {
  if (!columns.has(`${table}.importFingerprintVersion`)) return null
  const activePredicate = deletedColumn ? `AND "${deletedColumn}" = false` : ''
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT count(*)::text AS count
    FROM "${table}"
    WHERE ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" <> 1)
      ${activePredicate}
  `)
  return Number(rows[0]?.count ?? 0)
}

export async function withAdvisoryLock<T>({
  prisma,
  operationKey,
  run,
}: {
  prisma: OperationsPrisma
  operationKey: number
  run: () => Promise<T>
}) {
  const namespaceKey = 1262836053
  const lock = await prisma.$queryRaw<
    Array<{ acquired: boolean }>
  >`SELECT pg_try_advisory_lock(${namespaceKey}, ${operationKey}) AS acquired`
  if (!lock[0]?.acquired) {
    throw new ImportExportOperationError('OPERATION_ALREADY_RUNNING')
  }
  try {
    return await run()
  } finally {
    await prisma.$queryRaw<
      Array<{ released: boolean }>
    >`SELECT pg_advisory_unlock(${namespaceKey}, ${operationKey}) AS released`
  }
}

export type ExactScopeCounts = Readonly<{
  elements: number
  answerCollections: number
  mediaFiles: number
  artifacts: number
  receipts: number
  stagingRecords: number
  activeElements: number
  activeAnswerCollections: number
  foreignOwnedRecords: number
}>

export async function countExactRecoveryScope({
  prisma,
  ownerId,
  resources,
}: {
  prisma: OperationsPrisma
  ownerId: string
  resources: {
    elementIds: number[]
    answerCollectionIds: number[]
    mediaFileIds: string[]
    artifactIds: string[]
    receiptIds: string[]
    stagingIds: string[]
  }
}): Promise<ExactScopeCounts> {
  const ownerWhere = { ownerId }
  const [
    elements,
    answerCollections,
    mediaFiles,
    artifacts,
    receipts,
    stagingRecords,
    activeElements,
    activeAnswerCollections,
    foreignElements,
    foreignAnswerCollections,
    foreignMediaFiles,
    foreignArtifacts,
    foreignReceipts,
    foreignStagingRecords,
  ] = await Promise.all([
    resources.elementIds.length === 0
      ? 0
      : prisma.element.count({
          where: { ...ownerWhere, id: { in: resources.elementIds } },
        }),
    resources.answerCollectionIds.length === 0
      ? 0
      : prisma.answerCollection.count({
          where: {
            ...ownerWhere,
            id: { in: resources.answerCollectionIds },
          },
        }),
    resources.mediaFileIds.length === 0
      ? 0
      : prisma.mediaFile.count({
          where: { ...ownerWhere, id: { in: resources.mediaFileIds } },
        }),
    resources.artifactIds.length === 0
      ? 0
      : prisma.importExportPackageArtifact.count({
          where: { ...ownerWhere, id: { in: resources.artifactIds } },
        }),
    resources.receiptIds.length === 0
      ? 0
      : prisma.elementImportReceipt.count({
          where: { ...ownerWhere, id: { in: resources.receiptIds } },
        }),
    resources.stagingIds.length === 0
      ? 0
      : prisma.importMediaStaging.count({
          where: { ...ownerWhere, id: { in: resources.stagingIds } },
        }),
    resources.elementIds.length === 0
      ? 0
      : prisma.element.count({
          where: {
            ...ownerWhere,
            id: { in: resources.elementIds },
            isDeleted: false,
          },
        }),
    resources.answerCollectionIds.length === 0
      ? 0
      : prisma.answerCollection.count({
          where: {
            ...ownerWhere,
            id: { in: resources.answerCollectionIds },
            isDeleted: false,
          },
        }),
    resources.elementIds.length === 0
      ? 0
      : prisma.element.count({
          where: {
            id: { in: resources.elementIds },
            ownerId: { not: ownerId },
          },
        }),
    resources.answerCollectionIds.length === 0
      ? 0
      : prisma.answerCollection.count({
          where: {
            id: { in: resources.answerCollectionIds },
            ownerId: { not: ownerId },
          },
        }),
    resources.mediaFileIds.length === 0
      ? 0
      : prisma.mediaFile.count({
          where: {
            id: { in: resources.mediaFileIds },
            ownerId: { not: ownerId },
          },
        }),
    resources.artifactIds.length === 0
      ? 0
      : prisma.importExportPackageArtifact.count({
          where: {
            id: { in: resources.artifactIds },
            ownerId: { not: ownerId },
          },
        }),
    resources.receiptIds.length === 0
      ? 0
      : prisma.elementImportReceipt.count({
          where: {
            id: { in: resources.receiptIds },
            ownerId: { not: ownerId },
          },
        }),
    resources.stagingIds.length === 0
      ? 0
      : prisma.importMediaStaging.count({
          where: {
            id: { in: resources.stagingIds },
            ownerId: { not: ownerId },
          },
        }),
  ])
  return {
    elements,
    answerCollections,
    mediaFiles,
    artifacts,
    receipts,
    stagingRecords,
    activeElements,
    activeAnswerCollections,
    foreignOwnedRecords:
      foreignElements +
      foreignAnswerCollections +
      foreignMediaFiles +
      foreignArtifacts +
      foreignReceipts +
      foreignStagingRecords,
  }
}

export type PrismaTransactionClient = Prisma.TransactionClient
