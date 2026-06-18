import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ParameterType,
  PermissionLevel,
  Prisma,
  PublicationStatus,
  ReviewStatus,
  type AnswerCollection,
  type AnswerCollectionEntry,
  type Element,
  type ElementBlock,
  type ElementInstance,
  type ElementStack,
  type GroupActivity,
  type GroupActivityClue,
  type GroupActivityParameter,
  type LiveQuiz,
  type MicroLearning,
  type PracticeQuiz,
} from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  SortByType,
  type CaseStudyElementData,
  type ElementData,
  type ElementManipulationInput,
  type ElementOptionsInput,
  type SelectionElementData,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  propagateActivityToElements,
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import type { z } from 'zod'
import { applyManageActivityBatchOperations } from '../../services/manageActivityBatchOperations.js'
import {
  finalizeGroupActivityGrading,
  getGradingGroupActivity,
  gradeGroupActivitySubmission,
} from '../../services/manageGroupActivityGrading.js'
import { getPrisma, type TRPCContext } from '../context.js'
import {
  toAsyncActivityDetails,
  toLiveQuizActivityDetails,
  toOutdatedElementInstanceInfo,
  toUserActivitiesCourseListItem,
  toUserActivityOverviewItem,
} from '../dto/activity.js'
import { toPreviewElementData } from '../dto/elementPreview.js'
import { toGroupActivityGradingDto } from '../dto/groupActivityGrading.js'
import { router } from '../init.js'
import { hasActivityPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activityDetailsInput,
  activityReviewStatusInput,
  activityTemplateInput,
  applyActivityBatchOperationsInput,
  checkTemplateElementExistsInput,
  checkTemplateInfoAvailableInput,
  createActivityTemplateInput,
  createLiveQuizFromTemplateInput,
  deleteActivityTemplateInput,
  editActivityTemplateInput,
  finalizeGroupActivityGradingInput,
  gradeGroupActivitySubmissionInput,
  groupActivityGradingInput,
  matchingUserElementsTemplateInput,
  outdatedElementInstancesInput,
  templateInformationInput,
  templatePreviewAnswerCollectionEntriesInput,
  userActivitiesInput,
} from '../schemas/activity.js'
import { manipulateElement } from './element.js'
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

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CreateLiveQuizFromTemplateInput = z.infer<
  typeof createLiveQuizFromTemplateInput
>

type TemplateElementWithCollections = Element & {
  answerCollection?:
    | (AnswerCollection & { entries: AnswerCollectionEntry[] })
    | null
  answerCollectionItems?: AnswerCollectionEntry[] | null
}

function cleanUuid(value?: string | null) {
  return typeof value === 'string' && uuidRegex.test(value) ? value : undefined
}

function getTemplateElementOptions(
  values: ElementManipulationInput
): ElementOptionsInput | undefined | null {
  if (
    values.type === ElementType.SC ||
    values.type === ElementType.MC ||
    values.type === ElementType.KPRIM
  ) {
    if (!values.choicesOptions) {
      throw new Error('Choices options not provided for Choices element')
    }
    return values.choicesOptions
  }

  if (values.type === ElementType.NUMERICAL) {
    if (!values.numericalOptions) {
      throw new Error('Numerical options not provided for Numerical element')
    }
    return values.numericalOptions
  }

  if (values.type === ElementType.FREE_TEXT) {
    if (!values.freeTextOptions) {
      throw new Error('Free text options not provided for Free Text element')
    }
    return values.freeTextOptions
  }

  if (values.type === ElementType.SELECTION) {
    if (!values.selectionOptions) {
      throw new Error('Selection options not provided for Selection element')
    }
    return values.selectionOptions
  }

  if (values.type === ElementType.CASE_STUDY) {
    if (!values.caseStudyOptions) {
      throw new Error('Case study options not provided for Case Study element')
    }
    return values.caseStudyOptions
  }

  return undefined
}

