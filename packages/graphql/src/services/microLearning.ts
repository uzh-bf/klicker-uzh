import { Attachment, Question, QuestionType } from '@klicker-uzh/prisma'
import { GraphQLError } from 'graphql'
import { pick } from 'ramda'
import { ContextWithUser } from '../lib/context'
import { prepareInitialInstanceResults, processQuestionData } from './sessions'

interface GetMicroSessionDataArgs {
  id: string
}

export async function getMicroSessionData(
  { id }: GetMicroSessionDataArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.findUnique({
    where: { id },
    include: {
      course: true,
      instances: {
        orderBy: {
          questionId: 'asc',
        },
      },
    },
  })

  if (!microSession) return null

  const instancesWithoutSolution = microSession.instances.map((instance) => {
    const questionData = instance.questionData?.valueOf() as AllQuestionTypeData
    if (
      !questionData ||
      typeof questionData !== 'object' ||
      Array.isArray(questionData)
    )
      return instance

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM:
        return {
          ...instance,
          questionData: {
            ...questionData,
            options: {
              ...questionData.options,
              choices: questionData.options.choices.map(pick(['ix', 'value'])),
            },
          },
        }

      case QuestionType.FREE_TEXT:
        return instance

      case QuestionType.NUMERICAL:
        return instance

      default:
        return instance
    }
  })

  return {
    ...microSession,
    instances: instancesWithoutSolution,
  }
}

export async function getSingleMicroSession(
  { id }: GetMicroSessionDataArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.findUnique({
    where: { id },
    include: {
      course: true,
      instances: true,
    },
  })

  if (!microSession) return null

  return microSession
}

interface MarkMicroSessionCompletedArgs {
  courseId: string
  id: string
}

export async function markMicroSessionCompleted(
  { courseId, id }: MarkMicroSessionCompletedArgs,
  ctx: ContextWithUser
) {
  return ctx.prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    data: {
      completedMicroSessions: {
        push: id,
      },
    },
  })
}

interface CreateMicroSessionArgs {
  name: string
  displayName: string
  description?: string
  questions: number[]
  courseId?: string
  multiplier: number
  startDate: Date
  endDate: Date
}

export async function createMicroSession(
  {
    name,
    displayName,
    description,
    questions,
    courseId,
    multiplier,
    startDate,
    endDate,
  }: CreateMicroSessionArgs,
  ctx: ContextWithUser
) {
  const dbQuestions = await ctx.prisma.question.findMany({
    where: {
      id: { in: questions },
      ownerId: ctx.user.sub,
    },
    include: {
      attachments: true,
    },
  })

  const uniqueQuestions = new Set(dbQuestions.map((q) => q.id))
  if (dbQuestions.length !== uniqueQuestions.size) {
    throw new GraphQLError('Not all questions could be found')
  }

  const questionMap = dbQuestions.reduce<
    Record<number, Question & { attachments: Attachment[] }>
  >((acc, question) => ({ ...acc, [question.id]: question }), {})

  const session = await ctx.prisma.microSession.create({
    data: {
      name,
      displayName: displayName ?? name,
      description,
      pointsMultiplier: multiplier,
      scheduledStartAt: new Date(startDate),
      scheduledEndAt: new Date(endDate),
      instances: {
        create: questions.map((questionId, ix) => {
          const question = questionMap[questionId]
          const processedQuestionData = processQuestionData(question)
          const questionAttachmentInstances = question.attachments.map(
            pick(['type', 'href', 'name', 'description', 'originalName'])
          )
          return {
            order: ix,
            questionData: processedQuestionData,
            results: prepareInitialInstanceResults(processedQuestionData),
            question: {
              connect: { id: questionId },
            },
            owner: {
              connect: { id: ctx.user.sub },
            },
            attachments: {
              create: questionAttachmentInstances,
            },
          }
        }),
      },
      owner: {
        connect: { id: ctx.user.sub },
      },
      course: {
        connect: { id: courseId },
      },
    },
    include: {
      instances: true,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroSession', id: session.id })

  return session
}
