import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ParameterType,
  PermissionLevel,
  Prisma,
  PublicationStatus,
  ReviewStatus,
} from '@klicker-uzh/prisma/client'
import { ActivityType, SortByType, type ElementData } from '@klicker-uzh/types'
import { applyManageActivityBatchOperations } from '../../services/manageActivityBatchOperations.js'
import { getPrisma } from '../context.js'
import {
  toAsyncActivityDetails,
  toLiveQuizActivityDetails,
  toOutdatedElementInstanceInfo,
  toUserActivitiesCourseListItem,
  toUserActivityOverviewItem,
} from '../dto/activity.js'
import { toPreviewElementData } from '../dto/elementPreview.js'
import { router } from '../init.js'
import { hasActivityPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activityDetailsInput,
  activityReviewStatusInput,
  activityTemplateInput,
  applyActivityBatchOperationsInput,
  checkTemplateElementExistsInput,
  matchingUserElementsTemplateInput,
  outdatedElementInstancesInput,
  templateInformationInput,
  templatePreviewAnswerCollectionEntriesInput,
  userActivitiesInput,
} from '../schemas/activity.js'
import {
  getAnswerCollectionsForElements,
  isTemplateAccessible,
} from './resources.js'

const reviewStatusPermissionLevels = [
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

const elementTypesWithSampleSolution: ElementType[] = [
  ElementType.SC,
  ElementType.MC,
  ElementType.KPRIM,
  ElementType.NUMERICAL,
  ElementType.FREE_TEXT,
  ElementType.SELECTION,
  ElementType.CASE_STUDY,
]

const elementTypesWithAnswerFeedbacks: ElementType[] = [
  ElementType.SC,
  ElementType.MC,
  ElementType.KPRIM,
]

function optionFlagMatches(
  options: unknown,
  key: 'hasSampleSolution' | 'hasAnswerFeedbacks',
  expected: boolean
) {
  return (
    options !== null &&
    typeof options === 'object' &&
    key in options &&
    (options as Record<string, unknown>)[key] === expected
  )
}

type TemplateElementInstanceRecord = {
  id: number
  type: ElementInstanceType
  elementType: ElementType
  elementData: Prisma.JsonValue
}

type TemplateElementBlockRecord = {
  id: number
  order: number
  status: string
  timeLimit?: number | null
  elements?: TemplateElementInstanceRecord[] | null
}

type TemplateElementStackRecord = {
  id: number
  order?: number | null
  type: ElementStackType
  displayName?: string | null
  description?: string | null
  elements?: TemplateElementInstanceRecord[] | null
}

function toTemplateElementInstanceDto(instance: TemplateElementInstanceRecord) {
  return {
    __typename: 'ElementInstance' as const,
    id: instance.id,
    type: instance.type,
    elementType: instance.elementType,
    elementData: toPreviewElementData(
      instance.elementData as unknown as ElementData
    ),
  }
}

function toTemplateElementBlockDto(block: TemplateElementBlockRecord) {
  return {
    __typename: 'ElementBlock' as const,
    id: block.id,
    order: block.order,
    status: block.status,
    timeLimit: block.timeLimit ?? null,
    elements: block.elements?.map(toTemplateElementInstanceDto) ?? null,
  }
}

function toTemplateElementStackDto(stack: TemplateElementStackRecord) {
  return {
    __typename: 'ElementStack' as const,
    id: stack.id,
    order: stack.order ?? null,
    type: stack.type,
    displayName: stack.displayName ?? null,
    description: stack.description ?? null,
    elements: stack.elements?.map(toTemplateElementInstanceDto) ?? null,
  }
}

type TemplateInformationRecord = {
  name: string
  templateInfo: {
    id: string
    description: string
    instructions: string
  } | null
}

function toTemplateInformationDto(activity: TemplateInformationRecord | null) {
  if (!activity?.templateInfo) return null

  return {
    templateId: activity.templateInfo.id,
    name: activity.name,
    description: activity.templateInfo.description,
    instructions: activity.templateInfo.instructions,
  }
}

type TemplateLiveQuizRecord = {
  id: string
  status: PublicationStatus
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  accessMode: string
  name: string
  displayName: string
  description?: string | null
  pointsMultiplier: number
  defaultPoints: number
  defaultCorrectPoints: number
  maxBonusPoints?: number | null
  timeToZeroBonus?: number | null
  createdAt: Date
  blocks?: TemplateElementBlockRecord[] | null
}

type TemplateAsyncActivityRecord = {
  id: string
  name: string
  status: PublicationStatus
  displayName: string
  description?: string | null
  pointsMultiplier: number
  stacks?: TemplateElementStackRecord[] | null
}

type TemplatePracticeQuizRecord = TemplateAsyncActivityRecord & {
  resetTimeDays: number
  orderType: string
}

type TemplateScheduledActivityRecord = TemplateAsyncActivityRecord & {
  scheduledStartAt: Date
  scheduledEndAt: Date
}

type TemplateGroupActivityRecord = TemplateScheduledActivityRecord & {
  clues?: {
    id: number
    type: ParameterType
    name: string
    displayName: string
    value: string
    unit?: string | null
  }[]
}

function toTemplateLiveQuizDto(liveQuiz: TemplateLiveQuizRecord | null) {
  if (!liveQuiz) return null

  return {
    __typename: 'LiveQuiz' as const,
    id: liveQuiz.id,
    status: liveQuiz.status,
    isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
    isModerationEnabled: liveQuiz.isModerationEnabled,
    isGamificationEnabled: liveQuiz.isGamificationEnabled,
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    accessMode: liveQuiz.accessMode,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    description: liveQuiz.description ?? null,
    pointsMultiplier: liveQuiz.pointsMultiplier,
    defaultPoints: liveQuiz.defaultPoints,
    defaultCorrectPoints: liveQuiz.defaultCorrectPoints,
    maxBonusPoints: liveQuiz.maxBonusPoints ?? null,
    timeToZeroBonus: liveQuiz.timeToZeroBonus ?? null,
    createdAt: liveQuiz.createdAt,
    blocks: liveQuiz.blocks?.map(toTemplateElementBlockDto) ?? null,
  }
}

function toTemplatePracticeQuizDto(
  practiceQuiz: TemplatePracticeQuizRecord | null
) {
  if (!practiceQuiz) return null

  return {
    __typename: 'PracticeQuiz' as const,
    id: practiceQuiz.id,
    name: practiceQuiz.name,
    status: practiceQuiz.status,
    displayName: practiceQuiz.displayName,
    description: practiceQuiz.description ?? null,
    pointsMultiplier: practiceQuiz.pointsMultiplier,
    resetTimeDays: practiceQuiz.resetTimeDays,
    orderType: practiceQuiz.orderType,
    stacks: practiceQuiz.stacks?.map(toTemplateElementStackDto) ?? null,
  }
}

function toTemplateMicroLearningDto(
  microLearning: TemplateScheduledActivityRecord | null
) {
  if (!microLearning) return null

  return {
    __typename: 'MicroLearning' as const,
    id: microLearning.id,
    name: microLearning.name,
    status: microLearning.status,
    displayName: microLearning.displayName,
    description: microLearning.description ?? null,
    pointsMultiplier: microLearning.pointsMultiplier,
    scheduledStartAt: microLearning.scheduledStartAt,
    scheduledEndAt: microLearning.scheduledEndAt,
    stacks: microLearning.stacks?.map(toTemplateElementStackDto) ?? null,
  }
}

function toTemplateGroupActivityDto(
  groupActivity: TemplateGroupActivityRecord | null
) {
  if (!groupActivity) return null

  return {
    __typename: 'GroupActivity' as const,
    id: groupActivity.id,
    name: groupActivity.name,
    displayName: groupActivity.displayName,
    description: groupActivity.description ?? null,
    pointsMultiplier: groupActivity.pointsMultiplier,
    status: groupActivity.status,
    scheduledStartAt: groupActivity.scheduledStartAt,
    scheduledEndAt: groupActivity.scheduledEndAt,
    clues:
      groupActivity.clues?.map((clue) => ({
        __typename: 'GroupActivityClue' as const,
        id: clue.id,
        type: clue.type,
        name: clue.name,
        displayName: clue.displayName,
        value: clue.value,
        unit: clue.unit ?? null,
      })) ?? null,
    stacks: groupActivity.stacks?.map(toTemplateElementStackDto) ?? null,
  }
}

export const activityRouter = router({
  details: userProcedure
    .input(activityDetailsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canRead = await hasActivityPermission(
        ctx,
        {
          activityId: input.activityId,
          activityType: input.activityType,
        },
        PermissionLevel.READ
      )

      if (!canRead) return { activityDetails: null }

      if (input.activityType === ActivityType.LIVE_QUIZ) {
        const liveQuiz = await prisma.liveQuiz.findUnique({
          where: { id: input.activityId },
          include: {
            owner: true,
            _count: {
              select: {
                permissions: {
                  where: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
            course: {
              include: {
                _count: {
                  select: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: {
                          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                        },
                      },
                    },
                  },
                },
              },
            },
            blocks: {
              include: {
                elements: {
                  include: {
                    element: {
                      include: {
                        _count: {
                          select: {
                            permissions: {
                              where: {
                                userId: ctx.user.sub,
                                permissionLevel: {
                                  in: [
                                    PermissionLevel.WRITE,
                                    PermissionLevel.ADMIN,
                                    PermissionLevel.OWNER,
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        })

        return {
          activityDetails: liveQuiz
            ? toLiveQuizActivityDetails(liveQuiz)
            : null,
        }
      }

      if (input.activityType === ActivityType.PRACTICE_QUIZ) {
        const practiceQuiz = await prisma.practiceQuiz.findUnique({
          where: { id: input.activityId },
          include: {
            owner: true,
            _count: {
              select: {
                permissions: {
                  where: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
            course: {
              include: {
                _count: {
                  select: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: {
                          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                        },
                      },
                    },
                  },
                },
              },
            },
            stacks: {
              include: {
                elements: {
                  include: {
                    element: {
                      include: {
                        permissions: {
                          where: {
                            userId: ctx.user.sub,
                            permissionLevel: {
                              in: [
                                PermissionLevel.WRITE,
                                PermissionLevel.ADMIN,
                                PermissionLevel.OWNER,
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        })

        return {
          activityDetails: practiceQuiz
            ? toAsyncActivityDetails({ activity: practiceQuiz })
            : null,
        }
      }

      if (input.activityType === ActivityType.MICRO_LEARNING) {
        const microLearning = await prisma.microLearning.findUnique({
          where: { id: input.activityId },
          include: {
            owner: true,
            _count: {
              select: {
                permissions: {
                  where: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
            course: {
              include: {
                _count: {
                  select: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: {
                          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                        },
                      },
                    },
                  },
                },
              },
            },
            stacks: {
              include: {
                elements: {
                  include: {
                    element: {
                      include: {
                        permissions: {
                          where: {
                            userId: ctx.user.sub,
                            permissionLevel: {
                              in: [
                                PermissionLevel.WRITE,
                                PermissionLevel.ADMIN,
                                PermissionLevel.OWNER,
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        })

        return {
          activityDetails: microLearning
            ? toAsyncActivityDetails({ activity: microLearning })
            : null,
        }
      }

      const groupActivity = await prisma.groupActivity.findUnique({
        where: { id: input.activityId },
        include: {
          owner: true,
          _count: {
            select: {
              permissions: {
                where: {
                  userId: ctx.user.sub,
                  permissionLevel: {
                    in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                  },
                },
              },
            },
          },
          course: {
            include: {
              _count: {
                select: {
                  permissions: {
                    where: {
                      userId: ctx.user.sub,
                      permissionLevel: {
                        in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                      },
                    },
                  },
                },
              },
            },
          },
          stacks: {
            include: {
              elements: {
                include: {
                  element: {
                    include: {
                      permissions: {
                        where: {
                          userId: ctx.user.sub,
                          permissionLevel: {
                            in: [
                              PermissionLevel.WRITE,
                              PermissionLevel.ADMIN,
                              PermissionLevel.OWNER,
                            ],
                          },
                        },
                      },
                    },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      })

      return {
        activityDetails: groupActivity
          ? toAsyncActivityDetails({
              activity: groupActivity,
              isGroupActivity: true,
            })
          : null,
      }
    }),

  applyBatchOperations: userFullAccessProcedure
    .input(applyActivityBatchOperationsInput)
    .mutation(async ({ ctx, input }) => {
      const appliedCount = await applyManageActivityBatchOperations(input, {
        prisma: getPrisma(ctx),
        userId: ctx.user.sub,
      })

      return { appliedCount }
    }),

  setReviewStatus: userFullAccessProcedure
    .input(activityReviewStatusInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const reviewStatus = input.isReviewed
        ? ReviewStatus.REVIEWED
        : ReviewStatus.INCOMPLETE

      try {
        if (input.activityType === ActivityType.LIVE_QUIZ) {
          const liveQuiz = await prisma.liveQuiz.update({
            where: {
              id: input.activityId,
              OR: [
                {
                  courseId: null,
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                      permissionLevel: { in: reviewStatusPermissionLevels },
                    },
                  },
                },
                {
                  courseId: { not: null },
                  course: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: reviewStatusPermissionLevels },
                      },
                    },
                  },
                },
              ],
            },
            data: { reviewStatus },
            select: { id: true },
          })

          return { reviewStatus: liveQuiz ? reviewStatus : null }
        }

        if (input.activityType === ActivityType.PRACTICE_QUIZ) {
          const practiceQuiz = await prisma.practiceQuiz.update({
            where: {
              id: input.activityId,
              course: {
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                    permissionLevel: { in: reviewStatusPermissionLevels },
                  },
                },
              },
            },
            data: { reviewStatus },
            select: { id: true },
          })

          return { reviewStatus: practiceQuiz ? reviewStatus : null }
        }

        if (input.activityType === ActivityType.MICRO_LEARNING) {
          const microLearning = await prisma.microLearning.update({
            where: {
              id: input.activityId,
              course: {
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                    permissionLevel: { in: reviewStatusPermissionLevels },
                  },
                },
              },
            },
            data: { reviewStatus },
            select: { id: true },
          })

          return { reviewStatus: microLearning ? reviewStatus : null }
        }

        const groupActivity = await prisma.groupActivity.update({
          where: {
            id: input.activityId,
            course: {
              permissions: {
                some: {
                  userId: ctx.user.sub,
                  permissionLevel: { in: reviewStatusPermissionLevels },
                },
              },
            },
          },
          data: { reviewStatus },
          select: { id: true },
        })

        return { reviewStatus: groupActivity ? reviewStatus : null }
      } catch (error) {
        console.error('Error setting activity review status:', error)
        return { reviewStatus: null }
      }
    }),

  outdatedElementInstances: userProcedure
    .input(outdatedElementInstancesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      if (input.instanceIds.length === 0) {
        return { outdatedElementInstances: [] }
      }

      const dbInstances = await prisma.elementInstance.findMany({
        where: {
          id: { in: input.instanceIds },
          element: { isDeleted: false },
        },
        include: {
          element: {
            select: {
              id: true,
              version: true,
              name: true,
              options: true,
            },
          },
        },
      })

      return {
        outdatedElementInstances: dbInstances.flatMap((instance) => {
          const item = toOutdatedElementInstanceInfo(instance)
          return item ? [item] : []
        }),
      }
    }),

  templateInformation: userProcedure
    .input(templateInformationInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.activityId,
          activityType: input.activityType,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { templateInformation: null }

      const select = {
        name: true,
        templateInfo: {
          select: {
            id: true,
            description: true,
            instructions: true,
          },
        },
      }

      if (input.activityType === ActivityType.LIVE_QUIZ) {
        const liveQuiz = await prisma.liveQuiz.findUnique({
          where: {
            id: input.activityId,
            status: PublicationStatus.TEMPLATE,
          },
          select,
        })

        return { templateInformation: toTemplateInformationDto(liveQuiz) }
      }

      if (input.activityType === ActivityType.PRACTICE_QUIZ) {
        const practiceQuiz = await prisma.practiceQuiz.findUnique({
          where: {
            id: input.activityId,
            status: PublicationStatus.TEMPLATE,
          },
          select,
        })

        return { templateInformation: toTemplateInformationDto(practiceQuiz) }
      }

      if (input.activityType === ActivityType.MICRO_LEARNING) {
        const microLearning = await prisma.microLearning.findUnique({
          where: {
            id: input.activityId,
            status: PublicationStatus.TEMPLATE,
          },
          select,
        })

        return { templateInformation: toTemplateInformationDto(microLearning) }
      }

      const groupActivity = await prisma.groupActivity.findUnique({
        where: {
          id: input.activityId,
          status: PublicationStatus.TEMPLATE,
        },
        select,
      })

      return { templateInformation: toTemplateInformationDto(groupActivity) }
    }),

  template: userProcedure
    .input(activityTemplateInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const accessible = await isTemplateAccessible({
        prisma,
        userId: ctx.user.sub,
        templateId: input.templateId,
      })

      if (!accessible) return { activityTemplate: null }

      const template = await prisma.activityTemplate.findUnique({
        where: { id: input.templateId },
        include: {
          liveQuiz: {
            where: { isDeleted: false },
            include: {
              blocks: {
                include: {
                  elements: {
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          practiceQuiz: {
            where: { isDeleted: false },
            include: {
              stacks: {
                include: {
                  elements: {
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          microLearning: {
            where: { isDeleted: false },
            include: {
              stacks: {
                include: {
                  elements: {
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          groupActivity: {
            where: { isDeleted: false },
            include: {
              clues: true,
              stacks: {
                include: {
                  elements: {
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      })

      let activityType: ActivityType | null = null
      if (template?.liveQuiz) {
        activityType = ActivityType.LIVE_QUIZ
      } else if (template?.practiceQuiz) {
        activityType = ActivityType.PRACTICE_QUIZ
      } else if (template?.microLearning) {
        activityType = ActivityType.MICRO_LEARNING
      } else if (template?.groupActivity) {
        activityType = ActivityType.GROUP_ACTIVITY
      }

      if (!template || activityType === null) {
        return { activityTemplate: null }
      }

      return {
        activityTemplate: {
          __typename: 'ActivityTemplate' as const,
          id: template.id,
          activityType,
          description: template.description,
          instructions: template.instructions,
          liveQuiz: toTemplateLiveQuizDto(template.liveQuiz),
          practiceQuiz: toTemplatePracticeQuizDto(template.practiceQuiz),
          microLearning: toTemplateMicroLearningDto(template.microLearning),
          groupActivity: toTemplateGroupActivityDto(template.groupActivity),
        },
      }
    }),

  checkTemplateElementExists: userProcedure
    .input(checkTemplateElementExistsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const element = await prisma.element.findFirst({
        where: {
          name: input.name,
          permissions: { some: { userId: ctx.user.sub } },
        },
        select: { id: true },
      })

      return { checkTemplateElementExists: element !== null }
    }),

  matchingUserElementsTemplate: userProcedure
    .input(matchingUserElementsTemplateInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const availableElements = await prisma.element.findMany({
        where: {
          type: input.elementType,
          isDeleted: false,
          permissions: {
            some: {
              userId: ctx.user.sub,
            },
          },
        },
        select: {
          id: true,
          name: true,
          content: true,
          options: true,
        },
      })

      const matchingUserElementsTemplate = availableElements
        .filter((element) => {
          if (
            input.hasSampleSolution != null &&
            elementTypesWithSampleSolution.includes(input.elementType) &&
            !optionFlagMatches(
              element.options,
              'hasSampleSolution',
              input.hasSampleSolution
            )
          ) {
            return false
          }

          if (
            input.hasAnswerFeedbacks != null &&
            elementTypesWithAnswerFeedbacks.includes(input.elementType) &&
            !optionFlagMatches(
              element.options,
              'hasAnswerFeedbacks',
              input.hasAnswerFeedbacks
            )
          ) {
            return false
          }

          return true
        })
        .map((element) => ({
          id: element.id,
          name: element.name,
          content: element.content,
        }))

      return { matchingUserElementsTemplate }
    }),

  templatePreviewAnswerCollectionEntries: userProcedure
    .input(templatePreviewAnswerCollectionEntriesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const collections = await getAnswerCollectionsForElements({
        prisma,
        userId: ctx.user.sub,
        templateId: input.templateId,
      })
      const answerCollection = collections.find(
        (collection) => collection.id === input.answerCollectionId
      )

      return {
        templatePreviewAnswerCollectionEntries:
          answerCollection?.entries.map((entry) => ({
            id: entry.id,
            value: entry.value,
          })) ?? [],
      }
    }),

  userActivitiesCourses: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      select: {
        objects: {
          where: { courseId: { not: null } },
          select: {
            courseId: true,
            course: {
              select: {
                id: true,
                name: true,
                _count: {
                  select: {
                    liveQuizzes: true,
                    practiceQuizzes: true,
                    microLearnings: true,
                    groupActivities: true,
                  },
                },
              },
            },
          },
          orderBy: { course: { endDate: 'desc' } },
        },
      },
    })

    return {
      userActivitiesCourses:
        user?.objects.flatMap((object) => {
          const course = toUserActivitiesCourseListItem(object)
          return course ? [course] : []
        }) ?? [],
    }
  }),

  userActivities: userProcedure
    .input(userActivitiesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const {
        statusFilter,
        activityTypeFilter,
        courseId,
        withoutCourse,
        searchString,
        showOwned = true,
        showShared = true,
        showDependencies = true,
        multiplier,
        reviewStatus,
        isGamificationEnabled,
        isAssessmentEnabled,
        isPinProtected,
        sortByType,
        sortByAsc,
        numEntries,
        offset,
      } = input

      const whereClause: Prisma.UserActivitiesWhereInput = {
        userId: ctx.user.sub,
        permissionLevel:
          showOwned && showShared
            ? undefined
            : {
                in: [
                  ...(showOwned ? [PermissionLevel.OWNER] : []),
                  ...(showShared
                    ? [
                        PermissionLevel.ADMIN,
                        PermissionLevel.WRITE,
                        PermissionLevel.EXECUTE,
                        PermissionLevel.READ,
                      ]
                    : []),
                ],
              },
        derived: showDependencies ? undefined : false,
        status:
          statusFilter && statusFilter.length > 0
            ? { in: statusFilter }
            : undefined,
        pointsMultiplier: multiplier ? { equals: multiplier } : undefined,
        reviewStatus: reviewStatus ? { equals: reviewStatus } : undefined,
        type: activityTypeFilter ? { equals: activityTypeFilter } : undefined,
        isGamificationEnabled: isGamificationEnabled
          ? { equals: isGamificationEnabled }
          : undefined,
        isAssessmentEnabled: isAssessmentEnabled
          ? { equals: isAssessmentEnabled }
          : undefined,
        pinCode: isPinProtected ? { not: null } : undefined,
        courseId: courseId
          ? { equals: courseId }
          : withoutCourse
            ? null
            : undefined,
        OR: searchString
          ? [
              {
                name: {
                  contains: searchString,
                  mode: 'insensitive',
                },
              },
              {
                displayName: {
                  contains: searchString,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      }

      const orderBy: Prisma.UserActivitiesOrderByWithRelationInput[] = [
        ...(sortByType === SortByType.CREATED
          ? [{ createdAt: sortByAsc ? 'asc' : 'desc' } as const]
          : []),
        ...(sortByType === SortByType.MODIFIED
          ? [{ updatedAt: sortByAsc ? 'asc' : 'desc' } as const]
          : []),
        ...(sortByType === SortByType.TITLE
          ? [{ name: sortByAsc ? 'asc' : 'desc' } as const]
          : []),
        ...(sortByType === SortByType.TYPE
          ? [{ typeOrder: sortByAsc ? 'asc' : 'desc' } as const]
          : []),
        ...(sortByType === SortByType.STATUS
          ? [{ status: sortByAsc ? 'asc' : 'desc' } as const]
          : []),
        { updatedAt: 'desc' },
      ]

      const [activitiesFromView, totalCount] = await Promise.all([
        prisma.userActivities.findMany({
          where: whereClause,
          orderBy,
          take: numEntries ?? undefined,
          skip: offset ?? undefined,
        }),
        prisma.userActivities.count({ where: whereClause }),
      ])

      return {
        userActivities: {
          numOfActivities: totalCount,
          activities: activitiesFromView.flatMap((activity) => {
            const item = toUserActivityOverviewItem(activity)
            return item ? [item] : []
          }),
        },
      }
    }),
})