async function ensureTemplateAnswerCollectionAccess({
  tx,
  userId,
  templateAnswerCollectionIds,
  values,
  options,
}: {
  tx: PrismaTransactionClient
  userId: string
  templateAnswerCollectionIds: number[]
  values: ElementManipulationInput
  options: ElementOptionsInput | undefined | null
}) {
  if (
    values.type !== ElementType.SELECTION &&
    values.type !== ElementType.CASE_STUDY
  ) {
    return
  }

  if (
    !options ||
    !('answerCollection' in options) ||
    typeof options.answerCollection === 'undefined' ||
    options.answerCollection === null
  ) {
    throw new Error(
      'Answer collection not provided for selection or case study element'
    )
  }

  const answerCollectionId = options.answerCollection
  const permission = await tx.derivedPermission.findFirst({
    where: {
      answerCollectionId,
      userId,
      permissionLevel: {
        in: [
          PermissionLevel.READ,
          PermissionLevel.EXECUTE,
          PermissionLevel.WRITE,
          PermissionLevel.ADMIN,
          PermissionLevel.OWNER,
        ],
      },
    },
  })

  if (permission) return

  if (!templateAnswerCollectionIds.includes(answerCollectionId)) {
    throw new Error(
      'User does not have access to the answer collection linked to the template'
    )
  }

  await tx.permission.upsert({
    where: {
      answerCollectionId_userId: {
        answerCollectionId,
        userId,
      },
    },
    create: {
      permissionLevel: PermissionLevel.READ,
      user: {
        connect: { id: userId },
      },
      answerCollection: {
        connect: { id: answerCollectionId },
      },
    },
    update: {},
  })
}

