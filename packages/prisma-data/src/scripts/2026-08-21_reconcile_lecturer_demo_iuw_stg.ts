import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'

const RAW_TOOL_NAME = 'informatik_und_wirtschaft_video_expert'
const STRICT_PARAMETERS = { required: true, toolAlias: 'doc_query' }
const DEFAULT_SECRET_ENV_VAR = 'DOC_QUERY_JWT_TOKEN_KLICKER'
const DEFAULT_RECEIPT_PATH =
  'packages/prisma-data/src/data/_local/lecturer-demo-stg-iuw-reconcile.json'
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Database = PrismaClient | Prisma.TransactionClient

type ConfigSnapshot = {
  id: string
  chatbotId: string
  mcpServerId: string
  chatMode: string
  allowedTools: unknown
  priority: number
  isEnabled: boolean
  parameters: unknown
}

type ServerSnapshot = {
  id: string
  name: string
  url: string
  authType: string
  authSecretPresent: boolean
  passChatbotId: boolean
  chatbotIdHeader: string | null
  parameters: unknown
  isActive: boolean
}

export type Snapshot = {
  courseExists: boolean
  chatbot: { id: string; courseId: string } | null
  server: ServerSnapshot | null
  configs: ConfigSnapshot[]
}

type Target = {
  courseId: string
  chatbotId: string
  serverId: string
  tutorConfigId: string
  explainerConfigId: string
  serverName: string
  targetUrl: string
  secretEnvVar: string
  receiptPath: string
}

type Receipt = {
  version: 1
  scope: 'iuw-stg-inactive-reconcile'
  stage: 'before' | 'after'
  status: 'dry-run' | 'applied'
  payloadHash: string
  beforeStateHash: string
  afterStateHash: string | null
  targetUrl: string
  rawToolName: string
  secretEnvVar: string
  plannedUpdates: number
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonical(entry)).join(',')}]`
  }
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`)
  }
  return value
}

