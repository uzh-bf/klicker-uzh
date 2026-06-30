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
  type ElementBlockInput,
  type ElementData,
  type ElementManipulationInput,
  type ElementOptionsInput,
  type ElementStackInput,
  type SelectionElementData,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getCachedBlockResults,
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  processElementData,
  propagateActivityToElements,
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { TRPCError } from '@trpc/server'
import type { Redis } from 'ioredis'
import { randomInt, randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { publishMicroLearningEnded } from '../../realtime/events.js'
import {
  startLiveQuiz,
  type LiveQuizExecutionContext,
} from '../../services/liveQuizExecution.js'
import { applyManageActivityBatchOperations } from '../../services/manageActivityBatchOperations.js'
import {
  correctAssessmentPointsInstance,
  correctAssessmentPointsLiveQuiz,
  getAssessmentCourseParticipants,
  getAssessmentResultsCourse,
  getAssessmentResultsLiveQuiz,
  getEndedLiveQuizzesCourse,
  getLiveQuizStudentAssessmentResponses,
  getManageStudentCourseResults,
  getPreviousPointCorrections,
} from '../../services/manageAssessmentResults.js'
import {
  finalizeGroupActivityGrading,
  getGradingGroupActivity,
  gradeGroupActivitySubmission,
} from '../../services/manageGroupActivityGrading.js'
import { getPrisma, type TRPCContext } from '../context.js'
import {
  toActivityPermissionBooleans,
  toAsyncActivityDetails,
  toLiveQuizActivityDetails,
  toOutdatedElementInstanceInfo,
  toUserActivitiesCourseListItem,
  toUserActivityOverviewItem,
} from '../dto/activity.js'
import { toPreviewElementData } from '../dto/elementPreview.js'
import { toGroupActivityGradingDto } from '../dto/groupActivityGrading.js'
import {
  toLiveQuizStudentAssessmentResponsesDto,
  toPreviousPointCorrectionsDto,
} from '../dto/manageAssessmentResults.js'
import { router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import {
  userFullAccessProcedure,
  userProcedure,
  userSessionExecProcedure,
} from '../procedures.js'
import {
  activityDetailsInput,
  activityIdInput,
  activityReviewStatusInput,
  activityTemplateInput,
  applyActivityBatchOperationsInput,
  assessmentCourseParticipantsInput,
  assessmentResultsCourseInput,
  assessmentResultsLiveQuizInput,
  changeActivityNameInput,
  checkTemplateElementExistsInput,
  checkTemplateInfoAvailableInput,
  correctAssessmentPointsInstanceInput,
  correctAssessmentPointsLiveQuizInput,
  createActivityTemplateInput,
  createLiveQuizFromTemplateInput,
  deleteActivityTemplateInput,
  editActivityTemplateInput,
  editGroupActivityInput,
  editLiveQuizInput,
  editMicroLearningInput,
  editPracticeQuizInput,
  endedLiveQuizzesCourseInput,
  extendActivityInput,
  finalizeGroupActivityGradingInput,
  gradeGroupActivitySubmissionInput,
  groupActivityGradingInput,
  groupActivityManipulationInput,
  liveQuizManipulationInput,
  liveQuizStudentAssessmentResponsesInput,
  matchingUserElementsTemplateInput,
  microLearningManipulationInput,
  openGroupActivityInput,
  outdatedElementInstancesInput,
  practiceQuizManipulationInput,
  previousPointCorrectionsInput,
  publishActivityInput,
  scheduleLiveQuizInput,
  studentCourseResultsInput,
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

type PubSubPublisher = {
  publish(event: string, payload: unknown): unknown
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

type PracticeQuizManipulationInput = z.infer<
  typeof practiceQuizManipulationInput
>

type EditPracticeQuizInput = z.infer<typeof editPracticeQuizInput>

type MicroLearningManipulationInput = z.infer<
  typeof microLearningManipulationInput
>

type EditMicroLearningInput = z.infer<typeof editMicroLearningInput>

type GroupActivityManipulationInput = z.infer<
  typeof groupActivityManipulationInput
>

type EditGroupActivityInput = z.infer<typeof editGroupActivityInput>

type LiveQuizManipulationInput = z.infer<typeof liveQuizManipulationInput>

type EditLiveQuizInput = z.infer<typeof editLiveQuizInput>

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

  await recomputeDerivedPermissions({ answerCollectionId, userId }, tx)
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

function modifiedReviewStatus(reviewStatus: ReviewStatus) {
  return reviewStatus === ReviewStatus.REVIEWED
    ? ReviewStatus.MODIFIED_AFTER_REVIEW
    : undefined
}

type ActivityNameRecord = {
  name: string
  displayName: string
  reviewStatus: ReviewStatus
}

type ScheduledHatchetClient = {
  scheduled: {
    delete: (taskId: string) => Promise<unknown>
  }
}

type HatchetEventClient = {
  events?: {
    push?: (eventName: string, payload: { info: string }) => Promise<unknown>
  }
}

type ScheduledTaskResult = {
  metadata: {
    id: string
  }
}

type ActivitySchedulerTasks = {
  publishScheduledPracticeQuiz?: {
    schedule: (
      date: Date,
      payload: { practiceQuizId: string }
    ) => Promise<ScheduledTaskResult>
  }
  publishScheduledLiveQuiz?: {
    schedule: (
      date: Date,
      payload: { liveQuizId: string }
    ) => Promise<ScheduledTaskResult>
  }
  publishScheduledMicroLearning?: {
    schedule: (
      date: Date,
      payload: { microLearningId: string }
    ) => Promise<ScheduledTaskResult>
  }
  endExpiredMicroLearning?: {
    schedule: (
      date: Date,
      payload: { microLearningId: string }
    ) => Promise<ScheduledTaskResult>
  }
  publishScheduledGroupActivity?: {
    schedule: (
      date: Date,
      payload: { groupActivityId: string }
    ) => Promise<ScheduledTaskResult>
  }
  endExpiredGroupActivity?: {
    schedule: (
      date: Date,
      payload: { groupActivityId: string }
    ) => Promise<ScheduledTaskResult>
  }
}

type ScheduledActivityRecord = {
  scheduledPublicationTaskId?: string | null
  scheduledCompletionTaskId?: string | null
}

type UnpublishedActivityRecord = {
  id: string
  status: PublicationStatus
}

type PublishedActivityRecord = {
  id: string
  status: PublicationStatus
}

type ScheduledLiveQuizRecord = {
  id: string
  name: string
  status: PublicationStatus
  availableFrom?: Date | null
}

type OpenedGroupActivityRecord = {
  id: string
  status: PublicationStatus
  scheduledStartAt: Date
}

type AsyncActivitySummaryRecord = {
  numOfResponses: number
  numOfAnonymousResponses: number
}

type PracticeQuizSummaryRecord = AsyncActivitySummaryRecord

type MicroLearningSummaryRecord = AsyncActivitySummaryRecord

type GroupActivitySummaryRecord = {
  numOfStartedInstances: number
  numOfSubmissions: number
}

type LiveQuizSummaryRecord = {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
}

type AuthoringJsonRecord = Record<string, unknown>

function isAuthoringRecord(value: unknown): value is AuthoringJsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getAuthoringObjectProperty(value: unknown, key: string) {
  return isAuthoringRecord(value) ? value[key] : undefined
}

type AuthoringElementInstanceSource = Pick<
  ElementInstance,
  'id' | 'type' | 'elementType' | 'elementData'
>

type AuthoringElementStackSource = Pick<
  ElementStack,
  'id' | 'type' | 'displayName' | 'description' | 'order'
> & {
  elements: AuthoringElementInstanceSource[]
}

type AuthoringElementBlockSource = Pick<
  ElementBlock,
  'id' | 'order' | 'status' | 'timeLimit'
> & {
  elements: AuthoringElementInstanceSource[]
}

type AuthoringLiveQuizSource = Pick<
  LiveQuiz,
  | 'id'
  | 'name'
  | 'displayName'
  | 'description'
  | 'pointsMultiplier'
  | 'defaultPoints'
  | 'defaultCorrectPoints'
  | 'maxBonusPoints'
  | 'timeToZeroBonus'
  | 'isGamificationEnabled'
  | 'isAssessmentEnabled'
  | 'pinCode'
  | 'isLiveQAEnabled'
  | 'isConfusionFeedbackEnabled'
  | 'isModerationEnabled'
> & {
  blocks: AuthoringElementBlockSource[]
  course: { id: string } | null
}

type AuthoringPracticeQuizSource = Pick<
  PracticeQuiz,
  | 'id'
  | 'status'
  | 'name'
  | 'displayName'
  | 'description'
  | 'pointsMultiplier'
  | 'resetTimeDays'
  | 'availableFrom'
  | 'orderType'
> & {
  course: { id: string; displayName: string; color: string } | null
  stacks: AuthoringElementStackSource[]
}

type AuthoringMicroLearningSource = Pick<
  MicroLearning,
  | 'id'
  | 'name'
  | 'status'
  | 'displayName'
  | 'description'
  | 'pointsMultiplier'
  | 'scheduledStartAt'
  | 'scheduledEndAt'
> & {
  course: { id: string; displayName: string; color: string } | null
  stacks: AuthoringElementStackSource[]
}

type AuthoringGroupActivitySource = Pick<
  GroupActivity,
  | 'id'
  | 'name'
  | 'displayName'
  | 'description'
  | 'pointsMultiplier'
  | 'scheduledStartAt'
  | 'scheduledEndAt'
> & {
  course: { id: string; displayName: string } | null
  clues: Pick<
    GroupActivityClue,
    'id' | 'type' | 'name' | 'displayName' | 'value' | 'unit'
  >[]
  stacks: AuthoringElementStackSource[]
}

type EndedActivityRecord = {
  id: string
  status: PublicationStatus
  scheduledEndAt: Date
}

type ExtendedActivityRecord = {
  id: string
  scheduledEndAt: Date
}

type DeletedActivityRecord = {
  id: string
}

type ResetLiveQuizRecord = {
  id: string
  status: PublicationStatus
}

function getActivitySchedulerTasks(ctx: TRPCContext) {
  return ctx.tasks as ActivitySchedulerTasks | undefined
}

function getScheduledTaskId(task: ScheduledTaskResult) {
  return task.metadata.id
}

function toScheduledLiveQuizRecord(quiz: ScheduledLiveQuizRecord | null) {
  if (!quiz) return null

  return {
    id: quiz.id,
    name: quiz.name,
    status: quiz.status,
    availableFrom: quiz.availableFrom ?? null,
  }
}

function getResultTotal(results: Prisma.JsonValue | null | undefined) {
  if (results === null || typeof results !== 'object') return 0

  const total = (results as { total?: unknown }).total
  return typeof total === 'number' ? total : 0
}

type ActivityInstanceWithElement = ElementInstance & { element: Element }

async function splitActivityInstances({
  ctx,
  stacksOrBlocks,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  stacksOrBlocks: ElementStackInput[] | ElementBlockInput[]
}) {
  const prisma = getPrisma(ctx)
  const persistentInstanceOrderMap = stacksOrBlocks.reduce<
    Record<number, number>
  >((acc, block) => {
    block.elements
      .filter(
        (element) =>
          element.existingInstanceId != null && !element.duplicateInstance
      )
      .forEach((element) => {
        acc[element.existingInstanceId!] = element.order
      })
    return acc
  }, {})

  const persistentInstanceIds = Object.keys(persistentInstanceOrderMap).map(
    (id) => parseInt(id)
  )

  const persistentInstances = (await prisma.elementInstance.findMany({
    where: { id: { in: persistentInstanceIds } },
    include: { element: true },
  })) as ActivityInstanceWithElement[]

  const duplicateInstanceIds = stacksOrBlocks.flatMap((stackOrBlock) =>
    stackOrBlock.elements
      .filter(
        (element) =>
          element.existingInstanceId != null && element.duplicateInstance
      )
      .map((element) => element.existingInstanceId!)
  )

  const duplicationInstances = (await prisma.elementInstance.findMany({
    where: {
      id: { in: duplicateInstanceIds },
      element: {
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
            },
          },
        },
      },
    },
    include: { element: true },
  })) as ActivityInstanceWithElement[]

  const allInstances = [...persistentInstances, ...duplicationInstances]
  const anyInstanceOutdated = allInstances.some((instance) => {
    const instanceElementDataId = getAuthoringObjectProperty(
      instance.elementData,
      'id'
    )
    if (typeof instanceElementDataId !== 'string') return false

    const [, instanceVersion] = instanceElementDataId.split('-v')
    return (
      instanceVersion && parseInt(instanceVersion) !== instance.element.version
    )
  })

  const requiredElementsIds = stacksOrBlocks
    .flatMap((block) => block.elements)
    .filter((element) => element.existingInstanceId == null)
    .map((blockElem) => blockElem.elementId)

  const dbElements = await prisma.element.findMany({
    where: {
      id: { in: requiredElementsIds },
      isDeleted: false,
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
          },
        },
      },
    },
    include: {
      answerCollection: { include: { entries: true } },
      answerCollectionItems: true,
    },
  })

  const uniqueElements = new Set(dbElements.map((element) => element.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Not all elements could be found',
    })
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, element) => {
      acc[element.id] = element
      return acc
    },
    {}
  )

  return {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  }
}

