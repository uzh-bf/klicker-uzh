import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@klicker-uzh/prisma/client'
import { CHAT_BASE_MODEL_ID } from '@klicker-uzh/util'
import { signResponseExampleBaselineJob } from '@klicker-uzh/util/auth'
import {
  evaluateResponseExampleCurrentEligibility,
  hasCompleteResponseExampleCitationParity,
  loadCurrentResponseExampleResources,
} from '@klicker-uzh/util/response-example-eligibility'
import {
  computeResponseExampleBaselineConfigurationDigest,
  computeResponseExampleBaselineValueDigest,
} from '@klicker-uzh/util/response-example-runtime'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'
import { extractChatbotModes } from '../lib/responseExampleContract.js'
import { getChatModelRegistry } from './chatbots.js'
import { reconcileCurrentResponseExampleEligibility } from './responseExamples.js'

export const BASELINE_REPORT_MAX_CASES = 200
export const BASELINE_CASE_TIMEOUT_MS = 120_000
const activeStatuses = ['QUEUED', 'RUNNING'] as const
export const baselineConfigurationSelect = {
  systemPrompts: true,
  standardModeConfig: true,
  customModeConfig: true,
  draftConfig: true,
  answerPreferencesEnabled: true,
  knowledgeGraphRetrievalEnabled: true,
  openaiApiKey: true,
  openaiBaseUrl: true,
  knowledgeBases: {
    where: { isEnabled: true, kb: { deletedAt: null } },
    select: { kbId: true },
    orderBy: { id: 'asc' },
  },
  mcpConfigurations: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      allowedTools: true,
      chatMode: true,
      isEnabled: true,
      mcpServerId: true,
      parameters: true,
      priority: true,
      mcpServer: {
        select: {
          id: true,
          name: true,
          url: true,
          authType: true,
          authSecret: true,
          parameters: true,
          isActive: true,
          passChatbotId: true,
          chatbotIdHeader: true,
        },
      },
    },
  },
  course: { select: { displayName: true } },
} satisfies Prisma.ChatbotSelect

function failure(code: string) {
  return new GraphQLError(code, { extensions: { code } })
}
function requireOwner(ctx: ContextWithUser) {
  if (
    ctx.user.role !== 'USER' ||
    !['ACCOUNT_OWNER', 'FULL_ACCESS'].includes(ctx.user.scope ?? '')
  )
    throw failure('FORBIDDEN')
}
export function baselineTransportConfigured(env = process.env) {
  try {
    const url = new URL(env.CHAT_BASELINE_INTERNAL_URL ?? '')
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      Boolean(
        env.RESPONSE_EXAMPLE_BASELINE_JOB_SECRET &&
          env.RESPONSE_EXAMPLE_BASELINE_JOB_SECRET.length >= 32
      )
    )
  } catch {
    return false
  }
}
export function currentBaselineModel() {
  const model = getChatModelRegistry().find(
    (item) => item.id === CHAT_BASE_MODEL_ID && item.usageClass === 'BASE'
  )
  if (!model) throw failure('BASELINE_MODEL_UNAVAILABLE')
  return model
}
export function baselineModelDigest(model = currentBaselineModel()) {
  return computeResponseExampleBaselineValueDigest({
    id: model.id,
    deploymentId: model.deploymentId,
    maxOutputTokens: model.maxOutputTokens,
    usesResponsesApi: model.usesResponsesApi,
    cost: model.cost,
    supportedReasoningEfforts: model.supportedReasoningEfforts,
  })
}
export async function getResponseExampleBaseline(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
) {
  requireOwner(ctx)
  if (!z.string().guid().safeParse(chatbotId).success) return null
  const chatbot = await ctx.prisma.chatbot.findFirst({
    where: { id: chatbotId, ownerId: ctx.user.sub },
    select: {
      ...baselineConfigurationSelect,
      id: true,
      status: true,
      owner: { select: { aiFeaturesEnabled: true } },
    },
  })
  if (!chatbot) return null
  const set = await reconcileCurrentResponseExampleEligibility(
    ctx.prisma,
    chatbotId
  )
  const eligible =
    set?.examples.filter(
      (example) =>
        example.status === 'APPROVED' &&
        set.chatModes.includes(example.chatMode) &&
        example.evidenceReferences.every((ref) => ref.evidenceEligible) &&
        hasCompleteResponseExampleCitationParity(example)
    ) ?? []
  const report = set
    ? await ctx.prisma.responseExampleBaselineReport.findUnique({
        where: { setId: set.id },
        include: { cases: { orderBy: { ordinal: 'asc' } } },
      })
    : null
  let modelDigest: string | null = null
  try {
    modelDigest = baselineModelDigest()
  } catch {
    /* Model unavailability is exposed below. */
  }
  const stale = Boolean(
    report &&
      (report.setDigest !== set?.digest ||
        report.configurationDigest !==
          computeResponseExampleBaselineConfigurationDigest(chatbot) ||
        report.modelConfigurationDigest !== modelDigest)
  )
  const expired = Boolean(
    report &&
      activeStatuses.includes(
        report.status as (typeof activeStatuses)[number]
      ) &&
      report.deadline <= new Date()
  )
  return {
    eligibleCount: eligible.length,
    excludedCount: (set?.examples.length ?? 0) - eligible.length,
    available:
      baselineTransportConfigured() &&
      chatbot.owner.aiFeaturesEnabled &&
      chatbot.status !== 'PAUSED' &&
      Boolean(modelDigest) &&
      eligible.length > 0 &&
      (set?.examples.length ?? 0) <= BASELINE_REPORT_MAX_CASES,
    report: report
      ? {
          ...report,
          stale,
          status: expired ? ('INCOMPLETE' as const) : report.status,
          errorCode: expired ? 'BASELINE_DEADLINE_EXCEEDED' : report.errorCode,
        }
      : null,
  }
}

