// Backfill cursors are persisted outside logs in protected manifests.
import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
} from '../../services/importExportFingerprintMaintenance.js'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../importExportFingerprintCanonicalization.js'
import {
  createOperationsPrisma,
  getOperationsDatabaseIdentity,
  withAdvisoryLock,
  type OperationsPrisma,
} from './database.js'
import {
  ImportExportOperationError,
  createOperationOutput,
  parseBoundedInteger,
  parseDatabaseTarget,
  parseOperationEnvironment,
  requireMasterGateOff,
  writeProtectedJson,
} from './runtime.js'

const BackfillProgressManifestSchema = z
  .object({
    schemaVersion: z.literal(2),
    operation: z.enum([
      'import-export-media-hash-backfill',
      'import-export-fingerprint-backfill',
    ]),
    environment: z.enum(['stg', 'prd']),
    target: z.literal('normal'),
    databaseIdentity: z.string().regex(/^[a-f0-9]{64}$/),
    fingerprintVersion: z.number().int().positive(),
    stage: z.enum(['MEDIA', 'ANSWER_COLLECTION', 'ELEMENT', 'COMPLETE']),
    resumeAfterId: z
      .union([z.string().min(1), z.number().int().positive()])
      .nullable(),
    processed: z.number().int().nonnegative(),
    batches: z.number().int().nonnegative(),
    complete: z.boolean(),
  })
  .strict()

type BackfillProgressManifest = z.infer<typeof BackfillProgressManifestSchema>

const MAX_PROGRESS_MANIFEST_BYTES = 64 * 1024

async function readProgressManifest(
  path: string | undefined,
  expected: Pick<
    BackfillProgressManifest,
    | 'operation'
    | 'environment'
    | 'target'
    | 'databaseIdentity'
    | 'fingerprintVersion'
  >
) {
  if (!path) return undefined
  try {
    const details = await stat(path)
    if (!details.isFile() || details.size > MAX_PROGRESS_MANIFEST_BYTES) {
      throw new Error('invalid')
    }
    const manifest = BackfillProgressManifestSchema.parse(
      JSON.parse(await readFile(path, 'utf8'))
    )
    if (
      manifest.operation !== expected.operation ||
      manifest.environment !== expected.environment ||
      manifest.target !== expected.target ||
      manifest.databaseIdentity !== expected.databaseIdentity ||
      manifest.fingerprintVersion !== expected.fingerprintVersion
    ) {
      throw new Error('mismatch')
    }
    return manifest
  } catch {
    throw new ImportExportOperationError('PROGRESS_MANIFEST_INVALID')
  }
}

async function persistProgress(
  path: string,
  progress: BackfillProgressManifest
) {
  await writeProtectedJson(path, BackfillProgressManifestSchema.parse(progress))
}

function operationContext(
  operation: BackfillProgressManifest['operation'],
  env: NodeJS.ProcessEnv,
  databaseIdentity: string
) {
  return {
    operation,
    environment: parseOperationEnvironment(env),
    target: parseDatabaseTarget(env),
    databaseIdentity,
    fingerprintVersion:
      operation === 'import-export-media-hash-backfill'
        ? IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION
        : IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  } as const
}

function progressPath(env: NodeJS.ProcessEnv) {
  const path = env.IMPORT_EXPORT_PROGRESS_MANIFEST_PATH
  if (!path) {
    throw new ImportExportOperationError('PROGRESS_MANIFEST_PATH_REQUIRED')
  }
  return path
}

