import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createPrismaCohortActivationStore } from './doc-query-cohort-activation-prisma.js'
import { acquireCohortActivationSessionLock } from './doc-query-cohort-activation-run.js'
import {
  applyFinanceWikiAttachment,
  createFileFinanceWikiAttachmentReceiptStore,
  FinanceWikiAttachmentError,
  type FinanceWikiAttachmentManifest,
  type FinanceWikiAttachmentReceiptStore,
  type FinanceWikiAttachmentStore,
  parseFinanceWikiAttachmentManifest,
  planFinanceWikiAttachment,
  readFinanceWikiAttachment,
  recoverFinanceWikiAttachment,
  rollbackFinanceWikiAttachment,
} from './financewiki-attachment.js'

const DB_PORT_FORWARD_PORT = 7432

export type FinanceWikiAttachmentCliAction =
  | 'plan'
  | 'apply'
  | 'recover'
  | 'rollback'
  | 'readback'

export type FinanceWikiAttachmentCliArguments = {
  action: FinanceWikiAttachmentCliAction
  manifestPath: string | null
  receiptPath: string
}

export type FinanceWikiAttachmentCliDependencies = {
  store?: FinanceWikiAttachmentStore
  receiptStore?: FinanceWikiAttachmentReceiptStore
  environment?: NodeJS.ProcessEnv
  write?: (line: string) => void
}

function failArguments(message: string): never {
  throw new FinanceWikiAttachmentError('INVALID_ARGUMENTS', message)
}

function assertLocalPath(value: string): void {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    failArguments('manifest and receipt paths must be local files')
  }
}

export function parseFinanceWikiAttachmentCliArgs(
  argv: readonly string[]
): FinanceWikiAttachmentCliArguments {
  let action: FinanceWikiAttachmentCliAction = 'plan'
  let manifestPath: string | null = null
  let receiptPath: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (
      argument === 'plan' ||
      argument === 'apply' ||
      argument === 'recover' ||
      argument === 'rollback' ||
      argument === 'readback'
    ) {
      if (index !== 0) {
        failArguments('choose one attachment action')
      }
      action = argument
      continue
    }
    if (argument === '--manifest' || argument === '--receipt') {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) {
        failArguments(`${argument} requires a local path`)
      }
      assertLocalPath(next)
      if (argument === '--manifest') {
        if (manifestPath) failArguments('manifest path was repeated')
        manifestPath = resolve(next)
      } else {
        if (receiptPath) failArguments('receipt path was repeated')
        receiptPath = resolve(next)
      }
      index += 1
      continue
    }
    failArguments('unsupported attachment argument')
  }

  if (!receiptPath) failArguments('--receipt is required')
  if ((action === 'plan' || action === 'apply') && !manifestPath) {
    failArguments('--manifest is required for plan and apply')
  }
  if (action !== 'plan' && action !== 'apply' && manifestPath) {
    failArguments('--manifest is only used by plan and apply')
  }

  return { action, manifestPath, receiptPath }
}

async function readManifest(
  path: string
): Promise<FinanceWikiAttachmentManifest> {
  return parseFinanceWikiAttachmentManifest(
    JSON.parse(await readFile(path, 'utf8')) as unknown
  )
}

function createPrismaClient(environment: NodeJS.ProcessEnv): PrismaClient {
  const rawDatabaseUrl = environment.DATABASE_URL
  if (!rawDatabaseUrl) {
    throw new FinanceWikiAttachmentError(
      'DATABASE_URL_REQUIRED',
      'DATABASE_URL is not configured'
    )
  }
  const databaseUrl = new URL(rawDatabaseUrl)
  const sslmode = databaseUrl.searchParams.get('sslmode')
  if (sslmode === 'disable') {
    throw new FinanceWikiAttachmentError(
      'DATABASE_TLS_REQUIRED',
      'database TLS is required'
    )
  }
  const certificateHostname = databaseUrl.hostname
  databaseUrl.hostname = '127.0.0.1'
  databaseUrl.port = String(DB_PORT_FORWARD_PORT)
  databaseUrl.searchParams.delete('sslmode')
  const adapter = new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: { servername: certificateHostname, rejectUnauthorized: true },
  })
  return new PrismaClient({ adapter })
}

