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
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { encrypt } from '@klicker-uzh/util'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  assertCohortActivationNotPrepared,
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
  dryRunCohortActivation,
  makeCohortActivationReceiptIntent,
  makeCohortActivationReentryReceiptIntent,
  prepareCohortActivation,
  prepareCohortActivationReentry,
  readCohortActivationState,
  receiptExpectation,
  recoverPreparedCohortActivation,
  rollbackCohortActivation,
  switchCohortActivation,
  validateCohortActivationReceiptIntent,
  validatePinnedManifest,
  validateReceipt,
} from './doc-query-cohort-activation.js'
import { createPrismaCohortActivationStore } from './doc-query-cohort-activation-prisma.js'

const TOKEN_ENV = 'DOC_QUERY_JWT_TOKEN_KLICKER'
const DB_PORT_FORWARD_PORT = 7432

type Command =
  | 'dry-run'
  | 'migrate'
  | 'recover'
  | 'clear'
  | 'rollback'
  | 'readback'
  | 'reenter'
type ReceiptFile = CohortActivationReceiptFile

type ParsedArgs = {
  command: Command
  manifestPath: string
  receiptPath: string
  successorPath?: string
}

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

function usage(): never {
  throw new Error('usage')
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0]
  if (
    command !== 'dry-run' &&
    command !== 'migrate' &&
    command !== 'recover' &&
    command !== 'clear' &&
    command !== 'rollback' &&
    command !== 'readback' &&
    command !== 'reenter'
  ) {
    return usage()
  }
  const manifestIndex = argv.indexOf('--manifest')
  const receiptIndex = argv.indexOf('--receipt')
  const successorIndex = argv.indexOf('--successor')
  const manifestPath = manifestIndex >= 0 ? argv[manifestIndex + 1] : undefined
  const receiptPath = receiptIndex >= 0 ? argv[receiptIndex + 1] : undefined
  const successorPath =
    successorIndex >= 0 ? argv[successorIndex + 1] : undefined
  if (
    !manifestPath ||
    !receiptPath ||
    (command === 'reenter'
      ? !successorPath || argv.length !== 7
      : successorPath !== undefined || argv.length !== 5)
  ) {
    return usage()
  }
  return {
    command,
    manifestPath: resolve(manifestPath),
    receiptPath: resolve(receiptPath),
    ...(successorPath ? { successorPath: resolve(successorPath) } : {}),
  }
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
    return {
      release: async () => {
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
  const paths = [predecessorPath, successorPath].sort()
  const locks: CohortActivationSessionLock[] = []
  try {
    for (const path of paths) {
      locks.push(await acquireCohortActivationSessionLock(path))
    }
  } catch (error) {
    for (const lock of locks.reverse()) await lock.release()
    throw error
  }
  return {
    release: async () => {
      for (const lock of locks.reverse()) await lock.release()
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

function printResult(result: Record<string, unknown>): void {
  // Only fixed categories and ordinary counts/fingerprints are emitted.
  console.log(JSON.stringify(result))
}

function isCohortActivationIntent(
  receipt: ReceiptFile
): receipt is CohortActivationReceiptIntent {
  return receipt.state === 'preparing'
}

function classifyError(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    (/^[A-Z_]+$/.test(error.code) || /^P\d{4}$/.test(error.code))
  ) {
    return /^P\d{4}$/.test(error.code) ? `DB_${error.code}` : error.code
  }
  if (error instanceof Error) {
    if (error.name === 'PrismaClientInitializationError')
      return 'DB_INIT_FAILED'
    if (error.name === 'PrismaClientKnownRequestError')
      return 'DB_REQUEST_FAILED'
    if (error.name === 'PrismaClientUnknownRequestError')
      return 'DB_UNKNOWN_FAILED'
    if (error.name === 'PrismaClientValidationError') return 'DB_INPUT_FAILED'
  }
  return 'FAILED'
}

function createPrismaClient(): PrismaClient {
  const rawDatabaseUrl = process.env.DATABASE_URL
  if (!rawDatabaseUrl) throw new Error('database_missing')
  const databaseUrl = new URL(rawDatabaseUrl)
  const sslmode = databaseUrl.searchParams.get('sslmode')
  if (sslmode === 'disable') throw new Error('database_tls_disabled')
  const certificateHostname = databaseUrl.hostname
  databaseUrl.hostname = '127.0.0.1'
  databaseUrl.port = String(DB_PORT_FORWARD_PORT)
  // pg's connection-string parser can override an explicit TLS object when
  // sslmode remains in the URL. Keep verification in the object instead.
  databaseUrl.searchParams.delete('sslmode')
  const adapter = new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: { servername: certificateHostname, rejectUnauthorized: true },
  })
  return new PrismaClient({ adapter })
}

type ReceiptPersister = (receipt: ReceiptFile) => Promise<void>

async function runDryRun(
  store: ReturnType<typeof createPrismaCohortActivationStore>,
  manifest: CohortActivationManifest
): Promise<void> {
  const result = await dryRunCohortActivation(store, manifest)
  printResult({
    status: result.status,
    entryCount: result.entryCount,
    heldCount: result.heldCount,
    wouldCreateServer: result.wouldCreateServer,
    wouldCreateConfigs: result.wouldCreateConfigs,
    wouldSwitch: result.wouldSwitch,
    wouldPreserveSourceRows: result.wouldPreserveSourceRows,
  })
}

async function runMigrate(
  store: ReturnType<typeof createPrismaCohortActivationStore>,
  manifest: CohortActivationManifest,
  existingReceipt: ReceiptFile | null,
  persistReceipt: ReceiptPersister
): Promise<void> {
  if (existingReceipt) {
    printResult({ status: 'refused', reason: 'receipt_exists' })
    process.exitCode = 3
    return
  }
  const existingTargetServerId = await store.transaction(async (tx) => {
    const target = await tx.findServerByName(manifest.target.serverName)
    return target?.id ?? null
  })
  const bearer = existingTargetServerId ? undefined : process.env[TOKEN_ENV]
  if (
    !existingTargetServerId &&
    (!bearer || bearer.trim() === '' || /[\r\n]/.test(bearer))
  ) {
    printResult({ status: 'refused', reason: 'bearer_missing_or_invalid' })
    process.exitCode = 3
    return
  }
  const intent = makeCohortActivationReceiptIntent(
    manifest,
    existingTargetServerId
  )
  await persistReceipt(intent)
  // The token is read only long enough to encrypt it. It is never written
  // to a receipt, argument list, log, or child process.
  const encryptedBearer = bearer ? encrypt(bearer) : undefined
  if (bearer) delete process.env[TOKEN_ENV]
  const prepared = await prepareCohortActivation(store, manifest, {
    encryptedBearer,
    intent,
  })
  await persistReceipt(prepared)
  const switched = await switchCohortActivation(
    store,
    prepared,
    (checkpoint: CohortActivationReceipt) => persistReceipt(checkpoint)
  )
  await persistReceipt(switched)
  const state = await readCohortActivationState(store, switched)
  printResult({
    status: 'switched',
    state: state.state,
    entryCount: state.entryCount,
    chatbotCount: state.chatbotCount,
    sourceDisabled: state.sourceDisabled,
    targetEnabled: state.targetEnabled,
  })
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

async function runRecover(
  store: ReturnType<typeof createPrismaCohortActivationStore>,
  manifest: CohortActivationManifest,
  existingReceipt: ReceiptFile | null,
  persistReceipt: ReceiptPersister
): Promise<void> {
  if (!existingReceipt) {
    printResult({ status: 'refused', reason: 'receipt_missing' })
    process.exitCode = 3
    return
  }
  if (!isCohortActivationIntent(existingReceipt)) {
    printResult({ status: 'refused', reason: 'receipt_complete' })
    process.exitCode = 3
    return
  }
  if (existingReceipt.reentry) {
    printResult({ status: 'refused', reason: 'reentry_not_allowed' })
    process.exitCode = 3
    return
  }
  if (existingReceipt.manifestFingerprint !== manifest.fingerprint) {
    printResult({ status: 'refused', reason: 'receipt_manifest_mismatch' })
    process.exitCode = 3
    return
  }
  const recovered = await recoverPreparedCohortActivation(
    store,
    manifest,
    existingReceipt
  )
  await persistReceipt(recovered)
  printResult({
    status: 'prepared_recovered',
    state: recovered.state,
    entryCount: recovered.entries.length,
  })
}

async function runClear(
  store: ReturnType<typeof createPrismaCohortActivationStore>,
  manifest: CohortActivationManifest,
  receiptPath: string,
  existingReceipt: ReceiptFile | null
): Promise<void> {
  if (!existingReceipt) {
    printResult({ status: 'refused', reason: 'receipt_missing' })
    process.exitCode = 3
    return
  }
  if (!isCohortActivationIntent(existingReceipt)) {
    printResult({ status: 'refused', reason: 'receipt_complete' })
    process.exitCode = 3
    return
  }
  if (existingReceipt.reentry) {
    printResult({ status: 'refused', reason: 'reentry_not_allowed' })
    process.exitCode = 3
    return
  }
  if (existingReceipt.manifestFingerprint !== manifest.fingerprint) {
    printResult({ status: 'refused', reason: 'receipt_manifest_mismatch' })
    process.exitCode = 3
    return
  }
  await assertCohortActivationNotPrepared(store, manifest, existingReceipt)
  const expected = receiptExpectation(existingReceipt)
  if (!expected) {
    throw new CohortActivationError(
      'RECEIPT_CONCURRENT_WRITE',
      'receipt disappeared before the preparing intent could be cleared'
    )
  }
  await clearPreparingReceipt(receiptPath, expected)
  printResult({ status: 'intent_cleared' })
}

async function runSettledCommand(
  store: ReturnType<typeof createPrismaCohortActivationStore>,
  command: Command,
  manifest: CohortActivationManifest,
  existingReceipt: ReceiptFile | null,
  persistReceipt: ReceiptPersister
): Promise<void> {
  if (!existingReceipt) {
    printResult({ status: 'refused', reason: 'receipt_missing' })
    process.exitCode = 3
    return
  }
  if (isCohortActivationIntent(existingReceipt)) {
    printResult({ status: 'refused', reason: 'preparing_receipt' })
    process.exitCode = 3
    return
  }
  assertReceiptMatchesManifest(existingReceipt, manifest)
  if (command === 'rollback') {
    const rolledBack = await rollbackCohortActivation(
      store,
      existingReceipt,
      (checkpoint: CohortActivationReceipt) => persistReceipt(checkpoint)
    )
    await persistReceipt(rolledBack)
    const state = await readCohortActivationState(store, rolledBack)
    printResult({
      status: 'rolled_back',
      state: state.state,
      entryCount: state.entryCount,
      chatbotCount: state.chatbotCount,
      sourceEnabled: state.sourceEnabled,
      targetDisabled: state.targetDisabled,
    })
    return
  }

  const state = await readCohortActivationState(store, existingReceipt)
  printResult({
    status: 'readback',
    state: state.state,
    entryCount: state.entryCount,
    sourceEnabled: state.sourceEnabled,
    sourceDisabled: state.sourceDisabled,
    targetEnabled: state.targetEnabled,
    targetDisabled: state.targetDisabled,
  })
}

async function runReentryCommand(args: ParsedArgs): Promise<void> {
  let prisma: PrismaClient | undefined
  try {
    if (!args.successorPath) return usage()
    prisma = createPrismaClient()
    const store = createPrismaCohortActivationStore(prisma)
    const manifest = await readJsonFile<CohortActivationManifest>(
      args.manifestPath
    )
    validatePinnedManifest(manifest)
    const switched = await executeCohortActivationReentry(
      store,
      manifest,
      args.receiptPath,
      args.successorPath
    )
    const state = await readCohortActivationState(store, switched)
    printResult({
      status: 'switched',
      state: state.state,
      entryCount: state.entryCount,
      chatbotCount: state.chatbotCount,
      sourceDisabled: state.sourceDisabled,
      targetEnabled: state.targetEnabled,
    })
  } catch (error) {
    printResult({ status: 'failed', category: classifyError(error) })
    process.exitCode = 1
  } finally {
    await prisma?.$disconnect()
  }
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>
  try {
    args = parseArgs(process.argv.slice(2))
  } catch {
    printResult({ status: 'usage_error' })
    process.exitCode = 2
    return
  }
  if (args.command === 'reenter') {
    await runReentryCommand(args)
    return
  }

  let sessionLock: CohortActivationSessionLock
  try {
    sessionLock = await acquireCohortActivationSessionLock(args.receiptPath)
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_LOCKED') {
      printResult({ status: 'refused', reason: 'session_locked' })
      process.exitCode = 3
      return
    }
    printResult({ status: 'failed', category: 'SESSION_LOCK_FAILED' })
    process.exitCode = 1
    return
  }

  let prisma: PrismaClient
  try {
    prisma = createPrismaClient()
  } catch {
    await sessionLock.release()
    printResult({ status: 'failed', category: 'DB_CONFIG_FAILED' })
    process.exitCode = 1
    return
  }
  const store = createPrismaCohortActivationStore(prisma)

  try {
    const manifest = await readJsonFile<CohortActivationManifest>(
      args.manifestPath
    )
    validatePinnedManifest(manifest)
    if (args.command === 'dry-run') {
      await runDryRun(store, manifest)
      return
    }

    const existingReceipt = await readReceipt(args.receiptPath)
    let expectedReceipt = receiptExpectation(existingReceipt)
    const persistReceipt = async (receipt: ReceiptFile): Promise<void> => {
      await writeReceipt(args.receiptPath, receipt, expectedReceipt)
      expectedReceipt = receiptExpectation(receipt)
    }
    if (args.command === 'migrate') {
      await runMigrate(store, manifest, existingReceipt, persistReceipt)
      return
    }

    if (args.command === 'recover') {
      await runRecover(store, manifest, existingReceipt, persistReceipt)
      return
    }

    if (args.command === 'clear') {
      await runClear(store, manifest, args.receiptPath, existingReceipt)
      return
    }

    await runSettledCommand(
      store,
      args.command,
      manifest,
      existingReceipt,
      persistReceipt
    )
  } catch (error) {
    printResult({ status: 'failed', category: classifyError(error) })
    process.exitCode = 1
  } finally {
    try {
      await prisma.$disconnect()
    } finally {
      await sessionLock.release()
    }
  }
}

const entrypoint = process.argv[1]
const isEntrypoint =
  entrypoint !== undefined &&
  resolve(entrypoint) === fileURLToPath(import.meta.url)

if (isEntrypoint) await main()