async function createLiveQuizFromTemplate({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: CreateLiveQuizFromTemplateInput
}) {
  const prisma = getPrisma(ctx)
  const accessible = await isTemplateAccessible({
    prisma,
    userId: ctx.user.sub,
    templateId: input.templateId,
  })

  if (!accessible) return null

  const template = await prisma.activityTemplate.findUnique({
    where: { id: input.templateId },
    select: {
      liveQuizId: true,
      answerCollections: { select: { id: true } },
    },
  })

  if (!template?.liveQuizId) return null

  const templateLiveQuiz = await prisma.liveQuiz.findUnique({
    where: {
      id: template.liveQuizId,
      status: PublicationStatus.TEMPLATE,
    },
  })

  if (!templateLiveQuiz) return null

  const cleanCourseId = cleanUuid(input.courseId)
  const course = cleanCourseId
    ? await prisma.course.findUnique({
        where: {
          id: cleanCourseId,
          permissions: { some: { userId: ctx.user.sub } },
        },
      })
    : null

  if (cleanCourseId && !course) return null

  const templateAnswerCollectionIds = template.answerCollections.map(
    (collection) => collection.id
  )
  const gamificationSetting = course?.isGamificationEnabled
    ? course.isGamificationEnabled
    : input.isGamificationEnabled
  const assessmentSetting = course?.isAssessmentEnabled ?? false

  const newLiveQuiz = await prisma.$transaction(
    async (tx) => {
      const liveQuizContent: {
        blocks: {
          order: number
          timeLimit?: number | null
          elements: {
            order: number
            element: TemplateElementWithCollections
          }[]
        }[]
      } = { blocks: [] }

      for (const block of input.blocks) {
        const elements: {
          order: number
          element: TemplateElementWithCollections
        }[] = []

        for (const element of block.elements) {
          if (element.useExistingElement) {
            if (
              element.existingElementId === null ||
              typeof element.existingElementId === 'undefined'
            ) {
              throw new Error('Existing element id not provided')
            }

            const existingElement = await tx.element.findUnique({
              where: {
                id: element.existingElementId,
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                  },
                },
              },
              include: {
                answerCollection: {
                  include: {
                    entries: true,
                  },
                },
                answerCollectionItems: true,
              },
            })

            if (!existingElement) {
              console.log(
                'Failed to find element with id',
                element.existingElementId
              )
              throw new Error(
                'Existing element does not exist or user does not have access to it'
              )
            }

            elements.push({
              order: element.order,
              element: existingElement,
            })
          } else if (element.useNewElement) {
            if (
              element.newElement === null ||
              typeof element.newElement === 'undefined'
            ) {
              throw new Error('New element data not provided')
            }

            const values = element.newElement as ElementManipulationInput
            const options = getTemplateElementOptions(values)

            await ensureTemplateAnswerCollectionAccess({
              tx,
              userId: ctx.user.sub,
              templateAnswerCollectionIds,
              values,
              options,
            })

            const createdElement = await manipulateElement(
              { ...values, options, templateId: input.templateId },
              { ...ctx, prisma: tx } as Parameters<typeof manipulateElement>[1]
            )

            if (!createdElement) {
              console.log(
                'Failed to create new element from form inputs',
                values
              )
              throw new Error('Failed to create new element')
            }

            const newElement = await tx.element.findUnique({
              where: {
                id: createdElement.id,
                ownerId: ctx.user.sub,
              },
              include: {
                answerCollection: {
                  include: {
                    entries: true,
                  },
                },
                answerCollectionItems: true,
              },
            })

            if (!newElement) {
              console.log('Failed to fetch newly created element')
              throw new Error('Failed to fetch newly created element')
            }

            elements.push({
              order: element.order,
              element: newElement,
            })
          } else {
            throw new Error('Invalid template element modification choice')
          }
        }

        liveQuizContent.blocks.push({
          order: block.order,
          timeLimit: block.timeLimit,
          elements,
        })
      }

      const quiz = await tx.liveQuiz.create({
        data: {
          name: input.name.trim(),
          displayName: input.displayName.trim(),
          description: input.description,
          templateName: templateLiveQuiz.name,
          pointsMultiplier: Math.max(templateLiveQuiz.pointsMultiplier, 1),
          defaultPoints: Math.max(templateLiveQuiz.defaultPoints, 0),
          defaultCorrectPoints: Math.max(
            templateLiveQuiz.defaultCorrectPoints,
            0
          ),
          maxBonusPoints: Math.max(templateLiveQuiz.maxBonusPoints, 0),
          timeToZeroBonus: Math.max(templateLiveQuiz.timeToZeroBonus, 1),
          isGamificationEnabled: gamificationSetting,
          isAssessmentEnabled: assessmentSetting,
          isConfusionFeedbackEnabled:
            templateLiveQuiz.isConfusionFeedbackEnabled,
          isLiveQAEnabled: templateLiveQuiz.isLiveQAEnabled,
          isModerationEnabled: templateLiveQuiz.isModerationEnabled,
          blocks: {
            create: liveQuizContent.blocks.map((block) => ({
              order: block.order,
              timeLimit: block.timeLimit,
              elements: {
                create: block.elements.map((entry) => {
                  const elementData = processElementData(entry.element)
                  const initialResults = getInitialInstanceResults(elementData)

                  return {
                    elementType: entry.element.type,
                    order: entry.order,
                    type: ElementInstanceType.LIVE_QUIZ,
                    elementData,
                    options: {
                      basePoints: entry.element.basePoints,
                      pointsMultiplier:
                        templateLiveQuiz.pointsMultiplier *
                        entry.element.pointsMultiplier,
                    },
                    results: initialResults,
                    anonymousResults: initialResults,
                    instanceStatistics: {
                      create: getInitialInstanceStatistics(
                        ElementInstanceType.LIVE_QUIZ
                      ),
                    },
                    element: { connect: { id: entry.element.id } },
                    owner: { connect: { id: ctx.user.sub } },
                  }
                }),
              },
            })),
          },
          owner: { connect: { id: ctx.user.sub } },
          course: course ? { connect: { id: course.id } } : undefined,
        },
      })

      await recomputeDerivedPermissions(
        { liveQuizId: quiz.id, userId: ctx.user.sub },
        tx
      )

      return quiz
    },
    { timeout: 60000 }
  )

  return newLiveQuiz.id
}

function getTemplateActivityWhere(input: {
  activityId: string
  activityType: ActivityType
}) {
  if (input.activityType === ActivityType.LIVE_QUIZ) {
    return { liveQuizId: input.activityId }
  }

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    return { practiceQuizId: input.activityId }
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return { microLearningId: input.activityId }
  }

  return { groupActivityId: input.activityId }
}

async function updateTemplateActivityName(
  tx: Prisma.TransactionClient,
  {
    activityId,
    activityType,
    name,
  }: {
    activityId: string
    activityType: ActivityType
    name: string
  }
) {
  const where = {
    id: activityId,
    status: PublicationStatus.TEMPLATE,
  }

  if (activityType === ActivityType.LIVE_QUIZ) {
    await tx.liveQuiz.update({
      where,
      data: { name },
    })
    return
  }

  if (activityType === ActivityType.PRACTICE_QUIZ) {
    await tx.practiceQuiz.update({
      where,
      data: { name },
    })
    return
  }

  if (activityType === ActivityType.MICRO_LEARNING) {
    await tx.microLearning.update({
      where,
      data: { name },
    })
    return
  }

  await tx.groupActivity.update({
    where,
    data: { name },
  })
}

