import { encrypt } from '@klicker-uzh/util'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { createConnection, createServer, type Server } from 'node:net'
import {
  chmod,
  readFile,
  rename,
  mkdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReceiptMatchesManifest,
  assertReceiptTransition,
  type CohortActivationManifest,
  type CohortActivationReceiptExpectation,
  type CohortActivationReceiptFile,
  type CohortActivationReceipt,
  type CohortActivationReceiptIntent,
  dryRunCohortActivation,
  makeCohortActivationReceiptIntent,
  prepareCohortActivation,
  recoverPreparedCohortActivation,
  readCohortActivationState,
  rollbackCohortActivation,
  receiptExpectation,
  switchCohortActivation,
  validatePinnedManifest,
  validateCohortActivationReceiptIntent,
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

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function listenOnSocket(path: string): Promise<Server> {
  const server = createServer((socket) => socket.destroy())
  return new Promise((resolve, reject) => {
    const onListening = () => {
      server.removeListener('error', onError)
      resolve(server)
    }
    const onError = (error: Error & { code?: string }) => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    server.once('listening', onListening)
    server.once('error', onError)
    server.listen(path)
  })
}

function probeSocket(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(path)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy()
      resolve(error.code !== 'ECONNREFUSED' && error.code !== 'ENOENT')
    })
  })
}

/**
 * Keep one process-wide lifecycle lock for a receipt path. A Unix socket is
 * released by the operating system when its owner exits; the pathname is
 * reclaimed only after probing that no listener remains.
 */
export async function acquireCohortActivationSessionLock(
  receiptPath: string
): Promise<CohortActivationSessionLock> {
  const lockPath = `${receiptPath}.lock`
  await mkdir(dirname(receiptPath), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const server = await listenOnSocket(lockPath)
      return {
        release: async () => {
          // Keep the pathname until the next owner proves that the socket is
          // stale. This avoids unlinking a socket acquired during close().
          await closeServer(server)
        },
      }
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'EADDRINUSE'
      ) {
        throw error
      }
      if (await probeSocket(lockPath)) {
        throw new Error('SESSION_LOCKED')
      }
      await unlink(lockPath).catch((unlinkError: NodeJS.ErrnoException) => {
        if (unlinkError.code !== 'ENOENT') throw unlinkError
      })
    }
  }
  throw new Error('SESSION_LOCKED')
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
      return
    }

    const existingReceipt = await readReceipt(args.receiptPath)
    let expectedReceipt = receiptExpectation(existingReceipt)
    const persistReceipt = async (receipt: ReceiptFile): Promise<void> => {
      await writeReceipt(args.receiptPath, receipt, expectedReceipt)
      expectedReceipt = receiptExpectation(receipt)
    }
    if (args.command === 'migrate') {
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
      return
    }

    if (args.command === 'recover') {
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
      return
    }

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
    if (args.command === 'rollback') {
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
