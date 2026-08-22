import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'

const SECRET_ENV_VAR = 'DOC_QUERY_JWT_TOKEN_KLICKER'
const TARGET_URL =
  'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker'
const DEFAULT_RECEIPT_DIR = fileURLToPath(
  new URL('../data/_local/lecturer-demo-prd-activation', import.meta.url)
)
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Database = PrismaClient | Prisma.TransactionClient
type Target = 'iuw' | 'rsv'
type DesiredState = 'active' | 'inactive'

type TargetSpec = {
  target: Target
  courseId: string
  chatbotId: string
  serverId: string
  courseName: string
  chatbotName: string
  serverName: string
  rawTool: string
}

type Snapshot = {
  target: Target
  owner: { id: string; shortname: string; role: string } | null
  course: {
    id: string
    ownerId: string
    name: string
    displayName: string
    isArchived: boolean
    authType: string
  } | null
  chatbot: {
    id: string
    ownerId: string
    courseId: string
    name: string
    disclaimerId: string | null
  } | null
  server: {
    id: string
    name: string
    url: string
    authType: string
    authSecretPresent: boolean
    authSecretMatches: boolean
    isActive: boolean
    passChatbotId: boolean
    chatbotIdHeader: string | null
  } | null
  configs: Array<{
    id: string
    chatbotId: string
    mcpServerId: string
    chatMode: string
    allowedTools: unknown
    priority: number
    isEnabled: boolean
    parameters: unknown
  }>
  serverConfigs: Array<{
    id: string
    chatbotId: string
    mcpServerId: string
    chatMode: string
    allowedTools: unknown
    priority: number
    isEnabled: boolean
    parameters: unknown
  }>
}

type Receipt = {
  version: 1
  scope: 'lecturer-demo-prd-activation'
  target: Target
  desiredState: DesiredState
  stage: 'before' | 'after'
  status: 'dry-run' | 'applied' | 'rolled-back'
  beforeStateHash: string
  afterStateHash: string | null
  serverId: string
  targetUrl: string
  secretEnvVar: string
}

const TARGETS: Record<Target, TargetSpec> = {
  iuw: {
    target: 'iuw',
    courseId: '3956276b-b315-5c9a-a7af-eb22fa42b475',
    chatbotId: 'fd497bb5-a261-5045-b77f-7038ee7e3d32',
    serverId: '48b55440-9d70-58d9-8339-4393e1f65f4b',
    courseName: 'testkurs IuW',
    chatbotName: 'Informatik und Wirtschaft',
    serverName: 'testkurs IuW PRD Doc Query',
    rawTool: 'informatik_und_wirtschaft_video_expert',
  },
  rsv: {
    target: 'rsv',
    courseId: '535c584b-66a2-53f6-bfc2-c5ed0e162fa1',
    chatbotId: 'b80da3f7-b958-5a80-9c2f-7f254b7b3ecc',
    serverId: '505e7a6b-2460-56c2-a24d-fa75b9d638fd',
    courseName: 'testkurs RadioSurfVet',
    chatbotName: 'RadioSurfVet',
    serverName: 'testkurs RadioSurfVet PRD Doc Query',
    rawTool: 'radiosurfvet_expert',
  },
}

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
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
  if (!value || value.trim() === '') throw new Error(`${name} is required`)
  return value
}

function parseArgs(): {
  target: Target
  desiredState: DesiredState
  apply: boolean
} {
  const args = new Set(process.argv.slice(2))
  const unknown = [...args].filter(
    (arg) =>
      !['--apply', '--deactivate', '--target=iuw', '--target=rsv'].includes(arg)
  )
  if (unknown.length > 0) {
    throw new Error(
      `Unsupported arguments: ${unknown.join(', ')}. Use --target=iuw|rsv and optionally --apply or --deactivate.`
    )
  }
  const targetArgs = [...args].filter((arg) => arg.startsWith('--target='))
  if (targetArgs.length !== 1) {
    throw new Error('Exactly one --target=iuw or --target=rsv is required')
  }
  const target = targetArgs[0]!.slice('--target='.length) as Target
  if (!UUID.test(TARGETS[target].serverId)) {
    throw new Error(`Invalid ${target} server ID in activation target`)
  }
  return {
    target,
    desiredState: args.has('--deactivate') ? 'inactive' : 'active',
    apply: args.has('--apply'),
  }
}