async function deleteActivityTemplate({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
  }
}) {
  const prisma = getPrisma(ctx)
  const canAdmin = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.ADMIN
  )

  if (!canAdmin) return null

  if (input.activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: {
        id: input.activityId,
        status: PublicationStatus.TEMPLATE,
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!liveQuiz) return null

    return await prisma.$transaction(
      async (tx) => {
        const deletedLiveQuiz = await tx.liveQuiz.delete({
          where: { id: input.activityId },
        })

        await propagateActivityToElements(
          { stacks: liveQuiz.blocks, updateAccessRequests: true },
          tx
        )

        return deletedLiveQuiz.id
      },
      { timeout: 60000 }
    )
  }

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
      where: {
        id: input.activityId,
        status: PublicationStatus.TEMPLATE,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!practiceQuiz) return null

    return await prisma.$transaction(
      async (tx) => {
        const deletedPracticeQuiz = await tx.practiceQuiz.delete({
          where: { id: input.activityId },
        })

        await propagateActivityToElements(
          { stacks: practiceQuiz.stacks, updateAccessRequests: true },
          tx
        )

        return deletedPracticeQuiz.id
      },
      { timeout: 60000 }
    )
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await prisma.microLearning.findUnique({
      where: {
        id: input.activityId,
        status: PublicationStatus.TEMPLATE,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!microLearning) return null

    return await prisma.$transaction(
      async (tx) => {
        const deletedMicroLearning = await tx.microLearning.delete({
          where: { id: input.activityId },
        })

        await propagateActivityToElements(
          { stacks: microLearning.stacks, updateAccessRequests: true },
          tx
        )

        return deletedMicroLearning.id
      },
      { timeout: 60000 }
    )
  }

  const groupActivity = await prisma.groupActivity.findUnique({
    where: {
      id: input.activityId,
      status: PublicationStatus.TEMPLATE,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!groupActivity) return null

  return await prisma.$transaction(
    async (tx) => {
      const deletedGroupActivity = await tx.groupActivity.delete({
        where: { id: input.activityId },
      })

      await propagateActivityToElements(
        { stacks: groupActivity.stacks, updateAccessRequests: true },
        tx
      )

      return deletedGroupActivity.id
    },
    { timeout: 60000 }
  )
}

type TemplateConversionLiveQuiz = LiveQuiz & {
  blocks: (ElementBlock & { elements: ElementInstance[] })[]
}

type TemplateConversionAsyncActivity = {
  stacks: (ElementStack & { elements: ElementInstance[] })[]
}

type TemplateConversionPracticeQuiz = PracticeQuiz &
  TemplateConversionAsyncActivity

type TemplateConversionMicroLearning = MicroLearning &
  TemplateConversionAsyncActivity

type TemplateConversionGroupActivity = GroupActivity &
  TemplateConversionAsyncActivity & {
    parameters: GroupActivityParameter[]
    clues: GroupActivityClue[]
  }

type TemplateConversionActivity =
  | TemplateConversionLiveQuiz
  | TemplateConversionPracticeQuiz
  | TemplateConversionMicroLearning
  | TemplateConversionGroupActivity

function getElementDataOptions(instance: ElementInstance) {
  const elementData = instance.elementData as { options?: Record<string, any> }

  return elementData.options ?? {}
}

function getTemplateAnswerCollectionIds(instances: ElementInstance[]) {
  const answerCollectionIds = Array.from(
    new Set(
      instances.flatMap((instance) => {
        if (instance.elementType === ElementType.SELECTION) {
          const answerCollection = (
            instance.elementData as SelectionElementData
          ).options.answerCollection

          return typeof answerCollection?.id === 'number'
            ? [answerCollection.id]
            : []
        }

        if (instance.elementType === ElementType.CASE_STUDY) {
          const answerCollectionId = (
            instance.elementData as CaseStudyElementData
          ).options.answerCollectionId

          return typeof answerCollectionId === 'number'
            ? [answerCollectionId]
            : []
        }

        return []
      })
    )
  )

  const answerCollectionEntryIds = Array.from(
    new Set(
      instances.flatMap((instance) => {
        const options = getElementDataOptions(instance)

        if (instance.elementType === ElementType.SELECTION) {
          return Array.isArray(options.answerCollectionSolutionIds)
            ? options.answerCollectionSolutionIds.flatMap((id) =>
                typeof id === 'number' ? [id] : []
              )
            : []
        }

        if (instance.elementType === ElementType.CASE_STUDY) {
          return Array.isArray(options.items)
            ? options.items.flatMap((item) =>
                typeof item.id === 'number' ? [item.id] : []
              )
            : []
        }

        return []
      })
    )
  )

  return { answerCollectionIds, answerCollectionEntryIds }
}

async function getActivityTemplateResourceInfo({
  activityId,
  activityType,
  prisma,
}: {
  activityId: string
  activityType: ActivityType
  prisma: PrismaTransactionClient
}): Promise<{
  error: boolean
  activity: TemplateConversionActivity | null
  noInstances: boolean
  answerCollectionIds: number[]
  answerCollectionEntryIds: number[]
}> {
  let activity: TemplateConversionActivity | null = null
  let instances: ElementInstance[] = []

  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: activityId },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!liveQuiz) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
        answerCollectionEntryIds: [],
      }
    }

    activity = liveQuiz
    instances = liveQuiz.blocks.flatMap((block) => block.elements)
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: activityId },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!practiceQuiz) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
        answerCollectionEntryIds: [],
      }
    }

    activity = practiceQuiz
    instances = practiceQuiz.stacks.flatMap((stack) => stack.elements)
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await prisma.microLearning.findUnique({
      where: { id: activityId },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!microLearning) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
        answerCollectionEntryIds: [],
      }
    }

    activity = microLearning
    instances = microLearning.stacks.flatMap((stack) => stack.elements)
  } else {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
        parameters: true,
        clues: true,
      },
    })

    if (!groupActivity) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
        answerCollectionEntryIds: [],
      }
    }

    activity = groupActivity
    instances = groupActivity.stacks.flatMap((stack) => stack.elements)
  }

  if (instances.length === 0) {
    return {
      error: false,
      activity,
      noInstances: true,
      answerCollectionIds: [],
      answerCollectionEntryIds: [],
    }
  }

  return {
    error: false,
    activity,
    noInstances: false,
    ...getTemplateAnswerCollectionIds(instances),
  }
}

