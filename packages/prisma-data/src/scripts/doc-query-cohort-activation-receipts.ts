import { createHash, randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  assertCohortActivationReentryPreconditions,
  assertCohortActivationReentryRoot,
  assertReceiptMatchesManifest,
  assertReceiptTransition,
  CohortActivationError,
  type CohortActivationManifest,
  type CohortActivationReceipt,
  type CohortActivationReceiptExpectation,
  type CohortActivationReceiptFile,
  type CohortActivationReceiptIntent,
  type CohortActivationReentryLineage,
  type CohortActivationStore,
  makeCohortActivationReentryReceiptIntent,
  prepareCohortActivationReentry,
  receiptExpectation,
  switchCohortActivation,
  validateCohortActivationReceiptIntent,
  validateReceipt,
} from './doc-query-cohort-activation.js'

type ReceiptFile = CohortActivationReceiptFile

export const COHORT_ACTIVATION_REENTRY_CLAIM_VERSION = 1 as const

export type CohortActivationReentryClaim = {
  claimVersion: typeof COHORT_ACTIVATION_REENTRY_CLAIM_VERSION
  predecessorPath: string
  successorPath: string
  predecessorPayloadDigest: string
  claimDigest: string
}

export type CohortActivationReentryPaths = {
  predecessorPath: string
  successorPath: string
  claimPath: string
}

export type CohortActivationReentryHooks = {
  afterClaim?: (claim: CohortActivationReentryClaim) => Promise<void>
  afterIntent?: (intent: CohortActivationReceiptIntent) => Promise<void>
  afterPrepared?: (receipt: CohortActivationReceipt) => Promise<void>
}

export type CohortActivationSessionLock = {
  release: () => Promise<void>
}

async function releaseCohortActivationSessionLocks(
  locks: readonly CohortActivationSessionLock[]
): Promise<void> {
  let failed = false
  let firstError: unknown
  for (const lock of [...locks].reverse()) {
    try {
      await lock.release()
    } catch (error) {
      if (!failed) {
        failed = true
        firstError = error
      }
    }
  }
  if (failed) throw firstError
}

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as T
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)
}

function reentryClaimDigest(
  claim: Omit<CohortActivationReentryClaim, 'claimDigest'>
): string {
  return createHash('sha256').update(JSON.stringify(claim)).digest('hex')
}

export function cohortActivationReentryClaimPath(
  predecessorPath: string
): string {
  return `${resolve(predecessorPath)}.reentry.claim.json`
}

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}

async function inspectReceiptPath(
  path: string,
  role: 'predecessor' | 'successor'
): Promise<{ path: string; exists: boolean }> {
  const absolute = resolve(path)
  const parent = dirname(absolute)
  let parentStat: Stats
  try {
    parentStat = await lstat(parent)
  } catch (error) {
    if (isMissing(error)) {
      throw new CohortActivationError(
        'REENTRY_PATH_INVALID',
        `${role} receipt parent is missing`
      )
    }
    throw error
  }
  if (parentStat.isSymbolicLink()) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      `${role} receipt parent must not be a symlink`
    )
  }
  const canonicalParent = await realpath(parent)
  if (canonicalParent !== parent) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      `${role} receipt parent has symlink ambiguity`
    )
  }

  let entry: Stats | undefined
  try {
    entry = await lstat(absolute)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  if (entry?.isSymbolicLink()) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      `${role} receipt must not be a symlink`
    )
  }
  if (entry && !entry.isFile()) {
    throw new CohortActivationError(
      'REENTRY_PATH_INVALID',
      `${role} receipt path is not a regular file`
    )
  }
  const canonicalPath = entry
    ? await realpath(absolute)
    : join(canonicalParent, basename(absolute))
  if (canonicalPath !== absolute) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      `${role} receipt path has symlink ambiguity`
    )
  }
  return { path: canonicalPath, exists: entry !== undefined }
}

