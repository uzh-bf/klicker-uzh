// Recovery checks are exact-record and owner scoped.
import {
  createOperationsPrisma,
  getOperationsDatabaseIdentity,
  type OperationsPrisma,
} from './database.js'
import {
  ImportExportOperationError,
  createOperationOutput,
  getImportExportStorageIdentity,
  parseDatabaseTarget,
  parseOperationEnvironment,
  readRecoveryManifest,
  requireMasterGateOff,
  writeRecoveryManifest,
  type ImportExportRecoveryManifest,
} from './runtime.js'

type ExactScopeCounts = Readonly<{
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

async function countExactRecoveryScope({
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

function recoveryManifestPath(env: NodeJS.ProcessEnv) {
  const path = env.IMPORT_EXPORT_RECOVERY_MANIFEST_PATH
  if (!path) {
    throw new ImportExportOperationError('RECOVERY_MANIFEST_PATH_REQUIRED')
  }
  return path
}

async function assertManifestContext(
  manifest: ImportExportRecoveryManifest,
  env: NodeJS.ProcessEnv,
  prisma: OperationsPrisma
) {
  const databaseIdentity = await getOperationsDatabaseIdentity(prisma)
  const storageIdentity = getImportExportStorageIdentity(env)
  if (
    manifest.environment !== parseOperationEnvironment(env) ||
    manifest.target !== parseDatabaseTarget(env) ||
    manifest.databaseIdentity !== databaseIdentity ||
    manifest.storageIdentity !== storageIdentity
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
  await assertManifestContext(manifest, env, prisma)
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
      schemaVersion: 2,
      environment: parseOperationEnvironment(env),
      target: parseDatabaseTarget(env),
      databaseIdentity: await getOperationsDatabaseIdentity(prisma),
      storageIdentity: getImportExportStorageIdentity(env),
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
  await assertManifestContext(manifest, env, prisma)
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
