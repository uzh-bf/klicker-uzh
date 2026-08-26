import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { FlashcardCorrectness } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { z } from 'zod'
import { updateSpacedRepetition } from './stacks.js'

const PERSONAL_ELEMENT_LIMIT = 500
const TRANSACTION_RETRY_LIMIT = 3
const TRANSACTION_MAX_WAIT_MS = 5_000
const TRANSACTION_TIMEOUT_MS = 15_000
const MAX_SOURCE_COUNT = 32
const MAX_ID_LENGTH = 128
const MAX_TITLE_LENGTH = 256
const MAX_URL_LENGTH = 2_048
const MAX_METADATA_BYTES = 64 * 1024

const sourceMetadataValueSchema = z.union([
  z.string().max(MAX_TITLE_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

const sourceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    chunkId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    url: z
      .string()
      .trim()
      .url()
      .max(MAX_URL_LENGTH)
      .refine((value) => /^https?:\/\//i.test(value), {
        message: 'Source URLs must use http or https',
      })
      .optional(),
    metadata: z
      .record(z.string().max(MAX_ID_LENGTH), sourceMetadataValueSchema)
      .optional(),
  })
  .strict()
  .superRefine((source, refinementContext) => {
    for (const key of Object.keys(source.metadata ?? {})) {
      if (/^(?:text|content|body|snippet|excerpt|raw)$/i.test(key)) {
        refinementContext.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadata', key],
          message: 'Source text must not be persisted',
        })
      }
    }
  })

const sourcesSchema = z
  .array(sourceSchema)
  .min(1)
  .max(MAX_SOURCE_COUNT)
  .superRefine((sources, refinementContext) => {
    const chunkIds = sources.map((source) => source.chunkId)
    if (new Set(chunkIds).size !== chunkIds.length) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source chunk IDs must be unique',
      })
    }

    if (
      Buffer.byteLength(JSON.stringify(sources), 'utf8') > MAX_METADATA_BYTES
    ) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Source metadata exceeds the 64 KiB limit',
      })
    }
  })

const candidateSchema = z
  .object({
    candidateId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    name: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    content: z.string().trim().min(1).max(8_192),
    explanation: z.string().trim().min(1).max(8_192),
    sources: sourcesSchema,
    sourceMessageId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    sourceToolCallId: z.string().trim().min(1).max(MAX_ID_LENGTH),
    origin: z.enum(['AI_GENERATED', 'AUTHORED']).optional(),
  })
  .strict()

export type PersonalElementSource = z.infer<typeof sourceSchema>

export type PersonalElementCandidate = z.infer<typeof candidateSchema>

export type CreatePersonalElementsInput = {
  courseId: string
  candidates: readonly PersonalElementCandidate[]
}

export type UpdatePersonalElementInput = {
  id: string
  expectedVersion: number
  name?: string
  content?: string
  explanation?: string
  sources?: readonly PersonalElementSource[]
}

export type PersonalElementActor = {
  participantId: string
  role: DB.UserRole
}

export type PersonalElementServiceContext = {
  prisma: DB.PrismaClient
  actor: PersonalElementActor
}

function personalElementError(code: string, message = code) {
  return new GraphQLError(message, { extensions: { code } })
}

function isPrismaError(error: unknown, code: 'P2002' | 'P2034') {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

function parsePersonalElementInput<T>(schema: z.ZodType<T>, value: unknown) {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw personalElementError(
        'PERSONAL_ELEMENTS_INVALID_INPUT',
        error.issues[0]?.message ?? 'Personal element input is invalid'
      )
    }
    throw error
  }
}

function assertParticipantActor(actor: PersonalElementActor) {
  if (
    actor.role !== DB.UserRole.PARTICIPANT ||
    actor.participantId.trim().length === 0
  ) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_UNAUTHORIZED',
      'Only authenticated participants can use personal elements'
    )
  }
}

async function assertCourseParticipation(
  prisma: PrismaTransactionClient,
  actor: PersonalElementActor,
  courseId: string
) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: actor.participantId,
      },
    },
    select: { id: true },
  })

  if (!participation) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_NOT_PARTICIPATING',
      'The participant is not enrolled in this course'
    )
  }
}

function normalizeCandidates(candidates: readonly PersonalElementCandidate[]) {
  if (candidates.length === 0 || candidates.length > MAX_SOURCE_COUNT) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      'At least one and at most 32 candidates are allowed'
    )
  }

  const parsed = candidates.map((candidate) =>
    parsePersonalElementInput(candidateSchema, candidate)
  )
  const keys = parsed.map(
    (candidate) =>
      `${candidate.sourceMessageId}\u0000${candidate.sourceToolCallId}\u0000${candidate.candidateId}`
  )
  if (new Set(keys).size !== keys.length) {
    throw personalElementError(
      'PERSONAL_ELEMENTS_INVALID_INPUT',
      'Candidate linkage must be unique within a batch'
    )
  }

  return parsed
}