function generateLiveQuizPin() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  return Array.from({ length: 6 }, () =>
    characters.charAt(randomInt(characters.length))
  ).join('')
}

async function manipulateLiveQuiz({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: LiveQuizManipulationInput | EditLiveQuizInput
}) {
  const prisma = getPrisma(ctx)
  const id = 'id' in input ? input.id : undefined

  let existingActivity:
    | (LiveQuiz & { course?: { _count: { permissions: number } } | null })
    | null = null
  if (id) {
    existingActivity = await prisma.liveQuiz.findUnique({
      where: { id, isDeleted: false },
      include: {
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
      },
    })

    if (!existingActivity) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Live quiz not found',
      })
    }
    if (existingActivity.status === PublicationStatus.PUBLISHED) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot edit a published live quiz',
      })
    }
  }

  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ ctx, stacksOrBlocks: input.blocks })

  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = []
  let blocksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementBlock: { liveQuizId: id },
      },
    })

    const blocks = await prisma.elementBlock.findMany({
      where: { liveQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    blocksToDelete = blocks.map((block) => block.id)
  }

  const course = input.courseId
    ? await prisma.course.findUnique({
        where: { id: input.courseId },
        select: { isGamificationEnabled: true, isAssessmentEnabled: true },
      })
    : null

  if (input.courseId && !course) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' })
  }

  const gamificationSetting = course?.isGamificationEnabled
    ? course.isGamificationEnabled
    : input.isGamificationEnabled
  const assessmentSetting = course?.isAssessmentEnabled ?? false
  const pinProtection = assessmentSetting || input.isPinProtected

  const isCourseAdminOwner = !!existingActivity?.course?._count.permissions
  if (
    existingActivity?.isAssessmentEnabled &&
    !isCourseAdminOwner &&
    (input.courseId === null || input.courseId !== existingActivity.courseId)
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Assessment live quizzes can only be modified by course admins or owners',
    })
  }

  const requiresNewPin =
    pinProtection &&
    (!existingActivity ||
      ((input.courseId || existingActivity.courseId) &&
        input.courseId !== existingActivity.courseId) ||
      (existingActivity && !existingActivity.courseId && !input.courseId))

  let newPinCode: string | undefined | null = existingActivity?.pinCode
  if (requiresNewPin) {
    let pinValid = false

    for (let attempt = 0; attempt < 10; attempt++) {
      newPinCode = generateLiveQuizPin()

      const existingLiveQuiz = await prisma.liveQuiz.findUnique({
        where: { pinCode: newPinCode },
      })
      if (!existingLiveQuiz) {
        pinValid = true
        break
      }
    }

    if (!pinValid) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not find available pin code for live quiz',
      })
    }
  }

  const activityMultiplier = Math.max(input.multiplier, 1)
  const createOrUpdateJSON = {
    name: input.name.trim(),
    displayName: input.displayName.trim(),
    description: input.description,
    pointsMultiplier: activityMultiplier,
    defaultPoints:
      input.defaultPoints != null
        ? Math.max(input.defaultPoints, 0)
        : undefined,
    defaultCorrectPoints:
      input.defaultCorrectPoints != null
        ? Math.max(input.defaultCorrectPoints, 0)
        : undefined,
    maxBonusPoints:
      input.maxBonusPoints != null
        ? Math.max(input.maxBonusPoints, 0)
        : undefined,
    timeToZeroBonus:
      input.timeToZeroBonus != null
        ? Math.max(input.timeToZeroBonus, 1)
        : undefined,
    isGamificationEnabled: gamificationSetting,
    isAssessmentEnabled: assessmentSetting,
    pinCode: pinProtection ? newPinCode : null,
    isConfusionFeedbackEnabled: input.isConfusionFeedbackEnabled,
    isLiveQAEnabled: input.isLiveQAEnabled,
    isModerationEnabled: input.isModerationEnabled,
    areInstancesOutdated: anyInstanceOutdated,
    reviewStatus:
      existingActivity?.courseId !== input.courseId
        ? ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === ReviewStatus.REVIEWED
          ? ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    blocks: {
      create: input.blocks.map((block) => ({
        order: block.order,
        timeLimit: block.timeLimit,
        elements: {
          connectOrCreate: block.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.LIVE_QUIZ,
              activityMultiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      })),
    },
  }

  const activity = await prisma.$transaction(
    async (tx) => {
      await tx.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

      for (const instance of persistentInstances) {
        const elementMultiplier =
          getAuthoringObjectProperty(
            instance.elementData,
            'pointsMultiplier'
          ) ?? 1

        await tx.elementInstance.update({
          where: { id: instance.id },
          data: {
            elementBlockId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...(isAuthoringRecord(instance.options) ? instance.options : {}),
              pointsMultiplier:
                activityMultiplier *
                (typeof elementMultiplier === 'number' ? elementMultiplier : 1),
            },
          },
        })
      }

      await tx.elementBlock.deleteMany({
        where: { id: { in: blocksToDelete } },
      })

      const upsertedQuiz = await tx.liveQuiz.upsert({
        where: { id: id ?? randomUUID() },
        create: {
          ...createOrUpdateJSON,
          course: input.courseId
            ? { connect: { id: input.courseId } }
            : undefined,
          owner: { connect: { id: ctx.user.sub } },
        },
        update: {
          ...createOrUpdateJSON,
          course:
            typeof input.courseId !== 'undefined'
              ? input.courseId !== null
                ? { connect: { id: input.courseId } }
                : { disconnect: true }
              : undefined,
        },
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
                        in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                      },
                    },
                  },
                },
              },
            },
          },
          blocks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          _count: { select: { permissions: true } },
        },
      })

      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, tx)
        }
      }

      await recomputeDerivedPermissions({ liveQuizId: upsertedQuiz.id }, tx)

      return upsertedQuiz
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'LiveQuiz',
    id: activity.id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const directPermission = activity.permissions[0]?.directPermission
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = toActivityPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission: Boolean(
      directPermission && directPermission.userGroupId !== null
    ),
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.LIVE_QUIZ,
    status: activity.status,
    courseId: isCourseAdminOwner ? activity.course?.id : null,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.blocks.length,
    numOfElements: activity.blocks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
    automaticPublicationAt: activity.availableFrom,
    scheduledStartAt: null,
    scheduledEndAt: null,
    groupDeadlineDate: null,
    numOfParticipantGroups: null,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: activity.pinCode,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer:
      !id ||
      (activity.courseId === null &&
        (permissionLevel === PermissionLevel.OWNER ||
          permissionLevel === PermissionLevel.ADMIN)) ||
      (activity.course?._count.permissions ?? 0) > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

async function manipulatePracticeQuiz({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: PracticeQuizManipulationInput | EditPracticeQuizInput
}) {
  const prisma = getPrisma(ctx)
  const id = 'id' in input ? input.id : undefined

  let existingActivity: PracticeQuiz | null = null
  if (id) {
    existingActivity = await prisma.practiceQuiz.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Practice quiz not found',
      })
    }
    if (existingActivity.status === PublicationStatus.PUBLISHED) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot edit a published practice quiz',
      })
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { isGamificationEnabled: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' })
  }

  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ ctx, stacksOrBlocks: input.stacks })

  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = []
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { practiceQuizId: id },
      },
    })

    const stacks = await prisma.elementStack.findMany({
      where: { practiceQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: input.name.trim(),
    displayName: input.displayName.trim(),
    description: input.description,
    pointsMultiplier: input.multiplier,
    orderType: input.order,
    resetTimeDays: input.resetTimeDays,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== input.courseId
        ? ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === ReviewStatus.REVIEWED
          ? ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    stacks: {
      create: input.stacks.map((stack) => ({
        type: ElementStackType.PRACTICE_QUIZ,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.PRACTICE_QUIZ,
              activityMultiplier: input.multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
              additionalInstanceOptions: {
                resetTimeDays: input.resetTimeDays,
              },
            })
          ),
        },
      })),
    },
    course: { connect: { id: input.courseId } },
  }

  const activity = await prisma.$transaction(
    async (tx) => {
      await tx.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

      for (const instance of persistentInstances) {
        const elementMultiplier =
          getAuthoringObjectProperty(
            instance.elementData,
            'pointsMultiplier'
          ) ?? 1

        await tx.elementInstance.update({
          where: { id: instance.id },
          data: {
            elementStackId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...(isAuthoringRecord(instance.options) ? instance.options : {}),
              resetTimeDays: input.resetTimeDays,
              pointsMultiplier:
                input.multiplier *
                (typeof elementMultiplier === 'number' ? elementMultiplier : 1),
            },
          },
        })
      }

      await tx.elementStack.deleteMany({
        where: { id: { in: stacksToDelete } },
      })

      const upsertedQuiz = await tx.practiceQuiz.upsert({
        where: { id: id ?? randomUUID() },
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
                        in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
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

      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, tx)
        }
      }

      await recomputeDerivedPermissions({ practiceQuizId: upsertedQuiz.id }, tx)

      return upsertedQuiz
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'PracticeQuiz',
    id: activity.id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const directPermission = activity.permissions[0]?.directPermission
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = toActivityPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission: Boolean(
      directPermission && directPermission.userGroupId !== null
    ),
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.PRACTICE_QUIZ,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, stack) => acc + stack._count.elements,
      0
    ),
    automaticPublicationAt: activity.availableFrom,
    scheduledStartAt: null,
    scheduledEndAt: null,
    groupDeadlineDate: null,
    numOfParticipantGroups: null,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: null,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: (activity.course?._count.permissions ?? 0) > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

