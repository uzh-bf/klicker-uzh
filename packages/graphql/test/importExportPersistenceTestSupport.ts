import { prisma } from '@klicker-uzh/prisma'
import {
  ImportExportPackageArtifactDirection,
  ImportMediaStagingState,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'

export const TEST_RUN_ID = randomUUID()
export const TEST_EMAIL_PREFIX = `import-export-persistence-${TEST_RUN_ID}`
export const HASH_A = 'a'.repeat(64)
export const HASH_B = 'b'.repeat(64)
export const MINUTE_MS = 60_000

export let testSequence = 0
export let ownerId: string
export let testNow: Date

export function atOffset(milliseconds: number) {
  return new Date(testNow.getTime() + milliseconds)
}

export async function createTestOwner(label = 'owner') {
  const suffix = `${testSequence}-${label}-${randomUUID()}`
  return await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}-${suffix}@example.invalid`,
      shortname: `iep-${suffix}`,
    },
  })
}

export async function cleanupTestOwners() {
  const owners = await prisma.user.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  })
  const ownerIds = owners.map(({ id }) => id)

  if (ownerIds.length === 0) return

  await prisma.importMediaStaging.deleteMany({
    where: { ownerId: { in: ownerIds } },
  })
  await prisma.elementImportReceipt.deleteMany({
    where: { ownerId: { in: ownerIds } },
  })
  await prisma.importExportPackageArtifact.deleteMany({
    where: { ownerId: { in: ownerIds } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: ownerIds } },
  })
}

export async function createArtifact({
  artifactOwnerId = ownerId,
  storageContainer = `test-${TEST_RUN_ID}`,
  storageBlob = `${testSequence}/${randomUUID()}.zip`,
  expiresAt = atOffset(10 * MINUTE_MS),
}: {
  artifactOwnerId?: string
  storageContainer?: string
  storageBlob?: string
  expiresAt?: Date
} = {}) {
  return await prisma.importExportPackageArtifact.create({
    data: {
      ownerId: artifactOwnerId,
      direction: ImportExportPackageArtifactDirection.IMPORT,
      storageContainer,
      storageBlob,
      reservedBytes: 1,
      expiresAt,
    },
  })
}

export async function createPendingReceipt({
  artifactId,
  receiptOwnerId = ownerId,
  jti = randomUUID(),
  leaseId = randomUUID(),
  leaseExpiresAt = atOffset(10 * MINUTE_MS),
}: {
  artifactId: string
  receiptOwnerId?: string
  jti?: string
  leaseId?: string
  leaseExpiresAt?: Date
}) {
  return await prisma.elementImportReceipt.create({
    data: {
      jti,
      sourceArtifactId: artifactId,
      artifactRecordId: artifactId,
      packageHash: HASH_A,
      selectionDigest: HASH_B,
      selectedElementRefs: ['element:test'],
      leaseId,
      leaseExpiresAt,
      createdElementIds: [],
      createdAnswerCollectionIds: [],
      ownerId: receiptOwnerId,
    },
  })
}

export async function createMediaStaging({
  receiptId,
  stagingOwnerId = ownerId,
  packageMediaRef = `media/${randomUUID()}.png`,
  storageContainer = `test-${TEST_RUN_ID}`,
  storageBlob = `${testSequence}/${randomUUID()}.png`,
  state = ImportMediaStagingState.RESERVED,
  createdBlob = state !== ImportMediaStagingState.RESERVED,
  expiresAt = atOffset(10 * MINUTE_MS),
  mediaFileId,
  operationId = randomUUID(),
}: {
  receiptId: string
  stagingOwnerId?: string
  packageMediaRef?: string
  storageContainer?: string
  storageBlob?: string
  state?: ImportMediaStagingState
  createdBlob?: boolean
  expiresAt?: Date
  mediaFileId?: string
  operationId?: string
}) {
  return await prisma.importMediaStaging.create({
    data: {
      operationId,
      receiptId,
      ownerId: stagingOwnerId,
      packageMediaRef,
      contentHash: HASH_A,
      storageContainer,
      storageBlob,
      state,
      createdBlob,
      expiresAt,
      mediaFileId,
    },
  })
}

export async function expectDatabaseCheckFailure(operation: Promise<unknown>) {
  let error: unknown

  try {
    await operation
  } catch (caughtError) {
    error = caughtError
  }

  expect(error).toBeDefined()
  expect(String((error as { message?: unknown }).message)).toMatch(
    /check|constraint|violates|mismatch|immutable/i
  )
}

export async function waitForBlockedTransactionLock() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [result] = await prisma.$queryRaw<Array<{ blocked: bigint }>>`
      SELECT COUNT(*)::bigint AS blocked
      FROM pg_locks
      WHERE locktype = 'transactionid'
        AND NOT granted
    `

    if (Number(result?.blocked ?? 0) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(
    'staging insert did not block on the media ownership transfer'
  )
}

export async function beginPersistenceTest() {
  testSequence += 1
  testNow = new Date()
  ownerId = (await createTestOwner()).id
}

export async function assertExpectedImportExportPersistenceIndexes() {
  const rows = await prisma.$queryRaw<
    Array<{
      indexname: string
      definition: string
      indisready: boolean
      indisvalid: boolean
    }>
  >`
      SELECT index_rel.relname::text AS indexname,
             pg_get_indexdef(index_state.indexrelid)::text AS definition,
             index_state.indisready,
             index_state.indisvalid
      FROM pg_index index_state
      JOIN pg_class index_rel ON index_rel.oid = index_state.indexrelid
      JOIN pg_class table_rel ON table_rel.oid = index_state.indrelid
      JOIN pg_namespace namespace ON namespace.oid = table_rel.relnamespace
      WHERE namespace.nspname = current_schema()
        AND table_rel.relname IN (
          'Element',
          'AnswerCollection',
          'MediaFile',
          'ImportExportPackageArtifact',
          'ElementImportReceipt',
          'ImportMediaStaging'
        )
    `
  const indexes = new Map(rows.map((row) => [row.indexname, row]))
  const expectedIndexes = [
    'Element_ownerId_importFingerprint_idx',
    'Element_owner_fpv_fp_idx',
    'Element_owner_fpv_fp_id_idx',
    'AnswerCollection_ownerId_importFingerprint_idx',
    'AnswerCollection_owner_fpv_fp_idx',
    'AnswerCollection_owner_fpv_fp_id_idx',
    'MediaFile_import_fpv_id_idx',
    'PackageArtifact_owner_expiry_idx',
    'PackageArtifact_expiry_idx',
    'PackageArtifact_state_expiry_idx',
    'PackageArtifact_storage_target_key',
    'ElementImportReceipt_jti_key',
    'ElementImportReceipt_artifact_record_idx',
    'ElementImportReceipt_owner_idx',
    'ElementImportReceipt_state_lease_idx',
    'ElementImportReceipt_state_retention_idx',
    'ImportMediaStaging_operation_idx',
    'ImportMediaStaging_state_expiry_idx',
    'ImportMediaStaging_owner_expiry_idx',
    'ImportMediaStaging_media_file_idx',
    'ImportMediaStaging_receipt_ref_key',
    'ImportMediaStaging_storage_target_key',
  ]

  for (const expectedIndex of expectedIndexes) {
    const index = indexes.get(expectedIndex)
    expect(index, `missing PostgreSQL index ${expectedIndex}`).toBeDefined()
    expect(index).toMatchObject({ indisready: true, indisvalid: true })
  }

  const expectedDefinitions = {
    Element_owner_fpv_fp_idx:
      'ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")',
    Element_owner_fpv_fp_id_idx:
      'ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)',
    AnswerCollection_owner_fpv_fp_idx:
      'ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")',
    AnswerCollection_owner_fpv_fp_id_idx:
      'ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)',
    MediaFile_import_fpv_id_idx:
      'ON public."MediaFile" USING btree ("importFingerprintVersion", id)',
    PackageArtifact_owner_expiry_idx:
      'ON public."ImportExportPackageArtifact" USING btree ("ownerId", "expiresAt")',
    PackageArtifact_expiry_idx:
      'ON public."ImportExportPackageArtifact" USING btree ("expiresAt")',
    PackageArtifact_state_expiry_idx:
      'ON public."ImportExportPackageArtifact" USING btree (state, "expiresAt")',
    ElementImportReceipt_state_lease_idx:
      'ON public."ElementImportReceipt" USING btree (state, "leaseExpiresAt")',
    ElementImportReceipt_state_retention_idx:
      'ON public."ElementImportReceipt" USING btree (state, "retentionExpiresAt")',
    ImportMediaStaging_state_expiry_idx:
      'ON public."ImportMediaStaging" USING btree (state, "expiresAt")',
    ImportMediaStaging_owner_expiry_idx:
      'ON public."ImportMediaStaging" USING btree ("ownerId", "expiresAt")',
  } as const

  for (const [indexName, definition] of Object.entries(expectedDefinitions)) {
    expect(indexes.get(indexName)?.definition).toContain(definition)
  }
}