function candidateKey(candidate: {
  sourceMessageId: string | null
  sourceToolCallId: string | null
  candidateId: string | null
}) {
  return `${candidate.sourceMessageId ?? ''}\u0000${candidate.sourceToolCallId ?? ''}\u0000${candidate.candidateId ?? ''}`
}

const NEW_PERSONAL_ELEMENT_STATE = {
  eFactor: 2.5,
  interval: 1,
  correctCountStreak: 0,
  correctCount: 0,
  partialCorrectCount: 0,
  wrongCount: 0,
  nextDueAt: null,
  lastAnsweredAt: null,
  lastCorrectAt: null,
  lastPartialCorrectAt: null,
  lastWrongAt: null,
  lastResponseCorrectness: null,
} as const

async function runSerializable<T>(
  prisma: DB.PrismaClient,
  callback: (transaction: PrismaTransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      })
    } catch (error) {
      if (
        (isPrismaError(error, 'P2034') || isPrismaError(error, 'P2002')) &&
        attempt < TRANSACTION_RETRY_LIMIT - 1
      ) {
        continue
      }
      throw error
    }
  }

  throw personalElementError('PERSONAL_ELEMENTS_TRANSACTION_FAILED')
}

function toCreateData(
  candidate: PersonalElementCandidate,
  actor: PersonalElementActor,
  courseId: string
) {
  return {
    participantId: actor.participantId,
    courseId,
    version: 1,
    type: DB.ElementType.FLASHCARD,
    name: candidate.name,
    content: candidate.content,
    explanation: candidate.explanation,
    options: {},
    sources: candidate.sources,
    ...NEW_PERSONAL_ELEMENT_STATE,
    origin:
      candidate.origin === 'AUTHORED'
        ? DB.PersonalElementOrigin.AUTHORED
        : DB.PersonalElementOrigin.AI_GENERATED,
    sourceMessageId: candidate.sourceMessageId,
    sourceToolCallId: candidate.sourceToolCallId,
    candidateId: candidate.candidateId,
  }
}

export async function createPersonalElements(
  input: CreatePersonalElementsInput,
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)
  const candidates = normalizeCandidates(input.candidates)

  return runSerializable(context.prisma, async (transaction) => {
    await assertCourseParticipation(transaction, context.actor, input.courseId)

    const existing = await transaction.personalElement.findMany({
      where: {
        participantId: context.actor.participantId,
        courseId: input.courseId,
        OR: candidates.map((candidate) => ({
          sourceMessageId: candidate.sourceMessageId,
          sourceToolCallId: candidate.sourceToolCallId,
          candidateId: candidate.candidateId,
        })),
      },
    })
    const existingByKey = new Map(
      existing.map((element) => [candidateKey(element), element])
    )
    const missing = candidates.filter(
      (candidate) =>
        !existingByKey.has(
          candidateKey({
            sourceMessageId: candidate.sourceMessageId,
            sourceToolCallId: candidate.sourceToolCallId,
            candidateId: candidate.candidateId,
          })
        )
    )

    if (missing.length > 0) {
      const count = await transaction.personalElement.count({
        where: {
          participantId: context.actor.participantId,
          courseId: input.courseId,
        },
      })
      if (count + missing.length > PERSONAL_ELEMENT_LIMIT) {
        throw personalElementError(
          'PERSONAL_ELEMENTS_LIMIT_REACHED',
          `A participant can save at most ${PERSONAL_ELEMENT_LIMIT} personal elements per course`
        )
      }

      for (const candidate of missing) {
        const created = await transaction.personalElement.create({
          data: toCreateData(candidate, context.actor, input.courseId),
        })
        existingByKey.set(candidateKey(created), created)
      }
    }

    return candidates.map(
      (candidate) =>
        existingByKey.get(
          candidateKey({
            sourceMessageId: candidate.sourceMessageId,
            sourceToolCallId: candidate.sourceToolCallId,
            candidateId: candidate.candidateId,
          })
        )!
    )
  })
}

export async function listPersonalElements(
  { courseId }: { courseId: string },
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)
  await assertCourseParticipation(context.prisma, context.actor, courseId)

  const elements = await context.prisma.personalElement.findMany({
    where: {
      participantId: context.actor.participantId,
      courseId,
    },
  })

  return elements.sort((left, right) => {
    if (!left.nextDueAt && right.nextDueAt) return -1
    if (left.nextDueAt && !right.nextDueAt) return 1
    if (left.nextDueAt && right.nextDueAt) {
      const dueDifference = left.nextDueAt.getTime() - right.nextDueAt.getTime()
      if (dueDifference !== 0) return dueDifference
    }
    return left.createdAt.getTime() - right.createdAt.getTime()
  })
}

