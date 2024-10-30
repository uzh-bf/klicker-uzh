import {
  type Element,
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma'
import type { StackInput } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import { computeStackEvaluation } from './stacks.js'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        {
          status: PublicationStatus.PUBLISHED,
          isDeleted: false,
        },
        {
          status: PublicationStatus.SCHEDULED,
        },
        {
          ownerId: ctx.user?.sub,
        },
      ],
    },
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            include:
              ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
                ? {
                    responses: {
                      where: {
                        participantId: ctx.user.sub,
                      },
                    },
                  }
                : undefined,
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!quiz) return null

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === PublicationStatus.SCHEDULED) {
    return { ...quiz, stacks: [] }
  }

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    // TODO: adapt the implementation to multiple instances per stack - resorting inside the stack does probably not make sense
    const orderedStacks =
      quiz.orderType === ElementOrderType.SPACED_REPETITION
        ? orderStacks(quiz.stacks)
        : quiz.stacks

    return {
      ...quiz,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return quiz
}

export async function getPracticeQuizEvaluation(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      status: PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    include: {
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // compute evaluation
  const stackEvaluation = computeStackEvaluation(practiceQuiz.stacks)

  return {
    id: practiceQuiz.id,
    name: practiceQuiz.name,
    displayName: practiceQuiz.displayName,
    description: practiceQuiz.description,
    results: stackEvaluation,
  }
}

export async function getSinglePracticeQuiz(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  return quiz
}

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: StackInput[]
  courseId: string
  multiplier: number
  order: ElementOrderType
  availableFrom?: Date | null
  resetTimeDays: number
}

export async function manipulatePracticeQuiz(
  {
    id,
    name,
    displayName,
    description,
    stacks,
    courseId,
    multiplier,
    order,
    availableFrom,
    resetTimeDays,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old session and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Practice quiz not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }

    await ctx.prisma.practiceQuiz.update({
      where: { id },
      data: {
        stacks: {
          deleteMany: {},
        },
      },
    })
  }

  const elements = stacks
    .flatMap((stack) => stack.elements)
    .map((stackElem) => stackElem.elementId)
    .filter(
      (stackElem) => stackElem !== null && typeof stackElem !== 'undefined'
    )

  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elements },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, elem) => ({ ...acc, [elem.id]: elem }),
    {}
  )

  const availabilityTime =
    availableFrom && dayjs(availableFrom).isBefore(dayjs())
      ? null
      : (availableFrom ?? undefined)

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    availableFrom: availabilityTime,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: stacks.map((stack) => {
        return {
          type: ElementStackType.PRACTICE_QUIZ,
          order: stack.order,
          displayName: stack.displayName?.trim() ?? '',
          description: stack.description ?? '',
          elements: {
            create: stack.elements.map((elem) => {
              const element = elementMap[elem.elementId]!
              const processedElementData = processElementData(element)
              const initialResults = getInitialElementResults(element)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                  resetTimeDays,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.PRACTICE_QUIZ
                  ),
                },
                element: {
                  connect: { id: element.id },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            }),
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
  }

  const element = await ctx.prisma.practiceQuiz.upsert({
    where: { id: id ?? uuidv4() },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  return element
}

interface GetBookmarksPracticeQuizArgs {
  quizId?: string | null
  courseId: string
}

export async function getBookmarksPracticeQuiz(
  { quizId, courseId }: GetBookmarksPracticeQuizArgs,
  ctx: Context
) {
  if (!ctx.user?.sub) {
    return null
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    include: {
      bookmarkedElementStacks: {
        where: {
          practiceQuizId: quizId ?? undefined,
        },
      },
    },
  })

  return participation?.bookmarkedElementStacks.map((stack) => stack.id)
}

interface UnpublishPracticeQuizArgs {
  id: string
}

export async function unpublishPracticeQuiz(
  { id }: UnpublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: PublicationStatus.SCHEDULED,
    },
    data: {
      status: PublicationStatus.DRAFT,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  return practiceQuiz
}

export async function getPracticeQuizSummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  const { responses, anonymousResponses } = practiceQuiz.stacks.reduce(
    (acc, stack) => {
      const elem_counts = stack.elements.reduce(
        (acc_elem, instance) => {
          acc_elem.responses += instance.results.total
          acc_elem.anonymousResponses += instance.anonymousResults.total
          return acc_elem
        },
        { responses: 0, anonymousResponses: 0 }
      )

      acc.responses += elem_counts.responses
      acc.anonymousResponses += elem_counts.anonymousResponses
      return acc
    },
    { responses: 0, anonymousResponses: 0 }
  )

  return {
    numOfResponses: responses,
    numOfAnonymousResponses: anonymousResponses,
  }
}

interface DeletePracticeQuizArgs {
  id: string
}

export async function deletePracticeQuiz(
  { id }: DeletePracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      responses: true,
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    practiceQuiz.status === PublicationStatus.DRAFT ||
    practiceQuiz.status === PublicationStatus.SCHEDULED ||
    practiceQuiz.responses.length === 0
  ) {
    const deletedItem = await ctx.prisma.practiceQuiz.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })

    return deletedItem
  } else {
    // if the practice quiz is published and has responses -> soft deletion
    const updatedPracticeQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        isDeleted: true,
      },
      include: {
        stacks: true,
      },
    })

    // disconnect the stacks from the course they are linked to
    const stackIds = updatedPracticeQuiz.stacks.map((stack) => stack.id)
    await ctx.prisma.elementStack.updateMany({
      where: {
        id: {
          in: stackIds,
        },
      },
      data: {
        courseId: null,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedPracticeQuiz
  }
}

interface PublishPracticeQuizArgs {
  id: string
}

export async function publishPracticeQuiz(
  { id }: PublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      isDeleted: false,
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (
    practiceQuiz.availableFrom &&
    dayjs(practiceQuiz.availableFrom).isAfter(dayjs())
  ) {
    // change the status of the practice quiz to scheduled for the cronjob to identify it and publish it at the given time
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.SCHEDULED,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  } else {
    // publish practice quiz completely and link all stacks to the course
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
      },
      include: {
        stacks: true,
      },
    })

    // connect all elementStacks in the practice quiz to the course
    const courseId = updatedQuiz.courseId
    await ctx.prisma.course.update({
      where: {
        id: courseId,
      },
      data: {
        elementStacks: {
          connect: updatedQuiz.stacks.map((stack) => ({ id: stack.id })),
        },
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  }
}
