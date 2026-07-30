import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType, type ElementStackInput } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { getPermissionBooleans } from './activities.js'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import {
  removeAdaptivePracticeQuizConfig,
  replaceAdaptivePracticeQuizConfig,
  type AdaptivePracticeQuizConfigInput,
} from './adaptivePracticeQuizConfig.js'
import {
  lockPracticeQuizForUpdate,
  type LockedPracticeQuiz,
} from './adaptivePracticeQuizRepository.js'
import { splitActivityInstances } from './liveQuizzes.js'

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: ElementStackInput[]
  courseId: string
  multiplier: number
  order: DB.ElementOrderType
  resetTimeDays: number
  mode?: DB.PracticeQuizMode | null
  adaptiveConfig?: AdaptivePracticeQuizConfigInput | null
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
    mode,
    adaptiveConfig,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  let existingActivity: DB.PracticeQuiz | null = null
  if (id) {
    existingActivity = await ctx.prisma.practiceQuiz.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new GraphQLError('Practice quiz not found')
    }
    if (existingActivity.status === DB.PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }
  }

  const requestedMode =
    mode ?? existingActivity?.mode ?? DB.PracticeQuizMode.STANDARD
  const isAdaptive = requestedMode === DB.PracticeQuizMode.ADAPTIVE
  if (
    existingActivity?.status === DB.PublicationStatus.SCHEDULED &&
    (isAdaptive || existingActivity.mode === DB.PracticeQuizMode.ADAPTIVE)
  ) {
    throw new GraphQLError(
      'A scheduled adaptive practice quiz must be unpublished before it can be edited.',
      { extensions: { code: 'ADAPTIVE_CONFIG_LOCKED' } }
    )
  }
  if (isAdaptive && stacks.length > 0) {
    throw new GraphQLError(
      'Adaptive practice quizzes use their competence-tree pool and cannot contain standard stacks.',
      { extensions: { code: 'ADAPTIVE_STACKS_FORBIDDEN' } }
    )
  }
  const adaptiveConfigRequired =
    !existingActivity ||
    existingActivity.mode !== DB.PracticeQuizMode.ADAPTIVE ||
    existingActivity.courseId !== courseId
  if (isAdaptive && adaptiveConfigRequired && !adaptiveConfig) {
    throw new GraphQLError(
      'Adaptive practice quizzes require a competence-tree configuration.',
      { extensions: { code: 'ADAPTIVE_CONFIG_MISSING' } }
    )
  }
  if (!isAdaptive && adaptiveConfig) {
    throw new GraphQLError(
      'Adaptive configuration can only be supplied for adaptive practice quizzes.',
      { extensions: { code: 'ADAPTIVE_CONFIG_MODE_MISMATCH' } }
    )
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: {
      isGamificationEnabled: true,
      isAssessmentEnabled: true,
      isAdaptiveLearningEnabled: true,
    },
  })

  if (!course) {
    throw new GraphQLError('Course not found')
  }
  if (isAdaptive && !course.isAdaptiveLearningEnabled) {
    throw new GraphQLError(
      'Adaptive learning is not enabled for the selected course.',
      { extensions: { code: 'ADAPTIVE_COURSE_DISABLED' } }
    )
  }

  const effectiveMultiplier = isAdaptive ? 0 : multiplier
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx)

  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = []
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { practiceQuizId: id },
      },
    })
    const existingStacks = await ctx.prisma.elementStack.findMany({
      where: { practiceQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = existingStacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: effectiveMultiplier,
    orderType: order,
    resetTimeDays,
    mode: requestedMode,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: isAdaptive ? false : course.isGamificationEnabled,
    isAssessmentEnabled: isAdaptive ? false : course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== courseId
        ? DB.ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === DB.ReviewStatus.REVIEWED
          ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    stacks: {
      create: stacks.map((stack) => ({
        type: DB.ElementStackType.PRACTICE_QUIZ,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: DB.ElementInstanceType.PRACTICE_QUIZ,
              activityMultiplier: effectiveMultiplier,
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
    course: { connect: { id: courseId } },
  }

  const activity = await ctx.prisma.$transaction(
    async (prisma) => {
      if (isAdaptive) {
        await lockAdaptiveLearningCourseEnabled(courseId, prisma)
      }
      if (id) {
        const lockedQuiz = requireLockedPracticeQuiz(
          await lockPracticeQuizForUpdate(id, prisma)
        )
        if (lockedQuiz.status === DB.PublicationStatus.PUBLISHED) {
          throw new GraphQLError('Cannot edit a published practice quiz')
        }
        if (
          lockedQuiz.status === DB.PublicationStatus.SCHEDULED &&
          (isAdaptive || lockedQuiz.mode === DB.PracticeQuizMode.ADAPTIVE)
        ) {
          throw new GraphQLError(
            'A scheduled adaptive practice quiz must be unpublished before it can be edited.',
            { extensions: { code: 'ADAPTIVE_CONFIG_LOCKED' } }
          )
        }
      }

      await prisma.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

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
              pointsMultiplier: effectiveMultiplier * elementMultiplier,
            },
          },
        })
      }

      await prisma.elementStack.deleteMany({
        where: { id: { in: stacksToDelete } },
      })

      const upsertedQuiz = await prisma.practiceQuiz.upsert({
        where: { id: id ?? uuidv4() },
        create: {
          ...createOrUpdateJSON,
          owner: { connect: { id: ctx.user.sub } },
        },
        update: createOrUpdateJSON,
        include: {
          templateInfo: true,
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
            take: 1,
          },
          course: {
            include: {
              _count: {
                select: {
                  permissions: {
                    where: {
                      userId: ctx.user.sub,
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          stacks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          _count: { select: { permissions: true } },
        },
      })

      if (isAdaptive && adaptiveConfig) {
        await replaceAdaptivePracticeQuizConfig(
          {
            practiceQuizId: upsertedQuiz.id,
            courseId,
            input: adaptiveConfig,
            userId: ctx.user.sub,
          },
          prisma
        )
      } else if (
        !isAdaptive &&
        existingActivity?.mode === DB.PracticeQuizMode.ADAPTIVE
      ) {
        await removeAdaptivePracticeQuizConfig(upsertedQuiz.id, prisma)
      }

      for (const elementId of unlinkedElementIds) {
        await recomputeDerivedPermissions({ elementId }, prisma)
      }
      await recomputeDerivedPermissions(
        { practiceQuizId: upsertedQuiz.id },
        prisma
      )

      return upsertedQuiz
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? DB.PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = getPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission:
      activity.permissions[0]?.directPermission &&
      activity.permissions[0].directPermission.userGroupId !== null,
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.PRACTICE_QUIZ,
    mode: activity.mode,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
    automaticPublicationAt: activity.availableFrom,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: activity.course._count.permissions > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

function requireLockedPracticeQuiz(
  practiceQuiz: LockedPracticeQuiz | null
): LockedPracticeQuiz {
  if (!practiceQuiz || practiceQuiz.isDeleted) {
    throw new GraphQLError('Practice quiz not found.', {
      extensions: { code: 'NOT_FOUND' },
    })
  }

  return practiceQuiz
}
