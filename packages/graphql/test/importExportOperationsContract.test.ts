import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  withAdvisoryLock,
  type OperationsPrisma,
} from '../src/lib/importExportOperations/database.js'
import {
  inspectImportExportFingerprintInvariant,
  type ImportExportDatabaseInspection,
} from '../src/lib/importExportOperations/databaseCatalog.js'
import {
  IMPORT_EXPORT_CHECK_CONSTRAINT_CONTRACT_PREFIX,
  IMPORT_EXPORT_MIGRATIONS,
  REQUIRED_IMPORT_EXPORT_COLUMNS,
  REQUIRED_IMPORT_EXPORT_CONSTRAINTS,
  REQUIRED_IMPORT_EXPORT_INDEXES,
  REQUIRED_IMPORT_EXPORT_TRIGGERS,
} from '../src/lib/importExportOperations/databaseContract.js'
import {
  createImportExportInspectionOutput,
  evaluateImportExportBackfillInvariant,
  evaluateImportExportInspection,
} from '../src/lib/importExportOperations/inspection.js'
import { runCanaryManifestOperation } from '../src/lib/importExportOperations/recovery.js'
import {
  ImportExportOperationError,
  parseDatabaseTarget,
  requireMasterGateOff,
  resolveDatabaseUrl,
  runOperationCli,
} from '../src/lib/importExportOperations/runtime.js'
import {
  IMPORT_EXPORT_CLEANUP_RUNTIME_BUDGET_MS,
  cleanupImportExportPackages,
  handleCleanupImportExportPackages,
} from '../src/services/importExportCleanup.js'
import { cleanupOrphanedImportedMediaFiles } from '../src/services/mediaStorageCleanup.js'

const databaseCatalogMocks = vi.hoisted(() => ({
  inspectImportExportDatabase: vi.fn(),
}))

vi.mock('../src/lib/importExportOperations/databaseCatalog.js', async () => {
  const actual = await vi.importActual<
    typeof import('../src/lib/importExportOperations/databaseCatalog.js')
  >('../src/lib/importExportOperations/databaseCatalog.js')
  return {
    ...actual,
    inspectImportExportDatabase:
      databaseCatalogMocks.inspectImportExportDatabase,
  }
})

const SAFE_ENV = {
  NODE_ENV: 'production',
  IMPORT_EXPORT_ENVIRONMENT: 'stg',
} as const

const OPERATION_ALIASES = [
  'inspect',
  'readiness',
  'preflight',
  'media-hash-backfill',
  'fingerprint-backfill',
  'validate-constraints',
  'backfill-verify',
  'cleanup-dry-run',
  'canary',
] as const

async function readRepositoryFile(path: string) {
  return await readFile(new URL(`../../../${path}`, import.meta.url), 'utf8')
}

function taskDeclarationSource(source: string, taskName: string) {
  const nameIndex = source.indexOf(`name: '${taskName}'`)
  expect(nameIndex).toBeGreaterThanOrEqual(0)
  const taskStart = source.lastIndexOf('hatchet.task({', nameIndex)
  const taskEnd = source.indexOf('\n  })', nameIndex)
  expect(taskStart).toBeGreaterThanOrEqual(0)
  expect(taskEnd).toBeGreaterThan(nameIndex)
  return source.slice(taskStart, taskEnd + '\n  })'.length)
}

