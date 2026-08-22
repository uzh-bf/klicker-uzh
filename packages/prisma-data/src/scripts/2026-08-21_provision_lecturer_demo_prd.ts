import { createHash, randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'

const OWNER_SHORTNAME = 'klick'
const SECRET_ENV_VAR = 'DOC_QUERY_JWT_TOKEN_KLICKER'
const TARGET_URL =
  'http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker'
const RAW_TOOLS = {
  iuw: 'informatik_und_wirtschaft_video_expert',
  rsv: 'radiosurfvet_expert',
} as const
const STRICT_PARAMETERS = { required: true, toolAlias: 'doc_query' }
const START_DATE = '2026-08-21T00:00:00.000Z'
const END_DATE = '2027-08-31T23:59:59.000Z'
const DEFAULT_RECEIPT_PATH = fileURLToPath(
  new URL(
    '../data/_local/lecturer-demo-prd-two-courses.receipt.json',
    import.meta.url
  )
)
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Database = PrismaClient | Prisma.TransactionClient
type ResetPeriod = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE'

type Prompt = { prompt: string; description: string }
type SourcePayload = {
  chatbot: {
    name: string
    description: string
    systemPrompts: { tutor: Prompt; explainer: Prompt }
    creditInitialCredits: number
    creditResetPeriod: ResetPeriod
    creditResetAmount: number
    creditMaxCredits: number
    modelSelection: boolean
    allowedModelIds: string[]
  }
  disclaimer: { name: string; title: string; introText: string }
}

type Bundle = {
  key: 'iuw' | 'rsv'
  course: {
    id: string
    name: string
    displayName: string
    description: string
    language: 'de'
    color: string
    startDate: string
    endDate: string
    groupDeadlineDate: string
  }
  chatbot: SourcePayload['chatbot'] & {
    id: string
    courseId: string
    ownerId: string | null
    disclaimerId: string
  }
  disclaimer: SourcePayload['disclaimer'] & {
    id: string
    ownerId: string | null
  }
  server: {
    id: string
    name: string
    description: string
    url: string
    authType: 'bearer'
    isActive: false
    passChatbotId: false
    chatbotIdHeader: null
  }
  configs: {
    tutorId: string
    explainerId: string
    chatbotId: string
    serverId: string
    rawTool: string
  }
}

type BundleSnapshot = {
  key: Bundle['key']
  course: {
    exists: boolean
    id: string | null
    ownerId: string | null
    name: string | null
    displayName: string | null
    language: string | null
    authType: string | null
    isArchived: boolean | null
    pinPresent: boolean
    startDate: string | null
    endDate: string | null
    groupDeadlineDate: string | null
  }
  ownerPermission: string | null
  chatbot: {
    exists: boolean
    id: string | null
    ownerId: string | null
    courseId: string | null
    name: string | null
    disclaimerId: string | null
    contentHash: string | null
  }
  disclaimer: {
    exists: boolean
    id: string | null
    ownerId: string | null
    name: string | null
    contentHash: string | null
  }
  server: {
    exists: boolean
    id: string | null
    name: string | null
    url: string | null
    authType: string | null
    authSecretPresent: boolean
    authSecretMatches: boolean
    isActive: boolean | null
    passChatbotId: boolean | null
    chatbotIdHeader: string | null
  }
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
  conflicts: {
    courseNameId: string | null
    chatbotNameId: string | null
    disclaimerNameId: string | null
    serverNameId: string | null
  }
}

type StateSnapshot = {
  ownerId: string
  ownerRole: string
  bundles: BundleSnapshot[]
}

type Receipt = {
  version: 1 | 2
  scope: 'lecturer-demo-prd-two-courses'
  stage: 'before' | 'after'
  status: 'dry-run' | 'applied'
  payloadHash: string
  beforeStateHash: string
  afterStateHash: string | null
  beforeStateHashVersion: 1 | 2
  afterStateHashVersion: 1 | 2
  targetUrl: string
  secretEnvVar: string
  plannedCreates: number
}

function stableUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
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

function sourcePath(fileName: string): string {
  return fileURLToPath(new URL(`../data/_local/${fileName}`, import.meta.url))
}

function readSource(fileName: string): SourcePayload {
  const raw: unknown = JSON.parse(fs.readFileSync(sourcePath(fileName), 'utf8'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${fileName} must contain an object`)
  }
  const value = raw as Record<string, unknown>
  const chatbot = value.chatbot as Record<string, unknown> | undefined
  const disclaimer = value.disclaimer as Record<string, unknown> | undefined
  if (!chatbot || !disclaimer) throw new Error(`${fileName} is incomplete`)
  const systemPrompts = chatbot.systemPrompts as
    | Record<string, unknown>
    | undefined
  if (!systemPrompts) throw new Error(`${fileName} has no system prompts`)
  const prompt = (entry: unknown, name: string): Prompt => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${fileName} ${name} prompt is invalid`)
    }
    const promptValue = entry as Record<string, unknown>
    if (
      typeof promptValue.prompt !== 'string' ||
      typeof promptValue.description !== 'string' ||
      promptValue.prompt.trim() === '' ||
      promptValue.description.trim() === ''
    ) {
      throw new Error(`${fileName} ${name} prompt is incomplete`)
    }
    return {
      prompt: promptValue.prompt,
      description: promptValue.description,
    }
  }
  if (
    typeof chatbot.name !== 'string' ||
    typeof chatbot.description !== 'string' ||
    typeof chatbot.creditInitialCredits !== 'number' ||
    typeof chatbot.creditResetPeriod !== 'string' ||
    typeof chatbot.creditResetAmount !== 'number' ||
    typeof chatbot.creditMaxCredits !== 'number' ||
    typeof chatbot.modelSelection !== 'boolean' ||
    !Array.isArray(chatbot.allowedModelIds) ||
    chatbot.allowedModelIds.some((item) => typeof item !== 'string') ||
    typeof disclaimer.name !== 'string' ||
    typeof disclaimer.title !== 'string' ||
    typeof disclaimer.introText !== 'string'
  ) {
    throw new Error(`${fileName} has unsupported or incomplete fields`)
  }
  return {
    chatbot: {
      name: chatbot.name,
      description: chatbot.description,
      systemPrompts: {
        tutor: prompt(systemPrompts.tutor, 'tutor'),
        explainer: prompt(systemPrompts.explainer, 'explainer'),
      },
      creditInitialCredits: chatbot.creditInitialCredits,
      creditResetPeriod: chatbot.creditResetPeriod as ResetPeriod,
      creditResetAmount: chatbot.creditResetAmount,
      creditMaxCredits: chatbot.creditMaxCredits,
      modelSelection: chatbot.modelSelection,
      allowedModelIds: [...(chatbot.allowedModelIds as string[])],
    },
    disclaimer: {
      name: disclaimer.name,
      title: disclaimer.title,
      introText: disclaimer.introText,
    },
  }
}

