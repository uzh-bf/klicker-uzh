// Recovery checks are exact-record and owner scoped.
import {
  countExactRecoveryScope,
  createOperationsPrisma,
  type OperationsPrisma,
} from './database.js'
import {
  ImportExportOperationError,
  createOperationOutput,
  parseDatabaseTarget,
  parseOperationEnvironment,
  readRecoveryManifest,
  requireMasterGateOff,
  writeRecoveryManifest,
  type ImportExportRecoveryManifest,
} from './runtime.js'

function recoveryManifestPath(env: NodeJS.ProcessEnv) {
  const path = env.IMPORT_EXPORT_RECOVERY_MANIFEST_PATH
  if (!path) {
    throw new ImportExportOperationError('RECOVERY_MANIFEST_PATH_REQUIRED')
  }
  return path
}

function assertManifestContext(
  manifest: ImportExportRecoveryManifest,
  env: NodeJS.ProcessEnv
) {
  if (
    manifest.environment !== parseOperationEnvironment(env) ||
    manifest.target !== parseDatabaseTarget(env)
  ) {
    throw new ImportExportOperationError('RECOVERY_MANIFEST_CONTEXT_MISMATCH')
  }
}

export async function runExactCleanupDryRun({
  prisma,
  env = process.env,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
}) {
  requireMasterGateOff(env)
  const path = recoveryManifestPath(env)
  const manifest = await readRecoveryManifest(path)
  assertManifestContext(manifest, env)
  const counts = await countExactRecoveryScope({
    prisma,
    ownerId: manifest.ownerId,
    resources: manifest.resources,
  })
  if (counts.foreignOwnedRecords > 0) {
    throw new ImportExportOperationError('RECOVERY_SCOPE_OWNER_MISMATCH')
  }

  await writeRecoveryManifest(path, {
    ...manifest,
    phase: 'cleanup-reviewed',
  })

  return createOperationOutput(
    'import-export-cleanup-dry-run',
    {
      outcome: 'success',
      code: 'EXACT_CLEANUP_DRY_RUN_COMPLETE',
      counts,
      checks: {
        exactRecordScope: true,
        ownerScopeVerified: true,
        mutationAttempted: false,
        recoveryManifestWritten: true,
      },
    },
    env
  )
}

export async function runCanaryManifestOperation({
  prisma,
  env = process.env,
}: {
  prisma: OperationsPrisma
  env?: NodeJS.ProcessEnv
}) {
  const path = recoveryManifestPath(env)
  const mode = env.IMPORT_EXPORT_CANARY_MODE ?? 'verify-clean'

  if (mode === 'initialize') {
    const ownerId = env.IMPORT_EXPORT_CANARY_OWNER_ID
    if (!ownerId) {
      throw new ImportExportOperationError('CANARY_OWNER_REQUIRED')
    }
    const manifest: ImportExportRecoveryManifest = {
      schemaVersion: 1,
      environment: parseOperationEnvironment(env),
      target: parseDatabaseTarget(env),
      ownerId,
      phase: 'initialized',
      resources: {
        elementIds: [],
        answerCollectionIds: [],
        mediaFileIds: [],
        artifactIds: [],
        receiptIds: [],
        stagingIds: [],
      },
    }
    await writeRecoveryManifest(path, manifest)
    return createOperationOutput(
      'import-export-canary',
      {
        outcome: 'success',
        code: 'CANARY_MANIFEST_INITIALIZED',
        counts: { recordedResources: 0 },
        checks: { recoveryManifestWritten: true },
      },
      env
    )
  }

  if (mode !== 'verify-clean') {
    throw new ImportExportOperationError('CANARY_MODE_INVALID')
  }
  const manifest = await readRecoveryManifest(path)
  assertManifestContext(manifest, env)
  const counts = await countExactRecoveryScope({
    prisma,
    ownerId: manifest.ownerId,
    resources: manifest.resources,
  })
  if (counts.foreignOwnedRecords > 0) {
    throw new ImportExportOperationError('RECOVERY_SCOPE_OWNER_MISMATCH')
  }
  const activeResidue =
    counts.activeElements +
    counts.activeAnswerCollections +
    counts.mediaFiles +
    counts.artifacts +
    counts.stagingRecords
  const clean = activeResidue === 0
  await writeRecoveryManifest(path, {
    ...manifest,
    phase: clean ? 'clean' : 'recovery-required',
  })

  return createOperationOutput(
    'import-export-canary',
    {
      outcome: clean ? 'success' : 'incomplete',
      code: clean ? 'CANARY_SCOPE_CLEAN' : 'CANARY_RECOVERY_REQUIRED',
      counts: {
        activeResidue,
        retainedReceipts: counts.receipts,
        retainedSoftDeletedElements: counts.elements - counts.activeElements,
        retainedSoftDeletedAnswerCollections:
          counts.answerCollections - counts.activeAnswerCollections,
      },
      checks: {
        exactRecordScope: true,
        ownerScopeVerified: true,
        activeDatabaseResidueClear: clean,
        receiptsReportedSeparately: true,
        recoveryManifestWritten: true,
      },
    },
    env
  )
}

export async function runRecoveryCli(
  operation: 'cleanup' | 'canary',
  env: NodeJS.ProcessEnv = process.env
) {
  const prisma = createOperationsPrisma(env)
  try {
    return operation === 'cleanup'
      ? await runExactCleanupDryRun({ prisma, env })
      : await runCanaryManifestOperation({ prisma, env })
  } finally {
    await prisma.$disconnect()
  }
}