describe('import/export production operation aliases', () => {
  it('exposes exact production-only stg/prd aliases through the quiet Infisical wrapper', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8')
    ) as { scripts: Record<string, string> }

    for (const operation of OPERATION_ALIASES) {
      for (const environment of ['stg', 'prd'] as const) {
        const alias = `script:import-export-${operation}:${environment}`
        const command = packageJson.scripts[alias]
        expect(command, alias).toBeTypeOf('string')
        expect(command).toContain('NODE_ENV=production')
        expect(command).toContain('INFISICAL_WRAPPER_QUIET=true')
        expect(command).toContain('INFISICAL_WRAPPER_WATCH=false')
        expect(command).toContain(`IMPORT_EXPORT_ENVIRONMENT=${environment}`)
        expect(command).toContain(
          `../../util/_run_with_infisical.sh --env ${environment}`
        )
        expect(command).not.toContain('NODE_ENV=stg')
        expect(command).not.toContain('IMPORT_EXPORT_DATABASE_TARGET')
        expect(command).not.toContain('IMPORT_EXPORT_ASSESSMENT_DATABASE_URL')
        execFileSync('bash', ['-n', '-c', command!])
      }
    }
  })

  it('keeps the wrapper quiet and validates its watch mode', async () => {
    const wrapper = await readRepositoryFile('util/_run_with_infisical.sh')
    const wrapperPath = fileURLToPath(
      new URL('../../../util/_run_with_infisical.sh', import.meta.url)
    )
    expect(wrapper).toContain('INFISICAL_WRAPPER_QUIET')
    expect(wrapper).toContain('${INFISICAL_WRAPPER_WATCH:-true}')
    expect(wrapper).toContain('infisical run --watch')
    expect(wrapper).toContain('infisical run --env=')
    expect(wrapper).toContain('"stg"|"prd"')
    execFileSync('bash', ['-n', wrapperPath])

    const invalidWatchMode = spawnSync(
      'bash',
      [wrapperPath, '--env', 'stg', 'true'],
      {
        encoding: 'utf8',
        env: { ...process.env, INFISICAL_WRAPPER_WATCH: 'invalid' },
      }
    )
    expect(invalidWatchMode.status).toBe(1)
    expect(invalidWatchMode.stderr).toContain(
      "INFISICAL_WRAPPER_WATCH must be 'true' or 'false'"
    )
  })
})

describe('single-database operation configuration', () => {
  it('uses only DATABASE_URL and defaults serialized evidence to normal', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgresql://normal' })).toBe(
      'postgresql://normal'
    )
    expect(parseDatabaseTarget({})).toBe('normal')
    expect(
      parseDatabaseTarget({ IMPORT_EXPORT_DATABASE_TARGET: 'normal' })
    ).toBe('normal')
  })

  it('rejects the retired assessment selector without falling back to the normal database', () => {
    expect(() =>
      resolveDatabaseUrl({
        DATABASE_URL: 'postgresql://normal',
        IMPORT_EXPORT_DATABASE_TARGET: 'assessment',
        IMPORT_EXPORT_ASSESSMENT_DATABASE_URL: 'postgresql://assessment',
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'ASSESSMENT_DATABASE_TARGET_UNSUPPORTED',
      })
    )
    expect(() =>
      resolveDatabaseUrl({
        IMPORT_EXPORT_ASSESSMENT_DATABASE_URL: 'postgresql://assessment',
      })
    ).toThrowError(
      expect.objectContaining({ code: 'DATABASE_CONFIGURATION_MISSING' })
    )
  })
})

