import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  IMPORT_EXPORT_MIGRATIONS,
  REQUIRED_IMPORT_EXPORT_CONSTRAINTS,
  REQUIRED_IMPORT_EXPORT_INDEXES,
  withAdvisoryLock,
  type ImportExportDatabaseInspection,
  type OperationsPrisma,
} from '../src/lib/importExportOperations/database.js'
import { evaluateImportExportInspection } from '../src/lib/importExportOperations/inspection.js'
import {
  ImportExportOperationError,
  requireMasterGateOff,
  runOperationCli,
} from '../src/lib/importExportOperations/runtime.js'

const SAFE_ENV = {
  NODE_ENV: 'production',
  IMPORT_EXPORT_ENVIRONMENT: 'stg',
  IMPORT_EXPORT_DATABASE_TARGET: 'normal',
} as const

const OPERATION_ALIASES = [
  'inspect',
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

describe('database operation safety', () => {
  it('holds and releases one advisory lock around a bounded operation', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([{ released: true }])
    const run = vi.fn().mockResolvedValue('complete')

    await expect(
      withAdvisoryLock({
        prisma: { $queryRaw: queryRaw } as unknown as OperationsPrisma,
        operationKey: 2,
        run,
      })
    ).resolves.toBe('complete')
    expect(run).toHaveBeenCalledOnce()
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })

  it('refuses to overlap an operation when the advisory lock is held', async () => {
    const run = vi.fn()
    await expect(
      withAdvisoryLock({
        prisma: {
          $queryRaw: vi.fn().mockResolvedValue([{ acquired: false }]),
        } as unknown as OperationsPrisma,
        operationKey: 1,
        run,
      })
    ).rejects.toMatchObject({ code: 'OPERATION_ALREADY_RUNNING' })
    expect(run).not.toHaveBeenCalled()
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
      columns: [],
      indexes: REQUIRED_IMPORT_EXPORT_INDEXES.map((index_name) => ({
        table_name: 'Element',
        index_name,
        is_ready: true,
        is_valid: true,
        definition: 'allowlisted schema definition',
      })),
      constraints: REQUIRED_IMPORT_EXPORT_CONSTRAINTS.map(
        (constraint_name) => ({
          table_name: 'Element',
          constraint_name,
          constraint_type: 'c',
          is_validated: true,
          definition: 'allowlisted schema definition',
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
      indexesReady: true,
      constraintsValidated: true,
      staleVersionsClear: true,
      noWaitingLocks: true,
    })
    expect(
      evaluateImportExportInspection({
        ...inspection,
        locks: [{ ...inspection.locks[0]!, granted: false }],
      }).noWaitingLocks
    ).toBe(false)
  })
})
