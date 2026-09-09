import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  runFingerprintBackfill,
  runMediaHashBackfill,
} from '../src/lib/importExportOperations/backfill.js'
import type { OperationsPrisma } from '../src/lib/importExportOperations/database.js'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
} from '../src/services/importExportFingerprintMaintenance.js'

const operationMocks = vi.hoisted(() => ({
  withAdvisoryLock: vi.fn(),
}))

vi.mock('../src/lib/importExportOperations/database.js', async () => {
  const actual = await vi.importActual<
    typeof import('../src/lib/importExportOperations/database.js')
  >('../src/lib/importExportOperations/database.js')
  return {
    ...actual,
    withAdvisoryLock: operationMocks.withAdvisoryLock,
  }
})

vi.mock('../src/services/importExportFingerprintMaintenance.js', () => ({
  backfillFingerprintBatch: vi.fn(),
  backfillMediaHashBatch: vi.fn(),
}))

const tempDirectories: string[] = []
const DATABASE_IDENTITY_ROW = {
  databaseName: 'klicker-test',
  serverAddress: '127.0.0.1',
  serverPort: 5432,
}
const DATABASE_IDENTITY = createHash('sha256')
  .update(
    JSON.stringify([
      DATABASE_IDENTITY_ROW.databaseName,
      DATABASE_IDENTITY_ROW.serverAddress,
      DATABASE_IDENTITY_ROW.serverPort,
    ])
  )
  .digest('hex')

async function createTempDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'klicker-backfill-'))
  tempDirectories.push(directory)
  return directory
}

function createLockedPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValueOnce([DATABASE_IDENTITY_ROW]),
  } as unknown as OperationsPrisma
}

function operationEnv(
  progressPath: string,
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    IMPORT_EXPORT_ENVIRONMENT: 'stg',
    IMPORT_EXPORT_PROGRESS_MANIFEST_PATH: progressPath,
    IMPORT_EXPORT_BACKFILL_MAX_BATCHES: '1',
    ...overrides,
  }
}