async function checkTemplateInfoAvailable({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
  }
}) {
  const prisma = getPrisma(ctx)
  const canAdmin = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.ADMIN
  )

  if (!canAdmin) return null

  const { error, noInstances, answerCollectionIds, answerCollectionEntryIds } =
    await getActivityTemplateResourceInfo({
      activityId: input.activityId,
      activityType: input.activityType,
      prisma,
    })

  if (error) return null

  if (noInstances) {
    return {
      noInstances: true,
      noResourcesRequired: false,
      resourcesRequiredExist: false,
      resourcesRequiredMissing: false,
    }
  }

  if (answerCollectionIds.length === 0) {
    return {
      noInstances: false,
      noResourcesRequired: true,
      resourcesRequiredExist: false,
      resourcesRequiredMissing: false,
    }
  }

  const answerCollections = await prisma.answerCollection.findMany({
    where: { id: { in: answerCollectionIds } },
    select: { id: true },
  })
  const answerCollectionEntries = await prisma.answerCollectionEntry.findMany({
    where: { id: { in: answerCollectionEntryIds } },
    select: { id: true },
  })
  const resourcesRequiredExist =
    answerCollections.length === answerCollectionIds.length &&
    answerCollectionEntries.length === answerCollectionEntryIds.length

  return {
    noInstances: false,
    noResourcesRequired: false,
    resourcesRequiredExist,
    resourcesRequiredMissing: !resourcesRequiredExist,
  }
}

function getTemplateResourceConnections({
  answerCollectionIds,
  answerCollectionEntryIds,
}: {
  answerCollectionIds: number[]
  answerCollectionEntryIds: number[]
}) {
  return {
    answerCollections:
      answerCollectionIds.length > 0
        ? {
            connect: answerCollectionIds.map((id) => ({ id })),
          }
        : undefined,
    answerCollectionItems:
      answerCollectionEntryIds.length > 0
        ? {
            connect: answerCollectionEntryIds.map((id) => ({ id })),
          }
        : undefined,
  }
}