describe('rollout evidence identity and readiness', () => {
  it('binds a schema-v2 canary manifest to its database and storage identities', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'klicker-canary-'))
    const manifestPath = join(directory, 'recovery.json')
    const databaseRow = {
      databaseName: 'klicker-test',
      serverAddress: '127.0.0.1',
      serverPort: 5432,
    }
    const databaseIdentity = createHash('sha256')
      .update(
        JSON.stringify([
          databaseRow.databaseName,
          databaseRow.serverAddress,
          databaseRow.serverPort,
        ])
      )
      .digest('hex')
    const storageIdentity = createHash('sha256')
      .update('azure-blob:testaccount')
      .digest('hex')

    try {
      await expect(
        runCanaryManifestOperation({
          prisma: {
            $queryRaw: vi.fn().mockResolvedValue([databaseRow]),
          } as unknown as OperationsPrisma,
          env: {
            ...SAFE_ENV,
            BLOB_STORAGE_ACCOUNT_NAME: 'testaccount',
            IMPORT_EXPORT_CANARY_MODE: 'initialize',
            IMPORT_EXPORT_CANARY_OWNER_ID:
              '11111111-1111-4111-8111-111111111111',
            IMPORT_EXPORT_RECOVERY_MANIFEST_PATH: manifestPath,
          },
        })
      ).resolves.toMatchObject({
        outcome: 'success',
        code: 'CANARY_MANIFEST_INITIALIZED',
      })
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      expect(manifest).toMatchObject({
        schemaVersion: 2,
        environment: 'stg',
        target: 'normal',
        databaseIdentity,
        storageIdentity,
      })
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('reports an incomplete operation when readiness is required and checks fail', async () => {
    databaseCatalogMocks.inspectImportExportDatabase.mockResolvedValueOnce({
      migrations: [],
      missingMigrations: [...IMPORT_EXPORT_MIGRATIONS],
      tableSizes: [],
      columns: [],
      indexes: [],
      constraints: [],
      triggers: [],
      locks: [],
      staleVersions: {
        elements: null,
        answerCollections: null,
        mediaFiles: null,
      },
    })

    await expect(
      createImportExportInspectionOutput({
        prisma: {} as OperationsPrisma,
        env: SAFE_ENV,
        requireReady: true,
      })
    ).resolves.toMatchObject({
      operation: 'import-export-readiness',
      outcome: 'incomplete',
      code: 'TARGET_NOT_READY',
      checks: {
        migrationsPresent: false,
        staleVersionsClear: false,
        masterGateOff: true,
      },
    })
  })
})

describe('privacy-safe operation output', () => {
  it('never writes a raw exception message or stack', async () => {
    const marker = 'secret-token://authored-file-name-and-stack'
    let stdout = ''
    let stderr = ''
    const exitCode = await runOperationCli(
      'import-export-contract-test',
      async () => {
        throw new Error(marker)
      },
      {
        env: SAFE_ENV,
        stdout: { write: (value) => ((stdout += String(value)), true) },
        stderr: { write: (value) => ((stderr += String(value)), true) },
      }
    )

    expect(exitCode).toBe(1)
    expect(stdout).toBe('')
    expect(stderr).not.toContain(marker)
    expect(stderr).not.toContain('Error:')
    expect(JSON.parse(stderr)).toMatchObject({
      schemaVersion: 1,
      operation: 'import-export-contract-test',
      outcome: 'failure',
      code: 'OPERATION_FAILED',
    })
  })

  it('emits only an allowlisted stable code for expected failures', async () => {
    let stderr = ''
    const exitCode = await runOperationCli(
      'import-export-contract-test',
      async () => {
        throw new ImportExportOperationError('MASTER_GATE_MUST_BE_OFF')
      },
      {
        env: SAFE_ENV,
        stdout: { write: () => true },
        stderr: { write: (value) => ((stderr += String(value)), true) },
      }
    )

    expect(exitCode).toBe(1)
    expect(JSON.parse(stderr)).toMatchObject({
      outcome: 'failure',
      code: 'MASTER_GATE_MUST_BE_OFF',
    })
  })

  it('rejects malformed gate values instead of treating them as disabled', () => {
    expect(() =>
      requireMasterGateOff({ IMPORT_EXPORT_ENABLED: 'TRUE' })
    ).toThrowError(expect.objectContaining({ code: 'MASTER_GATE_INVALID' }))
    expect(() =>
      requireMasterGateOff({ IMPORT_EXPORT_ENABLED: 'false' })
    ).not.toThrow()
    expect(() => requireMasterGateOff({})).not.toThrow()
  })
})