function receiptPath(target: Target, desiredState: DesiredState): string {
  return path.resolve(
    process.env.LECTURER_DEMO_ACTIVATION_RECEIPT_PATH ??
      path.join(DEFAULT_RECEIPT_DIR, `${target}.${desiredState}.receipt.json`)
  )
}

function readReceipt(filePath: string): Receipt | null {
  if (!fs.existsSync(filePath)) return null
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('The lecturer-demo activation receipt is invalid')
  }
  const value = raw as Record<string, unknown>
  if (
    value.version !== 1 ||
    value.scope !== 'lecturer-demo-prd-activation' ||
    !['iuw', 'rsv'].includes(String(value.target)) ||
    !['active', 'inactive'].includes(String(value.desiredState)) ||
    !['before', 'after'].includes(String(value.stage)) ||
    !['dry-run', 'applied', 'rolled-back'].includes(String(value.status)) ||
    typeof value.beforeStateHash !== 'string' ||
    (value.afterStateHash !== null &&
      typeof value.afterStateHash !== 'string') ||
    typeof value.serverId !== 'string' ||
    value.targetUrl !== TARGET_URL ||
    value.secretEnvVar !== SECRET_ENV_VAR
  ) {
    throw new Error('The lecturer-demo activation receipt is invalid')
  }
  return value as Receipt
}