export async function resolveCohortActivationReentryPaths(
  predecessorPath: string,
  successorPath: string
): Promise<CohortActivationReentryPaths> {
  const predecessor = await inspectReceiptPath(predecessorPath, 'predecessor')
  const successor = await inspectReceiptPath(successorPath, 'successor')
  if (!predecessor.exists) {
    throw new CohortActivationError(
      'REENTRY_PREDECESSOR_MISSING',
      're-entry predecessor receipt is missing'
    )
  }
  if (predecessor.path === successor.path) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      're-entry predecessor and successor paths must differ'
    )
  }
  const claimPath = cohortActivationReentryClaimPath(predecessor.path)
  const claim = await inspectReceiptPath(claimPath, 'predecessor')
  if (claim.path === successor.path) {
    throw new CohortActivationError(
      'REENTRY_PATH_AMBIGUOUS',
      're-entry successor cannot be the claim sidecar'
    )
  }
  return {
    predecessorPath: predecessor.path,
    successorPath: successor.path,
    claimPath: claim.path,
  }
}

export function validateCohortActivationReentryClaim(
  claim: unknown,
  expected?: Pick<
    CohortActivationReentryPaths,
    'predecessorPath' | 'successorPath'
  >
): asserts claim is CohortActivationReentryClaim {
  if (
    !claim ||
    typeof claim !== 'object' ||
    Array.isArray(claim) ||
    !('claimVersion' in claim) ||
    !('predecessorPath' in claim) ||
    !('successorPath' in claim) ||
    !('predecessorPayloadDigest' in claim) ||
    !('claimDigest' in claim) ||
    Object.keys(claim).length !== 5 ||
    claim.claimVersion !== COHORT_ACTIVATION_REENTRY_CLAIM_VERSION ||
    typeof claim.predecessorPath !== 'string' ||
    typeof claim.successorPath !== 'string' ||
    !isSha256(claim.predecessorPayloadDigest) ||
    !isSha256(claim.claimDigest)
  ) {
    throw new CohortActivationError(
      'REENTRY_CLAIM_INVALID',
      're-entry claim is malformed'
    )
  }
  const { claimDigest, ...withoutDigest } =
    claim as CohortActivationReentryClaim
  if (reentryClaimDigest(withoutDigest) !== claimDigest) {
    throw new CohortActivationError(
      'REENTRY_CLAIM_INVALID',
      're-entry claim digest does not match'
    )
  }
  if (
    expected &&
    (claim.predecessorPath !== expected.predecessorPath ||
      claim.successorPath !== expected.successorPath)
  ) {
    throw new CohortActivationError(
      'REENTRY_CLAIM_MISMATCH',
      're-entry claim is bound to different receipt paths'
    )
  }
}