describe('import/export maintenance execution safety', () => {
  it('schema-qualifies every quoted relation in export snapshot SQL', async () => {
    const source = await readRepositoryFile(
      'packages/graphql/src/services/elementExportSnapshot.ts'
    )
    const relations = [
      'AnswerCollectionEntry',
      '_ElementAnswerCollectionUsedItems',
      'AnswerCollection',
      'DerivedPermission',
      'Element',
      'User',
    ] as const

    expect(source).not.toMatch(
      /\b(?:FROM|JOIN|UPDATE|INTO)\s+"(?!public"\.)[A-Za-z_][A-Za-z0-9_]*"/
    )
    for (const relation of relations) {
      expect(source).toContain(`"public"."${relation}"`)
    }
  })

  it('sets explicit Hatchet timeouts and leaves cleanup a five-minute stop margin', async () => {
    const [hatchetSource, cleanupSource, fingerprintSource] = await Promise.all(
      [
        readRepositoryFile('packages/hatchet/src/index.ts'),
        readRepositoryFile(
          'packages/graphql/src/services/importExportCleanup.ts'
        ),
        readRepositoryFile(
          'packages/graphql/src/services/importExportFingerprintMaintenance.ts'
        ),
      ]
    )
    const refreshTask = taskDeclarationSource(
      hatchetSource,
      'refresh-import-export-fingerprints'
    )
    const repairTask = taskDeclarationSource(
      hatchetSource,
      'repair-import-export-fingerprints'
    )
    const cleanupTask = taskDeclarationSource(
      hatchetSource,
      'cleanup-import-export-packages'
    )

    expect(hatchetSource).toContain("refreshFingerprints: '5m'")
    expect(hatchetSource).toContain("repairFingerprints: '10m'")
    expect(hatchetSource).toContain("cleanupPackages: '45m'")
    expect(hatchetSource).toContain(
      'limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST'
    )
    expect(refreshTask).toContain('retries: 0')
    expect(refreshTask).toContain(
      'IMPORT_EXPORT_TASK_EXECUTION_TIMEOUTS.refreshFingerprints'
    )
    expect(refreshTask).toContain('!result.stoppedEarly')
    expect(repairTask).toContain('retries: 0')
    expect(repairTask).toContain(
      'IMPORT_EXPORT_TASK_EXECUTION_TIMEOUTS.repairFingerprints'
    )
    expect(repairTask).toContain(
      'concurrency: IMPORT_EXPORT_MAINTENANCE_SINGLE_FLIGHT'
    )
    expect(cleanupTask).toContain('retries: 0')
    expect(cleanupTask).toContain(
      'IMPORT_EXPORT_TASK_EXECUTION_TIMEOUTS.cleanupPackages'
    )
    expect(cleanupTask).toContain(
      'concurrency: IMPORT_EXPORT_MAINTENANCE_SINGLE_FLIGHT'
    )
    expect(IMPORT_EXPORT_CLEANUP_RUNTIME_BUDGET_MS).toBe(40 * 60 * 1000)
    expect(cleanupSource).toContain(
      'executionCtx.abortController.signal.aborted'
    )
    expect(cleanupSource).toContain('Date.now() >= deadline')
    expect(fingerprintSource).toContain(
      'IMPORT_EXPORT_FINGERPRINT_REFRESH_RUNTIME_BUDGET_MS'
    )
    expect(fingerprintSource).toContain(
      'IMPORT_EXPORT_FINGERPRINT_REPAIR_RUNTIME_BUDGET_MS'
    )
    expect(fingerprintSource).toContain(
      'executionCtx.abortController.signal.aborted'
    )
  })

  it('stops cleanup before new persistence work when its budget is exhausted', async () => {
    const prisma = {} as PrismaClient
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    try {
      const [packageCleanup, mediaCleanup] = await Promise.all([
        cleanupImportExportPackages({
          prisma,
          getStopReason: () => 'budget',
        }),
        cleanupOrphanedImportedMediaFiles({
          prisma,
          shouldStop: () => true,
        }),
      ])

      expect(packageCleanup).toMatchObject({
        packageCleanupBacklogRemaining: true,
        receiptCleanupBacklogRemaining: true,
        cleanupBacklogRemaining: true,
        cleanupStoppedEarly: true,
        cleanupStopReason: 'budget',
        cleanupFailures: 0,
      })
      expect(mediaCleanup).toMatchObject({
        cleanupBacklogRemaining: true,
        cleanupStoppedEarly: true,
        failedMediaCleanups: 0,
      })
    } finally {
      info.mockRestore()
    }
  })

  it('reports cancellation as a failed stop instead of a successful budget stop', async () => {
    const events: Array<Record<string, unknown>> = []
    const info = vi
      .spyOn(console, 'info')
      .mockImplementation((label, value) => {
        if (label === '[ImportExportTelemetry]' && typeof value === 'string') {
          events.push(JSON.parse(value) as Record<string, unknown>)
        }
      })
    try {
      await expect(
        cleanupImportExportPackages({
          prisma: {} as PrismaClient,
          getStopReason: () => 'cancelled',
        })
      ).resolves.toMatchObject({
        cleanupStoppedEarly: true,
        cleanupStopReason: 'cancelled',
      })
    } finally {
      info.mockRestore()
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        operation: 'cleanup',
        outcome: 'failure',
        code: 'CLEANUP_CANCELLED',
      })
    )
  })

  it('rejects cancellation arriving after the final internal stop poll', async () => {
    const abortController = new AbortController()
    let receiptQueryCount = 0
    const prisma = {
      importExportPackageArtifact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      importMediaStaging: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      elementImportReceipt: {
        findMany: vi.fn().mockImplementation(async () => {
          receiptQueryCount++
          if (receiptQueryCount === 2) abortController.abort()
          return []
        }),
      },
    } as unknown as PrismaClient
    const logger = { info: vi.fn() }
    const events: Array<Record<string, unknown>> = []
    const info = vi
      .spyOn(console, 'info')
      .mockImplementation((label, value) => {
        if (label === '[ImportExportTelemetry]' && typeof value === 'string') {
          events.push(JSON.parse(value) as Record<string, unknown>)
        }
      })

    try {
      await expect(
        handleCleanupImportExportPackages(
          {},
          { prisma } as Parameters<typeof handleCleanupImportExportPackages>[1],
          { abortController, logger } as unknown as Parameters<
            typeof handleCleanupImportExportPackages
          >[2]
        )
      ).rejects.toThrow('Import/export cleanup was cancelled.')
    } finally {
      info.mockRestore()
    }

    expect(receiptQueryCount).toBe(2)
    expect(abortController.signal.aborted).toBe(true)
    expect(logger.info).not.toHaveBeenCalled()
    expect(events).toContainEqual(
      expect.objectContaining({
        operation: 'cleanup',
        outcome: 'failure',
        code: 'CLEANUP_CANCELLED',
      })
    )
    expect(events).not.toContainEqual(
      expect.objectContaining({
        operation: 'cleanup',
        outcome: 'success',
      })
    )
  })
})

