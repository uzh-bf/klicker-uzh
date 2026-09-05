import {
  ElementImportReceiptState,
  ImportMediaStagingState,
} from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  assertElementImportTokenUnexpired,
  type ElementImportTokenPayload,
} from '../lib/elementImportToken.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
  ImportExportWarningCode,
} from '../lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_ELEMENTS } from '../lib/importExportPackageConfig.js'
import { packageRefSchema } from '../lib/importExportPackageContract.js'
import {
  claimExpiredElementImportReceiptLease,
  findElementImportReceiptByJti,
  isElementImportReceiptJtiUniqueConflict,
  pinReadyImportArtifactAndCreateReceipt,
  renewElementImportReceiptLease,
} from './importExportPersistence.js'

const IMPORT_RECEIPT_LEASE_MS = 5 * 60 * 1000

export type DurableImportExecution = {
  receiptId: string
  leaseId: string
}

export type RenewableDurableImportExecution = DurableImportExecution & {
  leaseExpiresAt: Date
}

export type DurableImportLeaseGuard = {
  assertLease: () => void
  renewNow: () => Promise<void>
}

type ElementImportReceiptRecord = NonNullable<
  Awaited<ReturnType<typeof findElementImportReceiptByJti>>
>

function createSelectionDigest(selectedElementRefs: readonly string[]) {
  return createHash('sha256')
    .update(JSON.stringify(selectedElementRefs))
    .digest('hex')
}

export function prepareElementImportSelection(selectedElementRefs: string[]) {
  const normalizedSelectedElementRefs = Array.from(
    new Set(selectedElementRefs)
  ).sort()
  if (
    normalizedSelectedElementRefs.length === 0 ||
    normalizedSelectedElementRefs.length > MAX_IMPORT_EXPORT_ELEMENTS ||
    normalizedSelectedElementRefs.some(
      (ref) => !packageRefSchema.safeParse(ref).success
    )
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.INVALID_SELECTION)
  }

  return {
    selectedElementRefs: normalizedSelectedElementRefs,
    selectionDigest: createSelectionDigest(normalizedSelectedElementRefs),
  }
}

function readReceiptStringArray(value: unknown) {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string')
    ? value
    : null
}

function readReceiptIdArray(value: unknown) {
  return Array.isArray(value) &&
    value.every((entry) => Number.isSafeInteger(entry) && Number(entry) > 0)
    ? (value as number[])
    : null
}

function assertMatchingImportReceipt(
  receipt: ElementImportReceiptRecord,
  token: ElementImportTokenPayload,
  selectedElementRefs: readonly string[],
  selectionDigest: string
) {
  const receiptRefs = readReceiptStringArray(receipt.selectedElementRefs)
  if (
    receipt.ownerId !== token.userId ||
    receipt.sourceArtifactId !== token.artifactId ||
    receipt.packageHash !== token.packageHash ||
    receipt.selectionDigest !== selectionDigest ||
    !receiptRefs ||
    JSON.stringify(receiptRefs) !== JSON.stringify(selectedElementRefs)
  ) {
    throw new ImportExportDomainError(ImportExportErrorCode.REPLAY_MISMATCH)
  }
}

function getCompletedImportReceiptResult(receipt: ElementImportReceiptRecord) {
  const createdElementIds = readReceiptIdArray(receipt.createdElementIds)
  const createdAnswerCollectionIds = readReceiptIdArray(
    receipt.createdAnswerCollectionIds
  )
  if (!createdElementIds || !createdAnswerCollectionIds) {
    throw new ImportExportDomainError(
      ImportExportErrorCode.INFRASTRUCTURE_FAILURE
    )
  }

  return {
    importedElements: createdElementIds.length,
    importedAnswerCollections: createdAnswerCollectionIds.length,
    skippedElements: receipt.skippedElementRefs?.length ?? 0,
  }
}

function getMatchingCompletedImportReceipt(
  receipt: ElementImportReceiptRecord | null,
  token: ElementImportTokenPayload,
  selectedElementRefs: readonly string[],
  selectionDigest: string
) {
  if (!receipt) return null

  assertMatchingImportReceipt(
    receipt,
    token,
    selectedElementRefs,
    selectionDigest
  )
  if (receipt.state !== ElementImportReceiptState.COMPLETE) return null

  return {
    replay: getCompletedImportReceiptResult(receipt),
    receiptId: receipt.id,
  }
}

function createFencedImportError() {
  return new ImportExportDomainError(ImportExportErrorCode.IMPORT_IN_PROGRESS)
}

export async function findCompletedElementImportExecution({
  token,
  selectedElementRefs,
  selectionDigest,
  ctx,
}: {
  token: ElementImportTokenPayload
  selectedElementRefs: string[]
  selectionDigest: string
  ctx: ContextWithUser
}) {
  const receipt = await findElementImportReceiptByJti({
    prisma: ctx.prisma,
    jti: token.jti,
  })

  return getMatchingCompletedImportReceipt(
    receipt,
    token,
    selectedElementRefs,
    selectionDigest
  )
}