function writeReceipt(filePath: string, receipt: Receipt) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`)
}

function archiveReceipt(filePath: string, receipt: Receipt) {
  if (receipt.stage !== 'after' || receipt.afterStateHash === null) {
    throw new Error('Only completed activation receipts can be archived')
  }
  const archivePath = `${filePath}.history-${receipt.afterStateHash}.json`
  if (!fs.existsSync(archivePath)) fs.copyFileSync(filePath, archivePath)
}

async function readSnapshot(
  db: Database,
  spec: TargetSpec,
  secret: string
): Promise<Snapshot> {
  const [owner, course, chatbot, server, configs, serverConfigs] =
    await Promise.all([
      db.user.findUnique({
        where: { shortname: 'klick' },
        select: { id: true, shortname: true, role: true },
      }),
      db.course.findUnique({
        where: { id: spec.courseId },
        select: {
          id: true,
          ownerId: true,
          name: true,
          displayName: true,
          isArchived: true,
          authType: true,
        },
      }),
      db.chatbot.findUnique({
        where: { id: spec.chatbotId },
        select: {
          id: true,
          ownerId: true,
          courseId: true,
          name: true,
          disclaimerId: true,
        },
      }),
      db.chatbotMCPServer.findUnique({
        where: { id: spec.serverId },
        select: {
          id: true,
          name: true,
          url: true,
          authType: true,
          authSecret: true,
          isActive: true,
          passChatbotId: true,
          chatbotIdHeader: true,
        },
      }),
      db.chatbotMCPConfig.findMany({
        where: { chatbotId: spec.chatbotId },
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
        orderBy: { chatMode: 'asc' },
      }),
      db.chatbotMCPConfig.findMany({
        where: { mcpServerId: spec.serverId },
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
        orderBy: [{ chatbotId: 'asc' }, { chatMode: 'asc' }],
      }),
    ])

  let authSecretMatches = false
  if (server?.authSecret) {
    try {
      const { decrypt } = await import('@klicker-uzh/util')
      authSecretMatches = decrypt(server.authSecret) === secret
    } catch {
      authSecretMatches = false
    }
  }

  return {
    target: spec.target,
    owner,
    course,
    chatbot,
    server: server
      ? {
          id: server.id,
          name: server.name,
          url: server.url,
          authType: server.authType,
          authSecretPresent:
            server.authSecret !== null && server.authSecret !== undefined,
          authSecretMatches,
          isActive: server.isActive,
          passChatbotId: server.passChatbotId,
          chatbotIdHeader: server.chatbotIdHeader,
        }
      : null,
    configs,
    serverConfigs,
  }
}

function expectedConfigs(spec: TargetSpec) {
  return [
    {
      chatbotId: spec.chatbotId,
      mcpServerId: spec.serverId,
      chatMode: 'explainer',
      allowedTools: [spec.rawTool],
      priority: 0,
      isEnabled: true,
      parameters: { required: true, toolAlias: 'doc_query' },
    },
    {
      chatbotId: spec.chatbotId,
      mcpServerId: spec.serverId,
      chatMode: 'tutor',
      allowedTools: [spec.rawTool],
      priority: 0,
      isEnabled: true,
      parameters: { required: true, toolAlias: 'doc_query' },
    },
  ].sort((a, b) => a.chatMode.localeCompare(b.chatMode))
}

function assertExact(snapshot: Snapshot, spec: TargetSpec) {
  if (
    !snapshot.owner ||
    snapshot.owner.shortname !== 'klick' ||
    snapshot.owner.role !== 'ADMIN' ||
    !snapshot.course ||
    snapshot.course.id !== spec.courseId ||
    snapshot.course.ownerId !== snapshot.owner.id ||
    snapshot.course.name !== spec.courseName ||
    snapshot.course.displayName !== spec.courseName ||
    snapshot.course.isArchived ||
    snapshot.course.authType !== 'PIN' ||
    !snapshot.chatbot ||
    snapshot.chatbot.id !== spec.chatbotId ||
    snapshot.chatbot.ownerId !== snapshot.owner.id ||
    snapshot.chatbot.courseId !== spec.courseId ||
    snapshot.chatbot.name !== spec.chatbotName ||
    !snapshot.server ||
    snapshot.server.id !== spec.serverId ||
    snapshot.server.name !== spec.serverName ||
    snapshot.server.url !== TARGET_URL ||
    snapshot.server.authType !== 'bearer' ||
    !snapshot.server.authSecretPresent ||
    !snapshot.server.authSecretMatches ||
    snapshot.server.passChatbotId ||
    snapshot.server.chatbotIdHeader !== null ||
    canonical(snapshot.configs.map(({ id: _id, ...config }) => config)) !==
      canonical(expectedConfigs(spec)) ||
    canonical(
      snapshot.serverConfigs.map(({ id: _id, ...config }) => config)
    ) !== canonical(expectedConfigs(spec))
  ) {
    throw new Error(`Refusing ${spec.target}: target rows are not exact`)
  }
}

function stateHash(snapshot: Snapshot): string {
  return hash({
    target: snapshot.target,
    owner: snapshot.owner,
    course: snapshot.course,
    chatbot: snapshot.chatbot,
    server: snapshot.server,
    configs: snapshot.configs,
    serverConfigs: snapshot.serverConfigs,
  })
}

function assertDesiredState(snapshot: Snapshot, desiredState: DesiredState) {
  if (!snapshot.server) throw new Error('Target server is missing')
  if (snapshot.server.isActive !== (desiredState === 'active')) {
    throw new Error(
      `Target server is not in the expected ${desiredState === 'active' ? 'inactive' : 'active'} state`
    )
  }
}

async function main() {
  const { target, desiredState, apply } = parseArgs()
  const spec = TARGETS[target]
  const secret = requiredEnv(SECRET_ENV_VAR)
  requiredEnv('APP_SECRET')
  const pathToReceipt = receiptPath(target, desiredState)
  const oppositeState: DesiredState =
    desiredState === 'active' ? 'inactive' : 'active'
  let saved = readReceipt(pathToReceipt)
  let applyAuthorized = false

  const [{ prisma }, { decrypt }] = await Promise.all([
    import('@klicker-uzh/prisma'),
    import('@klicker-uzh/util'),
  ])

  try {
    const before = await readSnapshot(prisma, spec, secret)
    assertExact(before, spec)
    const beforeStateHash = stateHash(before)

    if (saved) {
      if (
        saved.target !== target ||
        saved.desiredState !== desiredState ||
        saved.serverId !== spec.serverId
      ) {
        throw new Error(
          'The existing activation receipt does not match the target'
        )
      }
      if (saved.stage === 'after') {
        if (saved.afterStateHash === beforeStateHash) {
          assertDesiredState(before, desiredState)
          console.log(
            `Already ${desiredState}: exact ${target} activation state verified; 0 writes executed`
          )
          return
        }
        const oppositeReceipt = readReceipt(receiptPath(target, oppositeState))
        if (
          saved.afterStateHash === null ||
          !oppositeReceipt ||
          oppositeReceipt.target !== target ||
          oppositeReceipt.desiredState !== oppositeState ||
          oppositeReceipt.stage !== 'after' ||
          oppositeReceipt.afterStateHash !== beforeStateHash
        ) {
          throw new Error('The activation state has drifted from its receipt')
        }
        archiveReceipt(pathToReceipt, saved)
        saved = null
      }
      if (
        saved &&
        (saved.stage !== 'before' ||
          saved.status !== 'dry-run' ||
          saved.beforeStateHash !== beforeStateHash)
      ) {
        throw new Error(
          'The activation dry-run receipt does not match current state'
        )
      }
      if (saved) applyAuthorized = true
    }
    if (!saved) {
      assertDesiredState(before, oppositeState)
      writeReceipt(pathToReceipt, {
        version: 1,
        scope: 'lecturer-demo-prd-activation',
        target,
        desiredState,
        stage: 'before',
        status: 'dry-run',
        beforeStateHash,
        afterStateHash: null,
        serverId: spec.serverId,
        targetUrl: TARGET_URL,
        secretEnvVar: SECRET_ENV_VAR,
      })
    }

    if (!apply) {
      console.log(
        `Dry run complete: ${target} server is ready for ${desiredState}; 0 writes executed`
      )
      return
    }
    if (!applyAuthorized) {
      throw new Error(
        'Apply requires a matching before-state dry-run receipt; rerun after the dry run'
      )
    }

    const after = await prisma.$transaction(
      async (tx) => {
        const transactionBefore = await readSnapshot(tx, spec, secret)
        assertExact(transactionBefore, spec)
        if (stateHash(transactionBefore) !== beforeStateHash) {
          throw new Error(
            'Transaction starting state differs from the dry-run receipt'
          )
        }
        assertDesiredState(
          transactionBefore,
          desiredState === 'active' ? 'inactive' : 'active'
        )
        await tx.chatbotMCPServer.update({
          where: { id: spec.serverId },
          data: { isActive: desiredState === 'active' },
        })
        const transactionAfter = await readSnapshot(tx, spec, secret)
        assertExact(transactionAfter, spec)
        assertDesiredState(transactionAfter, desiredState)
        const stored = await tx.chatbotMCPServer.findUnique({
          where: { id: spec.serverId },
          select: { authSecret: true },
        })
        if (!stored?.authSecret || decrypt(stored.authSecret) !== secret) {
          throw new Error('Post-state credential verification failed')
        }
        return transactionAfter
      },
      { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
    )

    writeReceipt(pathToReceipt, {
      version: 1,
      scope: 'lecturer-demo-prd-activation',
      target,
      desiredState,
      stage: 'after',
      status: desiredState === 'active' ? 'applied' : 'rolled-back',
      beforeStateHash,
      afterStateHash: stateHash(after),
      serverId: spec.serverId,
      targetUrl: TARGET_URL,
      secretEnvVar: SECRET_ENV_VAR,
    })
    console.log(
      `${desiredState === 'active' ? 'Activation' : 'Rollback'} complete: ${target} server is ${desiredState}; 1 write executed and verified`
    )
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
      error instanceof Error ? error.message : 'Lecturer-demo activation failed'
    )
    process.exitCode = 1
  }
}
