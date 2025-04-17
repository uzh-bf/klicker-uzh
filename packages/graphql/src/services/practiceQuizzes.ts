import {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma'
import type { ElementStackInput } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { computeStackEvaluation } from './stacks.js'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        { status: PublicationStatus.PUBLISHED, isDeleted: false },
        { status: PublicationStatus.SCHEDULED },
        // if user has access to the microlearning, the query should be enabled for loading the preview
        { permissions: { some: { userId: ctx.user?.sub } } },
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
  const isOwner =
    ctx.user?.sub && ctx.user.role === UserRole.USER
      ? ctx.user.sub === quiz.ownerId
      : false

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === PublicationStatus.SCHEDULED) {
    return isOwner ? { ...quiz, isOwner } : { ...quiz, isOwner, stacks: [] }
  }

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    const orderedStacks =
      quiz.orderType === ElementOrderType.SPACED_REPETITION
        ? orderStacks(quiz.stacks)
        : quiz.stacks

    return {
      ...quiz,
      isOwner,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return { ...quiz, isOwner }
}

export async function getPracticeQuizEvaluation(
  { id }: { id: string },
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
    courseId: practiceQuiz.courseId,
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

export async function getCoursePublishedPracticeQuizzes(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      practiceQuizzes: {
        where: {
          status: PublicationStatus.PUBLISHED,
          isDeleted: false,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  return course?.practiceQuizzes
    ? (course.practiceQuizzes.map((quiz) => ({
        ...quiz,
        course,
      })) ?? [])
    : []
}

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: ElementStackInput[]
  courseId: string
  multiplier: number
  order: ElementOrderType
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
    resetTimeDays,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  // in EDIT mode - validate that the practice quiz exists and is not published
  if (id) {
    const existingActivity = await ctx.prisma.practiceQuiz.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new GraphQLError('Practice quiz not found')
    }
    if (existingActivity.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }
  }

  // get required splits of instances based on provided stacks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx)

  // in EDIT mode - check which instances and stacks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { practiceQuizId: id },
      },
    })

    const stacks = await ctx.prisma.elementStack.findMany({
      where: { practiceQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: stacks.map((stack) => ({
        type: ElementStackType.PRACTICE_QUIZ,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.PRACTICE_QUIZ,
              activityMultiplier: multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
              additionalInstanceOptions: { resetTimeDays },
            })
          ),
        },
      })),
    },
    owner: { connect: { id: ctx.user.sub } },
    course: { connect: { id: courseId } },
  }

  const activity = await ctx.prisma.$transaction(async (prisma) => {
    // delete all instances that are not used anymore
    await prisma.elementInstance.deleteMany({
      where: { id: { in: instancesToDelete } },
    })

    // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
    for (const instance of persistentInstances) {
      const elementMultiplier =
        'pointsMultiplier' in instance.elementData
          ? ((instance.elementData.pointsMultiplier as number) ?? 1)
          : 1

      await prisma.elementInstance.update({
        where: { id: instance.id },
        data: {
          elementStackId: null,
          order: persistentInstanceOrderMap[instance.id],
          options: {
            ...instance.options,
            resetTimeDays,
            pointsMultiplier: multiplier * elementMultiplier,
          },
        },
      })
    }

    // delete all stacks
    await prisma.elementStack.deleteMany({
      where: { id: { in: stacksToDelete } },
    })

    const upsertedQuiz = await prisma.practiceQuiz.upsert({
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

    // enforce dervied permissions update to elements that were potentially removed from the quiz (-> removal of derived permissions)
    if (unlinkedElementIds.length > 0) {
      for (const elementId of unlinkedElementIds) {
        await recomputeDerivedPermissions({ elementId }, prisma)
      }
    }

    await recomputeDerivedPermissions(
      { practiceQuizId: upsertedQuiz.id },
      prisma
    )

    return upsertedQuiz
  })

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  return activity
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

export async function unpublishPracticeQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.update({
    where: {
      id,
      status: PublicationStatus.SCHEDULED,
    },
    data: {
      availableFrom: null,
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
    where: { id },
    include: { stacks: { include: { elements: true } } },
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

export async function deletePracticeQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: { responses: true, stacks: { include: { elements: true } } },
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
      where: { id },
    })

    // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
    // this case cannot be handled by the permissions module, since the practice quiz is already hard deleted
    await propagateActivityToElements(
      { stacks: practiceQuiz.stacks },
      ctx.prisma
    )

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })

    return deletedItem
  } else {
    // if the practice quiz is published and has responses -> soft deletion
    const updatedPracticeQuiz = await ctx.prisma.$transaction(
      async (prisma) => {
        const quiz = await prisma.practiceQuiz.update({
          where: { id },
          data: { isDeleted: true },
          include: { stacks: true },
        })

        // disconnect the stacks from the course they are linked to
        const stackIds = quiz.stacks.map((stack) => stack.id)
        await prisma.elementStack.updateMany({
          where: { id: { in: stackIds } },
          data: { courseId: null },
        })

        // update derived permissions for this practice quiz (after soft deletion)
        // this function call automatically includes permission updates for all linked elements
        await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)

        return quiz
      }
    )

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedPracticeQuiz
  }
}

export async function publishPracticeQuiz(
  { id, availableFrom }: { id: string; availableFrom?: Date | null },
  ctx: ContextWithUser
) {
  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (availableFrom && dayjs(availableFrom).isAfter(dayjs())) {
    // change the status of the practice quiz to scheduled for the cronjob to identify it and publish it at the given time
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        isDeleted: false,
      },
      data: {
        availableFrom,
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
        isDeleted: false,
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