function requiredUuid(name: string): string {
  const value = requiredEnv(name)
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID`)
  return value
}

function targetFromEnv(): Target {
  const targetUrl = requiredEnv('LECTURER_DEMO_TARGET_URL')
  const parsedUrl = new URL(targetUrl)
  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== ''
  ) {
    throw new Error('LECTURER_DEMO_TARGET_URL must be a plain HTTP(S) URL')
  }

  return {
    courseId: requiredUuid('LECTURER_DEMO_COURSE_ID'),
    chatbotId: requiredUuid('LECTURER_DEMO_CHATBOT_ID'),
    serverId: requiredUuid('LECTURER_DEMO_SERVER_ID'),
    tutorConfigId: requiredUuid('LECTURER_DEMO_TUTOR_CONFIG_ID'),
    explainerConfigId: requiredUuid('LECTURER_DEMO_EXPLAINER_CONFIG_ID'),
    serverName: requiredEnv('LECTURER_DEMO_SERVER_NAME'),
    targetUrl,
    secretEnvVar:
      process.env.LECTURER_DEMO_SECRET_ENV_VAR ?? DEFAULT_SECRET_ENV_VAR,
    receiptPath: path.resolve(
      process.env.LECTURER_DEMO_RECEIPT_PATH ?? DEFAULT_RECEIPT_PATH
    ),
  }
}

function payload(target: Target) {
  return {
    scope: 'iuw-stg-inactive-reconcile',
    courseId: target.courseId,
    chatbotId: target.chatbotId,
    serverId: target.serverId,
    tutorConfigId: target.tutorConfigId,
    explainerConfigId: target.explainerConfigId,
    serverName: target.serverName,
    targetUrl: target.targetUrl,
    rawToolName: RAW_TOOL_NAME,
    secretEnvVar: target.secretEnvVar,
  }
}

function readReceipt(receiptPath: string): Receipt | null {
  if (!fs.existsSync(receiptPath)) return null
  const raw: unknown = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
  if (
    typeof raw !== 'object' ||
    raw === null ||
    Array.isArray(raw) ||
    (raw as Record<string, unknown>).version !== 1 ||
    (raw as Record<string, unknown>).scope !== 'iuw-stg-inactive-reconcile' ||
    !['before', 'after'].includes(
      String((raw as Record<string, unknown>).stage)
    ) ||
    !['dry-run', 'applied'].includes(
      String((raw as Record<string, unknown>).status)
    ) ||
    typeof (raw as Record<string, unknown>).payloadHash !== 'string' ||
    typeof (raw as Record<string, unknown>).beforeStateHash !== 'string' ||
    ((raw as Record<string, unknown>).afterStateHash !== null &&
      typeof (raw as Record<string, unknown>).afterStateHash !== 'string') ||
    typeof (raw as Record<string, unknown>).targetUrl !== 'string' ||
    (raw as Record<string, unknown>).rawToolName !== RAW_TOOL_NAME ||
    typeof (raw as Record<string, unknown>).secretEnvVar !== 'string' ||
    typeof (raw as Record<string, unknown>).plannedUpdates !== 'number'
  ) {
    throw new Error('The lecturer-demo receipt is invalid')
  }
  return raw as Receipt
}

function writeReceipt(receiptPath: string, receipt: Receipt) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true })
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
}

export function expectedConfig(
  configId: string,
  chatbotId: string,
  serverId: string,
  chatMode: 'tutor' | 'explainer'
): ConfigSnapshot {
  return {
    id: configId,
    chatbotId,
    mcpServerId: serverId,
    chatMode,
    allowedTools: [RAW_TOOL_NAME],
    priority: 0,
    isEnabled: true,
    parameters: STRICT_PARAMETERS,
  }
}

function assertConfigs(snapshot: Snapshot, target: Target) {
  const expected = [
    expectedConfig(
      target.tutorConfigId,
      target.chatbotId,
      target.serverId,
      'tutor'
    ),
    expectedConfig(
      target.explainerConfigId,
      target.chatbotId,
      target.serverId,
      'explainer'
    ),
  ].sort((a, b) => a.chatMode.localeCompare(b.chatMode))
  const actual = [...snapshot.configs].sort((a, b) =>
    a.chatMode.localeCompare(b.chatMode)
  )
  if (
    actual.length !== expected.length ||
    actual.some(
      (config, index) => canonical(config) !== canonical(expected[index])
    )
  ) {
    throw new Error(
      'IuW MCP bindings are not exactly two enabled strict Tutor/Explainer configurations'
    )
  }
}

export function assertBefore(snapshot: Snapshot, target: Target) {
  if (!snapshot.courseExists)
    throw new Error('The target STG course does not exist')
  if (!snapshot.chatbot || snapshot.chatbot.courseId !== target.courseId) {
    throw new Error(
      'The target chatbot is missing or belongs to another course'
    )
  }
  if (!snapshot.server || snapshot.server.id !== target.serverId) {
    throw new Error('The target MCP server row is missing')
  }
  if (snapshot.server.name !== target.serverName) {
    throw new Error('The target MCP server name does not match')
  }
  if (snapshot.server.isActive) {
    throw new Error(
      'The target MCP server is already active; refusing to reconcile'
    )
  }
  if (
    snapshot.server.authType !== 'none' ||
    snapshot.server.authSecretPresent
  ) {
    throw new Error(
      'The target MCP server is not in the expected inactive, uncredentialed state'
    )
  }
  assertConfigs(snapshot, target)
}

export function assertAfter(snapshot: Snapshot, target: Target) {
  assertConfigs(snapshot, target)
  if (!snapshot.server) throw new Error('The target MCP server row is missing')
  if (
    snapshot.server.url !== target.targetUrl ||
    snapshot.server.authType !== 'bearer' ||
    !snapshot.server.authSecretPresent ||
    snapshot.server.isActive
  ) {
    throw new Error(
      'The target MCP server is not bound to the expected credentialed inactive state'
    )
  }
}

async function readSnapshot(db: Database, target: Target): Promise<Snapshot> {
  const [course, chatbot, server, configs] = await Promise.all([
    db.course.findUnique({
      where: { id: target.courseId },
      select: { id: true },
    }),
    db.chatbot.findUnique({
      where: { id: target.chatbotId },
      select: { id: true, courseId: true },
    }),
    db.chatbotMCPServer.findUnique({
      where: { id: target.serverId },
      select: {
        id: true,
        name: true,
        url: true,
        authType: true,
        authSecret: true,
        passChatbotId: true,
        chatbotIdHeader: true,
        parameters: true,
        isActive: true,
      },
    }),
    db.chatbotMCPConfig.findMany({
      where: { chatbotId: target.chatbotId },
      select: {
        id: true,
        chatbotId: true,
        mcpServerId: true,
        chatMode: true,
        allowedTools: true,
        priority: true,
        isEnabled: true,
        parameters: true,
      },
    }),
  ])

  return {
    courseExists: course !== null,
    chatbot,
    server: server
      ? {
          id: server.id,
          name: server.name,
          url: server.url,
          authType: server.authType,
          authSecretPresent: server.authSecret !== null,
          passChatbotId: server.passChatbotId,
          chatbotIdHeader: server.chatbotIdHeader,
          parameters: server.parameters,
          isActive: server.isActive,
        }
      : null,
    configs,
  }
}

function readSecret(target: Target): string {
  const value = process.env[target.secretEnvVar]
  if (!value || value.trim() === '') {
    throw new Error(`The configured credential ${target.secretEnvVar} is empty`)
  }
  return value
}

async function verifyStoredSecret(
  db: Database,
  target: Target,
  secret: string,
  decrypt: (value: string) => string
) {
  const row = await db.chatbotMCPServer.findUnique({
    where: { id: target.serverId },
    select: { authSecret: true },
  })
  if (!row?.authSecret || decrypt(row.authSecret) !== secret) {
    throw new Error(
      'The stored MCP credential does not match the approved payload'
    )
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const allowedArgs = new Set(['--apply'])
  if ([...args].some((arg) => !allowedArgs.has(arg))) {
    throw new Error('Only --apply is supported; dry-run is the default')
  }
  const apply = args.has('--apply')
  const target = targetFromEnv()
  const payloadHash = hash(payload(target))
  const saved = readReceipt(target.receiptPath)

  const [{ prisma }, { decrypt, encrypt }] = await Promise.all([
    import('@klicker-uzh/prisma'),
    import('@klicker-uzh/util'),
  ])

  try {
    const before = await readSnapshot(prisma, target)
    const beforeStateHash = hash(before)
    if (saved && saved.payloadHash !== payloadHash) {
      throw new Error('The existing receipt does not match the approved target')
    }

    if (saved?.stage === 'after') {
      if (
        saved.afterStateHash !== beforeStateHash ||
        saved.targetUrl !== target.targetUrl
      ) {
        throw new Error('The applied lecturer-demo state has drifted')
      }
      assertAfter(before, target)
      await verifyStoredSecret(prisma, target, readSecret(target), decrypt)
      console.log(
        'Already applied: exact inactive IuW STG state verified; 0 writes executed'
      )
      return
    }

    assertBefore(before, target)
    if (apply && !saved) {
      throw new Error('Apply requires an existing matching dry-run receipt')
    }
    if (apply && (saved?.stage !== 'before' || saved.status !== 'dry-run')) {
      throw new Error('Apply requires a matching before-state dry-run receipt')
    }
    if (!saved) {
      writeReceipt(target.receiptPath, {
        version: 1,
        scope: 'iuw-stg-inactive-reconcile',
        stage: 'before',
        status: 'dry-run',
        payloadHash,
        beforeStateHash,
        afterStateHash: null,
        targetUrl: target.targetUrl,
        rawToolName: RAW_TOOL_NAME,
        secretEnvVar: target.secretEnvVar,
        plannedUpdates: 1,
      })
    } else if (saved.beforeStateHash !== beforeStateHash) {
      throw new Error('The dry-run receipt does not match current STG state')
    }

    if (!apply) {
      console.log(
        'Dry run complete: 1 inactive IuW STG MCP server update planned'
      )
      return
    }

    const secret = readSecret(target)
    const after = await prisma.$transaction(
      async (tx) => {
        const transactionBefore = await readSnapshot(tx, target)
        if (hash(transactionBefore) !== beforeStateHash) {
          throw new Error(
            'The transaction starting state differs from the dry-run receipt'
          )
        }
        assertBefore(transactionBefore, target)
        const encryptedSecret = encrypt(secret)
        await tx.chatbotMCPServer.update({
          where: { id: target.serverId },
          data: {
            url: target.targetUrl,
            authType: 'bearer',
            authSecret: encryptedSecret,
            isActive: false,
          },
        })
        await verifyStoredSecret(tx, target, secret, decrypt)
        const transactionAfter = await readSnapshot(tx, target)
        assertAfter(transactionAfter, target)
        return transactionAfter
      },
      { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
    )

    writeReceipt(target.receiptPath, {
      version: 1,
      scope: 'iuw-stg-inactive-reconcile',
      stage: 'after',
      status: 'applied',
      payloadHash,
      beforeStateHash,
      afterStateHash: hash(after),
      targetUrl: target.targetUrl,
      rawToolName: RAW_TOOL_NAME,
      secretEnvVar: target.secretEnvVar,
      plannedUpdates: 1,
    })
    console.log('Apply complete: 1 inactive IuW STG MCP server update verified')
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    await main()
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Reconciliation failed'
    )
    process.exitCode = 1
  }
}