async function manipulateMicroLearning({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: MicroLearningManipulationInput | EditMicroLearningInput
}) {
  const prisma = getPrisma(ctx)
  const id = 'id' in input ? input.id : undefined

  let existingActivity: MicroLearning | null = null
  if (id) {
    existingActivity = await prisma.microLearning.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Microlearning not found',
      })
    }
    if (
      existingActivity.status === PublicationStatus.PUBLISHED ||
      existingActivity.status === PublicationStatus.ENDED
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot edit a published or ended microlearning',
      })
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { isGamificationEnabled: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' })
  }

  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ ctx, stacksOrBlocks: input.stacks })

  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = []
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { microLearningId: id },
      },
    })

    const stacks = await prisma.elementStack.findMany({
      where: { microLearningId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: input.name.trim(),
    displayName: input.displayName.trim(),
    description: input.description,
    pointsMultiplier: input.multiplier,
    scheduledStartAt: input.startDate,
    scheduledEndAt: input.endDate,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== input.courseId
        ? ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === ReviewStatus.REVIEWED
          ? ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    stacks: {
      create: input.stacks.map((stack) => ({
        type: ElementStackType.MICROLEARNING,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.MICROLEARNING,
              activityMultiplier: input.multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      })),
    },
    course: { connect: { id: input.courseId } },
  }

  const activity = await prisma.$transaction(
    async (tx) => {
      await tx.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

      for (const instance of persistentInstances) {
        const elementMultiplier =
          getAuthoringObjectProperty(
            instance.elementData,
            'pointsMultiplier'
          ) ?? 1

        await tx.elementInstance.update({
          where: { id: instance.id },
          data: {
            elementStackId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...(isAuthoringRecord(instance.options) ? instance.options : {}),
              pointsMultiplier:
                input.multiplier *
                (typeof elementMultiplier === 'number' ? elementMultiplier : 1),
            },
          },
        })
      }

      await tx.elementStack.deleteMany({
        where: { id: { in: stacksToDelete } },
      })

      const upsertedMicroLearning = await tx.microLearning.upsert({
        where: { id: id ?? randomUUID() },
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
                        in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
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

      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, tx)
        }
      }

      await recomputeDerivedPermissions(
        { microLearningId: upsertedMicroLearning.id },
        tx
      )

      return upsertedMicroLearning
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'MicroLearning',
    id: activity.id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const directPermission = activity.permissions[0]?.directPermission
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = toActivityPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission: Boolean(
      directPermission && directPermission.userGroupId !== null
    ),
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.MICRO_LEARNING,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, stack) => acc + stack._count.elements,
      0
    ),
    automaticPublicationAt: null,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    groupDeadlineDate: null,
    numOfParticipantGroups: null,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: null,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: (activity.course?._count.permissions ?? 0) > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

async function manipulateGroupActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: GroupActivityManipulationInput | EditGroupActivityInput
}) {
  const prisma = getPrisma(ctx)
  const id = 'id' in input ? input.id : undefined

  let existingActivity: GroupActivity | null = null
  if (id) {
    existingActivity = await prisma.groupActivity.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group Activity not found',
      })
    }
    if (
      existingActivity.status === PublicationStatus.SCHEDULED ||
      existingActivity.status === PublicationStatus.PUBLISHED ||
      existingActivity.status === PublicationStatus.GRADED
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only edit draft group activities',
      })
    }

    await prisma.groupActivity.update({
      where: { id },
      data: { clues: { deleteMany: {} } },
    })
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { isGamificationEnabled: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' })
  }

  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ ctx, stacksOrBlocks: [input.stack] })

  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = []
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { groupActivityId: id },
      },
    })

    const stacks = await prisma.elementStack.findMany({
      where: { groupActivityId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const newId = randomUUID()
  const groupActivityId = id ?? newId
  const createOrUpdateJSON = {
    id: groupActivityId,
    name: input.name,
    displayName: input.displayName,
    description: input.description,
    status: PublicationStatus.DRAFT,
    scheduledStartAt: input.startDate,
    scheduledEndAt: input.endDate,
    pointsMultiplier: input.multiplier,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== input.courseId
        ? ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === ReviewStatus.REVIEWED
          ? ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    clues: {
      connectOrCreate: input.clues.map((clue) => ({
        where: {
          groupActivityId_name: {
            groupActivityId,
            name: clue.name,
          },
        },
        create: {
          name: clue.name,
          displayName: clue.displayName,
          type: clue.type,
          value: clue.value,
          unit: clue.unit,
        },
      })),
    },
    stacks: {
      create: {
        type: ElementStackType.GROUP_ACTIVITY,
        order: 0,
        displayName: input.stack.displayName,
        description: input.stack.description,
        elements: {
          connectOrCreate: input.stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.GROUP_ACTIVITY,
              activityMultiplier: input.multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      },
    },
    course: { connect: { id: input.courseId } },
  }

  const activity = await prisma.$transaction(
    async (tx) => {
      await tx.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

      for (const instance of persistentInstances) {
        const elementMultiplier =
          getAuthoringObjectProperty(
            instance.elementData,
            'pointsMultiplier'
          ) ?? 1

        await tx.elementInstance.update({
          where: { id: instance.id },
          data: {
            elementStackId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...(isAuthoringRecord(instance.options) ? instance.options : {}),
              pointsMultiplier:
                input.multiplier *
                (typeof elementMultiplier === 'number' ? elementMultiplier : 1),
            },
          },
        })
      }

      await tx.elementStack.deleteMany({
        where: { id: { in: stacksToDelete } },
      })

      const upsertedActivity = await tx.groupActivity.upsert({
        where: { id: groupActivityId },
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
                  participantGroups: true,
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
          stacks: { include: { _count: { select: { elements: true } } } },
          _count: { select: { permissions: true } },
        },
      })

      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, tx)
        }
      }

      await recomputeDerivedPermissions(
        { groupActivityId: upsertedActivity.id },
        tx
      )

      return upsertedActivity
    },
    { timeout: 60000 }
  )

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const directPermission = activity.permissions[0]?.directPermission
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = toActivityPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission: Boolean(
      directPermission && directPermission.userGroupId !== null
    ),
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.GROUP_ACTIVITY,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, stack) => acc + stack._count.elements,
      0
    ),
    automaticPublicationAt: null,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    groupDeadlineDate: activity.course?.groupDeadlineDate,
    numOfParticipantGroups: activity.course?._count.participantGroups ?? null,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: null,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: (activity.course?._count.permissions ?? 0) > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

async function changeActivityNameForType({
  input,
  findActivity,
  updateActivity,
  emitInvalidation,
  errorMessage,
}: {
  input: {
    activityId: string
    name: string
    displayName: string
  }
  findActivity: () => Promise<ActivityNameRecord | null>
  updateActivity: (data: {
    name: string
    displayName: string
    reviewStatus?: ReviewStatus
  }) => Promise<unknown>
  emitInvalidation: () => void
  errorMessage: string
}) {
  const activity = await findActivity()

  if (!activity) return false

  if (
    activity.name === input.name &&
    activity.displayName === input.displayName
  ) {
    return true
  }

  try {
    await updateActivity({
      name: input.name,
      displayName: input.displayName,
      reviewStatus: modifiedReviewStatus(activity.reviewStatus),
    })

    emitInvalidation()
    return true
  } catch (error) {
    console.error(errorMessage, error)
    return false
  }
}

async function deleteScheduledHatchetTask({
  ctx,
  taskId,
  failureMessage,
}: {
  ctx: TRPCContext
  taskId: string
  failureMessage: string
}) {
  const hatchet = ctx.hatchet as ScheduledHatchetClient | undefined

  try {
    if (!hatchet?.scheduled?.delete) {
      throw new Error('Hatchet client unavailable')
    }

    await hatchet.scheduled.delete(taskId)
  } catch (error) {
    console.error(failureMessage, error)
  }
}

async function pushHatchetAuditLogEvent({
  ctx,
  info,
}: {
  ctx: TRPCContext
  info: string
}) {
  const hatchet = ctx.hatchet as HatchetEventClient | undefined

  if (!hatchet?.events?.push) {
    throw new Error('Hatchet event client unavailable')
  }

  await hatchet.events.push('create-audit-log-entry', { info })
}

async function pushHatchetAuditLogEventSafely({
  ctx,
  info,
}: {
  ctx: TRPCContext
  info: string
}) {
  try {
    await pushHatchetAuditLogEvent({ ctx, info })
  } catch (error) {
    console.error('Failed to create reset live quiz audit log entry:', error)
  }
}

async function unpublishScheduledActivity({
  ctx,
  activityId,
  typename,
  findActivity,
  getScheduledTasks,
  updateActivity,
}: {
  ctx: TRPCContext
  activityId: string
  typename: string
  findActivity: () => Promise<ScheduledActivityRecord | null>
  getScheduledTasks: (
    activity: ScheduledActivityRecord
  ) => { taskId?: string | null; failureMessage: string }[]
  updateActivity: () => Promise<UnpublishedActivityRecord>
}) {
  const activity = await findActivity()

  if (!activity) return null

  for (const task of getScheduledTasks(activity)) {
    if (task.taskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: task.taskId,
        failureMessage: task.failureMessage,
      })
    }
  }

  const updatedActivity = await updateActivity()

  ctx.emitter?.emit('invalidate', { typename, id: activityId })

  return {
    id: updatedActivity.id,
    status: updatedActivity.status,
  }
}