export async function startResponseExampleBaseline(
  {
    chatbotId,
    replaceActive = false,
  }: { chatbotId: string; replaceActive?: boolean | null },
  ctx: ContextWithUser
) {
  requireOwner(ctx)
  if (!baselineTransportConfigured()) throw failure('BASELINE_UNAVAILABLE')
  const overview = await getResponseExampleBaseline({ chatbotId }, ctx)
  if (!overview?.available) throw failure('BASELINE_UNAVAILABLE')
  const model = currentBaselineModel()
  const runId = randomUUID()
  await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Chatbot" WHERE "id"=${chatbotId}::uuid FOR UPDATE`
    )
    const chatbot = await tx.chatbot.findFirst({
      where: {
        id: chatbotId,
        ownerId: ctx.user.sub,
        status: { not: 'PAUSED' },
        owner: { aiFeaturesEnabled: true },
      },
      select: baselineConfigurationSelect,
    })
    if (!chatbot) throw failure('FORBIDDEN')
    const set = await tx.responseExampleSet.findUnique({
      where: { chatbotId },
      include: {
        examples: {
          take: BASELINE_REPORT_MAX_CASES + 1,
          orderBy: { id: 'asc' },
          include: { evidenceReferences: true },
        },
        baselineReport: true,
      },
    })
    if (!set || set.examples.length > BASELINE_REPORT_MAX_CASES)
      throw failure('BASELINE_UNAVAILABLE')
    if (
      set.baselineReport &&
      activeStatuses.includes(
        set.baselineReport.status as (typeof activeStatuses)[number]
      ) &&
      set.baselineReport.deadline > new Date() &&
      !replaceActive
    )
      throw failure('BASELINE_REPLACE_CONFIRMATION_REQUIRED')
    const resourceIds = set.examples.flatMap((example) =>
      example.evidenceReferences.map((ref) => ref.sourceId)
    )
    const resources = await loadCurrentResponseExampleResources(
      tx,
      chatbotId,
      resourceIds
    )
    const modes = extractChatbotModes(
      chatbot.systemPrompts,
      chatbot.standardModeConfig,
      chatbot.mcpConfigurations
    )
    const eligible = set.examples.filter(
      (example) =>
        example.status === 'APPROVED' &&
        modes.includes(example.chatMode) &&
        evaluateResponseExampleCurrentEligibility(example, resources).eligible
    )
    if (!eligible.length) throw failure('BASELINE_NO_ELIGIBLE_EXAMPLES')
    if (set.baselineReport)
      await tx.responseExampleBaselineReport.delete({
        where: { id: set.baselineReport.id },
      })
    await tx.responseExampleBaselineReport.create({
      data: {
        id: runId,
        setId: set.id,
        ownerId: ctx.user.sub,
        setDigest: set.digest,
        configurationDigest:
          computeResponseExampleBaselineConfigurationDigest(chatbot),
        modelId: model.id,
        modelConfigurationDigest: baselineModelDigest(model),
        deadline: new Date(
          Date.now() +
            Math.min(
              8 * 60 * 60_000,
              eligible.length * BASELINE_CASE_TIMEOUT_MS + 10 * 60_000
            )
        ),
        excludedCount: set.examples.length - eligible.length,
        cases: {
          create: eligible.map((example, ordinal) => ({
            exampleId: example.id,
            ordinal,
            chatMode: example.chatMode,
            question: example.studentMessage,
            idealAnswer: example.referenceAnswer,
            expectedEvidence: example.evidenceReferences.map(
              ({
                citationIndex,
                sourceId,
                chunkId,
                contentHash,
                citationAnchor,
              }) => ({
                citationIndex,
                sourceId,
                chunkId,
                contentHash,
                citationAnchor,
              })
            ),
          })),
        },
      },
    })
  })
  try {
    await ctx.tasks.runResponseExampleBaseline.runNoWait({ runId })
  } catch {
    await ctx.prisma.responseExampleBaselineReport.updateMany({
      where: { id: runId, status: 'QUEUED' },
      data: { status: 'FAILED', errorCode: 'BASELINE_ENQUEUE_FAILED' },
    })
  }
  return await getResponseExampleBaseline({ chatbotId }, ctx)
}

