import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import { Prisma as PrismaRuntime } from '@klicker-uzh/prisma/client'
import { computeResponseExampleSetDigest } from '@klicker-uzh/util/response-example-digest'
import {
  applyResponseExampleEligibilityReconciliation,
  buildResponseExampleEligibilityReconciliation,
  evaluateResponseExampleCurrentEligibility,
  loadCurrentResponseExampleResources,
  type ResponseExampleEligibilityInput,
  type ResponseExampleEligibilityReconciliation,
  type StoredResponseExampleEligibilityInput,
} from '@klicker-uzh/util/response-example-eligibility'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'
import {
  canApplyResponseExampleAction,
  extractChatbotModes,
  RESPONSE_EXAMPLE_CHAT_MODE_MAX_LENGTH,
  RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH,
  RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH,
  responseExampleStyleSchema,
} from '../lib/responseExampleContract.js'

type ResponseExamplePrisma = Pick<
  Prisma.TransactionClient,
  | '$queryRaw'
  | 'responseExample'
  | 'responseExampleEvidenceReference'
  | 'responseExampleSet'
>

const responseExampleSetInclude = {
  examples: {
    orderBy: [{ chatMode: 'asc' }, { studentMessage: 'asc' }, { id: 'asc' }],
    include: {
      evidenceReferences: {
        orderBy: [
          { citationIndex: 'asc' },
          { sourceId: 'asc' },
          { chunkId: 'asc' },
          { contentHash: 'asc' },
          { citationAnchor: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  },
  chatbot: {
    select: { systemPrompts: true },
  },
} satisfies Prisma.ResponseExampleSetInclude

type ResponseExampleSetWithRelations = Prisma.ResponseExampleSetGetPayload<{
  include: typeof responseExampleSetInclude
}>

type ResponseExampleSetWithModes = ResponseExampleSetWithRelations & {
  chatModes: string[]
}

type ResponseExampleEligibilityRecord = ResponseExampleEligibilityInput & {
  id: string
}

function withChatbotModes(
  set: ResponseExampleSetWithRelations
): ResponseExampleSetWithModes {
  return {
    ...set,
    chatModes: extractChatbotModes(set.chatbot.systemPrompts),
  }
}

export { computeResponseExampleSetDigest }

async function findResponseExampleSet(
  prisma: ResponseExamplePrisma,
  setId: string
) {
  return await prisma.responseExampleSet.findUnique({
    where: { id: setId },
    include: responseExampleSetInclude,
  })
}

const responseExampleIdSchema = z.string().uuid()

async function refreshResponseExampleSetDigestInTransaction(
  prisma: ResponseExamplePrisma,
  setId: string
) {
  await prisma.$queryRaw<{ id: string }[]>(
    PrismaRuntime.sql`
      SELECT "id"
      FROM "public"."ResponseExampleSet"
      WHERE "id" = ${setId}::uuid
      FOR UPDATE
    `
  )

  return await refreshResponseExampleSetDigestAfterLock(prisma, setId)
}

async function refreshResponseExampleSetDigestAfterLock(
  prisma: ResponseExamplePrisma,
  setId: string
) {
  const set = await findResponseExampleSet(prisma, setId)
  if (!set) return null

  return await prisma.responseExampleSet
    .update({
      where: { id: set.id },
      data: { digest: computeResponseExampleSetDigest(set) },
      include: responseExampleSetInclude,
    })
    .then(withChatbotModes)
}

async function loadCurrentEligibility(
  prisma: ResponseExamplePrisma,
  chatbotId: string,
  examples: readonly StoredResponseExampleEligibilityInput[]
) {
  const sourceIds = [
    ...new Set(
      examples.flatMap((example) =>
        example.evidenceReferences
          .map((reference) => reference.sourceId)
          .filter(
            (sourceId) => responseExampleIdSchema.safeParse(sourceId).success
          )
      )
    ),
  ]
  const resources = await loadCurrentResponseExampleResources(
    prisma,
    chatbotId,
    sourceIds
  )

  return buildResponseExampleEligibilityReconciliation(examples, resources)
}

async function getCurrentEligibilityForExample(
  prisma: ResponseExamplePrisma,
  chatbotId: string,
  example: ResponseExampleEligibilityRecord
) {
  const sourceIds = [
    ...new Set(
      example.evidenceReferences
        .map((reference) => reference.sourceId)
        .filter(
          (sourceId) => responseExampleIdSchema.safeParse(sourceId).success
        )
    ),
  ]
  const resources = await loadCurrentResponseExampleResources(
    prisma,
    chatbotId,
    sourceIds
  )

  return evaluateResponseExampleCurrentEligibility(example, resources)
}

async function updateStoredEvidenceEligibility(
  prisma: ResponseExamplePrisma,
  example: {
    evidenceReferences: readonly {
      id: string
      evidenceEligible: boolean
    }[]
  },
  current: ReturnType<typeof evaluateResponseExampleCurrentEligibility>
) {
  for (const [index, reference] of example.evidenceReferences.entries()) {
    const evidenceEligible = current.evidenceEligibility[index] ?? false
    if (reference.evidenceEligible !== evidenceEligible) {
      await prisma.responseExampleEvidenceReference.update({
        where: { id: reference.id },
        data: { evidenceEligible },
      })
    }
  }
}

function projectCurrentEligibility(
  set: ResponseExampleSetWithRelations,
  eligibility: ResponseExampleEligibilityReconciliation['currentEligibility']
) {
  return {
    ...set,
    examples: set.examples.map((example) => ({
      ...example,
      evidenceReferences: example.evidenceReferences.map(
        (reference, index) => ({
          ...reference,
          evidenceEligible:
            eligibility.get(example.id)?.evidenceEligibility[index] ?? false,
        })
      ),
    })),
  }
}

export async function reconcileCurrentResponseExampleEligibility(
  prisma: PrismaClient,
  chatbotId: string
) {
  const initialSet = await prisma.responseExampleSet.findUnique({
    where: { chatbotId },
    include: responseExampleSetInclude,
  })
  if (!initialSet) return null

  const initialEligibility = await loadCurrentEligibility(
    prisma,
    chatbotId,
    initialSet.examples
  )
  if (!initialEligibility.changed) {
    return withChatbotModes(
      projectCurrentEligibility(
        initialSet,
        initialEligibility.currentEligibility
      )
    )
  }

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."Chatbot"
        WHERE "id" = ${chatbotId}::uuid
        FOR UPDATE
      `
    )
    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."ResponseExampleSet"
        WHERE "chatbotId" = ${chatbotId}::uuid
        FOR UPDATE
      `
    )

    const set = await tx.responseExampleSet.findUnique({
      where: { chatbotId },
      include: responseExampleSetInclude,
    })
    if (!set) return null

    const currentEligibility = await loadCurrentEligibility(
      tx,
      chatbotId,
      set.examples
    )
    if (!currentEligibility.changed) {
      return withChatbotModes(
        projectCurrentEligibility(set, currentEligibility.currentEligibility)
      )
    }

    await applyResponseExampleEligibilityReconciliation(tx, currentEligibility)

    return await refreshResponseExampleSetDigestAfterLock(tx, set.id)
  })
}

export async function refreshResponseExampleSetDigest(
  prisma: PrismaClient,
  setId: string
) {
  return await prisma.$transaction((tx) =>
    refreshResponseExampleSetDigestInTransaction(tx, setId)
  )
}

export async function getChatbotResponseExamples(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
) {
  const parsedChatbotId = responseExampleIdSchema.safeParse(chatbotId)
  if (!parsedChatbotId.success) return null

  const set = await ctx.prisma.responseExampleSet.findFirst({
    where: {
      chatbotId,
      chatbot: { ownerId: ctx.user.sub },
    },
    select: { id: true },
  })

  if (!set) return null
  return await reconcileCurrentResponseExampleEligibility(ctx.prisma, chatbotId)
}

export const RESPONSE_EXAMPLE_SOURCES_REQUIRED =
  'RESPONSE_EXAMPLE_SOURCES_REQUIRED'
export const RESPONSE_EXAMPLE_MODE_UNAVAILABLE =
  'RESPONSE_EXAMPLE_MODE_UNAVAILABLE'
export const RESPONSE_EXAMPLE_STATUS_INVALID = 'RESPONSE_EXAMPLE_STATUS_INVALID'
export const RESPONSE_EXAMPLE_DUPLICATE = 'RESPONSE_EXAMPLE_DUPLICATE'
export const RESPONSE_EXAMPLE_STALE_UPDATE = 'RESPONSE_EXAMPLE_STALE_UPDATE'

async function reviewResponseExample(
  { id, status }: { id: string; status: DB.ResponseExampleStatus },
  ctx: ContextWithUser
) {
  const parsedId = responseExampleIdSchema.safeParse(id)
  if (!parsedId.success) return null

  return await ctx.prisma.$transaction(async (tx) => {
    const ownership = await tx.responseExample.findFirst({
      where: {
        id: parsedId.data,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: {
        set: { select: { chatbot: { select: { id: true } } } },
      },
    })

    if (!ownership) return null

    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."Chatbot"
        WHERE "id" = ${ownership.set.chatbot.id}::uuid
        FOR UPDATE
      `
    )

    const example = await tx.responseExample.findFirst({
      where: {
        id: parsedId.data,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: {
        id: true,
        setId: true,
        status: true,
        chatMode: true,
        referenceAnswer: true,
        evidenceReferences: {
          select: {
            id: true,
            sourceId: true,
            contentHash: true,
            citationIndex: true,
            evidenceEligible: true,
          },
        },
        set: {
          select: {
            chatbot: { select: { systemPrompts: true } },
          },
        },
      },
    })

    if (!example) return null

    const currentEligibility = await getCurrentEligibilityForExample(
      tx,
      ownership.set.chatbot.id,
      example
    )

    let action: 'APPROVE' | 'REJECT' | null = null
    if (status === DB.ResponseExampleStatus.APPROVED) action = 'APPROVE'
    if (status === DB.ResponseExampleStatus.REJECTED) action = 'REJECT'
    if (!action || !canApplyResponseExampleAction(example.status, action)) {
      throw new GraphQLError(
        'This response example cannot be reviewed in its current state.',
        { extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID } }
      )
    }

    if (
      status === DB.ResponseExampleStatus.APPROVED &&
      !extractChatbotModes(example.set.chatbot.systemPrompts).includes(
        example.chatMode
      )
    ) {
      throw new GraphQLError(
        'The response example uses a chat mode that is not available for this chatbot.',
        { extensions: { code: RESPONSE_EXAMPLE_MODE_UNAVAILABLE } }
      )
    }

    if (
      status === DB.ResponseExampleStatus.APPROVED &&
      !currentEligibility?.eligible
    ) {
      throw new GraphQLError(
        'An approved response example needs eligible sources and matching citation markers.',
        { extensions: { code: RESPONSE_EXAMPLE_SOURCES_REQUIRED } }
      )
    }

    if (currentEligibility) {
      await updateStoredEvidenceEligibility(tx, example, currentEligibility)
    }

    const updated = await tx.responseExample.updateMany({
      where: {
        id: example.id,
        status: {
          in: [
            DB.ResponseExampleStatus.CANDIDATE,
            DB.ResponseExampleStatus.NEEDS_REVIEW,
          ],
        },
      },
      data: {
        status,
        reviewedById: ctx.user.sub,
        reviewedAt: new Date(),
      },
    })

    if (updated.count === 0) {
      throw new GraphQLError(
        'This response example cannot be reviewed in its current state.',
        { extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID } }
      )
    }

    return await refreshResponseExampleSetDigestInTransaction(tx, example.setId)
  })
}

export async function approveResponseExample(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  return await reviewResponseExample(
    { id, status: DB.ResponseExampleStatus.APPROVED },
    ctx
  )
}

const editAndApproveResponseExampleSchema = z.object({
  id: responseExampleIdSchema,
  chatMode: z.string().trim().min(1).max(RESPONSE_EXAMPLE_CHAT_MODE_MAX_LENGTH),
  studentMessage: z
    .string()
    .trim()
    .min(1)
    .max(RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH),
  referenceAnswer: z
    .string()
    .trim()
    .min(1)
    .max(RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH),
  responseStyle: responseExampleStyleSchema,
  expectedUpdatedAt: z.date(),
})

export async function editAndApproveResponseExample(
  args: z.infer<typeof editAndApproveResponseExampleSchema>,
  ctx: ContextWithUser
) {
  const input = editAndApproveResponseExampleSchema.parse(args)

  return await ctx.prisma.$transaction(async (tx) => {
    const ownership = await tx.responseExample.findFirst({
      where: {
        id: input.id,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: {
        set: { select: { chatbot: { select: { id: true } } } },
      },
    })

    if (!ownership) return null

    await tx.$queryRaw<{ id: string }[]>(
      PrismaRuntime.sql`
        SELECT "id"
        FROM "public"."Chatbot"
        WHERE "id" = ${ownership.set.chatbot.id}::uuid
        FOR UPDATE
      `
    )

    const example = await tx.responseExample.findFirst({
      where: {
        id: input.id,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: {
        id: true,
        setId: true,
        status: true,
        updatedAt: true,
        evidenceReferences: {
          select: {
            id: true,
            sourceId: true,
            contentHash: true,
            citationIndex: true,
            evidenceEligible: true,
          },
        },
        set: {
          select: {
            chatbot: { select: { systemPrompts: true } },
          },
        },
      },
    })

    if (!example) return null

    const currentEligibility = await getCurrentEligibilityForExample(
      tx,
      ownership.set.chatbot.id,
      {
        ...example,
        referenceAnswer: input.referenceAnswer,
      }
    )

    if (example.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new GraphQLError(
        'The response example changed while it was open. Reload it before saving again.',
        { extensions: { code: RESPONSE_EXAMPLE_STALE_UPDATE } }
      )
    }

    if (!canApplyResponseExampleAction(example.status, 'EDIT_AND_APPROVE')) {
      throw new GraphQLError(
        'Rejected response examples cannot be edited and approved again.',
        { extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID } }
      )
    }

    if (
      !extractChatbotModes(example.set.chatbot.systemPrompts).includes(
        input.chatMode
      )
    ) {
      throw new GraphQLError(
        'The selected chat mode is not available for this chatbot.',
        { extensions: { code: RESPONSE_EXAMPLE_MODE_UNAVAILABLE } }
      )
    }

    if (!currentEligibility?.eligible) {
      throw new GraphQLError(
        'An approved response example needs eligible sources and matching citation markers.',
        { extensions: { code: RESPONSE_EXAMPLE_SOURCES_REQUIRED } }
      )
    }
    await updateStoredEvidenceEligibility(tx, example, currentEligibility)

    let updated: { count: number }
    try {
      updated = await tx.responseExample.updateMany({
        where: {
          id: example.id,
          status: { not: DB.ResponseExampleStatus.REJECTED },
          updatedAt: input.expectedUpdatedAt,
        },
        data: {
          chatMode: input.chatMode,
          studentMessage: input.studentMessage,
          referenceAnswer: input.referenceAnswer,
          responseStyle: input.responseStyle,
          status: DB.ResponseExampleStatus.APPROVED,
          reviewedById: ctx.user.sub,
          reviewedAt: new Date(),
        },
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new GraphQLError(
          'A response example with this question already exists for this chat mode.',
          { extensions: { code: RESPONSE_EXAMPLE_DUPLICATE } }
        )
      }
      throw error
    }

    if (updated.count === 0) {
      const current = await tx.responseExample.findUnique({
        where: { id: example.id },
        select: { status: true, updatedAt: true },
      })
      if (
        current &&
        current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
      ) {
        throw new GraphQLError(
          'The response example changed while it was open. Reload it before saving again.',
          { extensions: { code: RESPONSE_EXAMPLE_STALE_UPDATE } }
        )
      }
      throw new GraphQLError(
        'Rejected response examples cannot be edited and approved again.',
        { extensions: { code: RESPONSE_EXAMPLE_STATUS_INVALID } }
      )
    }

    return await refreshResponseExampleSetDigestInTransaction(tx, example.setId)
  })
}

export async function rejectResponseExample(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  return await reviewResponseExample(
    { id, status: DB.ResponseExampleStatus.REJECTED },
    ctx
  )
}