function printValuesFree(
  value:
    | Awaited<ReturnType<typeof planFinanceWikiAttachment>>
    | Awaited<ReturnType<typeof applyFinanceWikiAttachment>>
    | Awaited<ReturnType<typeof recoverFinanceWikiAttachment>>
    | Awaited<ReturnType<typeof rollbackFinanceWikiAttachment>>
    | Awaited<ReturnType<typeof readFinanceWikiAttachment>>,
  write: (line: string) => void
): void {
  if ('manifestFingerprint' in value) {
    write(
      JSON.stringify({
        status: value.status,
        manifestFingerprint: value.manifestFingerprint,
        targetCount: value.targetCount,
        modeCount: value.modeCount,
        alreadyAttached: value.alreadyAttached,
        wouldAttach: value.wouldAttach,
        receiptState: value.receiptState,
      })
    )
    return
  }
  if ('state' in value && 'targetCount' in value && 'attached' in value) {
    write(JSON.stringify(value))
    return
  }
  write(
    JSON.stringify({
      status: value.status,
      targetCount: value.receipt?.entries.length ?? 0,
      receiptState: value.receipt?.state ?? null,
    })
  )
}

function adaptStore(client: PrismaClient): FinanceWikiAttachmentStore {
  const store = createPrismaCohortActivationStore(client)
  return {
    transaction: (callback) => store.transaction((tx) => callback(tx)),
  }
}

export async function runFinanceWikiAttachmentCli(
  argv: readonly string[],
  dependencies: FinanceWikiAttachmentCliDependencies = {}
): Promise<number> {
  const write = dependencies.write ?? ((line: string) => console.log(line))
  let client: PrismaClient | null = null
  let sessionLock: Awaited<
    ReturnType<typeof acquireCohortActivationSessionLock>
  > | null = null
  try {
    const arguments_ = parseFinanceWikiAttachmentCliArgs(argv)
    const manifest = arguments_.manifestPath
      ? await readManifest(arguments_.manifestPath)
      : null
    const receiptStore =
      dependencies.receiptStore ??
      createFileFinanceWikiAttachmentReceiptStore(arguments_.receiptPath)
    sessionLock = await acquireCohortActivationSessionLock(
      arguments_.receiptPath
    )
    let store = dependencies.store
    if (!store) {
      client = createPrismaClient(dependencies.environment ?? process.env)
      store = adaptStore(client)
    }

    const result =
      arguments_.action === 'plan'
        ? await planFinanceWikiAttachment(store, manifest!, receiptStore)
        : arguments_.action === 'apply'
          ? await applyFinanceWikiAttachment(store, manifest!, receiptStore)
          : arguments_.action === 'recover'
            ? await recoverFinanceWikiAttachment(store, receiptStore)
            : arguments_.action === 'rollback'
              ? await rollbackFinanceWikiAttachment(store, receiptStore)
              : await readFinanceWikiAttachment(store, receiptStore)
    printValuesFree(result, write)
    return 0
  } catch (error) {
    if (error instanceof FinanceWikiAttachmentError) {
      write(
        JSON.stringify({ error: { code: error.code, message: error.message } })
      )
    } else if (error instanceof Error && error.message === 'SESSION_LOCKED') {
      write(
        JSON.stringify({
          error: {
            code: 'SESSION_LOCKED',
            message: 'another attachment session holds the receipt lock',
          },
        })
      )
    } else {
      write(
        JSON.stringify({
          error: { code: 'OPERATION_FAILED', message: 'operation failed' },
        })
      )
    }
    return 1
  } finally {
    await sessionLock?.release()
    await client?.$disconnect()
  }
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  void runFinanceWikiAttachmentCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode
  })
}