export async function handleRunResponseExampleBaseline(
  { runId }: { runId: string },
  global: { prisma: PrismaClient }
) {
  const prisma = global.prisma
  const claimed = await prisma.responseExampleBaselineReport.updateMany({
    where: { id: runId, status: 'QUEUED', deadline: { gt: new Date() } },
    data: { status: 'RUNNING' },
  })
  if (!claimed.count) return { success: false }
  const report = await prisma.responseExampleBaselineReport.findUnique({
    where: { id: runId },
    include: {
      set: { select: { chatbotId: true } },
      cases: { select: { id: true }, orderBy: { ordinal: 'asc' } },
    },
  })
  if (!report) return { success: false }
  try {
    if (!baselineTransportConfigured()) throw new Error('BASELINE_UNAVAILABLE')
    for (const entry of report.cases) {
      const current = await prisma.responseExampleBaselineReport.findFirst({
        where: { id: runId, status: 'RUNNING', deadline: { gt: new Date() } },
        select: { id: true },
      })
      if (!current) return { success: false }
      const scope = {
        ownerId: report.ownerId,
        chatbotId: report.set.chatbotId,
        runId,
        caseId: entry.id,
      }
      const token = await signResponseExampleBaselineJob(
        scope,
        process.env.RESPONSE_EXAMPLE_BASELINE_JOB_SECRET
      )
      const response = await fetch(process.env.CHAT_BASELINE_INTERNAL_URL!, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(BASELINE_CASE_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(scope),
      })
      if (!response.ok) throw new Error('BASELINE_EXECUTION_UNAVAILABLE')
      const result = z
        .object({ completed: z.boolean(), continueRun: z.boolean() })
        .safeParse(await response.json())
      if (!result.success || !result.data.continueRun)
        throw new Error('BASELINE_INCOMPLETE')
    }
    await prisma.responseExampleBaselineReport.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    })
    return { success: true }
  } catch {
    await prisma.responseExampleBaselineReport.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: { status: 'INCOMPLETE', errorCode: 'BASELINE_INCOMPLETE' },
    })
    return { success: false }
  }
}