async function publishPracticeQuiz({
  ctx,
  activityId,
  availableFrom,
}: {
  ctx: TRPCContext
  activityId: string
  availableFrom?: Date | null
}): Promise<PublishedActivityRecord | null> {
  const prisma = getPrisma(ctx)

  if (availableFrom && availableFrom > new Date()) {
    try {
      const scheduledTask = await getActivitySchedulerTasks(
        ctx
      )?.publishScheduledPracticeQuiz?.schedule(availableFrom, {
        practiceQuizId: activityId,
      })

      if (!scheduledTask) {
        throw new Error('Practice quiz publication scheduler unavailable')
      }

      const updatedQuiz = await prisma.practiceQuiz.update({
        where: { id: activityId, isDeleted: false },
        data: {
          availableFrom,
          status: PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: getScheduledTaskId(scheduledTask),
        },
        select: { id: true, status: true },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: activityId,
      })
      return updatedQuiz
    } catch (error) {
      console.error('Error scheduling practice quiz publication:', error)
      return null
    }
  }

  const updatedQuiz = await prisma.practiceQuiz.update({
    where: { id: activityId, isDeleted: false },
    data: { status: PublicationStatus.PUBLISHED },
    select: {
      id: true,
      status: true,
      courseId: true,
      stacks: { select: { id: true } },
    },
  })

  await prisma.course.update({
    where: { id: updatedQuiz.courseId },
    data: {
      elementStacks: {
        connect: updatedQuiz.stacks.map((stack) => ({ id: stack.id })),
      },
    },
  })

  ctx.emitter?.emit('invalidate', {
    typename: 'PracticeQuiz',
    id: activityId,
  })
  return {
    id: updatedQuiz.id,
    status: updatedQuiz.status,
  }
}

async function publishMicroLearning({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<PublishedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const tasks = getActivitySchedulerTasks(ctx)
  const microLearning = await prisma.microLearning.findUnique({
    where: {
      id: activityId,
      isDeleted: false,
      status: PublicationStatus.DRAFT,
    },
    select: {
      id: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  })

  if (!microLearning) return null

  if (microLearning.scheduledStartAt > new Date()) {
    try {
      const publicationTask =
        await tasks?.publishScheduledMicroLearning?.schedule(
          microLearning.scheduledStartAt,
          { microLearningId: microLearning.id }
        )
      const completionTask = await tasks?.endExpiredMicroLearning?.schedule(
        microLearning.scheduledEndAt,
        { microLearningId: microLearning.id }
      )

      if (!publicationTask || !completionTask) {
        throw new Error('Microlearning scheduler unavailable')
      }

      const updatedMicroLearning = await prisma.microLearning.update({
        where: { id: activityId },
        data: {
          status: PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: getScheduledTaskId(publicationTask),
          scheduledCompletionTaskId: getScheduledTaskId(completionTask),
        },
        select: { id: true, status: true },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'MicroLearning',
        id: activityId,
      })
      return updatedMicroLearning
    } catch (error) {
      console.error(
        `Failed to schedule task for microlearning ${activityId}:`,
        error
      )
      return null
    }
  }

  if (microLearning.scheduledEndAt < new Date()) {
    const updatedMicroLearning = await prisma.microLearning.update({
      where: { id: activityId },
      data: { status: PublicationStatus.ENDED },
      select: { id: true, status: true },
    })

    ctx.emitter?.emit('invalidate', {
      typename: 'MicroLearning',
      id: activityId,
    })
    return updatedMicroLearning
  }

  const completionTask = await tasks?.endExpiredMicroLearning?.schedule(
    microLearning.scheduledEndAt,
    { microLearningId: microLearning.id }
  )

  if (!completionTask) {
    throw new Error('Microlearning completion scheduler unavailable')
  }

  const updatedMicroLearning = await prisma.microLearning.update({
    where: { id: activityId },
    data: {
      status: PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: getScheduledTaskId(completionTask),
    },
    select: { id: true, status: true },
  })

  ctx.emitter?.emit('invalidate', {
    typename: 'MicroLearning',
    id: activityId,
  })
  return updatedMicroLearning
}

async function publishGroupActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<PublishedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const tasks = getActivitySchedulerTasks(ctx)
  const groupActivity = await prisma.groupActivity.findUnique({
    where: {
      id: activityId,
      isDeleted: false,
      status: PublicationStatus.DRAFT,
    },
    select: {
      id: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  })

  if (!groupActivity) return null

  if (groupActivity.scheduledStartAt > new Date()) {
    try {
      const publicationTask =
        await tasks?.publishScheduledGroupActivity?.schedule(
          groupActivity.scheduledStartAt,
          { groupActivityId: groupActivity.id }
        )
      const completionTask = await tasks?.endExpiredGroupActivity?.schedule(
        groupActivity.scheduledEndAt,
        { groupActivityId: groupActivity.id }
      )

      if (!publicationTask || !completionTask) {
        throw new Error('Group activity scheduler unavailable')
      }

      const updatedGroupActivity = await prisma.groupActivity.update({
        where: { id: activityId },
        data: {
          status: PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: getScheduledTaskId(publicationTask),
          scheduledCompletionTaskId: getScheduledTaskId(completionTask),
        },
        select: { id: true, status: true },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'GroupActivity',
        id: activityId,
      })
      return updatedGroupActivity
    } catch (error) {
      console.error(
        `Failed to schedule task for group activity ${activityId}:`,
        error
      )
      return null
    }
  }

  if (groupActivity.scheduledEndAt < new Date()) {
    const updatedGroupActivity = await prisma.groupActivity.update({
      where: { id: activityId },
      data: { status: PublicationStatus.ENDED },
      select: { id: true, status: true },
    })

    ctx.emitter?.emit('invalidate', {
      typename: 'GroupActivity',
      id: activityId,
    })
    return updatedGroupActivity
  }

  const completionTask = await tasks?.endExpiredGroupActivity?.schedule(
    groupActivity.scheduledEndAt,
    { groupActivityId: groupActivity.id }
  )

  if (!completionTask) {
    throw new Error('Group activity completion scheduler unavailable')
  }

  const updatedGroupActivity = await prisma.groupActivity.update({
    where: { id: activityId },
    data: {
      status: PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: getScheduledTaskId(completionTask),
    },
    select: { id: true, status: true },
  })

  ctx.emitter?.emit('invalidate', {
    typename: 'GroupActivity',
    id: activityId,
  })
  return updatedGroupActivity
}

async function publishActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
    availableFrom?: Date | null
  }
}) {
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute) return null

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    return await publishPracticeQuiz({
      ctx,
      activityId: input.activityId,
      availableFrom: input.availableFrom,
    })
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await publishMicroLearning({
      ctx,
      activityId: input.activityId,
    })
  }

  if (input.activityType === ActivityType.GROUP_ACTIVITY) {
    return await publishGroupActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  return null
}

async function scheduleLiveQuizActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    availableFrom?: Date | null
  }
}) {
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.LIVE_QUIZ,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute) return null

  if (input.availableFrom && input.availableFrom > new Date()) {
    try {
      const scheduledTask = await getActivitySchedulerTasks(
        ctx
      )?.publishScheduledLiveQuiz?.schedule(input.availableFrom, {
        liveQuizId: input.activityId,
      })

      if (!scheduledTask) {
        throw new Error('Live quiz publication scheduler unavailable')
      }

      const updatedQuiz = await getPrisma(ctx).liveQuiz.update({
        where: { id: input.activityId, isDeleted: false },
        data: {
          availableFrom: input.availableFrom,
          status: PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: getScheduledTaskId(scheduledTask),
        },
        select: {
          id: true,
          name: true,
          status: true,
          availableFrom: true,
        },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'LiveQuiz',
        id: input.activityId,
      })
      return toScheduledLiveQuizRecord(updatedQuiz)
    } catch (error) {
      console.error('Error scheduling live quiz publication:', error)
      return null
    }
  }

  const startedLiveQuiz = await startLiveQuiz(
    { id: input.activityId },
    ctx as unknown as LiveQuizExecutionContext
  )

  return toScheduledLiveQuizRecord(startedLiveQuiz)
}

async function openGroupActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<OpenedGroupActivityRecord | null> {
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.GROUP_ACTIVITY,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute) return null

  const prisma = getPrisma(ctx)
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id: input.activityId, status: PublicationStatus.SCHEDULED },
  })

  if (!groupActivity) return null

  if (groupActivity.scheduledPublicationTaskId) {
    await deleteScheduledHatchetTask({
      ctx,
      taskId: groupActivity.scheduledPublicationTaskId,
      failureMessage: `Failed to delete scheduled task for group activity ${input.activityId}:`,
    })
  }

  let scheduledCompletionTaskId: string | undefined
  if (!groupActivity.scheduledCompletionTaskId) {
    const completionTask = await getActivitySchedulerTasks(
      ctx
    )?.endExpiredGroupActivity?.schedule(groupActivity.scheduledEndAt, {
      groupActivityId: groupActivity.id,
    })

    if (!completionTask) {
      throw new Error('Group activity completion scheduler unavailable')
    }

    scheduledCompletionTaskId = getScheduledTaskId(completionTask)
  }

  const updatedGroupActivity = await prisma.groupActivity.update({
    where: { id: input.activityId, status: PublicationStatus.SCHEDULED },
    data: {
      status: PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(),
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId,
    },
  })

  const pubSub = ctx.pubSub as PubSubPublisher | undefined
  pubSub?.publish('groupActivityStarted', updatedGroupActivity)

  return {
    id: updatedGroupActivity.id,
    status: updatedGroupActivity.status,
    scheduledStartAt: updatedGroupActivity.scheduledStartAt,
  }
}