export async function runMediaHashBackfill({
  prisma,
  env = process.env,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
}) {
  requireMasterGateOff(env)
  const context = operationContext(
    'import-export-media-hash-backfill',
    env,
    await getOperationsDatabaseIdentity(prisma)
  )
  const outputPath = progressPath(env)
  const existing = await readProgressManifest(
    env.IMPORT_EXPORT_RESUME_MANIFEST_PATH,
    context
  )
  const maximumBatches = parseBoundedInteger({
    name: 'IMPORT_EXPORT_BACKFILL_MAX_BATCHES',
    defaultValue: 100,
    minimum: 1,
    maximum: 1000,
    env,
  })

  return await withAdvisoryLock({
    prisma,
    run: async (assertLockHeld) => {
      let afterId =
        existing?.complete !== true &&
        existing?.stage === 'MEDIA' &&
        typeof existing.resumeAfterId === 'string'
          ? existing.resumeAfterId
          : undefined
      let processed = existing?.complete ? 0 : (existing?.processed ?? 0)
      let batches = existing?.complete ? 0 : (existing?.batches ?? 0)
      // A completed manifest is evidence of a previous pass, not permission to
      // skip a later repair run after invariant verification found new drift.
      let complete = false
      let batchesThisRun = 0

      while (!complete && batchesThisRun < maximumBatches) {
        assertLockHeld()
        const result = await backfillMediaHashBatch(
          { afterId },
          prisma,
          assertLockHeld
        )
        processed += result.processed
        batches++
        batchesThisRun++
        afterId = result.nextAfterId
        complete = typeof afterId === 'undefined'
        await persistProgress(outputPath, {
          schemaVersion: 2,
          ...context,
          stage: complete ? 'COMPLETE' : 'MEDIA',
          resumeAfterId: afterId ?? null,
          processed,
          batches,
          complete,
        })
        assertLockHeld()
      }

      return createOperationOutput(
        context.operation,
        {
          outcome: complete ? 'success' : 'incomplete',
          code: complete ? 'BACKFILL_COMPLETE' : 'BACKFILL_BOUNDED_STOP',
          counts: { processed, batches, batchesThisRun },
          checks: {
            advisoryLockHeld: true,
            progressManifestWritten: true,
            complete,
          },
        },
        env
      )
    },
  })
}

export async function runFingerprintBackfill({
  prisma,
  env = process.env,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
}) {
  requireMasterGateOff(env)
  const context = operationContext(
    'import-export-fingerprint-backfill',
    env,
    await getOperationsDatabaseIdentity(prisma)
  )
  const outputPath = progressPath(env)
  const existing = await readProgressManifest(
    env.IMPORT_EXPORT_RESUME_MANIFEST_PATH,
    context
  )
  const maximumBatches = parseBoundedInteger({
    name: 'IMPORT_EXPORT_BACKFILL_MAX_BATCHES',
    defaultValue: 100,
    minimum: 1,
    maximum: 1000,
    env,
  })

  return await withAdvisoryLock({
    prisma,
    run: async (assertLockHeld) => {
      let stage: 'ANSWER_COLLECTION' | 'ELEMENT' | 'COMPLETE' =
        existing?.complete !== true && existing?.stage === 'ELEMENT'
          ? 'ELEMENT'
          : 'ANSWER_COLLECTION'
      let afterId =
        existing &&
        existing.stage === stage &&
        typeof existing.resumeAfterId === 'number'
          ? existing.resumeAfterId
          : undefined
      let processed = existing?.complete ? 0 : (existing?.processed ?? 0)
      let batches = existing?.complete ? 0 : (existing?.batches ?? 0)
      let batchesThisRun = 0

      while (stage !== 'COMPLETE' && batchesThisRun < maximumBatches) {
        assertLockHeld()
        const result = await backfillFingerprintBatch(
          {
            resource: stage,
            afterId,
          },
          prisma,
          assertLockHeld
        )
        processed += result.processed
        batches++
        batchesThisRun++
        afterId = result.nextAfterId
        if (typeof afterId === 'undefined') {
          stage = stage === 'ANSWER_COLLECTION' ? 'ELEMENT' : 'COMPLETE'
        }
        await persistProgress(outputPath, {
          schemaVersion: 2,
          ...context,
          stage,
          resumeAfterId: afterId ?? null,
          processed,
          batches,
          complete: stage === 'COMPLETE',
        })
        assertLockHeld()
      }

      const complete = stage === 'COMPLETE'
      return createOperationOutput(
        context.operation,
        {
          outcome: complete ? 'success' : 'incomplete',
          code: complete ? 'BACKFILL_COMPLETE' : 'BACKFILL_BOUNDED_STOP',
          counts: { processed, batches, batchesThisRun },
          checks: {
            advisoryLockHeld: true,
            progressManifestWritten: true,
            complete,
          },
        },
        env
      )
    },
  })
}

export async function runBackfillCli(
  kind: 'media' | 'fingerprint',
  env: NodeJS.ProcessEnv = process.env
) {
  const prisma = createOperationsPrisma(env)
  try {
    return kind === 'media'
      ? await runMediaHashBackfill({ prisma, env })
      : await runFingerprintBackfill({ prisma, env })
  } finally {
    await prisma.$disconnect()
  }
}