async function readReentryClaim(
  claimPath: string,
  expected: Pick<
    CohortActivationReentryPaths,
    'predecessorPath' | 'successorPath'
  >
): Promise<CohortActivationReentryClaim | null> {
  try {
    const claim = await readJsonFile<unknown>(claimPath)
    validateCohortActivationReentryClaim(claim, expected)
    return claim
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

async function syncDirectory(path: string): Promise<void> {
  const directory = await open(path, 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

async function createReentryClaim(
  paths: CohortActivationReentryPaths,
  predecessorPayloadDigest: string
): Promise<CohortActivationReentryClaim> {
  const existing = await readReentryClaim(paths.claimPath, paths)
  if (existing) {
    throw new CohortActivationError(
      'REENTRY_CLAIM_EXISTS',
      're-entry claim already exists'
    )
  }
  const withoutDigest = {
    claimVersion: COHORT_ACTIVATION_REENTRY_CLAIM_VERSION,
    predecessorPath: paths.predecessorPath,
    successorPath: paths.successorPath,
    predecessorPayloadDigest,
  }
  const claim = {
    ...withoutDigest,
    claimDigest: reentryClaimDigest(withoutDigest),
  }
  let file: Awaited<ReturnType<typeof open>> | undefined
  let closed = false
  try {
    file = await open(paths.claimPath, 'wx', 0o600)
    await file.writeFile(`${JSON.stringify(claim)}\n`, 'utf8')
    await file.sync()
    await file.close()
    closed = true
    await syncDirectory(dirname(paths.claimPath))
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
    ) {
      throw new CohortActivationError(
        'REENTRY_CLAIM_EXISTS',
        're-entry claim already exists'
      )
    }
    throw error
  } finally {
    if (file && !closed) await file.close()
  }
  validateCohortActivationReentryClaim(claim, paths)
  return claim
}

function isDatabaseLockError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('database is locked')
  )
}

/**
 * Keep one process-wide lifecycle lock for a receipt path. SQLite releases
 * the exclusive transaction when its owner exits, so crash recovery does not
 * require unlinking a stale path that another contender may already own.
 */
export async function acquireCohortActivationSessionLock(
  receiptPath: string
): Promise<CohortActivationSessionLock> {
  const lockPath = `${receiptPath}.lock.sqlite`
  await mkdir(dirname(receiptPath), { recursive: true })
  let database: DatabaseSync | undefined
  try {
    database = new DatabaseSync(lockPath, { timeout: 0 })
    database.exec('BEGIN EXCLUSIVE')
    let released = false
    return {
      release: async () => {
        if (released) return
        released = true
        try {
          database?.exec('ROLLBACK')
        } finally {
          database?.close()
        }
      },
    }
  } catch (error) {
    try {
      database?.close()
    } catch {
      // The connection may not have opened.
    }
    if (isDatabaseLockError(error)) throw new Error('SESSION_LOCKED')
    throw error
  }
}

export async function acquireCohortActivationReentrySessionLock(
  predecessorPath: string,
  successorPath: string
): Promise<CohortActivationSessionLock> {
  const paths = [predecessorPath, successorPath].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )
  const locks: CohortActivationSessionLock[] = []
  try {
    for (const path of paths) {
      locks.push(await acquireCohortActivationSessionLock(path))
    }
  } catch (error) {
    try {
      await releaseCohortActivationSessionLocks(locks)
    } catch {
      // Preserve the lock-acquisition error after attempting every cleanup.
    }
    throw error
  }
  let releasePromise: Promise<void> | undefined
  return {
    release: () => {
      releasePromise ??= releaseCohortActivationSessionLocks(locks)
      return releasePromise
    },
  }
}

export async function writeReceipt(
  path: string,
  receipt: ReceiptFile,
  expected: CohortActivationReceiptExpectation
): Promise<void> {
  if (receipt.state === 'preparing')
    validateCohortActivationReceiptIntent(receipt)
  else validateReceipt(receipt)
  const current = await readReceipt(path)
  assertReceiptTransition(expected, current, receipt)
  if (current?.payloadDigest === receipt.payloadDigest) return
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  await mkdir(dirname(path), { recursive: true })
  let renamed = false
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(`${JSON.stringify(receipt)}\n`, 'utf8')
      await file.sync()
    } finally {
      await file.close()
    }
    const latest = await readReceipt(path)
    assertReceiptTransition(expected, latest, receipt)
    await rename(temporary, path)
    renamed = true
    const directory = await open(dirname(path), 'r')
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  } finally {
    if (!renamed) {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
    }
  }
}