describe('database operation safety', () => {
  it('counts didactic-v2 nulls separately from media-v1 classification', async () => {
    const queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([
        { table_name: 'Element', column_name: 'importFingerprint' },
        { table_name: 'Element', column_name: 'importFingerprintVersion' },
        {
          table_name: 'AnswerCollection',
          column_name: 'importFingerprint',
        },
        {
          table_name: 'AnswerCollection',
          column_name: 'importFingerprintVersion',
        },
        {
          table_name: 'MediaFile',
          column_name: 'importFingerprintVersion',
        },
      ])
      .mockResolvedValueOnce([
        { elements: '1', answerCollections: '2', mediaFiles: '3' },
      ])

    await expect(
      inspectImportExportFingerprintInvariant({
        $queryRawUnsafe: queryRawUnsafe,
      } as unknown as OperationsPrisma)
    ).resolves.toEqual({
      elements: 1,
      answerCollections: 2,
      mediaFiles: 3,
    })

    const invariantSql = queryRawUnsafe.mock.calls[1]![0] as string
    expect(invariantSql).toContain('"importFingerprintVersion" <> 2')
    expect(invariantSql.match(/OR "importFingerprint" IS NULL/g)).toHaveLength(
      2
    )
    expect(invariantSql.match(/!~ '\^\[a-f0-9\]/g)).toHaveLength(2)
    expect(invariantSql).toContain('"importFingerprintVersion" <> 1')
  })

  it('evaluates only the active fingerprint invariant for backfill verification', () => {
    expect(
      evaluateImportExportBackfillInvariant({
        elements: 0,
        answerCollections: 0,
        mediaFiles: 0,
      })
    ).toEqual({
      elementFingerprintsCurrentAndNonNull: true,
      answerCollectionFingerprintsCurrentAndNonNull: true,
      mediaClassificationsCurrent: true,
    })
    expect(
      evaluateImportExportBackfillInvariant({
        elements: 1,
        answerCollections: null,
        mediaFiles: 0,
      })
    ).toEqual({
      elementFingerprintsCurrentAndNonNull: false,
      answerCollectionFingerprintsCurrentAndNonNull: false,
      mediaClassificationsCurrent: true,
    })
  })

  it('inspects the complete import/export migration and maintenance-index contract', async () => {
    expect(IMPORT_EXPORT_MIGRATIONS).toContain(
      '20260716085603_import_export_fingerprint_repair_indexes'
    )
    expect(IMPORT_EXPORT_MIGRATIONS).toContain(
      '20260722100000_import_export_null_fingerprint_repair_indexes'
    )
    expect(REQUIRED_IMPORT_EXPORT_INDEXES.map(([, name]) => name)).toEqual(
      expect.arrayContaining([
        'AnswerCollection_repair_fpv_deleted_id_idx',
        'AnswerCollection_repair_null_fp_id_idx',
        'Element_answer_collection_deleted_id_idx',
        'Element_repair_fpv_deleted_id_idx',
        'Element_repair_null_fp_id_idx',
      ])
    )

    const sealingMigration = await readRepositoryFile(
      'packages/prisma/src/prisma/schema/migrations/20260716085603_import_export_fingerprint_repair_indexes/migration.sql'
    )
    expect(sealingMigration).toContain('SELECT pg_get_expr(')
    expect(sealingMigration).not.toContain('SELECT pg_get_constraintdef(')
    expect(sealingMigration).toContain(
      `'${IMPORT_EXPORT_CHECK_CONSTRAINT_CONTRACT_PREFIX}' || live_expression`
    )

    const nullFingerprintRepairMigration = await readRepositoryFile(
      'packages/prisma/src/prisma/schema/migrations/20260722100000_import_export_null_fingerprint_repair_indexes/migration.sql'
    )
    expect(nullFingerprintRepairMigration).toContain(
      'AnswerCollection_repair_null_fp_id_idx'
    )
    expect(nullFingerprintRepairMigration).toContain(
      'Element_repair_null_fp_id_idx'
    )
  })

  it('holds and releases one advisory lock around a bounded operation', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ released: true }] })
    const session = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      query,
    }
    const run = vi.fn().mockResolvedValue('complete')

    await expect(
      withAdvisoryLock({
        prisma: {} as OperationsPrisma,
        createSession: () => session as never,
        run,
      })
    ).resolves.toBe('complete')
    expect(session.connect).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith(expect.any(Function))
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[0]?.[0]).toContain('pg_try_advisory_lock')
    expect(query.mock.calls[1]?.[0]).toContain('pg_advisory_unlock')
    expect(session.end).toHaveBeenCalledOnce()
  })

  it('refuses to overlap an operation when the advisory lock is held', async () => {
    const run = vi.fn()
    const session = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
    }
    await expect(
      withAdvisoryLock({
        prisma: {} as OperationsPrisma,
        createSession: () => session as never,
        run,
      })
    ).rejects.toMatchObject({ code: 'OPERATION_ALREADY_RUNNING' })
    expect(run).not.toHaveBeenCalled()
    expect(session.end).toHaveBeenCalledOnce()
  })

  it('requires exact migration checksums, ready indexes, validated constraints, no waits, and zero stale versions', () => {
    const inspection: ImportExportDatabaseInspection = {
      migrations: IMPORT_EXPORT_MIGRATIONS.map((migration_name) => ({
        migration_name,
        checksum: 'repository-checksum',
        repository_checksum: 'repository-checksum',
        checksum_matches: true,
        started_at: new Date(0),
        finished_at: new Date(1),
        rolled_back_at: null,
        applied_steps_count: 1,
      })),
      missingMigrations: [],
      tableSizes: [],
      columns: REQUIRED_IMPORT_EXPORT_COLUMNS.map(
        ([table_name, column_name, data_type]) => ({
          table_name,
          column_name,
          data_type,
          is_nullable: 'YES' as const,
          column_default: null,
          is_identity: 'NO' as const,
          is_generated: 'NEVER' as const,
        })
      ),
      indexes: REQUIRED_IMPORT_EXPORT_INDEXES.map(
        ([table_name, index_name, is_unique, key_columns, predicate]) => ({
          table_name,
          index_name,
          is_ready: true,
          is_valid: true,
          is_unique,
          access_method: 'btree',
          key_columns: [...key_columns],
          has_predicate: typeof predicate === 'string',
          predicate: predicate ?? null,
          has_expressions: false,
          has_included_columns: false,
          definition: 'operator evidence only',
        })
      ),
      constraints: REQUIRED_IMPORT_EXPORT_CONSTRAINTS.map((expected) => {
        const definition = 'operator evidence only'
        return {
          table_name: expected.tableName,
          constraint_name: expected.constraintName,
          constraint_type: expected.constraintType,
          is_validated: true,
          definition,
          contract_comment:
            expected.constraintType === 'c'
              ? `${IMPORT_EXPORT_CHECK_CONSTRAINT_CONTRACT_PREFIX}${definition}`
              : null,
          key_columns: [...expected.keyColumns],
          referenced_table:
            expected.constraintType === 'f' ? expected.referencedTable : null,
          referenced_schema: expected.constraintType === 'f' ? 'public' : null,
          referenced_columns:
            expected.constraintType === 'f'
              ? [...expected.referencedColumns]
              : [],
          update_action:
            expected.constraintType === 'f' ? expected.updateAction : '',
          delete_action:
            expected.constraintType === 'f' ? expected.deleteAction : '',
        }
      }),
      triggers: REQUIRED_IMPORT_EXPORT_TRIGGERS.map(
        ([
          table_name,
          trigger_name,
          function_name,
          trigger_type,
          update_columns,
        ]) => ({
          table_name,
          trigger_name,
          enabled: 'O',
          update_columns: [...update_columns],
          has_when_clause: false,
          has_arguments: false,
          is_constraint: false,
          is_deferrable: false,
          is_initially_deferred: false,
          function_schema: 'public',
          function_name,
          function_language: 'plpgsql',
          function_security_definer: false,
          function_source_matches: true,
          trigger_type,
        })
      ),
      locks: [
        {
          table_name: 'Element',
          mode: 'AccessShareLock',
          granted: true,
          count: '1',
        },
      ],
      staleVersions: { elements: 0, answerCollections: 0, mediaFiles: 0 },
    }

    expect(evaluateImportExportInspection(inspection)).toEqual({
      migrationsPresent: true,
      migrationChecksumsMatch: true,
      migrationHistoryUnambiguous: true,
      migrationStepsComplete: true,
      columnsReady: true,
      indexesReady: true,
      constraintsValidated: true,
      triggersReady: true,
      staleVersionsClear: true,
      noWaitingLocks: true,
    })
    expect(
      evaluateImportExportInspection({
        ...inspection,
        locks: [{ ...inspection.locks[0]!, granted: false }],
      }).noWaitingLocks
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        columns: [
          { ...inspection.columns[0]!, data_type: 'character varying' },
          ...inspection.columns.slice(1),
        ],
      }).columnsReady
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        indexes: [
          { ...inspection.indexes[0]!, table_name: 'Element' },
          ...inspection.indexes.slice(1),
        ],
      }).indexesReady
    ).toBe(false)
    const partialIndex = inspection.indexes.find(
      (index) => index.index_name === 'Element_repair_null_fp_id_idx'
    )!
    expect(
      evaluateImportExportInspection({
        ...inspection,
        indexes: inspection.indexes.map((index) =>
          index === partialIndex
            ? { ...index, predicate: '("isDeleted" = false)' }
            : index
        ),
      }).indexesReady
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: [
          { ...inspection.constraints[0]!, is_validated: false },
          ...inspection.constraints.slice(1),
        ],
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) =>
          constraint.constraint_name === 'MediaFile_contentHash_check'
            ? { ...constraint, definition: 'true' }
            : constraint
        ),
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) =>
          constraint.constraint_name === 'PackageArtifact_expiry_check'
            ? { ...constraint, key_columns: [] }
            : constraint
        ),
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) =>
          constraint.constraint_name === 'PackageArtifact_expiry_check'
            ? {
                ...constraint,
                definition: '"expiresAt" IS NULL OR "createdAt" IS NULL',
              }
            : constraint
        ),
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) =>
          constraint.constraint_name ===
          'ImportExportPackageArtifact_ownerId_fkey'
            ? { ...constraint, referenced_schema: 'shadow' }
            : constraint
        ),
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        constraints: inspection.constraints.map((constraint) =>
          constraint.constraint_name ===
          'ImportExportPackageArtifact_ownerId_fkey'
            ? { ...constraint, referenced_table: 'MediaFile' }
            : constraint
        ),
      }).constraintsValidated
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        triggers: [
          { ...inspection.triggers[0]!, enabled: 'D' },
          ...inspection.triggers.slice(1),
        ],
      }).triggersReady
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        triggers: [
          {
            ...inspection.triggers[2]!,
            update_columns: [],
          },
          ...inspection.triggers.filter((_, index) => index !== 2),
        ],
      }).triggersReady
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        triggers: [
          { ...inspection.triggers[0]!, function_source_matches: false },
          ...inspection.triggers.slice(1),
        ],
      }).triggersReady
    ).toBe(false)
    expect(
      evaluateImportExportInspection({
        ...inspection,
        triggers: [
          { ...inspection.triggers[0]!, function_schema: 'shadow' },
          ...inspection.triggers.slice(1),
        ],
      }).triggersReady
    ).toBe(false)

    const baselinedFirstMigration = {
      ...inspection,
      migrations: inspection.migrations.map((migration, index) => ({
        ...migration,
        applied_steps_count: index === 0 ? 0 : 1,
      })),
    }
    expect(
      evaluateImportExportInspection(baselinedFirstMigration)
        .migrationStepsComplete
    ).toBe(true)
    expect(
      evaluateImportExportInspection({
        ...baselinedFirstMigration,
        migrations: baselinedFirstMigration.migrations.map(
          (migration, index) => ({
            ...migration,
            applied_steps_count:
              index === 1 ? 0 : migration.applied_steps_count,
          })
        ),
      }).migrationStepsComplete
    ).toBe(false)

    const activeFailedAttempt = {
      ...inspection,
      migrations: [
        ...inspection.migrations,
        {
          ...inspection.migrations[1]!,
          started_at: new Date(2),
          finished_at: null,
          applied_steps_count: 0,
        },
      ],
    }
    expect(
      evaluateImportExportInspection(activeFailedAttempt)
        .migrationHistoryUnambiguous
    ).toBe(false)

    const rolledBackAttempt = {
      ...inspection,
      migrations: [
        ...inspection.migrations,
        {
          ...inspection.migrations[1]!,
          started_at: new Date(2),
          finished_at: null,
          rolled_back_at: new Date(3),
          applied_steps_count: 0,
        },
      ],
    }
    expect(
      evaluateImportExportInspection(rolledBackAttempt)
        .migrationHistoryUnambiguous
    ).toBe(true)
    expect(
      evaluateImportExportInspection({
        ...rolledBackAttempt,
        migrations: rolledBackAttempt.migrations.map((migration, index) =>
          index === rolledBackAttempt.migrations.length - 1
            ? { ...migration, checksum_matches: false }
            : migration
        ),
      }).migrationChecksumsMatch
    ).toBe(false)
  })
})
