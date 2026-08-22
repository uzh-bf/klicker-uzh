import { createHash } from 'node:crypto'
import type { Prisma } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import { z } from 'zod'
import type { ContextWithUser } from '../lib/context.js'

type ResponseExamplePrisma = Pick<
  Prisma.TransactionClient,
  'responseExample' | 'responseExampleSet'
>

const responseExampleSetInclude = {
  examples: {
    orderBy: [
      { chatMode: 'asc' },
      { locale: 'asc' },
      { studentTurn: 'asc' },
      { id: 'asc' },
    ],
    include: {
      evidenceReferences: {
        orderBy: [
          { sourceId: 'asc' },
          { chunkId: 'asc' },
          { contentHash: 'asc' },
          { citationAnchor: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  },
} satisfies Prisma.ResponseExampleSetInclude

type ResponseExampleSetWithRelations = Prisma.ResponseExampleSetGetPayload<{
  include: typeof responseExampleSetInclude
}>

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareFields<T extends object>(
  left: T,
  right: T,
  fields: readonly (keyof T)[]
) {
  for (const field of fields) {
    const comparison = compareStrings(String(left[field]), String(right[field]))
    if (comparison !== 0) return comparison
  }
  return 0
}

export function computeResponseExampleSetDigest(
  set: ResponseExampleSetWithRelations
) {
  const canonical = {
    setId: set.id,
    chatbotId: set.chatbotId,
    examples: [...set.examples]
      .sort((left, right) =>
        compareFields(left, right, [
          'chatMode',
          'locale',
          'studentTurn',
          'idealResponse',
          'behaviorTag',
          'status',
          'id',
          'setId',
        ])
      )
      .map((example) => ({
        id: example.id,
        setId: example.setId,
        chatMode: example.chatMode,
        locale: example.locale,
        studentTurn: example.studentTurn,
        idealResponse: example.idealResponse,
        behaviorTag: example.behaviorTag,
        status: example.status,
        evidenceReferences: [...example.evidenceReferences]
          .sort((left, right) =>
            compareFields(left, right, [
              'sourceId',
              'chunkId',
              'contentHash',
              'citationAnchor',
              'id',
              'responseExampleId',
            ])
          )
          .map((reference) => ({
            id: reference.id,
            responseExampleId: reference.responseExampleId,
            sourceId: reference.sourceId,
            chunkId: reference.chunkId,
            contentHash: reference.contentHash,
            citationAnchor: reference.citationAnchor,
            evidenceEligible: reference.evidenceEligible,
          })),
      })),
  }

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

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

export async function refreshResponseExampleSetDigest(
  prisma: ResponseExamplePrisma,
  setId: string
) {
  const set = await findResponseExampleSet(prisma, setId)
  if (!set) return null

  return await prisma.responseExampleSet.update({
    where: { id: set.id },
    data: { digest: computeResponseExampleSetDigest(set) },
    include: responseExampleSetInclude,
  })
}

export async function getChatbotResponseExamples(
  { chatbotId }: { chatbotId: string },
  ctx: ContextWithUser
) {
  return await ctx.prisma.responseExampleSet.findFirst({
    where: {
      chatbotId,
      chatbot: { ownerId: ctx.user.sub },
    },
    include: responseExampleSetInclude,
  })
}

async function reviewResponseExample(
  { id, status }: { id: string; status: DB.ResponseExampleStatus },
  ctx: ContextWithUser
) {
  const parsedId = responseExampleIdSchema.safeParse(id)
  if (!parsedId.success) return null

  return await ctx.prisma.$transaction(async (tx) => {
    const example = await tx.responseExample.findFirst({
      where: {
        id: parsedId.data,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: { id: true, setId: true },
    })

    if (!example) return null

    await tx.responseExample.update({
      where: { id: example.id },
      data: {
        status,
        reviewedById: ctx.user.sub,
        reviewedAt: new Date(),
      },
    })

    return await refreshResponseExampleSetDigest(tx, example.setId)
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
  chatMode: z.string().trim().min(1),
  locale: z.string().trim().min(1),
  studentTurn: z.string().trim().min(1),
  idealResponse: z.string().trim().min(1),
  behaviorTag: z.string().trim().min(1),
})

export async function editAndApproveResponseExample(
  args: z.infer<typeof editAndApproveResponseExampleSchema>,
  ctx: ContextWithUser
) {
  const input = editAndApproveResponseExampleSchema.parse(args)

  return await ctx.prisma.$transaction(async (tx) => {
    const example = await tx.responseExample.findFirst({
      where: {
        id: input.id,
        set: { chatbot: { ownerId: ctx.user.sub } },
      },
      select: { id: true, setId: true },
    })

    if (!example) return null

    await tx.responseExample.update({
      where: { id: example.id },
      data: {
        chatMode: input.chatMode,
        locale: input.locale,
        studentTurn: input.studentTurn,
        idealResponse: input.idealResponse,
        behaviorTag: input.behaviorTag,
        status: DB.ResponseExampleStatus.APPROVED,
        reviewedById: ctx.user.sub,
        reviewedAt: new Date(),
      },
    })

    return await refreshResponseExampleSetDigest(tx, example.setId)
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
