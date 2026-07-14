// Backfill cursors are persisted outside logs in protected manifests.
import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import {
  backfillFingerprintBatch,
  backfillMediaHashBatch,
} from '../../services/importExportFingerprintMaintenance.js'
import {
  createOperationsPrisma,
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
    schemaVersion: z.literal(1),
    operation: z.enum([
      'import-export-media-hash-backfill',
      'import-export-fingerprint-backfill',
    ]),
    environment: z.enum(['stg', 'prd']),
    target: z.enum(['normal', 'assessment']),
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
    'operation' | 'environment' | 'target'
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
      manifest.target !== expected.target
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
  env: NodeJS.ProcessEnv
) {
  return {
    operation,
    environment: parseOperationEnvironment(env),
    target: parseDatabaseTarget(env),
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
  const context = operationContext('import-export-media-hash-backfill', env)
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
    operationKey: 1,
    run: async () => {
      let afterId =
        existing?.stage === 'MEDIA' &&
        typeof existing.resumeAfterId === 'string'
          ? existing.resumeAfterId
          : undefined
      let processed = existing?.processed ?? 0
      let batches = existing?.batches ?? 0
      let complete = existing?.complete ?? false
      let batchesThisRun = 0

      while (!complete && batchesThisRun < maximumBatches) {
        const result = await backfillMediaHashBatch({ afterId }, prisma)
        processed += result.processed
        batches++
        batchesThisRun++
        afterId = result.nextAfterId
        complete = typeof afterId === 'undefined'
        await persistProgress(outputPath, {
          schemaVersion: 1,
          ...context,
          stage: complete ? 'COMPLETE' : 'MEDIA',
          resumeAfterId: afterId ?? null,
          processed,
          batches,
          complete,
        })
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
  const context = operationContext('import-export-fingerprint-backfill', env)
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
    operationKey: 2,
    run: async () => {
      let stage: 'ANSWER_COLLECTION' | 'ELEMENT' | 'COMPLETE' =
        existing?.stage === 'ELEMENT' || existing?.stage === 'COMPLETE'
          ? existing.stage
          : 'ANSWER_COLLECTION'
      let afterId =
        existing &&
        existing.stage === stage &&
        typeof existing.resumeAfterId === 'number'
          ? existing.resumeAfterId
          : undefined
      let processed = existing?.processed ?? 0
      let batches = existing?.batches ?? 0
      let batchesThisRun = 0

      while (stage !== 'COMPLETE' && batchesThisRun < maximumBatches) {
        const result = await backfillFingerprintBatch(
          {
            resource: stage,
            afterId,
          },
          prisma
        )
        processed += result.processed
        batches++
        batchesThisRun++
        afterId = result.nextAfterId
        if (typeof afterId === 'undefined') {
          stage = stage === 'ANSWER_COLLECTION' ? 'ELEMENT' : 'COMPLETE'
        }
        await persistProgress(outputPath, {
          schemaVersion: 1,
          ...context,
          stage,
          resumeAfterId: afterId ?? null,
          processed,
          batches,
          complete: stage === 'COMPLETE',
        })
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