function bundleFrom(
  key: Bundle['key'],
  source: SourcePayload,
  rawTool: string,
  courseName: string,
  serverName: string
): Bundle {
  const prefix = `lecturer-demo-prd:${key}`
  const courseId = stableUuid(`${prefix}:course`)
  const chatbotId = stableUuid(`${prefix}:chatbot`)
  const disclaimerId = stableUuid(`${prefix}:disclaimer`)
  const serverId = stableUuid(`${prefix}:server`)
  const tutorId = stableUuid(`${prefix}:tutor`)
  const explainerId = stableUuid(`${prefix}:explainer`)
  for (const id of [
    courseId,
    chatbotId,
    disclaimerId,
    serverId,
    tutorId,
    explainerId,
  ]) {
    if (!UUID.test(id)) throw new Error(`Generated invalid UUID for ${key}`)
  }
  return {
    key,
    course: {
      id: courseId,
      name: courseName,
      displayName: courseName,
      description: `Interner Lecturer-Demo-Kurs für ${source.chatbot.name}.`,
      language: 'de',
      color: '#CCD5ED',
      startDate: START_DATE,
      endDate: END_DATE,
      groupDeadlineDate: END_DATE,
    },
    chatbot: {
      ...source.chatbot,
      id: chatbotId,
      courseId,
      ownerId: null,
      disclaimerId,
    },
    disclaimer: {
      ...source.disclaimer,
      name: `${courseName} Disclaimer`,
      id: disclaimerId,
      ownerId: null,
    },
    server: {
      id: serverId,
      name: serverName,
      description: `PRD Doc Query MCP server for the ${source.chatbot.name} lecturer demo.`,
      url: TARGET_URL,
      authType: 'bearer',
      isActive: false,
      passChatbotId: false,
      chatbotIdHeader: null,
    },
    configs: {
      tutorId: tutorId,
      explainerId: explainerId,
      chatbotId,
      serverId,
      rawTool,
    },
  }
}