export async function withElementImportReceiptHeartbeat<T>({
  execution,
  ctx,
  callback,
}: {
  execution: RenewableDurableImportExecution
  ctx: ContextWithUser
  callback: (guard: DurableImportLeaseGuard) => Promise<T>
}) {
  let leaseDeadline = execution.leaseExpiresAt.getTime()
  let leaseLost = false
  const renewalState: { inFlight: Promise<void> | null } = { inFlight: null }

  const assertLease = () => {
    if (leaseLost || Date.now() >= leaseDeadline) {
      leaseLost = true
      throw createFencedImportError()
    }
  }

  const beginRenewal = () => {
    if (renewalState.inFlight) return renewalState.inFlight

    const renewedAt = new Date()
    const nextDeadline = renewedAt.getTime() + IMPORT_RECEIPT_LEASE_MS
    let renewal: Promise<void>
    renewal = renewElementImportReceiptLease({
      prisma: ctx.prisma,
      receiptId: execution.receiptId,
      ownerId: ctx.user.sub,
      leaseId: execution.leaseId,
      leaseExpiresAt: new Date(nextDeadline),
      now: renewedAt,
    })
      .then((renewed) => {
        if (!renewed) {
          leaseLost = true
          throw createFencedImportError()
        }
        leaseDeadline = Math.max(leaseDeadline, nextDeadline)
      })
      .catch((error: unknown) => {
        if (Date.now() >= leaseDeadline) leaseLost = true
        throw error
      })
      .finally(() => {
        if (renewalState.inFlight === renewal) renewalState.inFlight = null
      })
    renewalState.inFlight = renewal
    return renewal
  }

  const renewNow = async () => {
    assertLease()
    try {
      await beginRenewal()
    } catch {
      leaseLost = true
      throw createFencedImportError()
    }
    assertLease()
  }

  const renewalInterval = setInterval(
    () => {
      if (leaseLost || renewalState.inFlight) return
      void beginRenewal().catch(() => {
        if (Date.now() >= leaseDeadline) leaseLost = true
      })
    },
    Math.max(1_000, Math.floor(IMPORT_RECEIPT_LEASE_MS / 3))
  )
  renewalInterval.unref?.()

  try {
    assertLease()
    return await callback({ assertLease, renewNow })
  } finally {
    clearInterval(renewalInterval)
    if (renewalState.inFlight) {
      await renewalState.inFlight.catch(() => undefined)
    }
  }
}

export async function getElementImportResultWarnings(
  receiptId: string,
  ctx: ContextWithUser
) {
  try {
    const cleanupPending = await ctx.prisma.importMediaStaging.count({
      where: {
        receiptId,
        state: ImportMediaStagingState.CLEANUP_PENDING,
      },
    })
    return cleanupPending > 0 ? [ImportExportWarningCode.CLEANUP_PENDING] : []
  } catch {
    // Receipt completion is the import commit point. A best-effort warning
    // lookup must never turn committed work (or its replay) into a failure.
    console.error('[ImportExportPackage] Cleanup warning lookup failed')
    return [ImportExportWarningCode.CLEANUP_PENDING]
  }
}

export async function acquireElementImportExecution({
  token,
  selectedElementRefs,
  selectionDigest,
  ctx,
}: {
  token: ElementImportTokenPayload
  selectedElementRefs: string[]
  selectionDigest: string
  ctx: ContextWithUser
}): Promise<
  | {
      replay: ReturnType<typeof getCompletedImportReceiptResult>
      receiptId: string
    }
  | { execution: RenewableDurableImportExecution }
> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date()
    const receipt = await findElementImportReceiptByJti({
      prisma: ctx.prisma,
      jti: token.jti,
    })

    if (receipt) {
      const completed = getMatchingCompletedImportReceipt(
        receipt,
        token,
        selectedElementRefs,
        selectionDigest
      )
      if (completed) return completed

      assertElementImportTokenUnexpired(token, now.getTime())
      if (receipt.leaseExpiresAt && receipt.leaseExpiresAt > now) {
        throw new ImportExportDomainError(
          ImportExportErrorCode.IMPORT_IN_PROGRESS
        )
      }

      const leaseId = randomUUID()
      const leaseExpiresAt = new Date(now.getTime() + IMPORT_RECEIPT_LEASE_MS)
      const claimed = await claimExpiredElementImportReceiptLease({
        prisma: ctx.prisma,
        receiptId: receipt.id,
        leaseId,
        leaseExpiresAt,
        now,
      })
      if (claimed) {
        return {
          execution: { receiptId: receipt.id, leaseId, leaseExpiresAt },
        }
      }
      continue
    }

    assertElementImportTokenUnexpired(token, now.getTime())
    const leaseId = randomUUID()
    const leaseExpiresAt = new Date(now.getTime() + IMPORT_RECEIPT_LEASE_MS)
    try {
      const created = await pinReadyImportArtifactAndCreateReceipt({
        prisma: ctx.prisma,
        artifactId: token.artifactId,
        jti: token.jti,
        packageHash: token.packageHash,
        selectionDigest,
        selectedElementRefs,
        leaseId,
        leaseExpiresAt,
        ownerId: token.userId,
        now,
      })
      return {
        execution: { receiptId: created.id, leaseId, leaseExpiresAt },
      }
    } catch (error) {
      if (!isElementImportReceiptJtiUniqueConflict(error)) throw error
    }
  }

  throw new ImportExportDomainError(ImportExportErrorCode.IMPORT_IN_PROGRESS)
}
