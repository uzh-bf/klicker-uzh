import { randomUUID } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { encrypt } from '@klicker-uzh/util'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  assertReceiptMatchesManifest,
  assertReceiptTransition,
  type CohortActivationManifest,
  type CohortActivationReceipt,
  type CohortActivationReceiptExpectation,
  type CohortActivationReceiptFile,
  type CohortActivationReceiptIntent,
  dryRunCohortActivation,
  makeCohortActivationReceiptIntent,
  prepareCohortActivation,
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

type Command = 'dry-run' | 'migrate' | 'recover' | 'rollback' | 'readback'
type ReceiptFile = CohortActivationReceiptFile

export type CohortActivationSessionLock = {
  release: () => Promise<void>
}

function usage(): never {
  throw new Error('usage')
}

function parseArgs(argv: string[]): {
  command: Command
  manifestPath: string
  receiptPath: string
} {
  const command = argv[0]
  if (
    command !== 'dry-run' &&
    command !== 'migrate' &&
    command !== 'recover' &&
    command !== 'rollback' &&
    command !== 'readback'
  ) {
    return usage()
  }
  const manifestIndex = argv.indexOf('--manifest')
  const receiptIndex = argv.indexOf('--receipt')
  const manifestPath = manifestIndex >= 0 ? argv[manifestIndex + 1] : undefined
  const receiptPath = receiptIndex >= 0 ? argv[receiptIndex + 1] : undefined
  if (!manifestPath || !receiptPath || argv.length !== 5) return usage()
  return {
    command,
    manifestPath: resolve(manifestPath),
    receiptPath: resolve(receiptPath),
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as T
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
  try {
    await writeFile(temporary, `${JSON.stringify(receipt)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })
    await chmod(temporary, 0o600)
    const latest = await readReceipt(path)
    assertReceiptTransition(expected, latest, receipt)
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
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

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>
  try {
    args = parseArgs(process.argv.slice(2))
  } catch {
    printResult({ status: 'usage_error' })
    process.exitCode = 2
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