function loadBundles(): Bundle[] {
  return [
    bundleFrom(
      'iuw',
      readSource('informatik-und-wirtschaft-chatbot.json'),
      RAW_TOOLS.iuw,
      'testkurs IuW',
      'testkurs IuW PRD Doc Query'
    ),
    bundleFrom(
      'rsv',
      readSource('lecturer-demo-prd-rsv.json'),
      RAW_TOOLS.rsv,
      'testkurs RadioSurfVet',
      'testkurs RadioSurfVet PRD Doc Query'
    ),
  ]
}

function payload(bundles: Bundle[]) {
  return {
    scope: 'lecturer-demo-prd-two-courses',
    ownerShortname: OWNER_SHORTNAME,
    targetUrl: TARGET_URL,
    secretEnvVar: SECRET_ENV_VAR,
    startDate: START_DATE,
    endDate: END_DATE,
    bundles: bundles.map((bundle) => ({
      key: bundle.key,
      course: bundle.course,
      chatbot: {
        id: bundle.chatbot.id,
        name: bundle.chatbot.name,
        courseId: bundle.chatbot.courseId,
        disclaimerId: bundle.chatbot.disclaimerId,
        contentHash: hash({
          description: bundle.chatbot.description,
          systemPrompts: bundle.chatbot.systemPrompts,
          creditInitialCredits: bundle.chatbot.creditInitialCredits,
          creditResetPeriod: bundle.chatbot.creditResetPeriod,
          creditResetAmount: bundle.chatbot.creditResetAmount,
          creditMaxCredits: bundle.chatbot.creditMaxCredits,
          modelSelection: bundle.chatbot.modelSelection,
          allowedModelIds: bundle.chatbot.allowedModelIds,
        }),
      },
      disclaimer: {
        id: bundle.disclaimer.id,
        name: bundle.disclaimer.name,
        contentHash: hash({
          name: bundle.disclaimer.name,
          title: bundle.disclaimer.title,
          introText: bundle.disclaimer.introText,
        }),
      },
      server: bundle.server,
      configs: bundle.configs,
    })),
  }
}

function dateIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