export async function getPersonalElementCounts(
  { courseId }: { courseId: string },
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)
  await assertCourseParticipation(context.prisma, context.actor, courseId)

  const [personalElementCount, personalDueCount] = await Promise.all([
    context.prisma.personalElement.count({
      where: { participantId: context.actor.participantId, courseId },
    }),
    context.prisma.personalElement.count({
      where: {
        participantId: context.actor.participantId,
        courseId,
        nextDueAt: { lte: new Date() },
      },
    }),
  ])

  return { personalElementCount, personalDueCount }
}

export async function respondToPersonalElement(
  {
    id,
    response,
    expectedVersion,
  }: { id: string; response: FlashcardCorrectness; expectedVersion: number },
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_VERSION')
  }
  if (!Object.values(FlashcardCorrectness).includes(response)) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_RESPONSE')
  }

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id },
    })
    if (!element || element.participantId !== context.actor.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.actor,
      element.courseId
    )
    if (element.version !== expectedVersion) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    const correct = response === FlashcardCorrectness.CORRECT
    const partial = response === FlashcardCorrectness.PARTIAL
    const correctness = correct
      ? DB.ResponseCorrectness.CORRECT
      : partial
        ? DB.ResponseCorrectness.PARTIAL
        : DB.ResponseCorrectness.WRONG
    const grade = correct ? 1 : partial ? 0.5 : 0
    const nextStreak = correct ? element.correctCountStreak + 1 : 0
    const spacedRepetition = updateSpacedRepetition({
      eFactor: element.eFactor,
      interval: element.interval,
      streak: nextStreak,
      grade,
    })
    const now = new Date()

    const result = await transaction.personalElement.updateMany({
      where: {
        id,
        participantId: context.actor.participantId,
        version: expectedVersion,
      },
      data: {
        correctCount: { increment: correct ? 1 : 0 },
        correctCountStreak: nextStreak,
        partialCorrectCount: { increment: partial ? 1 : 0 },
        wrongCount: { increment: correct || partial ? 0 : 1 },
        lastAnsweredAt: now,
        lastCorrectAt: correct ? now : undefined,
        lastPartialCorrectAt: partial ? now : undefined,
        lastWrongAt: !correct && !partial ? now : undefined,
        lastResponseCorrectness: correctness,
        eFactor: spacedRepetition.efactor,
        interval: spacedRepetition.interval,
        nextDueAt: spacedRepetition.nextDueAt,
      },
    })
    if (result.count !== 1) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    return transaction.personalElement.findUniqueOrThrow({ where: { id } })
  })
}

export async function updatePersonalElement(
  input: UpdatePersonalElementInput,
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw personalElementError('PERSONAL_ELEMENT_INVALID_VERSION')
  }

  const updateData = {
    name: input.name?.trim(),
    content: input.content?.trim(),
    explanation: input.explanation?.trim(),
    sources: input.sources,
  }
  const parsedUpdate = parsePersonalElementInput(
    z
      .object({
        name: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
        content: z.string().min(1).max(8_192).optional(),
        explanation: z.string().min(1).max(8_192).optional(),
        sources: sourcesSchema.optional(),
      })
      .strict(),
    updateData
  )
  if (Object.values(parsedUpdate).every((value) => value === undefined)) {
    throw personalElementError(
      'PERSONAL_ELEMENT_INVALID_INPUT',
      'At least one card field must be updated'
    )
  }

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id: input.id },
    })
    if (!element || element.participantId !== context.actor.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.actor,
      element.courseId
    )
    if (element.version !== input.expectedVersion) {
      throw personalElementError(
        'PERSONAL_ELEMENT_VERSION_CONFLICT',
        'The card was changed by another request'
      )
    }

    const semanticChanged =
      (parsedUpdate.content !== undefined &&
        parsedUpdate.content !== element.content) ||
      (parsedUpdate.explanation !== undefined &&
        parsedUpdate.explanation !== element.explanation) ||
      (parsedUpdate.sources !== undefined &&
        JSON.stringify(parsedUpdate.sources) !==
          JSON.stringify(element.sources))

    if (!semanticChanged && parsedUpdate.name === undefined) {
      return element
    }

    return transaction.personalElement.update({
      where: { id: input.id },
      data: {
        ...parsedUpdate,
        ...(semanticChanged
          ? { version: { increment: 1 }, ...NEW_PERSONAL_ELEMENT_STATE }
          : {}),
      },
    })
  })
}

export async function deletePersonalElement(
  { id }: { id: string },
  context: PersonalElementServiceContext
) {
  assertParticipantActor(context.actor)

  return runSerializable(context.prisma, async (transaction) => {
    const element = await transaction.personalElement.findUnique({
      where: { id },
    })
    if (!element || element.participantId !== context.actor.participantId) {
      throw personalElementError('PERSONAL_ELEMENT_NOT_FOUND')
    }
    await assertCourseParticipation(
      transaction,
      context.actor,
      element.courseId
    )
    await transaction.personalElement.delete({ where: { id } })
    return id
  })
}