beforeEach(() => {
  operationMocks.withAdvisoryLock.mockReset()
  operationMocks.withAdvisoryLock.mockImplementation(
    async ({
      run,
    }: {
      run: (assertLockHeld: () => void) => Promise<unknown>
    }) => await run(() => undefined)
  )
  vi.mocked(backfillFingerprintBatch).mockReset()
  vi.mocked(backfillMediaHashBatch).mockReset()
})

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('import/export backfill progress', () => {
  it('persists and resumes a bounded didactic-v2 cursor', async () => {
    const directory = await createTempDirectory()
    const progressPath = join(directory, 'fingerprint.json')
    const env = operationEnv(progressPath)
    vi.mocked(backfillFingerprintBatch)
      .mockResolvedValueOnce({ processed: 100, nextAfterId: 101 })
      .mockResolvedValueOnce({ processed: 0 })

    await expect(
      runFingerprintBackfill({ prisma: createLockedPrisma(), env })
    ).resolves.toMatchObject({
      outcome: 'incomplete',
      code: 'BACKFILL_BOUNDED_STOP',
    })

    const firstManifest = JSON.parse(await readFile(progressPath, 'utf8'))
    expect(firstManifest).toMatchObject({
      schemaVersion: 2,
      target: 'normal',
      databaseIdentity: DATABASE_IDENTITY,
      fingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      stage: 'ANSWER_COLLECTION',
      resumeAfterId: 101,
      complete: false,
    })

    await expect(
      runFingerprintBackfill({
        prisma: createLockedPrisma(),
        env: operationEnv(progressPath, {
          IMPORT_EXPORT_RESUME_MANIFEST_PATH: progressPath,
        }),
      })
    ).resolves.toMatchObject({ outcome: 'incomplete' })
    expect(backfillFingerprintBatch).toHaveBeenLastCalledWith(
      { resource: 'ANSWER_COLLECTION', afterId: 101 },
      expect.anything(),
      expect.any(Function)
    )
  })

  it('rejects a completed v1 progress manifest instead of skipping v2', async () => {
    const directory = await createTempDirectory()
    const progressPath = join(directory, 'fingerprint.json')
    await writeFile(
      progressPath,
      `${JSON.stringify({
        schemaVersion: 1,
        operation: 'import-export-fingerprint-backfill',
        environment: 'stg',
        target: 'normal',
        stage: 'COMPLETE',
        resumeAfterId: null,
        processed: 10,
        batches: 2,
        complete: true,
      })}\n`
    )

    await expect(
      runFingerprintBackfill({
        prisma: createLockedPrisma(),
        env: operationEnv(progressPath, {
          IMPORT_EXPORT_RESUME_MANIFEST_PATH: progressPath,
        }),
      })
    ).rejects.toMatchObject({ code: 'PROGRESS_MANIFEST_INVALID' })
    expect(backfillFingerprintBatch).not.toHaveBeenCalled()
  })

  it('rejects resume state created for a different database endpoint', async () => {
    const directory = await createTempDirectory()
    const progressPath = join(directory, 'fingerprint.json')
    await writeFile(
      progressPath,
      `${JSON.stringify({
        schemaVersion: 2,
        operation: 'import-export-fingerprint-backfill',
        environment: 'stg',
        target: 'normal',
        databaseIdentity: 'f'.repeat(64),
        fingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
        stage: 'ELEMENT',
        resumeAfterId: 100,
        processed: 100,
        batches: 1,
        complete: false,
      })}\n`
    )

    await expect(
      runFingerprintBackfill({
        prisma: createLockedPrisma(),
        env: operationEnv(progressPath, {
          IMPORT_EXPORT_RESUME_MANIFEST_PATH: progressPath,
        }),
      })
    ).rejects.toMatchObject({ code: 'PROGRESS_MANIFEST_INVALID' })
    expect(backfillFingerprintBatch).not.toHaveBeenCalled()
  })

  it('rescans from the lowest IDs after completed evidence', async () => {
    const directory = await createTempDirectory()
    const progressPath = join(directory, 'fingerprint.json')
    await writeFile(
      progressPath,
      `${JSON.stringify({
        schemaVersion: 2,
        operation: 'import-export-fingerprint-backfill',
        environment: 'stg',
        target: 'normal',
        databaseIdentity: DATABASE_IDENTITY,
        fingerprintVersion: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
        stage: 'COMPLETE',
        resumeAfterId: null,
        processed: 10,
        batches: 2,
        complete: true,
      })}\n`
    )
    vi.mocked(backfillFingerprintBatch)
      .mockResolvedValueOnce({ processed: 0 })
      .mockResolvedValueOnce({ processed: 0 })

    await expect(
      runFingerprintBackfill({
        prisma: createLockedPrisma(),
        env: operationEnv(progressPath, {
          IMPORT_EXPORT_RESUME_MANIFEST_PATH: progressPath,
          IMPORT_EXPORT_BACKFILL_MAX_BATCHES: '2',
        }),
      })
    ).resolves.toMatchObject({ outcome: 'success' })
    expect(vi.mocked(backfillFingerprintBatch).mock.calls).toEqual([
      [
        { resource: 'ANSWER_COLLECTION', afterId: undefined },
        expect.anything(),
        expect.any(Function),
      ],
      [
        { resource: 'ELEMENT', afterId: undefined },
        expect.anything(),
        expect.any(Function),
      ],
    ])
  })

  it('records the independent media-classification version', async () => {
    const directory = await createTempDirectory()
    const progressPath = join(directory, 'media.json')
    vi.mocked(backfillMediaHashBatch).mockResolvedValueOnce({ processed: 0 })

    await expect(
      runMediaHashBackfill({
        prisma: createLockedPrisma(),
        env: operationEnv(progressPath),
      })
    ).resolves.toMatchObject({ outcome: 'success' })

    await expect(readFile(progressPath, 'utf8')).resolves.toContain(
      `"fingerprintVersion": ${IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION}`
    )
  })
})