async function readBundleSnapshot(
  db: Database,
  bundle: Bundle,
  ownerId: string,
  secret: string
): Promise<BundleSnapshot> {
  const [
    course,
    chatbot,
    disclaimer,
    server,
    configs,
    serverConfigs,
    ownerPermission,
    courseNameConflict,
    chatbotNameConflict,
    disclaimerNameConflict,
    serverNameConflict,
  ] = await Promise.all([
    db.course.findUnique({
      where: { id: bundle.course.id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        displayName: true,
        language: true,
        authType: true,
        isArchived: true,
        pinCode: true,
        startDate: true,
        endDate: true,
        groupDeadlineDate: true,
      },
    }),
    db.chatbot.findUnique({
      where: { id: bundle.chatbot.id },
      select: {
        id: true,
        ownerId: true,
        courseId: true,
        name: true,
        description: true,
        systemPrompts: true,
        creditInitialCredits: true,
        creditResetPeriod: true,
        creditResetAmount: true,
        creditMaxCredits: true,
        modelSelection: true,
        allowedModelIds: true,
        disclaimerId: true,
      },
    }),
    db.chatbotDisclaimer.findUnique({
      where: { id: bundle.disclaimer.id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        title: true,
        introText: true,
      },
    }),
    db.chatbotMCPServer.findUnique({
      where: { id: bundle.server.id },
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
      where: { chatbotId: bundle.chatbot.id },
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
      where: { mcpServerId: bundle.server.id },
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
    db.derivedPermission.findUnique({
      where: {
        courseId_userId: { courseId: bundle.course.id, userId: ownerId },
      },
      select: { permissionLevel: true },
    }),
    db.course.findFirst({
      where: {
        ownerId,
        name: bundle.course.name,
        id: { not: bundle.course.id },
      },
      select: { id: true },
    }),
    db.chatbot.findFirst({
      where: {
        courseId: bundle.course.id,
        name: bundle.chatbot.name,
        id: { not: bundle.chatbot.id },
      },
      select: { id: true },
    }),
    db.chatbotDisclaimer.findFirst({
      where: {
        ownerId,
        name: bundle.disclaimer.name,
        id: { not: bundle.disclaimer.id },
      },
      select: { id: true },
    }),
    db.chatbotMCPServer.findFirst({
      where: { name: bundle.server.name, id: { not: bundle.server.id } },
      select: { id: true },
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
    key: bundle.key,
    course: {
      exists: course !== null,
      id: course?.id ?? null,
      ownerId: course?.ownerId ?? null,
      name: course?.name ?? null,
      displayName: course?.displayName ?? null,
      language: course?.language ?? null,
      authType: course?.authType ?? null,
      isArchived: course?.isArchived ?? null,
      pinPresent: course?.pinCode !== null && course?.pinCode !== undefined,
      startDate: dateIso(course?.startDate),
      endDate: dateIso(course?.endDate),
      groupDeadlineDate: dateIso(course?.groupDeadlineDate),
    },
    ownerPermission: ownerPermission?.permissionLevel ?? null,
    chatbot: {
      exists: chatbot !== null,
      id: chatbot?.id ?? null,
      ownerId: chatbot?.ownerId ?? null,
      courseId: chatbot?.courseId ?? null,
      name: chatbot?.name ?? null,
      disclaimerId: chatbot?.disclaimerId ?? null,
      contentHash: chatbot
        ? hash({
            description: chatbot.description,
            systemPrompts: chatbot.systemPrompts,
            creditInitialCredits: chatbot.creditInitialCredits,
            creditResetPeriod: chatbot.creditResetPeriod,
            creditResetAmount: chatbot.creditResetAmount,
            creditMaxCredits: chatbot.creditMaxCredits,
            modelSelection: chatbot.modelSelection,
            allowedModelIds: chatbot.allowedModelIds,
          })
        : null,
    },
    disclaimer: {
      exists: disclaimer !== null,
      id: disclaimer?.id ?? null,
      ownerId: disclaimer?.ownerId ?? null,
      name: disclaimer?.name ?? null,
      contentHash: disclaimer
        ? hash({
            name: disclaimer.name,
            title: disclaimer.title,
            introText: disclaimer.introText,
          })
        : null,
    },
    server: {
      exists: server !== null,
      id: server?.id ?? null,
      name: server?.name ?? null,
      url: server?.url ?? null,
      authType: server?.authType ?? null,
      authSecretPresent:
        server?.authSecret !== null && server?.authSecret !== undefined,
      authSecretMatches,
      isActive: server?.isActive ?? null,
      passChatbotId: server?.passChatbotId ?? null,
      chatbotIdHeader: server?.chatbotIdHeader ?? null,
    },
    configs,
    serverConfigs,
    conflicts: {
      courseNameId: courseNameConflict?.id ?? null,
      chatbotNameId: chatbotNameConflict?.id ?? null,
      disclaimerNameId: disclaimerNameConflict?.id ?? null,
      serverNameId: serverNameConflict?.id ?? null,
    },
  }
}

async function readState(
  db: Database,
  bundles: Bundle[],
  ownerId: string,
  ownerRole: string,
  secret: string
): Promise<StateSnapshot> {
  const snapshots = await Promise.all(
    bundles.map((bundle) => readBundleSnapshot(db, bundle, ownerId, secret))
  )
  return { ownerId, ownerRole, bundles: snapshots }
}

function expectedConfigs(bundle: Bundle) {
  return [
    {
      id: bundle.configs.tutorId,
      chatbotId: bundle.chatbot.id,
      mcpServerId: bundle.server.id,
      chatMode: 'tutor',
      allowedTools: [bundle.configs.rawTool],
      priority: 0,
      isEnabled: true,
      parameters: STRICT_PARAMETERS,
    },
    {
      id: bundle.configs.explainerId,
      chatbotId: bundle.chatbot.id,
      mcpServerId: bundle.server.id,
      chatMode: 'explainer',
      allowedTools: [bundle.configs.rawTool],
      priority: 0,
      isEnabled: true,
      parameters: STRICT_PARAMETERS,
    },
  ].sort((a, b) => a.chatMode.localeCompare(b.chatMode))
}

function expectedChatbotHash(bundle: Bundle): string {
  return hash({
    description: bundle.chatbot.description,
    systemPrompts: bundle.chatbot.systemPrompts,
    creditInitialCredits: bundle.chatbot.creditInitialCredits,
    creditResetPeriod: bundle.chatbot.creditResetPeriod,
    creditResetAmount: bundle.chatbot.creditResetAmount,
    creditMaxCredits: bundle.chatbot.creditMaxCredits,
    modelSelection: bundle.chatbot.modelSelection,
    allowedModelIds: bundle.chatbot.allowedModelIds,
  })
}

function expectedDisclaimerHash(bundle: Bundle): string {
  return hash({
    name: bundle.disclaimer.name,
    title: bundle.disclaimer.title,
    introText: bundle.disclaimer.introText,
  })
}

function isExact(snapshot: BundleSnapshot, bundle: Bundle): boolean {
  return (
    snapshot.conflicts.courseNameId === null &&
    snapshot.conflicts.chatbotNameId === null &&
    snapshot.conflicts.disclaimerNameId === null &&
    snapshot.conflicts.serverNameId === null &&
    snapshot.course.exists &&
    snapshot.course.id === bundle.course.id &&
    snapshot.course.ownerId === bundle.chatbot.ownerId &&
    snapshot.course.name === bundle.course.name &&
    snapshot.course.displayName === bundle.course.displayName &&
    snapshot.course.language === bundle.course.language &&
    snapshot.course.authType === 'PIN' &&
    snapshot.course.isArchived === false &&
    snapshot.course.pinPresent &&
    snapshot.course.startDate === bundle.course.startDate &&
    snapshot.course.endDate === bundle.course.endDate &&
    snapshot.course.groupDeadlineDate === bundle.course.groupDeadlineDate &&
    snapshot.ownerPermission === 'OWNER' &&
    snapshot.chatbot.exists &&
    snapshot.chatbot.id === bundle.chatbot.id &&
    snapshot.chatbot.ownerId === bundle.chatbot.ownerId &&
    snapshot.chatbot.courseId === bundle.course.id &&
    snapshot.chatbot.name === bundle.chatbot.name &&
    snapshot.chatbot.disclaimerId === bundle.disclaimer.id &&
    snapshot.chatbot.contentHash === expectedChatbotHash(bundle) &&
    snapshot.disclaimer.exists &&
    snapshot.disclaimer.id === bundle.disclaimer.id &&
    snapshot.disclaimer.ownerId === bundle.chatbot.ownerId &&
    snapshot.disclaimer.name === bundle.disclaimer.name &&
    snapshot.disclaimer.contentHash === expectedDisclaimerHash(bundle) &&
    snapshot.server.exists &&
    snapshot.server.id === bundle.server.id &&
    snapshot.server.name === bundle.server.name &&
    snapshot.server.url === bundle.server.url &&
    snapshot.server.authType === 'bearer' &&
    snapshot.server.authSecretPresent &&
    snapshot.server.authSecretMatches &&
    snapshot.server.isActive === false &&
    snapshot.server.passChatbotId === false &&
    snapshot.server.chatbotIdHeader === null &&
    canonical(snapshot.configs) === canonical(expectedConfigs(bundle)) &&
    canonical(snapshot.serverConfigs) === canonical(expectedConfigs(bundle))
  )
}

function isAbsent(snapshot: BundleSnapshot): boolean {
  return (
    !snapshot.course.exists &&
    !snapshot.chatbot.exists &&
    !snapshot.disclaimer.exists &&
    !snapshot.server.exists &&
    snapshot.configs.length === 0 &&
    snapshot.serverConfigs.length === 0 &&
    snapshot.ownerPermission === null &&
    snapshot.conflicts.courseNameId === null &&
    snapshot.conflicts.chatbotNameId === null &&
    snapshot.conflicts.disclaimerNameId === null &&
    snapshot.conflicts.serverNameId === null
  )
}

function stateKind(
  snapshot: BundleSnapshot,
  bundle: Bundle
): 'absent' | 'exact' | 'partial' {
  if (isAbsent(snapshot)) return 'absent'
  if (isExact(snapshot, bundle)) return 'exact'
  return 'partial'
}

function assertOwner(ownerId: string, ownerRole: string) {
  if (!UUID.test(ownerId) || ownerRole !== 'ADMIN') {
    throw new Error(
      'The approved klick owner account is missing or not an administrator'
    )
  }
}

function assertTargetState(state: StateSnapshot, bundles: Bundle[]) {
  assertOwner(state.ownerId, state.ownerRole)
  for (const [index, bundle] of bundles.entries()) {
    const snapshot = state.bundles[index]
    if (!snapshot) throw new Error(`Missing ${bundle.key} state snapshot`)
    const kind = stateKind(snapshot, bundle)
    if (kind === 'partial') {
      throw new Error(
        `Refusing partial or competing ${bundle.key} lecturer-demo state`
      )
    }
  }
}

function readReceipt(receiptPath: string): Receipt | null {
  if (!fs.existsSync(receiptPath)) return null
  const raw: unknown = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('The lecturer-demo receipt is invalid')
  }
  const value = raw as Record<string, unknown>
  const version = Number(value.version)
  const beforeStateHashVersion =
    value.beforeStateHashVersion === undefined
      ? version === 1
        ? 1
        : 2
      : Number(value.beforeStateHashVersion)
  const afterStateHashVersion =
    value.afterStateHashVersion === undefined
      ? version === 1
        ? 1
        : 2
      : Number(value.afterStateHashVersion)
  if (
    ![1, 2].includes(version) ||
    value.scope !== 'lecturer-demo-prd-two-courses' ||
    !['before', 'after'].includes(String(value.stage)) ||
    !['dry-run', 'applied'].includes(String(value.status)) ||
    typeof value.payloadHash !== 'string' ||
    typeof value.beforeStateHash !== 'string' ||
    (value.afterStateHash !== null &&
      typeof value.afterStateHash !== 'string') ||
    ![1, 2].includes(beforeStateHashVersion) ||
    ![1, 2].includes(afterStateHashVersion) ||
    value.targetUrl !== TARGET_URL ||
    value.secretEnvVar !== SECRET_ENV_VAR ||
    typeof value.plannedCreates !== 'number'
  ) {
    throw new Error('The lecturer-demo receipt is invalid')
  }
  return {
    ...(value as Receipt),
    version: version as 1 | 2,
    beforeStateHashVersion: beforeStateHashVersion as 1 | 2,
    afterStateHashVersion: afterStateHashVersion as 1 | 2,
  }
}

function writeReceipt(receiptPath: string, receipt: Receipt) {
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true })
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
}

function archiveLegacyReceipt(receiptPath: string) {
  const archivePath = `${receiptPath}.history-v1.json`
  if (!fs.existsSync(archivePath)) fs.copyFileSync(receiptPath, archivePath)
}

function randomPin(): number {
  return randomInt(100_000_000, 1_000_000_000)
}

async function createBundle(
  tx: Prisma.TransactionClient,
  bundle: Bundle,
  ownerId: string,
  secret: string,
  encrypt: (value: string) => string
) {
  await tx.course.create({
    data: {
      id: bundle.course.id,
      name: bundle.course.name,
      displayName: bundle.course.displayName,
      description: bundle.course.description,
      language: bundle.course.language,
      color: bundle.course.color,
      startDate: new Date(bundle.course.startDate),
      endDate: new Date(bundle.course.endDate),
      groupDeadlineDate: new Date(bundle.course.groupDeadlineDate),
      isGroupCreationEnabled: true,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      isArchived: false,
      authType: 'PIN',
      pinCode: randomPin(),
      ownerId,
    },
  })

  const { recomputeDerivedPermissions } = await import('@klicker-uzh/util')
  await recomputeDerivedPermissions(
    { courseId: bundle.course.id, userId: ownerId },
    tx
  )

  await tx.chatbotDisclaimer.create({
    data: {
      id: bundle.disclaimer.id,
      name: bundle.disclaimer.name,
      title: bundle.disclaimer.title,
      introText: bundle.disclaimer.introText,
      ownerId,
    },
  })

  await tx.chatbotMCPServer.create({
    data: {
      id: bundle.server.id,
      name: bundle.server.name,
      description: bundle.server.description,
      url: bundle.server.url,
      authType: bundle.server.authType,
      authSecret: encrypt(secret),
      passChatbotId: bundle.server.passChatbotId,
      chatbotIdHeader: bundle.server.chatbotIdHeader,
      isActive: false,
    },
  })

  await tx.chatbot.create({
    data: {
      id: bundle.chatbot.id,
      name: bundle.chatbot.name,
      description: bundle.chatbot.description,
      systemPrompts: bundle.chatbot.systemPrompts as Prisma.InputJsonValue,
      creditInitialCredits: bundle.chatbot.creditInitialCredits,
      creditResetPeriod: bundle.chatbot.creditResetPeriod,
      creditResetAmount: bundle.chatbot.creditResetAmount,
      creditMaxCredits: bundle.chatbot.creditMaxCredits,
      modelSelection: bundle.chatbot.modelSelection,
      allowedModelIds: bundle.chatbot.allowedModelIds,
      disclaimerId: bundle.disclaimer.id,
      ownerId,
      courseId: bundle.course.id,
    },
  })

  await tx.chatbotMCPConfig.createMany({
    data: expectedConfigs(bundle).map((config) => ({
      id: config.id,
      chatbotId: config.chatbotId,
      mcpServerId: config.mcpServerId,
      chatMode: config.chatMode,
      allowedTools: config.allowedTools as Prisma.InputJsonValue,
      priority: config.priority,
      isEnabled: config.isEnabled,
      parameters: config.parameters as Prisma.InputJsonValue,
    })),
  })
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if ([...args].some((arg) => arg !== '--apply')) {
    throw new Error('Only --apply is supported; dry-run is the default')
  }
  const apply = args.has('--apply')
  const receiptPath = path.resolve(
    process.env.LECTURER_DEMO_RECEIPT_PATH ?? DEFAULT_RECEIPT_PATH
  )
  const bundles = loadBundles()
  const payloadHash = hash(payload(bundles))
  const secret = requiredEnv(SECRET_ENV_VAR)
  requiredEnv('APP_SECRET')
  let saved = readReceipt(receiptPath)

  const [{ prisma }, { decrypt, encrypt }] = await Promise.all([
    import('@klicker-uzh/prisma'),
    import('@klicker-uzh/util'),
  ])

  try {
    const owner = await prisma.user.findUnique({
      where: { shortname: OWNER_SHORTNAME },
      select: { id: true, shortname: true, role: true },
    })
    if (!owner || owner.shortname !== OWNER_SHORTNAME) {
      throw new Error('The approved klick owner account was not found')
    }
    assertOwner(owner.id, owner.role)
    for (const bundle of bundles) bundle.chatbot.ownerId = owner.id
    for (const bundle of bundles) bundle.disclaimer.ownerId = owner.id

    const before = await readState(
      prisma,
      bundles,
      owner.id,
      owner.role,
      secret
    )
    const beforeStateHash = hash(before)
    if (saved && saved.payloadHash !== payloadHash) {
      throw new Error(
        'The existing receipt does not match the approved payload'
      )
    }

    if (saved?.version === 1) {
      if (saved.stage === 'after') {
        if (
          bundles.some(
            (bundle, index) => !isExact(before.bundles[index]!, bundle)
          )
        ) {
          throw new Error('The applied lecturer-demo state is not exact')
        }
        archiveLegacyReceipt(receiptPath)
        const upgraded: Receipt = {
          scope: 'lecturer-demo-prd-two-courses',
          version: 2,
          stage: 'after',
          status: 'applied',
          payloadHash: saved.payloadHash,
          beforeStateHash: saved.beforeStateHash,
          afterStateHash: beforeStateHash,
          beforeStateHashVersion: 1,
          afterStateHashVersion: 2,
          targetUrl: TARGET_URL,
          secretEnvVar: SECRET_ENV_VAR,
          plannedCreates: saved.plannedCreates,
        }
        writeReceipt(receiptPath, upgraded)
        saved = upgraded
      } else {
        if (apply) {
          throw new Error(
            'The legacy dry-run receipt must be upgraded by a fresh dry run before apply'
          )
        }
        assertTargetState(before, bundles)
        archiveLegacyReceipt(receiptPath)
        const upgraded: Receipt = {
          scope: 'lecturer-demo-prd-two-courses',
          version: 2,
          stage: 'before',
          status: 'dry-run',
          payloadHash: saved.payloadHash,
          beforeStateHash,
          afterStateHash: null,
          beforeStateHashVersion: 2,
          afterStateHashVersion: 2,
          targetUrl: TARGET_URL,
          secretEnvVar: SECRET_ENV_VAR,
          plannedCreates: saved.plannedCreates,
        }
        writeReceipt(receiptPath, upgraded)
        saved = upgraded
      }
    }

    if (saved?.stage === 'after') {
      if (saved.afterStateHash !== beforeStateHash) {
        throw new Error('The applied lecturer-demo state has drifted')
      }
      if (
        bundles.some(
          (bundle, index) => !isExact(before.bundles[index]!, bundle)
        )
      ) {
        throw new Error('The applied lecturer-demo state is not exact')
      }
      console.log(
        'Already applied: exact inactive PRD two-course state verified; 0 writes executed'
      )
      return
    }

    assertTargetState(before, bundles)
    const kinds = bundles.map((bundle, index) =>
      stateKind(before.bundles[index]!, bundle)
    )
    const plannedCreates = kinds.reduce(
      (sum, kind) => sum + (kind === 'absent' ? 6 : 0),
      0
    )
    if (saved && (saved.stage !== 'before' || saved.status !== 'dry-run')) {
      throw new Error('Apply requires a matching before-state dry-run receipt')
    }
    if (saved && saved.beforeStateHash !== beforeStateHash) {
      throw new Error('The dry-run receipt does not match current PRD state')
    }
    if (apply && !saved) {
      throw new Error(
        'Apply requires a matching before-state dry-run receipt; rerun after the dry run'
      )
    }
    if (!saved) {
      writeReceipt(receiptPath, {
        version: 2,
        scope: 'lecturer-demo-prd-two-courses',
        stage: 'before',
        status: 'dry-run',
        payloadHash,
        beforeStateHash,
        afterStateHash: null,
        beforeStateHashVersion: 2,
        afterStateHashVersion: 2,
        targetUrl: TARGET_URL,
        secretEnvVar: SECRET_ENV_VAR,
        plannedCreates,
      })
    }

    if (!apply) {
      console.log(
        `Dry run complete: ${plannedCreates} PRD lecturer-demo rows planned; both MCP servers remain inactive`
      )
      return
    }

    const after = await prisma.$transaction(
      async (tx) => {
        const transactionOwner = await tx.user.findUnique({
          where: { shortname: OWNER_SHORTNAME },
          select: { id: true, shortname: true, role: true },
        })
        if (!transactionOwner || transactionOwner.id !== owner.id) {
          throw new Error('The approved klick owner changed before apply')
        }
        assertOwner(transactionOwner.id, transactionOwner.role)
        const transactionBefore = await readState(
          tx,
          bundles,
          transactionOwner.id,
          transactionOwner.role,
          secret
        )
        if (hash(transactionBefore) !== beforeStateHash) {
          throw new Error(
            'The transaction starting state differs from the dry-run receipt'
          )
        }
        assertTargetState(transactionBefore, bundles)
        for (const [index, bundle] of bundles.entries()) {
          const kind = stateKind(transactionBefore.bundles[index]!, bundle)
          if (kind === 'absent') {
            await createBundle(tx, bundle, transactionOwner.id, secret, encrypt)
          }
        }
        const transactionAfter = await readState(
          tx,
          bundles,
          transactionOwner.id,
          transactionOwner.role,
          secret
        )
        for (const [index, bundle] of bundles.entries()) {
          if (!isExact(transactionAfter.bundles[index]!, bundle)) {
            throw new Error(
              `Post-state ${bundle.key} lecturer-demo invariant failed`
            )
          }
        }
        for (const bundle of bundles) {
          const server = await tx.chatbotMCPServer.findUnique({
            where: { id: bundle.server.id },
            select: { authSecret: true },
          })
          if (!server?.authSecret || decrypt(server.authSecret) !== secret) {
            throw new Error(
              `Post-state ${bundle.key} credential verification failed`
            )
          }
        }
        return transactionAfter
      },
      { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 60_000 }
    )

    writeReceipt(receiptPath, {
      version: 2,
      scope: 'lecturer-demo-prd-two-courses',
      stage: 'after',
      status: 'applied',
      payloadHash,
      beforeStateHash,
      afterStateHash: hash(after),
      beforeStateHashVersion: 2,
      afterStateHashVersion: 2,
      targetUrl: TARGET_URL,
      secretEnvVar: SECRET_ENV_VAR,
      plannedCreates,
    })
    console.log(
      `Apply complete: ${plannedCreates} PRD lecturer-demo rows created and verified; both MCP servers remain inactive`
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
      error instanceof Error ? error.message : 'Provisioning failed'
    )
    process.exitCode = 1
  }
}