export async function clearPreparingReceipt(
  path: string,
  expected: NonNullable<CohortActivationReceiptExpectation>
): Promise<void> {
  const current = await readReceipt(path)
  if (current?.reentry) {
    throw new CohortActivationError(
      'REENTRY_NOT_ALLOWED',
      're-entry evidence cannot be cleared'
    )
  }
  if (
    !current ||
    current.state !== 'preparing' ||
    current.manifestFingerprint !== expected.manifestFingerprint ||
    current.payloadDigest !== expected.payloadDigest ||
    current.state !== expected.state ||
    JSON.stringify(receiptExpectation(current)?.inactiveSource) !==
      JSON.stringify(expected.inactiveSource) ||
    JSON.stringify(receiptExpectation(current)?.activeSources) !==
      JSON.stringify(expected.activeSources)
  ) {
    throw new CohortActivationError(
      'RECEIPT_CONCURRENT_WRITE',
      'receipt changed before the preparing intent could be cleared'
    )
  }
  await unlink(path)
  const directory = await open(dirname(path), 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

async function readReceipt(path: string): Promise<ReceiptFile | null> {
  try {
    const receipt = await readJsonFile<ReceiptFile>(path)
    if (receipt.state === 'preparing')
      validateCohortActivationReceiptIntent(receipt)
    else validateReceipt(receipt)
    return receipt
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
}

function isCohortActivationIntent(
  receipt: ReceiptFile
): receipt is CohortActivationReceiptIntent {
  return receipt.state === 'preparing'
}

async function runCohortActivationReentryLocked(
  store: CohortActivationStore,
  manifest: CohortActivationManifest,
  paths: CohortActivationReentryPaths,
  hooks: CohortActivationReentryHooks = {}
): Promise<CohortActivationReceipt> {
  const predecessor = await readReceipt(paths.predecessorPath)
  if (!predecessor || isCohortActivationIntent(predecessor)) {
    throw new CohortActivationError(
      'REENTRY_PREDECESSOR_INVALID',
      're-entry predecessor must be a complete receipt'
    )
  }
  const successor = await readReceipt(paths.successorPath)
  if (successor) {
    throw new CohortActivationError(
      'REENTRY_SUCCESSOR_EXISTS',
      're-entry successor receipt already exists'
    )
  }
  const existingClaim = await readReentryClaim(paths.claimPath, paths)
  if (existingClaim) {
    throw new CohortActivationError(
      'REENTRY_CLAIM_EXISTS',
      're-entry claim already exists'
    )
  }

  assertReceiptMatchesManifest(predecessor, manifest)
  assertCohortActivationReentryRoot(predecessor)
  await assertCohortActivationReentryPreconditions(store, manifest, predecessor)

  const claim = await createReentryClaim(paths, predecessor.payloadDigest)
  await hooks.afterClaim?.(claim)
  const lineage: CohortActivationReentryLineage = {
    predecessorPayloadDigest: predecessor.payloadDigest,
    claimDigest: claim.claimDigest,
  }
  const intent = makeCohortActivationReentryReceiptIntent(
    manifest,
    predecessor,
    lineage
  )
  let expectedReceipt: CohortActivationReceiptExpectation = null
  const persistReceipt = async (receipt: ReceiptFile): Promise<void> => {
    await writeReceipt(paths.successorPath, receipt, expectedReceipt)
    expectedReceipt = receiptExpectation(receipt)
  }
  await persistReceipt(intent)
  await hooks.afterIntent?.(intent)
  const prepared = await prepareCohortActivationReentry(
    store,
    manifest,
    predecessor,
    intent
  )
  await persistReceipt(prepared)
  await hooks.afterPrepared?.(prepared)
  const switched = await switchCohortActivation(
    store,
    prepared,
    (checkpoint: CohortActivationReceipt) => persistReceipt(checkpoint)
  )
  await persistReceipt(switched)
  return switched
}

export async function executeCohortActivationReentry(
  store: CohortActivationStore,
  manifest: CohortActivationManifest,
  predecessorPath: string,
  successorPath: string,
  hooks?: CohortActivationReentryHooks
): Promise<CohortActivationReceipt> {
  const paths = await resolveCohortActivationReentryPaths(
    predecessorPath,
    successorPath
  )
  const sessionLock = await acquireCohortActivationReentrySessionLock(
    paths.predecessorPath,
    paths.successorPath
  )
  try {
    return await runCohortActivationReentryLocked(store, manifest, paths, hooks)
  } finally {
    await sessionLock.release()
  }
}