async function getMicroLearningSummary({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<MicroLearningSummaryRecord | null> {
  const canRead = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.MICRO_LEARNING,
    },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const microLearning = await getPrisma(ctx).microLearning.findUnique({
    where: { id: input.activityId },
    select: {
      stacks: {
        select: {
          elements: {
            select: {
              results: true,
              anonymousResults: true,
            },
          },
        },
      },
    },
  })

  if (!microLearning) return null

  const { responses, anonymousResponses } = microLearning.stacks.reduce(
    (acc, stack) => {
      const stackCounts = stack.elements.reduce(
        (elementAcc, instance) => {
          elementAcc.responses += getResultTotal(instance.results)
          elementAcc.anonymousResponses += getResultTotal(
            instance.anonymousResults
          )
          return elementAcc
        },
        { responses: 0, anonymousResponses: 0 }
      )

      acc.responses += stackCounts.responses
      acc.anonymousResponses += stackCounts.anonymousResponses
      return acc
    },
    { responses: 0, anonymousResponses: 0 }
  )

  return {
    numOfResponses: responses,
    numOfAnonymousResponses: anonymousResponses,
  }
}

async function getPracticeQuizSummary({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<PracticeQuizSummaryRecord | null> {
  const canRead = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.PRACTICE_QUIZ,
    },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const practiceQuiz = await getPrisma(ctx).practiceQuiz.findUnique({
    where: { id: input.activityId },
    select: {
      stacks: {
        select: {
          elements: {
            select: {
              results: true,
              anonymousResults: true,
            },
          },
        },
      },
    },
  })

  if (!practiceQuiz) return null

  const { responses, anonymousResponses } = practiceQuiz.stacks.reduce(
    (acc, stack) => {
      const stackCounts = stack.elements.reduce(
        (elementAcc, instance) => {
          elementAcc.responses += getResultTotal(instance.results)
          elementAcc.anonymousResponses += getResultTotal(
            instance.anonymousResults
          )
          return elementAcc
        },
        { responses: 0, anonymousResponses: 0 }
      )

      acc.responses += stackCounts.responses
      acc.anonymousResponses += stackCounts.anonymousResponses
      return acc
    },
    { responses: 0, anonymousResponses: 0 }
  )

  return {
    numOfResponses: responses,
    numOfAnonymousResponses: anonymousResponses,
  }
}

function toAuthoringElementData({
  elementData,
  includeSolutions = true,
}: {
  elementData: ElementInstance['elementData']
  includeSolutions?: boolean
}) {
  if (includeSolutions) return elementData as ElementData

  const cloned = JSON.parse(JSON.stringify(elementData)) as AuthoringJsonRecord
  const options = getAuthoringObjectProperty(cloned, 'options')

  if (isAuthoringRecord(options)) {
    const choices = getAuthoringObjectProperty(options, 'choices')
    if (Array.isArray(choices)) {
      options.choices = choices.map((choice) => {
        if (!isAuthoringRecord(choice)) return choice
        return {
          ix: choice.ix,
          value: choice.value,
        }
      })
    }

    delete options.answerCollectionId
    delete options.answerCollectionSolutionIds
    delete options.exactSolutions
    delete options.solutionRanges
    delete options.solutions

    const cases = getAuthoringObjectProperty(options, 'cases')
    if (Array.isArray(cases)) {
      for (const item of cases) {
        if (isAuthoringRecord(item)) {
          delete item.solutions
        }
      }
    }
  }

  return cloned as unknown as ElementData
}

function toAuthoringElementInstance(
  instance: AuthoringElementInstanceSource,
  includeSolutions = true
) {
  return {
    id: instance.id,
    type: instance.type,
    elementType: instance.elementType,
    elementData: toAuthoringElementData({
      elementData: instance.elementData,
      includeSolutions,
    }),
  }
}

function toAuthoringElementStack(stack: AuthoringElementStackSource) {
  return {
    id: stack.id,
    type: stack.type,
    displayName: stack.displayName,
    description: stack.description,
    order: stack.order,
    elements: stack.elements.map((element) =>
      toAuthoringElementInstance(element)
    ),
  }
}

function toAuthoringGroupActivityStack(stack: AuthoringElementStackSource) {
  return {
    id: stack.id,
    displayName: stack.displayName,
    description: stack.description,
    elements: stack.elements.map((element) =>
      toAuthoringElementInstance(element, false)
    ),
  }
}

function toAuthoringLiveQuiz(quiz: AuthoringLiveQuizSource) {
  return {
    id: quiz.id,
    name: quiz.name,
    displayName: quiz.displayName,
    description: quiz.description,
    blocks: quiz.blocks.map((block) => ({
      id: block.id,
      order: block.order,
      status: block.status,
      timeLimit: block.timeLimit,
      elements: block.elements.map((element) =>
        toAuthoringElementInstance(element)
      ),
    })),
    course: quiz.course ? { id: quiz.course.id } : null,
    pointsMultiplier: quiz.pointsMultiplier,
    defaultPoints: quiz.defaultPoints,
    defaultCorrectPoints: quiz.defaultCorrectPoints,
    maxBonusPoints: quiz.maxBonusPoints,
    timeToZeroBonus: quiz.timeToZeroBonus,
    isGamificationEnabled: quiz.isGamificationEnabled,
    isAssessmentEnabled: quiz.isAssessmentEnabled,
    pinCode: quiz.pinCode,
    isLiveQAEnabled: quiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: quiz.isConfusionFeedbackEnabled,
    isModerationEnabled: quiz.isModerationEnabled,
  }
}

function toAuthoringPracticeQuiz(quiz: AuthoringPracticeQuizSource) {
  return {
    id: quiz.id,
    status: quiz.status,
    name: quiz.name,
    displayName: quiz.displayName,
    description: quiz.description,
    pointsMultiplier: quiz.pointsMultiplier,
    resetTimeDays: quiz.resetTimeDays,
    availableFrom: quiz.availableFrom,
    orderType: quiz.orderType,
    numOfStacks: quiz.stacks.length,
    course: quiz.course
      ? {
          id: quiz.course.id,
          displayName: quiz.course.displayName,
          color: quiz.course.color,
        }
      : null,
    stacks: quiz.stacks.map(toAuthoringElementStack),
  }
}

function toAuthoringMicroLearning(activity: AuthoringMicroLearningSource) {
  return {
    id: activity.id,
    name: activity.name,
    status: activity.status,
    displayName: activity.displayName,
    description: activity.description,
    pointsMultiplier: activity.pointsMultiplier,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    course: activity.course
      ? {
          id: activity.course.id,
          displayName: activity.course.displayName,
          color: activity.course.color,
        }
      : null,
    stacks: activity.stacks.map(toAuthoringElementStack),
  }
}

function toAuthoringGroupActivity(activity: AuthoringGroupActivitySource) {
  return {
    id: activity.id,
    name: activity.name,
    displayName: activity.displayName,
    description: activity.description,
    pointsMultiplier: activity.pointsMultiplier,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    clues: activity.clues.map((clue) => ({
      id: clue.id,
      type: clue.type,
      name: clue.name,
      displayName: clue.displayName,
      value: clue.value,
      unit: clue.unit,
    })),
    stacks: activity.stacks.map(toAuthoringGroupActivityStack),
    course: activity.course
      ? {
          id: activity.course.id,
          displayName: activity.course.displayName,
        }
      : null,
  }
}

async function getAuthoringLiveQuiz({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: { activityId: string }
}) {
  const canRead = await hasActivityPermission(
    ctx,
    { activityId: input.activityId, activityType: ActivityType.LIVE_QUIZ },
    PermissionLevel.READ
  )

  if (!canRead || !input.activityId) return null

  const quiz = await getPrisma(ctx).liveQuiz.findUnique({
    where: { id: input.activityId },
    include: {
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
      course: true,
    },
  })

  return quiz ? toAuthoringLiveQuiz(quiz) : null
}

async function getAuthoringPracticeQuiz({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: { activityId: string }
}) {
  const canRead = await hasActivityPermission(
    ctx,
    { activityId: input.activityId, activityType: ActivityType.PRACTICE_QUIZ },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const quiz = await getPrisma(ctx).practiceQuiz.findUnique({
    where: { id: input.activityId, isDeleted: false },
    include: {
      course: true,
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return quiz ? toAuthoringPracticeQuiz(quiz) : null
}

async function getAuthoringMicroLearning({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: { activityId: string }
}) {
  const canRead = await hasActivityPermission(
    ctx,
    { activityId: input.activityId, activityType: ActivityType.MICRO_LEARNING },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const microLearning = await getPrisma(ctx).microLearning.findUnique({
    where: { id: input.activityId, isDeleted: false },
    include: {
      course: true,
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return microLearning ? toAuthoringMicroLearning(microLearning) : null
}

async function getAuthoringGroupActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: { activityId: string }
}) {
  const canRead = await hasActivityPermission(
    ctx,
    { activityId: input.activityId, activityType: ActivityType.GROUP_ACTIVITY },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const groupActivity = await getPrisma(ctx).groupActivity.findUnique({
    where: { id: input.activityId, isDeleted: false },
    include: {
      course: true,
      clues: true,
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return groupActivity ? toAuthoringGroupActivity(groupActivity) : null
}

async function getLiveQuizSummary({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<LiveQuizSummaryRecord | null> {
  const canRead = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.LIVE_QUIZ,
    },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const liveQuiz = await getPrisma(ctx).liveQuiz.findUnique({
    where: { id: input.activityId },
    include: {
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: true,
          temporaryLeaderboard: true,
        },
      },
      blocks: { include: { elements: true } },
      activeBlock: { include: { elements: true } },
    },
  })

  if (!liveQuiz) return null

  let storedResponses = liveQuiz.blocks.reduce((blockAcc, block) => {
    blockAcc += block.elements.reduce((instanceAcc, instance) => {
      instanceAcc +=
        getResultTotal(instance.results) +
        getResultTotal(instance.anonymousResults)
      return instanceAcc
    }, 0)
    return blockAcc
  }, 0)

  const redis = (
    liveQuiz.isAssessmentEnabled ? ctx.redisAssessmentExec : ctx.redisExec
  ) as Redis | undefined

  if (liveQuiz.activeBlock && redis) {
    const cachedResults = await getCachedBlockResults({
      redisExec: redis,
      activeBlock: liveQuiz.activeBlock,
    })

    if (cachedResults) {
      storedResponses += liveQuiz.activeBlock.elements.reduce(
        (acc, instance) => {
          acc +=
            cachedResults.instanceResults[instance.id]?.anonymousResults
              .total ?? 0
          return acc
        },
        0
      )
    }
  }

  return {
    numOfResponses: storedResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries:
      liveQuiz._count.leaderboard + liveQuiz._count.temporaryLeaderboard,
  }
}

async function getGroupActivitySummary({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<GroupActivitySummaryRecord | null> {
  const canRead = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.GROUP_ACTIVITY,
    },
    PermissionLevel.READ
  )

  if (!canRead) return null

  const groupActivity = await getPrisma(ctx).groupActivity.findUnique({
    where: { id: input.activityId },
    select: {
      activityInstances: {
        select: {
          decisionsSubmittedAt: true,
        },
      },
    },
  })

  if (!groupActivity) return null

  const numOfStartedInstances = groupActivity.activityInstances.filter(
    (instance) => instance.decisionsSubmittedAt === null
  ).length
  const numOfSubmissions =
    groupActivity.activityInstances.length - numOfStartedInstances

  return {
    numOfStartedInstances,
    numOfSubmissions,
  }
}

async function deleteLiveQuizActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  activityId: string
}): Promise<DeletedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id: activityId },
    include: {
      blocks: { include: { elements: true } },
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
    },
  })

  if (!liveQuiz || liveQuiz.status === PublicationStatus.PUBLISHED) {
    return null
  }

  if (liveQuiz.status === PublicationStatus.ENDED) {
    if (liveQuiz.isAssessmentEnabled) return null

    const deletedLiveQuiz = await prisma.$transaction(
      async (tx) => {
        const quiz = await tx.liveQuiz.update({
          where: { id: activityId, status: PublicationStatus.ENDED },
          data: {
            isDeleted: true,
            directPermissions: { deleteMany: {} },
          },
        })

        await recomputeDerivedPermissions({ liveQuizId: quiz.id }, tx)

        return quiz
      },
      { timeout: 60000 }
    )

    ctx.emitter?.emit('invalidate', {
      typename: 'LiveQuiz',
      id: activityId,
    })
    return { id: deletedLiveQuiz.id }
  }

  if (liveQuiz.isAssessmentEnabled) {
    const isCourseAdminOwner =
      !!liveQuiz.course?._count?.permissions &&
      liveQuiz.course._count.permissions > 0

    if (!isCourseAdminOwner) return null
  }

  const deletedLiveQuiz = await prisma.$transaction(
    async (tx) => {
      const quiz = await tx.liveQuiz.delete({
        where: {
          id: activityId,
          status: {
            in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
          },
        },
      })

      if (
        quiz.status === PublicationStatus.SCHEDULED &&
        quiz.scheduledPublicationTaskId
      ) {
        await deleteScheduledHatchetTask({
          ctx,
          taskId: quiz.scheduledPublicationTaskId,
          failureMessage: `Failed to delete scheduled task for live quiz ${activityId}:`,
        })
      }

      await propagateActivityToElements(
        { stacks: liveQuiz.blocks, updateAccessRequests: true },
        tx
      )

      return quiz
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'LiveQuiz',
    id: activityId,
  })
  return { id: deletedLiveQuiz.id }
}

async function resetAssessmentLiveQuizActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
  }
}): Promise<ResetLiveQuizRecord | null> {
  const canAdmin = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: ActivityType.LIVE_QUIZ,
    },
    PermissionLevel.ADMIN
  )

  if (!canAdmin) return null

  const prisma = getPrisma(ctx)
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: {
      id: input.activityId,
      isAssessmentEnabled: true,
      status: PublicationStatus.ENDED,
      course: {
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
            },
          },
        },
      },
    },
    include: {
      blocks: {
        include: {
          elements: {
            include: { liveQuizResponses: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!liveQuiz) return null

  try {
    await pushHatchetAuditLogEvent({
      ctx,
      info: `[INFO] [Reset Assessment Live Quiz] Assessment course admin with ID ${ctx.user.sub} initiated reset of live quiz with ID ${input.activityId}.`,
    })

    for (const block of liveQuiz.blocks) {
      for (const instance of block.elements) {
        await Promise.all(
          instance.liveQuizResponses.map((response) =>
            pushHatchetAuditLogEvent({
              ctx,
              info: `[INFO] [Reset Assessment Live Quiz] Deducted ${response.basePoints} base points, ${response.correctnessPoints} correctness points, and ${response.bonusPoints} bonus points from participant with ID ${response.participantId} for element instance with ID ${instance.id} in block with ID ${block.id} in live quiz with ID ${input.activityId}.`,
            })
          )
        )
      }
    }

    const updatedQuiz = await prisma.$transaction(
      async (tx) => {
        const quiz = await tx.liveQuiz.update({
          where: { id: input.activityId },
          data: {
            status: PublicationStatus.DRAFT,
            startedAt: null,
            finishedAt: null,
            feedbacks: { deleteMany: {} },
            confusionFeedbacks: { deleteMany: {} },
            leaderboard: { deleteMany: {} },
            temporaryLeaderboard: { deleteMany: {} },
          },
          select: { id: true, status: true },
        })

        for (const block of liveQuiz.blocks) {
          await tx.elementBlock.update({
            where: { id: block.id },
            data: {
              status: 'SCHEDULED',
              startedAt: null,
              closedAt: null,
              expiresAt: null,
              execution: { increment: 1 },
            },
          })

          for (const instance of block.elements) {
            const initialResults = getInitialInstanceResults(
              instance.elementData
            )

            await tx.elementInstance.update({
              where: { id: instance.id },
              data: {
                liveQuizResponses: { deleteMany: {} },
                results: initialResults,
                anonymousResults: initialResults,
              },
            })
          }
        }

        return quiz
      },
      { timeout: 60000 }
    )

    await pushHatchetAuditLogEvent({
      ctx,
      info: `[INFO] [Reset Assessment Live Quiz] Successfully reset assessment live quiz with ID ${input.activityId}.`,
    })

    ctx.emitter?.emit('invalidate', {
      typename: 'LiveQuiz',
      id: input.activityId,
    })

    const redis = (
      liveQuiz.isAssessmentEnabled ? ctx.redisAssessmentExec : ctx.redisExec
    ) as Redis | undefined

    if (!redis) {
      throw new Error('Redis client unavailable')
    }

    const keys = await redis.keys(`lq:${liveQuiz.id}:*`)
    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        pipe.unlink(key)
      }
      await pipe.exec()
    }

    return updatedQuiz
  } catch (error) {
    await pushHatchetAuditLogEventSafely({
      ctx,
      info: `[ERROR] [Reset Assessment Live Quiz] Failed to reset live quiz with ID ${input.activityId}: ${error}`,
    })

    return null
  }
}

async function deletePracticeQuizActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<DeletedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
    where: { id: activityId },
    include: { responses: true, stacks: { include: { elements: true } } },
  })

  if (!practiceQuiz) return null

  if (
    practiceQuiz.status === PublicationStatus.DRAFT ||
    practiceQuiz.status === PublicationStatus.SCHEDULED ||
    practiceQuiz.responses.length === 0
  ) {
    const deletedItem = await prisma.practiceQuiz.delete({
      where: { id: activityId },
    })

    if (
      deletedItem.scheduledPublicationTaskId &&
      deletedItem.status === PublicationStatus.SCHEDULED
    ) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: deletedItem.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled task for practice quiz ${activityId}:`,
      })
    }

    await propagateActivityToElements(
      { stacks: practiceQuiz.stacks, updateAccessRequests: true },
      prisma
    )

    ctx.emitter?.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: activityId,
    })
    return { id: deletedItem.id }
  }

  const updatedPracticeQuiz = await prisma.$transaction(
    async (tx) => {
      const quiz = await tx.practiceQuiz.update({
        where: { id: activityId },
        data: {
          isDeleted: true,
          directPermissions: { deleteMany: {} },
        },
        include: { stacks: true },
      })

      await tx.elementStack.updateMany({
        where: { id: { in: quiz.stacks.map((stack) => stack.id) } },
        data: { courseId: null },
      })

      await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, tx)

      return quiz
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'PracticeQuiz',
    id: activityId,
  })
  return { id: updatedPracticeQuiz.id }
}

async function deleteMicroLearningActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<DeletedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const microLearning = await prisma.microLearning.findUnique({
    where: { id: activityId },
    include: { responses: true, stacks: { include: { elements: true } } },
  })

  if (!microLearning) return null

  if (
    microLearning.status === PublicationStatus.DRAFT ||
    microLearning.status === PublicationStatus.SCHEDULED ||
    microLearning.responses.length === 0
  ) {
    const deletedItem = await prisma.microLearning.delete({
      where: { id: activityId },
    })

    if (
      deletedItem.scheduledPublicationTaskId &&
      deletedItem.status === PublicationStatus.SCHEDULED
    ) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: deletedItem.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication task for microlearning ${activityId}:`,
      })
    }

    if (
      deletedItem.scheduledCompletionTaskId &&
      (deletedItem.status === PublicationStatus.SCHEDULED ||
        deletedItem.status === PublicationStatus.PUBLISHED)
    ) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: deletedItem.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion task for microlearning ${activityId}:`,
      })
    }

    await propagateActivityToElements(
      { stacks: microLearning.stacks, updateAccessRequests: true },
      prisma
    )

    ctx.emitter?.emit('invalidate', {
      typename: 'MicroLearning',
      id: activityId,
    })
    return { id: deletedItem.id }
  }

  const updatedMicroLearning = await prisma.$transaction(
    async (tx) => {
      if (
        microLearning.status === PublicationStatus.PUBLISHED &&
        microLearning.scheduledCompletionTaskId
      ) {
        await deleteScheduledHatchetTask({
          ctx,
          taskId: microLearning.scheduledCompletionTaskId,
          failureMessage: `Failed to delete scheduled completion task for microlearning ${activityId}:`,
        })
      }

      const updatedActivity = await tx.microLearning.update({
        where: { id: activityId },
        data: {
          isDeleted: true,
          scheduledCompletionTaskId: null,
          directPermissions: { deleteMany: {} },
        },
      })

      await recomputeDerivedPermissions(
        { microLearningId: updatedActivity.id },
        tx
      )

      return updatedActivity
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'MicroLearning',
    id: activityId,
  })
  return { id: updatedMicroLearning.id }
}

async function deleteGroupActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<DeletedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      activityInstances: true,
      stacks: { include: { elements: true } },
    },
  })

  if (!groupActivity) return null

  if (
    groupActivity.status === PublicationStatus.DRAFT ||
    groupActivity.status === PublicationStatus.SCHEDULED ||
    groupActivity.activityInstances.length === 0
  ) {
    const deletedItem = await prisma.groupActivity.delete({
      where: { id: activityId },
    })

    if (
      deletedItem.scheduledPublicationTaskId &&
      deletedItem.status === PublicationStatus.SCHEDULED
    ) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: deletedItem.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication task for group activity ${activityId}:`,
      })
    }

    if (
      deletedItem.scheduledCompletionTaskId &&
      (deletedItem.status === PublicationStatus.SCHEDULED ||
        deletedItem.status === PublicationStatus.PUBLISHED)
    ) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: deletedItem.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion task for group activity ${activityId}:`,
      })
    }

    await propagateActivityToElements(
      { stacks: groupActivity.stacks, updateAccessRequests: true },
      prisma
    )

    ctx.emitter?.emit('invalidate', {
      typename: 'GroupActivity',
      id: activityId,
    })
    return { id: deletedItem.id }
  }

  const updatedGroupActivity = await prisma.$transaction(
    async (tx) => {
      if (
        groupActivity.status === PublicationStatus.PUBLISHED &&
        groupActivity.scheduledCompletionTaskId
      ) {
        await deleteScheduledHatchetTask({
          ctx,
          taskId: groupActivity.scheduledCompletionTaskId,
          failureMessage: `Failed to delete scheduled completion task for group activity ${activityId}:`,
        })
      }

      const updatedActivity = await tx.groupActivity.update({
        where: { id: activityId },
        data: {
          isDeleted: true,
          directPermissions: { deleteMany: {} },
          scheduledCompletionTaskId:
            groupActivity.status === PublicationStatus.PUBLISHED
              ? null
              : undefined,
        },
      })

      await recomputeDerivedPermissions(
        { groupActivityId: updatedActivity.id },
        tx
      )

      return updatedActivity
    },
    { timeout: 60000 }
  )

  ctx.emitter?.emit('invalidate', {
    typename: 'GroupActivity',
    id: activityId,
  })
  return { id: updatedGroupActivity.id }
}

async function deleteActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
  }
}): Promise<DeletedActivityRecord | null> {
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
    return await deleteLiveQuizActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    return await deletePracticeQuizActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await deleteMicroLearningActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  if (input.activityType === ActivityType.GROUP_ACTIVITY) {
    return await deleteGroupActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  return null
}

async function endMicroLearningActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<EndedActivityRecord | null> {
  const updatedMicroLearning = await getPrisma(ctx).microLearning.update({
    where: {
      id: activityId,
      status: PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    data: { status: PublicationStatus.ENDED, scheduledEndAt: new Date() },
  })

  if (updatedMicroLearning.scheduledCompletionTaskId) {
    await deleteScheduledHatchetTask({
      ctx,
      taskId: updatedMicroLearning.scheduledCompletionTaskId,
      failureMessage: `Failed to delete scheduled completion task for microlearning ${activityId}:`,
    })
  }

  publishMicroLearningEnded(ctx.pubSub, updatedMicroLearning)

  return {
    id: updatedMicroLearning.id,
    status: updatedMicroLearning.status,
    scheduledEndAt: updatedMicroLearning.scheduledEndAt,
  }
}

async function endGroupActivity({
  ctx,
  activityId,
}: {
  ctx: TRPCContext
  activityId: string
}): Promise<EndedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id: activityId, status: PublicationStatus.PUBLISHED },
  })

  if (!groupActivity) return null

  if (groupActivity.scheduledCompletionTaskId) {
    await deleteScheduledHatchetTask({
      ctx,
      taskId: groupActivity.scheduledCompletionTaskId,
      failureMessage: `Failed to delete scheduled completion task for group activity ${activityId}:`,
    })
  }

  const updatedGroupActivity = await prisma.groupActivity.update({
    where: { id: activityId },
    data: {
      status: PublicationStatus.ENDED,
      scheduledEndAt: new Date(),
      scheduledCompletionTaskId: null,
    },
  })

  const pubSub = ctx.pubSub as PubSubPublisher | undefined
  pubSub?.publish('groupActivityEnded', updatedGroupActivity)
  pubSub?.publish('singleGroupActivityEnded', updatedGroupActivity)

  return {
    id: updatedGroupActivity.id,
    status: updatedGroupActivity.status,
    scheduledEndAt: updatedGroupActivity.scheduledEndAt,
  }
}

async function endActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
  }
}): Promise<EndedActivityRecord | null> {
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute) return null

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await endMicroLearningActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  if (input.activityType === ActivityType.GROUP_ACTIVITY) {
    return await endGroupActivity({
      ctx,
      activityId: input.activityId,
    })
  }

  return null
}

async function extendMicroLearningActivity({
  ctx,
  activityId,
  endDate,
}: {
  ctx: TRPCContext
  activityId: string
  endDate: Date
}): Promise<ExtendedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const microLearning = await prisma.microLearning.update({
    where: {
      id: activityId,
      scheduledEndAt: { gt: new Date() },
      isDeleted: false,
    },
    data: { scheduledEndAt: endDate },
    select: { id: true, scheduledCompletionTaskId: true },
  })

  if (microLearning.scheduledCompletionTaskId) {
    await deleteScheduledHatchetTask({
      ctx,
      taskId: microLearning.scheduledCompletionTaskId,
      failureMessage: `Failed to delete scheduled completion task for microlearning ${activityId}:`,
    })
  }

  const completionTask = await getActivitySchedulerTasks(
    ctx
  )?.endExpiredMicroLearning?.schedule(endDate, {
    microLearningId: microLearning.id,
  })

  if (!completionTask) {
    throw new Error('Microlearning completion scheduler unavailable')
  }

  const updatedMicroLearning = await prisma.microLearning.update({
    where: { id: activityId },
    data: { scheduledCompletionTaskId: getScheduledTaskId(completionTask) },
    select: { id: true, scheduledEndAt: true },
  })

  ctx.emitter?.emit('invalidate', {
    typename: 'MicroLearning',
    id: activityId,
  })
  return updatedMicroLearning
}

async function extendGroupActivity({
  ctx,
  activityId,
  endDate,
}: {
  ctx: TRPCContext
  activityId: string
  endDate: Date
}): Promise<ExtendedActivityRecord | null> {
  const prisma = getPrisma(ctx)
  const groupActivity = await prisma.groupActivity.update({
    where: {
      id: activityId,
      status: {
        in: [PublicationStatus.SCHEDULED, PublicationStatus.PUBLISHED],
      },
      scheduledEndAt: { gt: new Date() },
    },
    data: { scheduledEndAt: endDate },
    select: { id: true, scheduledCompletionTaskId: true },
  })

  if (groupActivity.scheduledCompletionTaskId) {
    await deleteScheduledHatchetTask({
      ctx,
      taskId: groupActivity.scheduledCompletionTaskId,
      failureMessage: `Failed to delete scheduled completion task for group activity ${activityId}:`,
    })
  }

  const completionTask = await getActivitySchedulerTasks(
    ctx
  )?.endExpiredGroupActivity?.schedule(endDate, {
    groupActivityId: groupActivity.id,
  })

  if (!completionTask) {
    throw new Error('Group activity completion scheduler unavailable')
  }

  const updatedGroupActivity = await prisma.groupActivity.update({
    where: { id: activityId },
    data: { scheduledCompletionTaskId: getScheduledTaskId(completionTask) },
    select: { id: true, scheduledEndAt: true },
  })

  ctx.emitter?.emit('invalidate', {
    typename: 'GroupActivity',
    id: activityId,
  })
  return updatedGroupActivity
}

async function extendActivity({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
    endDate: Date
  }
}) {
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute || input.endDate < new Date()) return null

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await extendMicroLearningActivity({
      ctx,
      activityId: input.activityId,
      endDate: input.endDate,
    })
  }

  if (input.activityType === ActivityType.GROUP_ACTIVITY) {
    return await extendGroupActivity({
      ctx,
      activityId: input.activityId,
      endDate: input.endDate,
    })
  }

  return null
}

async function unpublishActivity({
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
  const canExecute = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.EXECUTE
  )

  if (!canExecute) return null

  if (input.activityType === ActivityType.LIVE_QUIZ) {
    return await unpublishScheduledActivity({
      ctx,
      activityId: input.activityId,
      typename: 'LiveQuiz',
      findActivity: () =>
        prisma.liveQuiz.findUnique({
          where: {
            id: input.activityId,
            status: PublicationStatus.SCHEDULED,
          },
          select: { scheduledPublicationTaskId: true },
        }),
      getScheduledTasks: (activity) => [
        {
          taskId: activity.scheduledPublicationTaskId,
          failureMessage: `Failed to delete scheduled task for live quiz ${input.activityId}:`,
        },
      ],
      updateActivity: () =>
        prisma.liveQuiz.update({
          where: {
            id: input.activityId,
            status: PublicationStatus.SCHEDULED,
          },
          data: {
            availableFrom: null,
            status: PublicationStatus.DRAFT,
            scheduledPublicationTaskId: null,
          },
          select: { id: true, status: true },
        }),
    })
  }

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    return await unpublishScheduledActivity({
      ctx,
      activityId: input.activityId,
      typename: 'PracticeQuiz',
      findActivity: () =>
        prisma.practiceQuiz.findUnique({
          where: {
            id: input.activityId,
            status: PublicationStatus.SCHEDULED,
          },
          select: { scheduledPublicationTaskId: true },
        }),
      getScheduledTasks: (activity) => [
        {
          taskId: activity.scheduledPublicationTaskId,
          failureMessage: `Failed to delete scheduled task for practice quiz ${input.activityId}:`,
        },
      ],
      updateActivity: () =>
        prisma.practiceQuiz.update({
          where: {
            id: input.activityId,
            status: PublicationStatus.SCHEDULED,
          },
          data: {
            availableFrom: null,
            status: PublicationStatus.DRAFT,
            scheduledPublicationTaskId: null,
          },
          select: { id: true, status: true },
        }),
    })
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await unpublishScheduledActivity({
      ctx,
      activityId: input.activityId,
      typename: 'MicroLearning',
      findActivity: () =>
        prisma.microLearning.findUnique({
          where: {
            id: input.activityId,
            isDeleted: false,
            status: PublicationStatus.SCHEDULED,
          },
          select: {
            scheduledPublicationTaskId: true,
            scheduledCompletionTaskId: true,
          },
        }),
      getScheduledTasks: (activity) => [
        {
          taskId: activity.scheduledPublicationTaskId,
          failureMessage: `Failed to delete scheduled publication task for microlearning ${input.activityId}:`,
        },
        {
          taskId: activity.scheduledCompletionTaskId,
          failureMessage: `Failed to delete scheduled completion task for microlearning ${input.activityId}:`,
        },
      ],
      updateActivity: () =>
        prisma.microLearning.update({
          where: {
            id: input.activityId,
            status: PublicationStatus.SCHEDULED,
          },
          data: {
            status: PublicationStatus.DRAFT,
            scheduledPublicationTaskId: null,
            scheduledCompletionTaskId: null,
          },
          select: { id: true, status: true },
        }),
    })
  }

  return await unpublishScheduledActivity({
    ctx,
    activityId: input.activityId,
    typename: 'GroupActivity',
    findActivity: () =>
      prisma.groupActivity.findUnique({
        where: {
          id: input.activityId,
          status: PublicationStatus.SCHEDULED,
        },
        select: {
          scheduledPublicationTaskId: true,
          scheduledCompletionTaskId: true,
        },
      }),
    getScheduledTasks: (activity) => [
      {
        taskId: activity.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication task for group activity ${input.activityId}:`,
      },
      {
        taskId: activity.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion task for group activity ${input.activityId}:`,
      },
    ],
    updateActivity: () =>
      prisma.groupActivity.update({
        where: {
          id: input.activityId,
          status: PublicationStatus.SCHEDULED,
        },
        data: {
          status: PublicationStatus.DRAFT,
          scheduledPublicationTaskId: null,
          scheduledCompletionTaskId: null,
        },
        select: { id: true, status: true },
      }),
  })
}

async function changeActivityName({
  ctx,
  input,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  input: {
    activityId: string
    activityType: ActivityType
    name: string
    displayName: string
  }
}) {
  const prisma = getPrisma(ctx)
  const canWrite = await hasActivityPermission(
    ctx,
    {
      activityId: input.activityId,
      activityType: input.activityType,
    },
    PermissionLevel.WRITE
  )

  if (!canWrite) return null

  if (input.activityType === ActivityType.LIVE_QUIZ) {
    return await changeActivityNameForType({
      input,
      findActivity: () =>
        prisma.liveQuiz.findUnique({
          where: { id: input.activityId },
          select: { name: true, displayName: true, reviewStatus: true },
        }),
      updateActivity: (data) =>
        prisma.liveQuiz.update({
          where: { id: input.activityId },
          data,
        }),
      emitInvalidation: () =>
        ctx.emitter?.emit('invalidate', {
          typename: 'LiveQuiz',
          id: input.activityId,
        }),
      errorMessage: 'Error changing live quiz name:',
    })
  }

  if (input.activityType === ActivityType.PRACTICE_QUIZ) {
    return await changeActivityNameForType({
      input,
      findActivity: () =>
        prisma.practiceQuiz.findUnique({
          where: { id: input.activityId },
          select: { name: true, displayName: true, reviewStatus: true },
        }),
      updateActivity: (data) =>
        prisma.practiceQuiz.update({
          where: { id: input.activityId },
          data,
        }),
      emitInvalidation: () =>
        ctx.emitter?.emit('invalidate', {
          typename: 'PracticeQuiz',
          id: input.activityId,
        }),
      errorMessage: 'Error changing practice quiz name:',
    })
  }

  if (input.activityType === ActivityType.MICRO_LEARNING) {
    return await changeActivityNameForType({
      input,
      findActivity: () =>
        prisma.microLearning.findUnique({
          where: { id: input.activityId },
          select: { name: true, displayName: true, reviewStatus: true },
        }),
      updateActivity: (data) =>
        prisma.microLearning.update({
          where: { id: input.activityId },
          data,
        }),
      emitInvalidation: () =>
        ctx.emitter?.emit('invalidate', {
          typename: 'MicroLearning',
          id: input.activityId,
        }),
      errorMessage: 'Error changing microlearning name:',
    })
  }

  return await changeActivityNameForType({
    input,
    findActivity: () =>
      prisma.groupActivity.findUnique({
        where: { id: input.activityId },
        select: { name: true, displayName: true, reviewStatus: true },
      }),
    updateActivity: (data) =>
      prisma.groupActivity.update({
        where: { id: input.activityId },
        data,
      }),
    emitInvalidation: () =>
      ctx.emitter?.emit('invalidate', {
        typename: 'GroupActivity',
        id: input.activityId,
      }),
    errorMessage: 'Error changing group activity name:',
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

  assessmentResultsCourse: userProcedure
    .input(assessmentResultsCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canAdmin = await hasCoursePermission(
        ctx,
        input.courseId,
        PermissionLevel.ADMIN
      )

      if (!canAdmin) return { assessmentResultsCourse: null }

      return {
        assessmentResultsCourse: await getAssessmentResultsCourse({
          prisma,
          courseId: input.courseId,
        }),
      }
    }),

  assessmentResultsLiveQuiz: userProcedure
    .input(assessmentResultsLiveQuizInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        assessmentResultsLiveQuiz: await getAssessmentResultsLiveQuiz({
          prisma,
          liveQuizId: input.liveQuizId,
          userId: ctx.user.sub,
        }),
      }
    }),

  studentCourseResults: userProcedure
    .input(studentCourseResultsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        studentCourseResults: await getManageStudentCourseResults({
          prisma,
          user: ctx.user,
          courseId: input.courseId,
          participantId: input.participantId,
        }),
      }
    }),

  liveQuizStudentAssessmentResponses: userProcedure
    .input(liveQuizStudentAssessmentResponsesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        liveQuizStudentAssessmentResponses:
          toLiveQuizStudentAssessmentResponsesDto(
            await getLiveQuizStudentAssessmentResponses({
              prisma,
              liveQuizId: input.liveQuizId,
              participantId: input.participantId,
              userId: ctx.user.sub,
            })
          ),
      }
    }),

  endedLiveQuizzesCourse: userProcedure
    .input(endedLiveQuizzesCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canRead = await hasCoursePermission(
        ctx,
        input.courseId,
        PermissionLevel.READ
      )

      if (!canRead) return { endedLiveQuizzesCourse: [] }

      return {
        endedLiveQuizzesCourse: await getEndedLiveQuizzesCourse({
          prisma,
          courseId: input.courseId,
        }),
      }
    }),

  assessmentCourseParticipants: userProcedure
    .input(assessmentCourseParticipantsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canAdmin = await hasCoursePermission(
        ctx,
        input.courseId,
        PermissionLevel.ADMIN
      )

      if (!canAdmin) return { assessmentCourseParticipants: [] }

      return {
        assessmentCourseParticipants: await getAssessmentCourseParticipants({
          prisma,
          courseId: input.courseId,
        }),
      }
    }),

  previousPointCorrections: userProcedure
    .input(previousPointCorrectionsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        previousPointCorrections: toPreviousPointCorrectionsDto(
          await getPreviousPointCorrections({
            prisma,
            courseId: input.courseId,
            liveQuizId: input.liveQuizId,
            instanceId: input.instanceId,
            userId: ctx.user.sub,
          })
        ),
      }
    }),

  correctAssessmentPointsInstance: userFullAccessProcedure
    .input(correctAssessmentPointsInstanceInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const { instanceId, ...correctionInput } = input
      const correction = await correctAssessmentPointsInstance({
        ctx: { ...ctx, prisma },
        input: correctionInput,
        instanceId,
      })

      return {
        correctAssessmentPointsInstance: correction
          ? { id: correction.id }
          : null,
      }
    }),

  correctAssessmentPointsLiveQuiz: userFullAccessProcedure
    .input(correctAssessmentPointsLiveQuizInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const { liveQuizId, ...correctionInput } = input
      const correction = await correctAssessmentPointsLiveQuiz({
        ctx: { ...ctx, prisma },
        input: correctionInput,
        liveQuizId,
      })

      return {
        correctAssessmentPointsLiveQuiz: correction
          ? { id: correction.id }
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

  changeName: userFullAccessProcedure
    .input(changeActivityNameInput)
    .mutation(async ({ ctx, input }) => ({
      changeActivityName: await changeActivityName({ ctx, input }),
    })),

  authoringLiveQuiz: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      liveQuiz: await getAuthoringLiveQuiz({ ctx, input }),
    })),

  authoringPracticeQuiz: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      practiceQuiz: await getAuthoringPracticeQuiz({ ctx, input }),
    })),

  authoringMicroLearning: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      microLearning: await getAuthoringMicroLearning({ ctx, input }),
    })),

  authoringGroupActivity: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      groupActivity: await getAuthoringGroupActivity({ ctx, input }),
    })),

  createLiveQuiz: userFullAccessProcedure
    .input(liveQuizManipulationInput)
    .mutation(async ({ ctx, input }) => ({
      createLiveQuiz: await manipulateLiveQuiz({ ctx, input }),
    })),

  editLiveQuiz: userFullAccessProcedure
    .input(editLiveQuizInput)
    .mutation(async ({ ctx, input }) => {
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.LIVE_QUIZ,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { editLiveQuiz: null }

      return {
        editLiveQuiz: await manipulateLiveQuiz({ ctx, input }),
      }
    }),

  createPracticeQuiz: userFullAccessProcedure
    .input(practiceQuizManipulationInput)
    .mutation(async ({ ctx, input }) => ({
      createPracticeQuiz: await manipulatePracticeQuiz({ ctx, input }),
    })),

  editPracticeQuiz: userFullAccessProcedure
    .input(editPracticeQuizInput)
    .mutation(async ({ ctx, input }) => {
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.PRACTICE_QUIZ,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { editPracticeQuiz: null }

      return {
        editPracticeQuiz: await manipulatePracticeQuiz({ ctx, input }),
      }
    }),

  createMicroLearning: userFullAccessProcedure
    .input(microLearningManipulationInput)
    .mutation(async ({ ctx, input }) => ({
      createMicroLearning: await manipulateMicroLearning({ ctx, input }),
    })),

  editMicroLearning: userFullAccessProcedure
    .input(editMicroLearningInput)
    .mutation(async ({ ctx, input }) => {
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.MICRO_LEARNING,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { editMicroLearning: null }

      return {
        editMicroLearning: await manipulateMicroLearning({ ctx, input }),
      }
    }),

  createGroupActivity: userFullAccessProcedure
    .input(groupActivityManipulationInput)
    .mutation(async ({ ctx, input }) => ({
      createGroupActivity: await manipulateGroupActivity({ ctx, input }),
    })),

  editGroupActivity: userFullAccessProcedure
    .input(editGroupActivityInput)
    .mutation(async ({ ctx, input }) => {
      const canWrite = await hasActivityPermission(
        ctx,
        {
          activityId: input.id,
          activityType: ActivityType.GROUP_ACTIVITY,
        },
        PermissionLevel.WRITE
      )

      if (!canWrite) return { editGroupActivity: null }

      return {
        editGroupActivity: await manipulateGroupActivity({ ctx, input }),
      }
    }),

  liveQuizSummary: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      liveQuizSummary: await getLiveQuizSummary({ ctx, input }),
    })),

  practiceQuizSummary: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      practiceQuizSummary: await getPracticeQuizSummary({ ctx, input }),
    })),

  microLearningSummary: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      microLearningSummary: await getMicroLearningSummary({ ctx, input }),
    })),

  groupActivitySummary: userProcedure
    .input(activityIdInput)
    .query(async ({ ctx, input }) => ({
      groupActivitySummary: await getGroupActivitySummary({ ctx, input }),
    })),

  publish: userFullAccessProcedure
    .input(publishActivityInput)
    .mutation(async ({ ctx, input }) => ({
      publishActivity: await publishActivity({ ctx, input }),
    })),

  scheduleLiveQuiz: userSessionExecProcedure
    .input(scheduleLiveQuizInput)
    .mutation(async ({ ctx, input }) => ({
      scheduleLiveQuiz: await scheduleLiveQuizActivity({ ctx, input }),
    })),

  openGroupActivity: userFullAccessProcedure
    .input(openGroupActivityInput)
    .mutation(async ({ ctx, input }) => ({
      openGroupActivity: await openGroupActivity({ ctx, input }),
    })),

  end: userFullAccessProcedure
    .input(activityDetailsInput)
    .mutation(async ({ ctx, input }) => ({
      endActivity: await endActivity({ ctx, input }),
    })),

  delete: userFullAccessProcedure
    .input(activityDetailsInput)
    .mutation(async ({ ctx, input }) => ({
      deleteActivity: await deleteActivity({ ctx, input }),
    })),

  resetAssessmentLiveQuiz: userFullAccessProcedure
    .input(activityIdInput)
    .mutation(async ({ ctx, input }) => ({
      resetAssessmentLiveQuiz: await resetAssessmentLiveQuizActivity({
        ctx,
        input,
      }),
    })),

  extend: userFullAccessProcedure
    .input(extendActivityInput)
    .mutation(async ({ ctx, input }) => ({
      extendActivity: await extendActivity({ ctx, input }),
    })),

  unpublish: userFullAccessProcedure
    .input(activityDetailsInput)
    .mutation(async ({ ctx, input }) => ({
      unpublishActivity: await unpublishActivity({ ctx, input }),
    })),

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