function createTemplateElementInstances({
  elements,
  type,
  userId,
}: {
  elements: ElementInstance[]
  type: ElementInstanceType
  userId: string
}) {
  return elements.map((element) => ({
    elementType: element.elementType,
    order: element.order,
    type,
    elementData: element.elementData,
    options: element.options,
    results: element.results,
    anonymousResults: element.anonymousResults,
    instanceStatistics: {
      create: getInitialInstanceStatistics(type),
    },
    element: {
      connect: { id: element.elementId },
    },
    owner: {
      connect: { id: userId },
    },
  }))
}

async function createActivityTemplate({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
    templateName: string
    templateDescription: string
    templateInstructions: string
    copyBeforeConversion: boolean
  }
}) {
  const prisma = getPrisma(ctx)
  const canAdmin = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.ADMIN
  )

  if (!canAdmin) return null

  const {
    error,
    activity,
    noInstances,
    answerCollectionIds,
    answerCollectionEntryIds,
  } = await getActivityTemplateResourceInfo({
    activityId: input.activityId,
    activityType: input.activityType,
    prisma,
  })

  if (error || noInstances || !activity) return false

  const templateResourceConnections = getTemplateResourceConnections({
    answerCollectionIds,
    answerCollectionEntryIds,
  })

  if (input.copyBeforeConversion) {
    if (input.activityType === ActivityType.LIVE_QUIZ) {
      const liveQuiz = activity as TemplateConversionLiveQuiz

      await prisma.$transaction(async (tx) => {
        const template = await tx.liveQuiz.create({
          data: {
            name: input.templateName,
            displayName: liveQuiz.displayName,
            description: liveQuiz.description,
            status: PublicationStatus.TEMPLATE,
            pointsMultiplier: Math.max(liveQuiz.pointsMultiplier, 1),
            defaultPoints: Math.max(liveQuiz.defaultPoints, 0),
            defaultCorrectPoints: Math.max(liveQuiz.defaultCorrectPoints, 0),
            maxBonusPoints: Math.max(liveQuiz.maxBonusPoints, 0),
            timeToZeroBonus: Math.max(liveQuiz.timeToZeroBonus, 1),
            isGamificationEnabled: liveQuiz.isGamificationEnabled,
            isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
            isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
            isModerationEnabled: liveQuiz.isModerationEnabled,
            blocks: {
              create: liveQuiz.blocks.map((block) => ({
                order: block.order,
                timeLimit: block.timeLimit,
                elements: {
                  create: createTemplateElementInstances({
                    elements: block.elements,
                    type: ElementInstanceType.LIVE_QUIZ,
                    userId: ctx.user.sub,
                  }),
                },
              })),
            },
            templateInfo: {
              create: {
                description: input.templateDescription,
                instructions: input.templateInstructions,
                ...templateResourceConnections,
              },
            },
            owner: {
              connect: {
                id: ctx.user.sub,
              },
            },
          },
        })

        await recomputeDerivedPermissions(
          {
            liveQuizId: template.id,
            userId: ctx.user.sub,
          },
          tx
        )
      })

      return true
    }

    if (input.activityType === ActivityType.PRACTICE_QUIZ) {
      const practiceQuiz = activity as TemplateConversionPracticeQuiz

      await prisma.$transaction(async (tx) => {
        const template = await tx.practiceQuiz.create({
          data: {
            name: input.templateName,
            displayName: practiceQuiz.displayName,
            description: practiceQuiz.description,
            status: PublicationStatus.TEMPLATE,
            pointsMultiplier: practiceQuiz.pointsMultiplier,
            orderType: practiceQuiz.orderType,
            resetTimeDays: practiceQuiz.resetTimeDays,
            stacks: {
              create: practiceQuiz.stacks.map((stack) => ({
                type: ElementStackType.PRACTICE_QUIZ,
                order: stack.order,
                displayName: stack.displayName,
                description: stack.description,
                elements: {
                  create: createTemplateElementInstances({
                    elements: stack.elements,
                    type: ElementInstanceType.PRACTICE_QUIZ,
                    userId: ctx.user.sub,
                  }),
                },
              })),
            },
            templateInfo: {
              create: {
                description: input.templateDescription,
                instructions: input.templateInstructions,
                ...templateResourceConnections,
              },
            },
            course: {
              connect: { id: practiceQuiz.courseId },
            },
            owner: { connect: { id: ctx.user.sub } },
          },
        })

        await recomputeDerivedPermissions(
          {
            practiceQuizId: template.id,
            userId: ctx.user.sub,
          },
          tx
        )
      })

      return true
    }

    if (input.activityType === ActivityType.MICRO_LEARNING) {
      const microLearning = activity as TemplateConversionMicroLearning

      await prisma.$transaction(async (tx) => {
        const template = await tx.microLearning.create({
          data: {
            name: input.templateName,
            displayName: microLearning.displayName,
            description: microLearning.description,
            status: PublicationStatus.TEMPLATE,
            pointsMultiplier: microLearning.pointsMultiplier,
            scheduledStartAt: microLearning.scheduledStartAt,
            scheduledEndAt: microLearning.scheduledEndAt,
            stacks: {
              create: microLearning.stacks.map((stack) => ({
                type: ElementStackType.MICROLEARNING,
                order: stack.order,
                displayName: stack.displayName,
                description: stack.description,
                elements: {
                  create: createTemplateElementInstances({
                    elements: stack.elements,
                    type: ElementInstanceType.MICROLEARNING,
                    userId: ctx.user.sub,
                  }),
                },
              })),
            },
            templateInfo: {
              create: {
                description: input.templateDescription,
                instructions: input.templateInstructions,
                ...templateResourceConnections,
              },
            },
            course: {
              connect: { id: microLearning.courseId },
            },
            owner: { connect: { id: ctx.user.sub } },
          },
        })

        await recomputeDerivedPermissions(
          {
            microLearningId: template.id,
            userId: ctx.user.sub,
          },
          tx
        )
      })

      return true
    }

    const groupActivity = activity as TemplateConversionGroupActivity

    await prisma.$transaction(async (tx) => {
      const template = await tx.groupActivity.create({
        data: {
          name: input.templateName,
          displayName: groupActivity.displayName,
          description: groupActivity.description,
          status: PublicationStatus.TEMPLATE,
          pointsMultiplier: groupActivity.pointsMultiplier,
          scheduledStartAt: groupActivity.scheduledStartAt,
          scheduledEndAt: groupActivity.scheduledEndAt,
          parameters: {
            create: groupActivity.parameters.map((parameter) => ({
              name: parameter.name,
              displayName: parameter.displayName,
              type: parameter.type,
              options: parameter.options,
              unit: parameter.unit,
            })),
          },
          clues: {
            create: groupActivity.clues.map((clue) => ({
              name: clue.name,
              displayName: clue.displayName,
              type: clue.type,
              value: clue.value,
              unit: clue.unit,
            })),
          },
          stacks: {
            create: groupActivity.stacks.map((stack) => ({
              type: ElementStackType.GROUP_ACTIVITY,
              order: stack.order,
              displayName: stack.displayName,
              description: stack.description,
              elements: {
                create: createTemplateElementInstances({
                  elements: stack.elements,
                  type: ElementInstanceType.GROUP_ACTIVITY,
                  userId: ctx.user.sub,
                }),
              },
            })),
          },
          templateInfo: {
            create: {
              description: input.templateDescription,
              instructions: input.templateInstructions,
              ...templateResourceConnections,
            },
          },
          course: {
            connect: { id: groupActivity.courseId },
          },
          owner: { connect: { id: ctx.user.sub } },
        },
      })

      await recomputeDerivedPermissions(
        {
          groupActivityId: template.id,
          userId: ctx.user.sub,
        },
        tx
      )
    })

    return true
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityTemplate.create({
      data: {
        description: input.templateDescription,
        instructions: input.templateInstructions,
        liveQuiz:
          input.activityType === ActivityType.LIVE_QUIZ
            ? { connect: { id: input.activityId } }
            : undefined,
        practiceQuiz:
          input.activityType === ActivityType.PRACTICE_QUIZ
            ? { connect: { id: input.activityId } }
            : undefined,
        microLearning:
          input.activityType === ActivityType.MICRO_LEARNING
            ? { connect: { id: input.activityId } }
            : undefined,
        groupActivity:
          input.activityType === ActivityType.GROUP_ACTIVITY
            ? { connect: { id: input.activityId } }
            : undefined,
        ...templateResourceConnections,
      },
    })

    if (input.activityType === ActivityType.LIVE_QUIZ) {
      await tx.liveQuiz.update({
        where: { id: input.activityId },
        data: {
          name: input.templateName,
          status: PublicationStatus.TEMPLATE,
        },
      })
    } else if (input.activityType === ActivityType.PRACTICE_QUIZ) {
      await tx.practiceQuiz.update({
        where: { id: input.activityId },
        data: {
          name: input.templateName,
          status: PublicationStatus.TEMPLATE,
        },
      })
    } else if (input.activityType === ActivityType.MICRO_LEARNING) {
      await tx.microLearning.update({
        where: { id: input.activityId },
        data: {
          name: input.templateName,
          status: PublicationStatus.TEMPLATE,
        },
      })
    } else {
      await tx.groupActivity.update({
        where: { id: input.activityId },
        data: {
          name: input.templateName,
          status: PublicationStatus.TEMPLATE,
        },
      })
    }
  })

  return true
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

  groupActivityGrading: userProcedure
    .input(groupActivityGradingInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canExecute = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.GROUP_ACTIVITY,
        },
        PermissionLevel.EXECUTE
      )

      if (!canExecute) return { groupActivityGrading: null }

      return {
        groupActivityGrading: toGroupActivityGradingDto(
          await getGradingGroupActivity({ prisma, id: input.id })
        ),
      }
    }),

  gradeGroupActivitySubmission: userFullAccessProcedure
    .input(gradeGroupActivitySubmissionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canExecute = await hasActivityPermission(
        ctx,
        {
          activityId: input.groupActivityId,
          activityType: ActivityType.GROUP_ACTIVITY,
        },
        PermissionLevel.EXECUTE
      )

      if (!canExecute) return { gradeGroupActivitySubmission: null }

      const submission = await gradeGroupActivitySubmission({
        prisma,
        id: input.id,
        gradingDecisions: input.gradingDecisions,
      })

      return {
        gradeGroupActivitySubmission: submission ? { id: submission.id } : null,
      }
    }),

  finalizeGroupActivityGrading: userFullAccessProcedure
    .input(finalizeGroupActivityGradingInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.GROUP_ACTIVITY,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { finalizeGroupActivityGrading: null }

      const groupActivity = await finalizeGroupActivityGrading({
        prisma,
        id: input.id,
      })

      return {
        finalizeGroupActivityGrading: groupActivity
          ? { id: groupActivity.id, status: groupActivity.status }
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

  checkTemplateInfoAvailable: userProcedure
    .input(checkTemplateInfoAvailableInput)
    .query(async ({ ctx, input }) => ({
      checkTemplateInfoAvailable: await checkTemplateInfoAvailable({
        ctx,
        input,
      }),
    })),

  createActivityTemplate: userFullAccessProcedure
    .input(createActivityTemplateInput)
    .mutation(async ({ ctx, input }) => ({
      createActivityTemplate: await createActivityTemplate({
        ctx,
        input,
      }),
    })),

  createLiveQuizFromTemplate: userFullAccessProcedure
    .input(createLiveQuizFromTemplateInput)
    .mutation(async ({ ctx, input }) => ({
      createLiveQuizFromTemplate: await createLiveQuizFromTemplate({
        ctx,
        input,
      }),
    })),

  editTemplate: userFullAccessProcedure
    .input(editActivityTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.activityId,
          activityType: input.activityType,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { editActivityTemplate: false }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.activityTemplate.update({
            where: {
              id: input.templateId,
              ...getTemplateActivityWhere(input),
            },
            data: {
              description: input.description,
              instructions: input.instructions,
            },
          })

          await updateTemplateActivityName(tx, {
            activityId: input.activityId,
            activityType: input.activityType,
            name: input.name,
          })
        })

        return { editActivityTemplate: true }
      } catch (error) {
        console.error('Error editing activity template:', error)
        return { editActivityTemplate: false }
      }
    }),

  deleteTemplate: userFullAccessProcedure
    .input(deleteActivityTemplateInput)
    .mutation(async ({ ctx, input }) => ({
      deleteActivityTemplate: await deleteActivityTemplate({
        ctx,
        input,
      }),
    })),

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
