import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  type CaseStudyCaseSolution,
  type ElementBlockInput,
  type ElementResultsCaseStudy,
  type ElementResultsChoices,
  type ElementResultsContent,
  type ElementResultsFlashcard,
  type ElementResultsOpen,
  type ElementResultsSelection,
  type ElementStackInput,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getInitialInstanceResults,
  levelFromXp,
  propagateActivityToElements,
  recomputeDerivedPermissions,
  signJWT,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import generatePassword from 'generate-password'
import { GraphQLError } from 'graphql'
import { min } from 'mathjs'
import schedule from 'node-schedule'
import { createHmac } from 'node:crypto'
import { omitBy, pick, prop, sortBy } from 'remeda'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'
import { getPermissionBooleans } from './activities.js'
import { upsertDailyTimelineEntry } from './participants.js'
import { computeStackEvaluation } from './stacks.js'

// TODO: rework scheduling for serverless
const scheduledJobs: Record<string, any> = {}

const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

// ------ HELPER FUNCTIONS ------
// #region
async function getCachedBlockResults({
  ctx,
  activeBlock,
}: {
  ctx: Context
  activeBlock: DB.ElementBlock & { elements: DB.ElementInstance[] }
}) {
  const redisMultiLb = ctx.redisExec.multi()

  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:lb`)
  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:b:${activeBlock.id}:lb`)
  redisMultiLb.hgetall(`lq:${activeBlock.liveQuizId}:lbTemporary`)
  redisMultiLb.hgetall(
    `lq:${activeBlock.liveQuizId}:b:${activeBlock.id}:lbTemporary`
  )

  const cacheData = await redisMultiLb.exec()

  if (!cacheData) {
    return null
  }

  const mappedResults: any[] = cacheData.map(([_, result]) => result)

  const liveQuizLeaderboard: Record<string, string> = mappedResults[0]
  const blockLeaderboard: Record<string, string> = mappedResults[1]
  const liveQuizLeaderboardTemporary: Record<string, string> = mappedResults[2]
  const blockLeaderboardTemporary: Record<string, string> = mappedResults[3]

  const instanceResults: Record<
    string,
    {
      info: Record<string, string>
      responseHashes: Record<string, string>
      anonymousResults:
        | ElementResultsChoices
        | ElementResultsOpen
        | ElementResultsFlashcard
        | ElementResultsContent
        | ElementResultsSelection
    }
  > = {}

  for (const instance of activeBlock.elements) {
    const redisMulti = ctx.redisExec.multi()

    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:info`)
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responseHashes`
    )
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responses`
    )
    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:results`)

    const cacheData = await redisMulti.exec()

    if (!cacheData) return

    const mappedResults: any[] = cacheData.map(([_, result]) => result)

    const [info, responseHashes, _, results] = mappedResults

    // TODO: if possible, split up results and anonymous results here (potentially the cache content needs to augmented)
    let anonymousResults:
      | ElementResultsChoices
      | ElementResultsOpen
      | ElementResultsFlashcard
      | ElementResultsContent
      | ElementResultsSelection
      | undefined

    if (
      instance.elementType === DB.ElementType.SC ||
      instance.elementType === DB.ElementType.MC ||
      instance.elementType === DB.ElementType.KPRIM
    ) {
      const choices = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsChoices['choices']>(
        (acc, [responseHash, count]) => {
          return {
            ...acc,
            [responseHash]: (acc[responseHash] ?? 0) + parseInt(count),
          }
        },
        {}
      )

      anonymousResults = {
        choices,
        total: parseInt(results.participants),
      } as ElementResultsChoices
    } else if (
      instance.elementType === DB.ElementType.NUMERICAL ||
      instance.elementType === DB.ElementType.FREE_TEXT
    ) {
      const responses = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsOpen['responses']>(
        (responses_acc, [responseHash, count]) => {
          let solutions = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const response = responseHashes[responseHash] ?? responseHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            if (instance.elementType === DB.ElementType.NUMERICAL) {
              const exactSolutionsDefined =
                typeof solutions[0] === 'number' ||
                typeof solutions[0] === 'string'
              grading =
                gradeQuestionNumerical({
                  response,
                  solutionRanges: exactSolutionsDefined ? undefined : solutions,
                  exactSolutions: exactSolutionsDefined ? solutions : undefined,
                }) ?? undefined
            } else if (instance.elementType === DB.ElementType.FREE_TEXT) {
              grading =
                gradeQuestionFreeText({
                  response,
                  solutions,
                }) ?? undefined
            }
          }

          const updatedResponse = {
            value: responseHashes[responseHash] ?? responseHash,
            count: (responses_acc[responseHash]?.count ?? 0) + parseInt(count),
          }

          return {
            ...responses_acc,
            [responseHash]:
              typeof grading !== 'undefined'
                ? {
                    ...updatedResponse,
                    correct: grading === 1 ? true : false,
                  }
                : updatedResponse,
          }
        },
        {}
      )

      anonymousResults = {
        responses,
        total: parseInt(results.participants),
      } as ElementResultsOpen
    } else if (instance.elementType === DB.ElementType.SELECTION) {
      const selections = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<Record<string, number>>(
        (acc, [answerId, count]) => {
          acc[answerId] = (acc[answerId] ?? 0) + parseInt(count)
          return acc
        },
        { ...(instance.anonymousResults as ElementResultsSelection).selections }
      )

      anonymousResults = {
        selections,
        total: parseInt(results.participants),
      } as ElementResultsSelection
    } else if (instance.elementType === DB.ElementType.CASE_STUDY) {
      const assessments = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsCaseStudy['assessments']>(
        (assessmentsAcc, [combinedHash, answerCount]) => {
          let solutions: {
            caseId: string
            itemSolutions: CaseStudyCaseSolution[]
          }[] = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const responseValue: number | undefined =
            responseHashes[combinedHash] ?? undefined

          if (responseValue === null || typeof responseValue === 'undefined') {
            console.log('An error occured while parsing the response value:')
            console.error('responseValue: ', responseValue)
            return assessmentsAcc
          }

          // split up combined hash into caseId, itemId, criterionId and responseHash
          const [caseId, itemId, criterionId, responseHash] =
            combinedHash.split(':')

          // if any of the ids or the hash are invalid, skip this response
          if (
            !caseId ||
            !itemId ||
            !criterionId ||
            !responseHash ||
            !responseValue
          ) {
            console.log('An error occured while parsing the combinedHash:')
            console.error('combinedHash: ', combinedHash)
            return assessmentsAcc
          }

          // verify that the corresponding case-item-criterion combination exists in the results
          if (
            typeof assessmentsAcc[caseId]?.[itemId]?.[criterionId] ===
            'undefined'
          ) {
            console.log(
              'An error occured while verifying the case-item-criterion combination:'
            )
            console.error('caseId', caseId)
            console.error('itemId', itemId)
            console.error('criterionId', criterionId)
            return assessmentsAcc
          }

          // only once and selecting all corresponding responses based on the combinedHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            const caseSolutions = solutions.find(
              (solution) => solution.caseId === caseId
            )
            if (caseSolutions) {
              const itemSolution = caseSolutions.itemSolutions.find(
                (itemSolution) => itemSolution.itemId === parseInt(itemId)
              )
              if (itemSolution) {
                const criterionSolution = itemSolution.criteriaSolutions.find(
                  (criterionSolution) =>
                    criterionSolution.criterionId === criterionId
                )
                if (criterionSolution) {
                  grading =
                    responseValue >= criterionSolution.min &&
                    responseValue <= criterionSolution.max
                      ? 1
                      : 0
                }
              }
            }
          }

          assessmentsAcc[caseId][itemId][criterionId] = {
            ...assessmentsAcc[caseId][itemId][criterionId],
            [responseHash]: {
              value: responseValue,
              count: parseInt(answerCount),
              correct:
                typeof grading !== 'undefined'
                  ? grading === 1
                    ? true
                    : false
                  : undefined,
            },
          }

          return assessmentsAcc
        },
        {
          ...(instance.anonymousResults as ElementResultsCaseStudy).assessments,
        }
      )

      anonymousResults = {
        assessments,
        total: parseInt(results.participants),
      } as ElementResultsCaseStudy
    } else if (instance.elementType === DB.ElementType.CONTENT) {
      anonymousResults = {
        total: parseInt(results.participants),
      } as ElementResultsChoices
    }

    instanceResults[instance.id] = {
      info,
      responseHashes,
      anonymousResults: anonymousResults ?? { total: 0 },
    }
  }

  return {
    liveQuizLeaderboard,
    liveQuizLeaderboardTemporary,
    blockLeaderboard,
    blockLeaderboardTemporary,
    instanceResults,
    activeInstanceIds: activeBlock.elements.map((instance) => instance.id),
  }
}
// #endregion

// ------ LIVE QUIZ CREATION / EDITING ------
// #region
export async function splitActivityInstances(
  {
    stacksOrBlocks,
  }: { stacksOrBlocks: ElementStackInput[] | ElementBlockInput[] },
  ctx: ContextWithUser
) {
  // in EDIT mode - compute map between id of instance that is kept and the new order attribute
  const persistentInstanceOrderMap = stacksOrBlocks.reduce<
    Record<number, number>
  >((acc, block) => {
    block.elements
      .filter(
        (element) =>
          element.existingInstanceId !== null && !element.duplicateInstance
      )
      .forEach((element) => {
        acc[element.existingInstanceId!] = element.order
      })
    return acc
  }, {})

  // extract the ids of all instances that should be kept in the activity
  const persistentInstanceIds = Object.keys(persistentInstanceOrderMap).map(
    (id) => parseInt(id)
  )

  // fetch instances that should be kept in the activity
  const persistentInstances = await ctx.prisma.elementInstance.findMany({
    where: { id: { in: persistentInstanceIds } },
    include: { element: true },
  })

  // in DUPLICATION mode - instances that should be duplicated in the activity
  const duplicateInstanceIds = stacksOrBlocks.flatMap(
    (stackOrBlock: ElementStackInput | ElementBlockInput) =>
      stackOrBlock.elements
        .filter(
          (element) =>
            element.existingInstanceId !== null && element.duplicateInstance
        )
        .map((element) => element.existingInstanceId!)
  )

  // fetch instances that should be duplicated into new quiz
  const duplicationInstances = await ctx.prisma.elementInstance.findMany({
    where: {
      id: { in: duplicateInstanceIds },
      // for duplication of an activity, ADMIN permissions on the activity are required -> propagates to element
      // verify that user has at least ADMIN permissions on the element linked to this instance
      element: {
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
            },
          },
        },
      },
    },
    include: { element: true },
  })

  // check if any of the persistent / duplication instances are outdated (w.r.t. the element version)
  // -> only persistent and duplicated instances can be outdated, other instances are created from the current element
  const allInstances = [...persistentInstances, ...duplicationInstances]
  const anyInstanceOutdated = allInstances.some((instance) => {
    const [_, instanceVersion] = instance.elementData.id.split('-v')
    return (
      instanceVersion && parseInt(instanceVersion) !== instance.element.version
    )
  })

  // get the ids of all elements that should be used for instance creation
  const requiredElementsIds = stacksOrBlocks
    .flatMap((block: ElementStackInput | ElementBlockInput) => block.elements)
    .filter((element) => element.existingInstanceId === null)
    .map((blockElem) => blockElem.elementId)

  // fetch all elements from the database that should be used for instance creation
  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: requiredElementsIds },
      isDeleted: false,
      // only admins and owners are allowed to re-use elements
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
          },
        },
      },
    },
    include: {
      answerCollection: { include: { entries: true } },
      answerCollectionItems: true,
    },
  })

  // make sure that every element could be found and create a map for efficient access
  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }
  const elementMap = dbElements.reduce<Record<number, DB.Element>>(
    (acc, elem) => {
      acc[elem.id] = elem
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

interface ManipulateLiveQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  blocks: ElementBlockInput[]
  courseId?: string | null
  multiplier: number
  defaultPoints?: number | null
  defaultCorrectPoints?: number | null
  maxBonusPoints?: number | null
  timeToZeroBonus?: number | null
  isGamificationEnabled: boolean
  isPinProtected: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export async function manipulateLiveQuiz(
  {
    id,
    name,
    displayName,
    description,
    blocks,
    courseId,
    multiplier,
    defaultPoints,
    defaultCorrectPoints,
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isPinProtected,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: ManipulateLiveQuizArgs,
  ctx: ContextWithUser
) {
  // in EDIT mode - validate that the live quiz exists and is not published
  let existingActivity:
    | (DB.LiveQuiz & { course?: { _count: { permissions: number } } | null })
    | null = null
  if (id) {
    existingActivity = await ctx.prisma.liveQuiz.findUnique({
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
                      in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
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
      throw new GraphQLError('Live quiz not found')
    }
    if (existingActivity.status === DB.PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published live quiz')
    }
  }

  // get required splits of instances based on provided blocks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ stacksOrBlocks: blocks }, ctx)

  // in EDIT mode - check which instances and blocks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let blocksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementBlock: { liveQuizId: id },
      },
    })

    const blocks = await ctx.prisma.elementBlock.findMany({
      where: { liveQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    blocksToDelete = blocks.map((block) => block.id)
  }

  // fetch the course to which the live quiz should be linked regarding the gamification and assessment settings
  const course = courseId
    ? await ctx.prisma.course.findUnique({
        where: { id: courseId },
        select: { isGamificationEnabled: true, isAssessmentEnabled: true },
      })
    : null

  // activities in gamified courses should always be gamified, otherwise respect user setting
  const gamificationSetting = course?.isGamificationEnabled
    ? course.isGamificationEnabled
    : isGamificationEnabled

  // only activities in assessment courses will be marked as being part of assessment
  const assessmentSetting = course?.isAssessmentEnabled ?? false

  // pin protection applies when assessment is enabled or explicitly enabled via flag
  const pinProtection = assessmentSetting || isPinProtected

  // if the activity is part of an assessment course, but should be modified and the user is not a course admin, return early
  if (
    typeof courseId !== 'undefined' &&
    courseId !== null &&
    existingActivity?.isAssessmentEnabled &&
    !existingActivity?.course?._count.permissions
  ) {
    throw new GraphQLError(
      'Assessment live quizzes can only be modified by course admins or owners'
    )
  }

  // if required, find a new pin code for the live quiz that is still available
  let newPinCode: string | undefined | null = existingActivity?.pinCode
  if (pinProtection && (!courseId || courseId !== existingActivity?.courseId)) {
    let pinValid = false

    for (let attempt = 0; attempt < 10; attempt++) {
      // generate a new pin code
      newPinCode = generatePassword.generate({
        uppercase: true,
        lowercase: false,
        numbers: true,
        symbols: false,
        length: 6,
      })

      // check if the pin code is still available
      const existingLiveQuiz = await ctx.prisma.liveQuiz.findUnique({
        where: { pinCode: newPinCode },
      })
      if (!existingLiveQuiz) {
        pinValid = true
        break
      }
    }

    // if the pin is still invalid, return null and abort the transaction
    if (!pinValid) {
      throw new Error('Could not find available pin code for live quiz')
    }
  }

  // re-create blocks and link existing instance / create new instances (depending on mode and novelty of the included element)
  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    defaultPoints: defaultPoints ?? undefined,
    defaultCorrectPoints: defaultCorrectPoints ?? undefined,
    maxBonusPoints: maxBonusPoints ?? undefined,
    timeToZeroBonus: timeToZeroBonus ?? undefined,
    isGamificationEnabled: gamificationSetting,
    isAssessmentEnabled: assessmentSetting,
    pinCode: pinProtection ? newPinCode : null, // if pin protection applies (and the course changed), assign a pin
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
    areInstancesOutdated: anyInstanceOutdated,
    reviewStatus:
      existingActivity?.courseId !== courseId
        ? DB.ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === DB.ReviewStatus.REVIEWED
          ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    blocks: {
      create: blocks.map((block) => ({
        order: block.order,
        timeLimit: block.timeLimit,
        elements: {
          connectOrCreate: block.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: DB.ElementInstanceType.LIVE_QUIZ,
              activityMultiplier: multiplier,
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

  const activity = await ctx.prisma.$transaction(
    async (prisma) => {
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
            elementBlockId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...instance.options,
              pointsMultiplier: multiplier * elementMultiplier,
            },
          },
        })
      }

      // delete all blocks
      await prisma.elementBlock.deleteMany({
        where: {
          id: { in: blocksToDelete },
        },
      })

      const upsertedQuiz = await prisma.liveQuiz.upsert({
        where: { id: id ?? uuidv4() },
        create: {
          ...createOrUpdateJSON,
          course:
            typeof courseId !== 'undefined' && courseId !== null
              ? { connect: { id: courseId } }
              : undefined,
          owner: { connect: { id: ctx.user.sub } }, // only connect the owner during activity creation (not editing)!
        },
        update: {
          ...createOrUpdateJSON,
          course:
            typeof courseId !== 'undefined'
              ? courseId !== null
                ? { connect: { id: courseId } }
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
          blocks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          _count: { select: { permissions: true } },
        },
      })

      // enforce dervied permissions update to elements that were potentially removed from the quiz (-> removal of derived permissions)
      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, prisma)
        }
      }

      await recomputeDerivedPermissions({ liveQuizId: upsertedQuiz.id }, prisma)
      return upsertedQuiz
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
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
    type: ActivityType.LIVE_QUIZ,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.blocks.length,
    numOfElements: activity.blocks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
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
      !id || // activity creation -> automatically activity owner
      (activity.courseId === null &&
        (activity.permissions[0]?.permissionLevel ===
          DB.PermissionLevel.OWNER ||
          activity.permissions[0]?.permissionLevel ===
            DB.PermissionLevel.ADMIN)) || // live quiz not part of course -> activity admin
      (!!activity.course && activity.course._count.permissions > 0), // live quiz in course -> course admin
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

export async function removeLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified live quiz
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!liveQuiz) {
    return null
  }

  // remove direct permission and recompute derived permissions for this live quiz and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      await prisma.liveQuiz.update({
        where: { id },
        data: { directPermissions: { deleteMany: { userId: ctx.user.sub } } },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.LIVE_QUIZ,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.LIVE_QUIZ} (ID: ${id})`,
        },
      })

      await recomputeDerivedPermissions(
        { liveQuizId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id,
  })

  return id
}
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (LECTURER) ------
// #region
export async function getLiveQuizData(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  if (!id) return null

  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      blocks: {
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
      course: true,
    },
  })

  return quiz
}

export async function getUserRunningLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: {
          liveQuizId: { not: null },
          permissionLevel: {
            in: [
              DB.PermissionLevel.EXECUTE,
              DB.PermissionLevel.WRITE,
              DB.PermissionLevel.ADMIN,
              DB.PermissionLevel.OWNER,
            ],
          },
          liveQuiz: { status: DB.PublicationStatus.PUBLISHED },
        },
        include: { liveQuiz: { include: { course: true } } },
      },
    },
  })

  return user?.objects.map((object) => object.liveQuiz!) ?? []
}

export async function getLecturerViewLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      confusionFeedbacks: true,
      feedbacks: { where: { isPinned: true } },
    },
  })

  if (liveQuiz?.status !== DB.PublicationStatus.PUBLISHED || !liveQuiz) {
    return null
  }

  // recude live quiz to only contain what is required for the lecturer cockpit
  const reducedQuiz = {
    ...liveQuiz,
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
  }

  return reducedQuiz
}

export async function getControlLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, status: DB.PublicationStatus.PUBLISHED },
    include: {
      activeBlock: true,
      course: true,
      blocks: {
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

  if (!quiz) {
    return null
  }

  return quiz
}

export async function getShortnameQuizzes(
  { shortname }: { shortname: string },
  ctx: Context
) {
  const user = await ctx.prisma.user.findUnique({
    where: { shortname: shortname.trim() },
    include: {
      objects: {
        where: {
          // the shared object must be a live quiz that is published and accessible
          liveQuizId: { not: null },
          liveQuiz: {
            status: DB.PublicationStatus.PUBLISHED,
            accessMode: DB.AccessMode.PUBLIC,
          },
          // only users with at least execution permissions can execute a live quiz
          permissionLevel: {
            in: [
              DB.PermissionLevel.OWNER,
              DB.PermissionLevel.ADMIN,
              DB.PermissionLevel.WRITE,
              DB.PermissionLevel.EXECUTE,
            ],
          },
        },
        include: { liveQuiz: { include: { course: true } } },
      },
    },
  })

  return (
    user?.objects.flatMap((obj) =>
      obj.liveQuiz
        ? {
            ...obj.liveQuiz,
            isPinProtected: !!obj.liveQuiz.pinCode,
          }
        : []
    ) ?? []
  )
}

export async function getUnassignedLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          courseId: null,
          status: {
            in: [
              DB.PublicationStatus.PUBLISHED,
              DB.PublicationStatus.SCHEDULED,
              DB.PublicationStatus.DRAFT,
            ],
          },
        },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })

  return user?.liveQuizzes ?? []
}
// #endregion

// ------ LIVE QUIZ EXECUTION (LECTURER) ------
// #region
export async function startLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  try {
    const quiz = await ctx.prisma.liveQuiz.findFirst({
      where: {
        id,
        status: {
          in: [
            DB.PublicationStatus.DRAFT,
            DB.PublicationStatus.SCHEDULED,
            DB.PublicationStatus.PUBLISHED,
          ],
        },
      },
      include: { blocks: { orderBy: { id: 'asc' } } },
    })

    // if there is no live quiz matching the current user and quiz id, exit early
    if (!quiz) {
      return null
    }

    switch (quiz.status) {
      case DB.PublicationStatus.PUBLISHED:
        return quiz

      case DB.PublicationStatus.DRAFT:
      case DB.PublicationStatus.SCHEDULED: {
        try {
          const pipeline = ctx.redisExec.pipeline()
          pipeline.hmset(`lq:${quiz.id}:meta`, {
            namespace: quiz.namespace,
            startedAt: Number(new Date()),
            isGamificationEnabled: quiz.isGamificationEnabled,
            isAssessmentEnabled: quiz.isAssessmentEnabled,
          })

          await pipeline.exec()
        } catch (e) {
          console.error(e)
        }

        // generate a random pin code
        const startedLiveQuiz = await ctx.prisma.liveQuiz.update({
          where: { id },
          data: {
            status: DB.PublicationStatus.PUBLISHED,
            startedAt: new Date(),
          },
        })

        await sendTeamsNotifications(
          'graphql/startLiveQuiz',
          `START Live quiz ${quiz.name} with id ${quiz.id}.`
        )

        return startedLiveQuiz
      }
    }
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/startLiveQuiz',
      `ERROR - failed to start live quiz: ${error}`
    )
    throw error
  }
}

export async function getCockpitQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, status: DB.PublicationStatus.PUBLISHED },
    include: {
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: {
        orderBy: { order: 'asc' },
        include: { elements: { orderBy: { order: 'asc' } } },
      },
      course: true,
      confusionFeedbacks: true,
      feedbacks: { include: { responses: true } },
    },
  })

  if (!liveQuiz) {
    return null
  }

  // number of participants per block
  const blockParticipants = liveQuiz.blocks.reduce<Record<number, number>>(
    (acc, block) => {
      acc[block.id] = block.elements.reduce(
        (instanceAcc, instance) =>
          min(
            instanceAcc,
            instance.results.total + instance.anonymousResults.total
          ),
        100000
      )
      return acc
    },
    {}
  )

  if (liveQuiz.activeBlock && liveQuiz.activeBlock.id) {
    const activeInstanceIds = liveQuiz.activeBlock?.elements.map(
      (instance) => instance.id
    )
    const redisMulti = ctx.redisExec.pipeline()
    activeInstanceIds?.forEach((instanceId) => {
      redisMulti.hgetall(`lq:${id}:i:${instanceId}:results`)
    })
    const cacheContent = (await redisMulti.exec()) as
      | [
          Error | null,
          { participants: string }, // TODO: extend type with more content of cache (as needed)
        ][]
      | null

    const activeBlockParticipants = cacheContent
      ?.map(([_, result]) => parseInt(result?.participants))
      .reduce((acc, val) => min(acc, val), 100000)
    blockParticipants[liveQuiz.activeBlock.id] =
      activeBlockParticipants ?? blockParticipants[liveQuiz.activeBlock.id] ?? 0
  }

  // recude live quiz to only contain what is required for the lecturer cockpit
  const reducedQuiz = {
    ...liveQuiz,
    activeBlock: liveQuiz.activeBlock,
    blocks: liveQuiz.blocks.map((block) => {
      return {
        ...block,
        numOfParticipants: blockParticipants[block.id],
        elements: block.elements.map((instance) => {
          const elementData = instance.elementData
          if (
            !elementData ||
            typeof elementData !== 'object' ||
            Array.isArray(elementData)
          ) {
            return instance
          } else {
            return {
              ...instance,
              elementData: {
                ...elementData,
                options: null,
              },
            }
          }
        }),
      }
    }),
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
  }

  return reducedQuiz
}

export async function activateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: { blocks: { orderBy: { id: 'asc' } } },
  })

  if (!quiz) return null

  const newBlock = quiz.blocks.find((block) => block.id === blockId)

  // if the block is not from the current quiz or it is already active, return early
  if (!newBlock || quiz.activeBlockId === blockId) return quiz

  // set the new block to active
  const updatedQuiz = await ctx.prisma.liveQuiz.update({
    where: { id: quizId },
    data: {
      activeBlock: { connect: { id: blockId } },
      blocks: {
        update: {
          where: { id: blockId },
          data: {
            status: DB.ElementBlockStatus.ACTIVE,
            startedAt: new Date(),
            expiresAt: newBlock.timeLimit
              ? dayjs().add(newBlock.timeLimit, 'seconds').toDate()
              : undefined,
          },
        },
      },
    },
    include: {
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (updatedQuiz.activeBlock?.expiresAt) {
    scheduledJobs[blockId] = schedule.scheduleJob(
      dayjs(updatedQuiz.activeBlock.expiresAt).add(10, 'second').toDate(),
      async () => {
        await deactivateLiveQuizBlock({ quizId, blockId }, ctx, true)
        ctx.emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: updatedQuiz.id,
        })
      }
    )
  }

  // update the quiz with an updated version through the corresponding subscription
  ctx.pubSub.publish('runningLiveQuizUpdated', {
    id: updatedQuiz.id,
    beforeFirstBlock: false,
    activeBlock: {
      ...updatedQuiz.activeBlock,
      elements: updatedQuiz.activeBlock!.elements
        ? await Promise.all(
            removeSolutionFromInstances({
              instances: updatedQuiz.activeBlock!.elements,
            }).map(async (instance) => {
              if (!quiz.isAssessmentEnabled) {
                return instance
              }

              // for assessment quizzes, add a correlation key to verify a student's submission
              const correlationKey = await signJWT(
                {
                  instanceId: instance.id,
                  execution: updatedQuiz.activeBlock!.execution,
                  liveQuizId: quiz.id,
                  sub: '', // dummy sub, since this value is required
                },
                process.env.APP_SECRET as string,
                undefined,
                updatedQuiz.activeBlock!.startedAt ?? new Date(0)
              )

              return { ...instance, correlationKey }
            })
          )
        : [],
    },
    // for future blocks, do not return the elements
    blocks: updatedQuiz.blocks.map((block) => ({
      ...block,
      elements:
        block.status === DB.ElementBlockStatus.EXECUTED
          ? removeSolutionFromInstances({ instances: block.elements })
          : [],
    })),
  })

  // initialize the cache for the new active block
  const redisMulti = ctx.redisExec.pipeline()

  updatedQuiz.activeBlock!.elements.forEach((instance) => {
    const elementData = instance.elementData

    const commonInfo = {
      namespace: updatedQuiz.namespace,
      startedAt: Number(new Date()),
      sessionBlockId: blockId,
      type: elementData.type,
      basePoints: instance.options.basePoints,
      pointsMultiplier: instance.options.pointsMultiplier,
      defaultPoints: updatedQuiz.defaultPoints,
      defaultCorrectPoints: updatedQuiz.defaultCorrectPoints,
      maxBonusPoints: updatedQuiz.maxBonusPoints,
      timeToZeroBonus: updatedQuiz.timeToZeroBonus,
      blockExecution: updatedQuiz.activeBlock!.execution,
      blockStartedAt: Number(updatedQuiz.activeBlock!.startedAt),
    }

    switch (elementData.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          choiceCount: elementData.options.choices.length,
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(
                elementData.options.choices
                  .map((choice, ix) => ({ ix, correct: choice.correct }))
                  .filter((choice) => choice.correct)
                  .map((choice) => choice.ix)
              )
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsChoices).choices,
        })

        break
      }

      case DB.ElementType.NUMERICAL: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          ...(elementData.options.restrictions &&
          Object.keys(elementData.options.restrictions).length > 0
            ? { restrictions: JSON.stringify(elementData.options.restrictions) }
            : {}),
          solutions:
            elementData.options.exactSolutions &&
            elementData.options.exactSolutions.length > 0
              ? JSON.stringify(elementData.options.exactSolutions)
              : elementData.options.solutionRanges
                ? JSON.stringify(elementData.options.solutionRanges)
                : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.FREE_TEXT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          ...(elementData.options.restrictions &&
          Object.keys(elementData.options.restrictions).length > 0
            ? { restrictions: JSON.stringify(elementData.options.restrictions) }
            : {}),
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(elementData.options.solutions)
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.SELECTION: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: JSON.stringify(
            elementData.options.answerCollectionSolutionIds
          ),
          numberOfInputs: elementData.options.numberOfInputs,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsSelection).selections,
        })

        break
      }

      case DB.ElementType.CASE_STUDY: {
        // convert solutions to object for faster access
        const validSolutions = elementData.options.cases.every(
          (caseItem) => caseItem.solutions
        )
        const solutions =
          elementData.options.hasSampleSolution && validSolutions
            ? elementData.options.cases.map((caseItem) => ({
                caseId: caseItem.id,
                itemSolutions: caseItem.solutions,
              }))
            : undefined

        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: solutions ? JSON.stringify(solutions) : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }

      case DB.ElementType.CONTENT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, commonInfo)
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })

        break
      }
    }
  })

  redisMulti.exec()
  return updatedQuiz
}

export async function deactivateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: ContextWithUser,
  isScheduled?: boolean
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      course: true,
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: { orderBy: { id: 'asc' } },
    },
  })

  if (!quiz || !quiz.activeBlock) return false

  // if the block is not the active one, return early
  if (quiz.activeBlockId !== blockId) return false

  try {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: quiz.activeBlock,
    })

    if (!cachedResults) return false

    const {
      instanceResults,
      liveQuizLeaderboard,
      liveQuizLeaderboardTemporary,
      activeInstanceIds,
    } = cachedResults

    // filter the leaderboard entries to only include those that have a valid participant id
    const { regularParticipantLeaderboard, temporaryParticipantLeaderboard } = (
      await Promise.allSettled(
        Object.entries(liveQuizLeaderboard).map(async ([id, score]) => {
          const participant = await ctx.prisma.participant.findUnique({
            where: { id },
            include: {
              participations: quiz.courseId
                ? { where: { courseId: quiz.courseId } }
                : { take: 0 },
            },
          })

          if (!participant) return null
          return {
            participantId: id,
            participantUsername: participant.username,
            participantAvatar: participant.avatar,
            gamifiedCourseParticipation:
              !!quiz.courseId &&
              quiz.course?.isGamificationEnabled &&
              !!participant.participations?.[0],
            courseParticipationActive:
              !!quiz.courseId &&
              !!participant.participations?.[0] &&
              participant.participations?.[0].isActive,
            score,
          }
        })
      )
    ).reduce<{
      regularParticipantLeaderboard: { participantId: string; score: number }[]
      temporaryParticipantLeaderboard: {
        participantId: string
        participantUsername: string
        participantAvatar: string | null
        score: number
      }[]
    }>(
      (acc, result) => {
        // filter out failed requests and those which have a valid gamified course participation,
        // which is not active -> active decision to not be on leaderboard
        if (
          result.status !== 'fulfilled' ||
          !result.value ||
          (result.value.gamifiedCourseParticipation &&
            !result.value.courseParticipationActive)
        ) {
          return acc
        }

        if (result.value.gamifiedCourseParticipation) {
          // active gamified course participation (inactive already filtered) -> regular leaderboard
          acc.regularParticipantLeaderboard.push({
            participantId: result.value.participantId,
            score: parseInt(result.value.score, 10),
          })
        } else {
          // no gamified course participation -> temporary leaderboard
          acc.temporaryParticipantLeaderboard.push({
            participantId: result.value.participantId,
            participantUsername: result.value.participantUsername,
            participantAvatar: result.value.participantAvatar,
            score: parseInt(result.value.score, 10),
          })
        }

        return acc
      },
      { regularParticipantLeaderboard: [], temporaryParticipantLeaderboard: [] }
    )

    // filter temporary leaderboard entries to only include those that have a valid temporary leaderboard entry for this live quiz
    // technically, this should not be required, since all ids should be valid, but it is a safety check
    const existingTemporaryLB = (
      await Promise.allSettled(
        Object.entries(liveQuizLeaderboardTemporary).map(
          async ([id, score]) => {
            const tempLeadeboardEntry =
              await ctx.prisma.temporaryLeaderboardEntry.findUnique({
                where: { id_quizId: { id, quizId } },
              })

            if (!tempLeadeboardEntry) return null
            return {
              participantId: id,
              participantUsername: undefined,
              participantAvatar: undefined,
              score: parseInt(score, 10),
            }
          }
        )
      )
    ).flatMap((result) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      return [result.value]
    })

    const updatedQuiz = await ctx.prisma.liveQuiz.update({
      where: { id: quizId },
      data: {
        activeBlock: { disconnect: true },
        blocks: {
          update: {
            where: { id: blockId },
            data: {
              status: DB.ElementBlockStatus.EXECUTED,
              closedAt: new Date(),
              elements: {
                update: Object.entries(instanceResults).map(
                  ([id, instanceResult]) => ({
                    where: { id: Number(id) },
                    data: { anonymousResults: instanceResult.anonymousResults },
                  })
                ),
              },
            },
          },
        },
        leaderboard: quiz.isGamificationEnabled
          ? {
              upsert: regularParticipantLeaderboard.map(
                ({ participantId, score }) => ({
                  where: {
                    type_participantId_liveQuizId: {
                      type: DB.LeaderboardType.SESSION,
                      participantId,
                      liveQuizId: quizId,
                    },
                  },
                  create: {
                    type: DB.LeaderboardType.SESSION,
                    participant: { connect: { id: participantId } },
                    score: score,
                    sessionParticipation: quiz.courseId
                      ? {
                          connectOrCreate: {
                            where: {
                              courseId_participantId: {
                                courseId: quiz.courseId,
                                participantId,
                              },
                            },
                            create: {
                              course: { connect: { id: quiz.courseId! } },
                              participant: { connect: { id: participantId } },
                            },
                          },
                        }
                      : undefined,
                  },
                  update: { score },
                })
              ),
            }
          : undefined,
        temporaryLeaderboard: quiz.isGamificationEnabled
          ? {
              upsert: [
                ...temporaryParticipantLeaderboard,
                ...existingTemporaryLB,
              ].map(
                ({
                  participantId,
                  participantUsername,
                  participantAvatar,
                  score,
                }) => ({
                  where: {
                    id_quizId: {
                      id: participantId,
                      quizId,
                    },
                  },
                  create: {
                    id: participantId,
                    username: participantUsername ?? '', // fallback should never be used
                    avatar: participantAvatar ?? undefined,
                    score,
                  },
                  update: { score },
                })
              ),
            }
          : undefined,
      },
      include: {
        blocks: {
          include: { elements: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    // update the running live quiz with the updated block information
    ctx.pubSub.publish('runningLiveQuizUpdated', {
      id: updatedQuiz.id,
      beforeFirstBlock: false,
      activeBlock: null,
      // for future blocks, do not return the elements
      blocks: updatedQuiz.blocks.map((block) => ({
        ...block,
        elements:
          block.status === DB.ElementBlockStatus.EXECUTED
            ? removeSolutionFromInstances({ instances: block.elements })
            : [],
      })),
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: quiz.id,
    })

    if (!isScheduled && scheduledJobs[blockId]) {
      await scheduledJobs[blockId].cancel()
      delete scheduledJobs[blockId]
    }

    // add the closure timestamp of the block to the instance info in the redis cache
    const updatedBlock = updatedQuiz.blocks.find(
      (block) => block.id === blockId
    )
    if (updatedBlock && updatedBlock.closedAt) {
      for (const instanceId of activeInstanceIds) {
        // add the blockClosedAt timestamp to the instance info cache
        await ctx.redisExec.hset(
          `lq:${quiz.id}:i:${instanceId}:info`,
          'blockClosedAt',
          Number(updatedBlock.closedAt)
        )
      }
    }

    return true
  } catch (error: any) {
    await sendTeamsNotifications(
      'graphql/deactivateLiveQuizBlock',
      `ERROR - failed to deactivate block ${blockId} in live quiz ${
        quiz.id
      } with active block ${quiz.activeBlockId}: ${error?.message || error}`
    )

    throw error
  }
}

export async function endLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findFirst({
    where: { id },
    include: {
      course: true,
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  // if there is no live quiz matching the current user and quiz id, exit early
  if (!quiz) {
    return null
  }

  if (quiz.status === DB.PublicationStatus.ENDED) {
    return quiz
  }
  if (
    quiz.status === DB.PublicationStatus.DRAFT ||
    quiz.status === DB.PublicationStatus.SCHEDULED
  ) {
    return null
  }

  // update course leaderboard and participant XP
  try {
    const quizLB = await ctx.redisExec.hgetall(`lq:${id}:lb`)
    const quizXP = await ctx.redisExec.hgetall(`lq:${id}:xp`)
    const participants: Record<string, any> = {}

    Object.entries(quizXP).forEach(([id, xp]) => {
      participants[id] = {
        xp: parseInt(xp),
      }
    })
    Object.entries(quizLB).forEach(([id, score]) => {
      participants[id] = {
        ...(participants[id] ?? {}),
        score: parseInt(score),
      }
    })

    // quizXP should always be around as soon as there are logged-in participants (check first)
    // quizLB only for live quizzes that are compatible with points collection (check second)
    if (Object.keys(participants).length > 0) {
      let existingParticipants: {
        id: string
        score?: number
        xp?: number
        hasParticipation?: boolean
      }[] = (
        await Promise.allSettled(
          Object.entries(participants).map(async ([id, { score, xp }]) => {
            const participant = await ctx.prisma.participant.findUnique({
              where: { id },
              include: {
                // if the live quiz is part of a course, include the corresponding participations
                // if the participant is not part of the relevant course, the joined array will be empty
                participations: quiz.courseId
                  ? { where: { courseId: quiz.courseId } }
                  : undefined,
              },
            })

            if (!participant) return null

            return {
              id,
              score,
              xp,
              hasParticipation: participant.participations?.[0]?.isActive,
            }
          })
        )
      ).flatMap((result) => {
        if (result.status !== 'fulfilled' || !result.value) return []
        return [result.value]
      })

      // track the achievement ids, which should be awarded to the participants
      let newAchievements: Record<string, number> = {}

      // only award achievements, if the live quiz did contain questions with sample
      // solutions and at least three participants collected points
      const awardAchievements = quiz.blocks.some(
        (block) =>
          block.elements.some((instance) => {
            return instance.elementType !== DB.ElementType.CONTENT &&
              'hasSampleSolution' in instance.elementData.options
              ? (instance.elementData.options.hasSampleSolution ?? false)
              : false
          }) &&
          existingParticipants.filter(
            ({ score }) => typeof score !== 'undefined'
          ).length >= 3
      )

      // award achievements to the top 3 participants (and all others with equal scores)
      if (awardAchievements) {
        const topScores = existingParticipants
          .filter(({ score }) => typeof score !== 'undefined')
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, 3)

        const firstRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: FIRST_ACHIEVEMENT_ID },
        })
        const secondRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: SECOND_ACHIEVEMENT_ID },
        })
        const thirdRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: THIRD_ACHIEVEMENT_ID },
        })

        const goldScore = topScores[0]?.score
        const silverScore = topScores[1]?.score
        const bronzeScore = topScores[2]?.score

        // awarding logic (including point and xp updates):
        // award gold to every participant with gold score
        // award silver to every participant with silver score, if silver score != gold score
        // award bronze to every participant with bronze score, if bronze score != silver score
        existingParticipants = existingParticipants.map((participant) => {
          if (
            typeof participant.score === 'undefined' ||
            typeof participant.xp === 'undefined'
          ) {
            return participant
          }

          if (participant.score === goldScore) {
            participant.xp += firstRankAchievement!.rewardedXP ?? 0
            participant.score += firstRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = firstRankAchievement!.id
          }
          if (participant.score === silverScore && silverScore !== goldScore) {
            participant.xp += secondRankAchievement!.rewardedXP ?? 0
            participant.score += secondRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = secondRankAchievement!.id
          }
          if (
            participant.score === bronzeScore &&
            bronzeScore !== silverScore
          ) {
            participant.xp += thirdRankAchievement!.rewardedXP ?? 0
            participant.score += thirdRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = thirdRankAchievement!.id
          }

          return participant
        })
      }

      // execute XP and points in the same transaction to prevent issues when one fails
      // the live quiz update later on should never fail, but we need the return value (keep separate)
      await ctx.prisma.$transaction(async (prisma) => {
        // process XP updates
        for (const participant of existingParticipants) {
          if (typeof participant.xp !== 'undefined') {
            await prisma.participant.update({
              where: { id: participant.id },
              data: { xp: { increment: Number(participant.xp) } },
            })
          }
        }

        // remove any temporary leaderboard entries that have not been updated after their creation (with score 0)
        await prisma.temporaryLeaderboardEntry.deleteMany({
          where: {
            quizId: id,
            score: 0,
            createdAt: {
              equals: prisma.temporaryLeaderboardEntry.fields.updatedAt,
            },
          },
        })

        // if the live quiz is part of a gamified course, update the course leaderboard
        // with the accumulated points and award achievements
        if (quizLB && quiz.courseId) {
          for (const participant of existingParticipants) {
            if (
              quiz.course?.isGamificationEnabled && // verify that the course is gamified
              typeof participant.score !== 'undefined' &&
              participant.hasParticipation
            ) {
              // award points, if the student is a participant in the course
              await prisma.leaderboardEntry.upsert({
                where: {
                  type_participantId_courseId: {
                    type: DB.LeaderboardType.COURSE,
                    courseId: quiz.courseId,
                    participantId: participant.id,
                  },
                },
                include: {
                  participation: true,
                  participant: true,
                },
                create: {
                  type: DB.LeaderboardType.COURSE,
                  course: { connect: { id: quiz.courseId } },
                  participant: { connect: { id: participant.id } },
                  participation: {
                    connectOrCreate: {
                      where: {
                        courseId_participantId: {
                          courseId: quiz.courseId,
                          participantId: participant.id,
                        },
                      },
                      create: {
                        course: { connect: { id: quiz.courseId } },
                        participant: { connect: { id: participant.id } },
                      },
                    },
                  },
                  score: participant.score,
                },
                update: {
                  score: { increment: participant.score },
                },
              })
            }

            // update daily timeline entries
            if (
              typeof participant.xp !== 'undefined' ||
              (typeof participant.score !== 'undefined' &&
                participant.hasParticipation)
            ) {
              await upsertDailyTimelineEntry({
                prisma,
                participantId: participant.id,
                courseId: quiz.courseId,
                xpAwarded: participant.xp,
                pointsAwarded: participant.hasParticipation
                  ? participant.score
                  : undefined,
              })
            }

            // award achievements if participant has achieved high scores / ...
            if (typeof newAchievements[participant.id] !== 'undefined') {
              await prisma.participant.update({
                where: { id: participant.id },
                data: {
                  achievements: {
                    upsert: {
                      where: {
                        participantId_achievementId: {
                          participantId: participant.id,
                          achievementId: newAchievements[participant.id]!,
                        },
                      },
                      create: {
                        achievedAt: new Date(),
                        achievedCount: 1,
                        achievement: {
                          connect: { id: newAchievements[participant.id]! },
                        },
                      },
                      update: {
                        achievedCount: { increment: 1 },
                      },
                    },
                  },
                },
              })
            }
          }
        }
      })
    }

    // TODO: make sure here that cache keys of instances in assessment live quizzes remain intact until the last response has been processed
    // Clean up Redis keys without using KEYS (iterate with SCAN to avoid blocking)
    const SCAN_COUNT = 1000
    let cursor = '0'
    do {
      const [nextCursor, keys] = await ctx.redisExec.scan(
        cursor,
        'MATCH',
        `lq:${id}:*`,
        'COUNT',
        SCAN_COUNT
      )
      cursor = nextCursor

      if (keys.length > 0) {
        const pipe = ctx.redisExec.pipeline()
        for (const key of keys) {
          pipe.unlink(key)
        }
        await pipe.exec()
      }
    } while (cursor !== '0')

    const endedLiveQuiz = await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        status: DB.PublicationStatus.ENDED,
        finishedAt: new Date(),
      },
    })

    await sendTeamsNotifications(
      'graphql/endLiveQuiz',
      `END Live quiz ${quiz.name} with id ${quiz.id}.`
    )

    return endedLiveQuiz
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/endLiveQuiz',
      `ERROR - failed to end live quiz ${quiz.name} with id ${quiz.id}: ${error}`
    )
    throw error
  }
}

export async function changeLiveQuizSettings(
  {
    id,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
  }: {
    id: string
    isLiveQAEnabled?: boolean | null
    isConfusionFeedbackEnabled?: boolean | null
    isModerationEnabled?: boolean | null
  },
  ctx: ContextWithUser
) {
  // check if moderation is being diabled
  if (isModerationEnabled === false) {
    // fetch all unpublished feedbacks for the quiz
    const currentQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: { id },
      include: {
        feedbacks: {
          where: { isPublished: false },
          include: { responses: true },
        },
      },
    })

    if (currentQuiz?.isModerationEnabled && currentQuiz.feedbacks.length > 0) {
      // auto-publish any unpublished feedbacks
      await ctx.prisma.feedback.updateMany({
        where: { liveQuizId: id, isPublished: false },
        data: { isPublished: true },
      })

      currentQuiz.feedbacks.forEach((feedback) => {
        ctx.pubSub.publish('feedbackAdded', feedback)
      })
    }
  }

  const quiz = await ctx.prisma.liveQuiz.update({
    where: { id },
    data: {
      isLiveQAEnabled: isLiveQAEnabled ?? undefined,
      isConfusionFeedbackEnabled: isConfusionFeedbackEnabled ?? undefined,
      isModerationEnabled: isModerationEnabled ?? undefined,
    },
  })

  ctx.pubSub.publish('liveQuizSettingsChanged', {
    liveQuizId: quiz.id,
    isLiveQAEnabled: quiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: quiz.isConfusionFeedbackEnabled,
  })

  ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })

  return quiz
}

export async function changeLiveQuizName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
  })

  if (!liveQuiz) return false

  // if both name and displayname remain unchanged, skip the update
  if (liveQuiz.name === name && liveQuiz.displayName === displayName) {
    return true
  }

  try {
    await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        name,
        displayName,
        reviewStatus:
          liveQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
            ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
            : undefined,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
    return true
  } catch (error) {
    console.error('Error changing live quiz name:', error)
    return false
  }
}

export async function getLiveQuizSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
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

  // get responses for completed blocks
  let storedResponses = liveQuiz.blocks.reduce((acc_b, block) => {
    acc_b += block.elements.reduce((acc_i, instance) => {
      acc_i += instance.results.total + instance.anonymousResults.total
      return acc_i
    }, 0)
    return acc_b
  }, 0)

  // get results for active blocks
  if (liveQuiz.activeBlock) {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: liveQuiz.activeBlock,
    })

    if (cachedResults) {
      const { instanceResults } = cachedResults

      const cachedResponses = liveQuiz.activeBlock.elements.reduce(
        (acc, instance) => {
          acc += instanceResults[instance.id]?.anonymousResults.total ?? 0
          return acc
        },
        0
      )

      storedResponses += cachedResponses
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

export async function cancelLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      activeBlock: true,
      blocks: { include: { elements: true, activeInLiveQuiz: true } },
      leaderboard: true,
    },
  })

  if (!quiz) return null

  try {
    if (quiz.status !== DB.PublicationStatus.PUBLISHED) {
      throw new Error('Live quiz is not running')
    }

    // if the quiz is an assessment quiz, it can only be aborted before the first block is activated
    if (
      quiz.isAssessmentEnabled &&
      (quiz.activeBlock ||
        quiz.blocks.some(
          (block) => block.status !== DB.ElementBlockStatus.SCHEDULED
        ))
    ) {
      throw new Error(
        'Assessment quizzes can only be aborted before the first block is activated'
      )
    }

    const instances = quiz.blocks.flatMap((block) => block.elements)
    const [updatedQuiz] = await ctx.prisma.$transaction([
      ctx.prisma.liveQuiz.update({
        where: { id },
        data: {
          status: DB.PublicationStatus.DRAFT,
          startedAt: null,
          activeBlock: { disconnect: true },
          leaderboard: { deleteMany: {} },
          temporaryLeaderboard: { deleteMany: {} },
          feedbacks: { deleteMany: {} },
          confusionFeedbacks: { deleteMany: {} },
          blocks: {
            updateMany: {
              where: {
                status: {
                  in: [
                    DB.ElementBlockStatus.EXECUTED,
                    DB.ElementBlockStatus.ACTIVE,
                  ],
                },
              },
              data: {
                status: DB.ElementBlockStatus.SCHEDULED,
                startedAt: null,
                closedAt: null,
                expiresAt: null,
                execution: { increment: 1 },
              },
            },
          },
        },
        include: {
          activeBlock: true,
          blocks: { include: { elements: true, activeInLiveQuiz: true } },
        },
      }),

      ...instances.map((instance) => {
        const initialResults = getInitialInstanceResults(instance.elementData)

        return ctx.prisma.elementInstance.update({
          where: {
            id: instance.id,
          },
          data: {
            results: initialResults,
            anonymousResults: initialResults,
          },
        })
      }),
    ])

    const keys = await ctx.redisExec.keys(`lq:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `CANCEL Live quiz ${quiz.name} with id ${quiz.id}.`
    )

    return updatedQuiz
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `ERROR - failed to cancel live quiz ${quiz.name} with id ${quiz.id}: ${error}`
    )
    throw error
  }
}

export async function getLiveQuizEvaluation(
  { id, hmac }: { id: string; hmac?: string | null },
  ctx: Context
) {
  if ((!ctx.user?.sub && typeof hmac !== 'string') || hmac == '') {
    return null
  }

  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      status: {
        in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
      },
      isDeleted: false,
    },
    include: {
      activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
      blocks: {
        orderBy: { order: 'asc' },
        where: { status: { equals: DB.ElementBlockStatus.EXECUTED } },
        include: { elements: { orderBy: { order: 'asc' } } },
      },
      feedbacks: {
        include: { responses: true },
        orderBy: { updatedAt: 'desc' },
      },
      confusionFeedbacks: { orderBy: { createdAt: 'asc' } },
      course: { select: { language: true } },
    },
  })

  if (!liveQuiz) {
    return null
  }

  if (typeof hmac === 'string') {
    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
    hmacEncoder.update(liveQuiz.namespace + liveQuiz.id)
    const quizHmac = hmacEncoder.digest('hex')

    // evaluate whether the hashed liveQuiz.namespace and liveQuiz.id equals the hmac
    if (quizHmac !== hmac) {
      return null
    }
  }

  // load results from active block as well
  let activeBlockWithResults:
    | (DB.ElementBlock & { elements: DB.ElementInstance[] })
    | undefined
  if (liveQuiz.activeBlockId && liveQuiz.activeBlock) {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: liveQuiz.activeBlock,
    })

    if (cachedResults) {
      const { instanceResults } = cachedResults

      activeBlockWithResults = {
        ...liveQuiz.activeBlock,
        elements: liveQuiz.activeBlock.elements.map((instance) => ({
          ...instance,
          anonymousResults:
            instanceResults[instance.id]?.anonymousResults ??
            instance.anonymousResults,
        })),
      }
    }
  }

  // compute evaluation
  const blockEvaluations = computeStackEvaluation(
    typeof activeBlockWithResults !== 'undefined'
      ? [...liveQuiz.blocks, { ...activeBlockWithResults, active: true }]
      : liveQuiz.blocks
  )

  return {
    id: liveQuiz.id,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    description: liveQuiz.description,
    courseLanguage: liveQuiz.course?.language,
    results: blockEvaluations,
    feedbacks:
      liveQuiz.status === DB.PublicationStatus.ENDED
        ? liveQuiz.feedbacks
        : null, // only shown on evaluation for completed quizzes
    confusionFeedbacks:
      liveQuiz.status === DB.PublicationStatus.ENDED
        ? liveQuiz.confusionFeedbacks
        : null, // only shown on evaluation for completed quizzes
  }
}
// #endregion

// ------ LIVE QUIZ MANAGEMENT (DELETION / EMBEDDING / ...) ------
// #region
export async function deleteLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch live quiz to check its status, remember the contained elements
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
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
                    in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!liveQuiz) return null

  if (liveQuiz.status === DB.PublicationStatus.PUBLISHED) {
    // running live quizzes cannot be deleted
    return null
  } else if (liveQuiz.status === DB.PublicationStatus.ENDED) {
    // completed assessment live quizzes cannot be deleted
    if (liveQuiz.isAssessmentEnabled) {
      return null
    }

    const deletedLiveQuiz = await ctx.prisma.$transaction(
      async (prisma) => {
        const quiz = await prisma.liveQuiz.update({
          where: { id, status: DB.PublicationStatus.ENDED },
          data: {
            isDeleted: true,
            directPermissions: { deleteMany: {} }, // delete all direct permissions on the activity
          },
        })

        // update derived permissions for this live quiz (after soft deletion)
        // this function call automatically includes permission updates for all linked elements
        await recomputeDerivedPermissions({ liveQuizId: quiz.id }, prisma)

        return quiz
      },
      { timeout: 60000 }
    )

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id,
    })

    return deletedLiveQuiz
  } else {
    // draft and scheduled assessment live quizzes can only be deleted by admins of the corresponding assessment course
    if (liveQuiz.isAssessmentEnabled) {
      const isCourseAdminOwner =
        !!liveQuiz.course?._count?.permissions &&
        liveQuiz.course._count.permissions > 0

      if (!isCourseAdminOwner) {
        return null
      }
    }

    const deletedLiveQuiz = await ctx.prisma.$transaction(
      async (prisma) => {
        const quiz = await prisma.liveQuiz.delete({
          where: {
            id,
            status: {
              in: [DB.PublicationStatus.DRAFT, DB.PublicationStatus.SCHEDULED],
            },
          },
        })

        // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
        // this case cannot be handled by the permissions module, since the live quiz is already hard deleted
        // access requests need to be updated as well, since the derived permissions on elements might have changed
        await propagateActivityToElements(
          { stacks: liveQuiz.blocks, updateAccessRequests: true },
          prisma
        )

        return quiz
      },
      { timeout: 60000 }
    )

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id,
    })

    return deletedLiveQuiz
  }
}

export async function getLiveQuizEmbeddingInfo(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!quiz) return null

  const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
  hmacEncoder.update(quiz.namespace + quiz.id)
  const quizHmac = hmacEncoder.digest('hex')

  const instances = quiz.blocks.flatMap((block) =>
    block.elements.map((instance) => ({
      id: instance.id,
      name: instance.elementData.name,
    }))
  )

  return { id: quiz.id, hmac: quizHmac, instances }
}

// compute the average of all feedbacks that were given within the last 10 minutes
const aggregateFeedbacks = (feedbacks: DB.ConfusionTimestep[]) => {
  // TODO: for improved efficiency, try to use descending feedback ordering
  // and break early once first is not within the filtering requirements anymore
  const recentFeedbacks = feedbacks.filter(
    (feedback) =>
      dayjs().diff(dayjs(feedback.createdAt)) > 0 &&
      dayjs().diff(dayjs(feedback.createdAt)) < 1000 * 60 * 10
  )

  if (recentFeedbacks.length > 0) {
    const summedFeedbacks = recentFeedbacks.reduce(
      (previousValue, feedback) => {
        return {
          speed: previousValue.speed + feedback.speed,
          difficulty: previousValue.difficulty + feedback.difficulty,
          numberOfParticipants: previousValue.numberOfParticipants + 1,
        }
      },
      { speed: 0, difficulty: 0, numberOfParticipants: 0 }
    )
    return {
      ...summedFeedbacks,
      speed: summedFeedbacks.speed / summedFeedbacks.numberOfParticipants,
      difficulty:
        summedFeedbacks.difficulty / summedFeedbacks.numberOfParticipants,
    }
  }
  return { speed: 0, difficulty: 0, numberOfParticipants: 0 }
}
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (STUDENT) ------
// #region
export async function setLiveQuizPinCookie(
  { liveQuizId, pin }: { liveQuizId: string; pin: string },
  ctx: Context
) {
  // verify that the corresponding live quiz is available
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: { id: true, status: true, pinCode: true },
  })
  if (!liveQuiz || liveQuiz.status !== DB.PublicationStatus.PUBLISHED) {
    throw new GraphQLError('LIVE_QUIZ_PIN_INVALID', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  // remove any previously added cookie and set the new correct one
  const cookieName = `live-quiz-pin-${liveQuizId}`
  if (!liveQuiz.pinCode || pin !== liveQuiz.pinCode) {
    try {
      ctx.res.clearCookie(cookieName, {
        domain: process.env.COOKIE_DOMAIN as string | undefined,
        path: '/',
      })
    } catch (_) {}
    throw new GraphQLError('LIVE_QUIZ_PIN_INVALID', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  // set the pin as a cookie to be readable by the student live quiz query
  ctx.res.cookie(cookieName, pin, {
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // cookie valie for one day
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite: 'lax',
  })

  return true
}

function removeSolutionFromInstances({
  instances,
}: {
  instances: DB.ElementInstance[]
}) {
  return instances.map((instance) => {
    const elementData = instance.elementData
    if (
      !elementData ||
      typeof elementData !== 'object' ||
      Array.isArray(elementData)
    )
      return instance

    switch (elementData.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              choices: elementData.options.choices.map((choice) => ({
                ...pick(choice, ['ix', 'value']),
              })),
            },
          },
        }

      case DB.ElementType.NUMERICAL:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              exactSolutions: undefined,
              solutionRanges: undefined,
            },
          },
        }

      case DB.ElementType.FREE_TEXT:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              solutions: undefined,
            },
          },
        }

      case DB.ElementType.SELECTION:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              answerCollectionSolutionIds: undefined,
            },
          },
        }

      case DB.ElementType.CASE_STUDY:
        return {
          ...instance,
          elementData: {
            ...elementData,
            options: {
              ...elementData.options,
              cases: elementData.options.cases.map((caseItem) => ({
                ...omitBy(caseItem, (_, key) => key === 'solutions'),
              })),
            },
          },
        }

      default:
        return instance
    }
  })
}

export async function getRunningLiveQuiz({ id }: { id: string }, ctx: Context) {
  // only get the minimal required information of the quiz
  const quizInfo = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    select: { id: true, status: true, pinCode: true },
  })

  // if the quiz is not available, return early
  if (!quizInfo || quizInfo.status !== DB.PublicationStatus.PUBLISHED)
    return null

  // if a pin code is required, verify that the user has already entered a valid one
  if (quizInfo.pinCode) {
    const cookieName = `live-quiz-pin-${id}`
    const providedPin = ctx.req.cookies?.[cookieName]

    if (!providedPin) {
      throw new GraphQLError('LIVE_QUIZ_PIN_MISSING', {
        extensions: { code: 'FORBIDDEN' },
      })
    }

    if (providedPin !== quizInfo.pinCode) {
      try {
        ctx.res.clearCookie(cookieName, {
          domain: process.env.COOKIE_DOMAIN as string | undefined,
          path: '/',
          secure: false,
          sameSite: 'lax',
        })
      } catch (_) {}

      throw new GraphQLError('LIVE_QUIZ_PIN_INVALID', {
        extensions: { code: 'FORBIDDEN' },
      })
    }
  }

  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: { elements: { orderBy: { order: 'asc' } } },
      },
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
      course: true,
    },
  })

  // check if any block has been started / completed
  const beforeFirstBlock = quiz?.blocks?.every(
    (block) => block.status === DB.ElementBlockStatus.SCHEDULED
  )

  // extract solution from instances in active block
  let quizWithoutSolutions: any
  if (quiz && quiz.activeBlock) {
    const activeBlockInstances = await Promise.all(
      removeSolutionFromInstances({
        instances: quiz.activeBlock.elements,
      }).map(async (instance) => {
        if (!quiz.isAssessmentEnabled) {
          return instance
        }

        // for assessment quizzes, add a correlation key to verify a student's submission
        const correlationKey = await signJWT(
          {
            instanceId: instance.id,
            execution: quiz.activeBlock!.execution,
            liveQuizId: quiz.id,
            sub: '', // dummy sub, since this value is required
          },
          process.env.APP_SECRET as string,
          undefined,
          quiz.activeBlock?.startedAt ?? new Date(0)
        )

        return { ...instance, correlationKey }
      })
    )

    quizWithoutSolutions = {
      ...quiz,
      beforeFirstBlock,
      activeBlock: { ...quiz.activeBlock, elements: activeBlockInstances },
      // for future blocks, do not return the elements
      blocks: quiz.blocks.map((block) => ({
        ...block,
        elements:
          block.status === DB.ElementBlockStatus.EXECUTED
            ? removeSolutionFromInstances({ instances: block.elements })
            : [],
      })),
    }
  }

  if (quiz?.status === DB.PublicationStatus.PUBLISHED) {
    return quizWithoutSolutions
      ? {
          ...quizWithoutSolutions,
          isPartOfGamifiedCourse: !!quiz.course?.isGamificationEnabled,
        }
      : {
          ...quiz,
          isPartOfGamifiedCourse: !!quiz.course?.isGamificationEnabled,
          beforeFirstBlock,
        }
  }

  return null
}

export async function validateAvailableLiveQuiz(
  { quizId, courseId }: { quizId: string; courseId: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      status: DB.PublicationStatus.PUBLISHED,
      courseId,
    },
  })

  return !!quiz
}

export async function getCourseRunningLiveQuizzes(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      liveQuizzes: {
        where: {
          status: DB.PublicationStatus.PUBLISHED,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return course?.liveQuizzes ?? []
}

export async function getLiveQuizLeaderboard(
  { quizId, hmac }: { quizId: string; hmac?: string | null },
  ctx: Context
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      leaderboard: {
        include: { participant: true, sessionParticipation: true },
      },
      course: { select: { isGamificationEnabled: true } },
      temporaryLeaderboard: true,
      blocks: true,
    },
  })

  // if the quiz does not exist, return early
  if (!quiz) return []

  // if the quiz is not gamified, return null for the leaderboard
  if (!quiz.isGamificationEnabled) return null

  const participant =
    ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT
      ? await ctx.prisma.participant.findUnique({ where: { id: ctx.user.sub } })
      : null

  let participantProfilesVisible =
    (participant?.isProfilePublic ?? false) ||
    ctx.user?.role === DB.UserRole.TEMPORARY_PARTICIPANT ||
    ctx.user?.role === DB.UserRole.USER ||
    ctx.user?.role === DB.UserRole.ADMIN

  // if a valid hmac is passed, the participant profile is also visible
  if (typeof hmac === 'string' && hmac !== null && hmac !== '') {
    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
    hmacEncoder.update(quiz.namespace + quiz.id)
    const quizHmac = hmacEncoder.digest('hex')

    // evaluate whether the hashed quiz.namespace and quiz.id equals the hmac
    if (quizHmac === hmac) {
      participantProfilesVisible = true
    }
  }

  // find the order attribute of the last exectued block
  const executedBlockOrders = quiz?.blocks
    .filter((quizBlock) => quizBlock.status === DB.ElementBlockStatus.EXECUTED)
    .map((quizBlock) => Number(quizBlock.order))

  const lastBlockOrder =
    executedBlockOrders && executedBlockOrders.length > 0
      ? Math.max(...executedBlockOrders)
      : 0

  const preparedEntries =
    quiz?.leaderboard
      ?.flatMap((entry) => {
        // if the course is not gamified, the participation is always inactive and this check should be skipped
        if (
          quiz.course?.isGamificationEnabled &&
          !entry.sessionParticipation?.isActive
        )
          return []

        return {
          id: entry.id,
          participantId: entry.participant.id,
          username:
            entry.participant.isProfilePublic && participantProfilesVisible
              ? entry.participant.username
              : 'Anonymous',
          avatar:
            entry.participant.isProfilePublic && participantProfilesVisible
              ? entry.participant.avatar
              : null,
          score: entry.score,
          level: levelFromXp(entry.participant.xp),
          // isSelf: entry.participantId === ctx.user.sub,
          isTemporary: false,
          lastBlockOrder,
        }
      })
      .concat(
        quiz?.temporaryLeaderboard?.flatMap((entry) => {
          return {
            id: Math.floor(Math.random() * 1000000000), // generate a random large number for temporary leaderboard entries
            participantId: entry.id,
            username: participantProfilesVisible ? entry.username : 'Anonymous',
            avatar: participantProfilesVisible ? entry.avatar : null,
            score: entry.score,
            level: 1, // temporary leaderboard entries do not have a experience points
            // isSelf: entry.id === ctx.user.sub,
            isTemporary: true,
            lastBlockOrder,
          }
        }) ?? []
      ) ?? []

  const sortedEntries = sortBy(
    preparedEntries,
    [prop('score'), 'desc'],
    [prop('username'), 'asc']
  )

  const filteredEntries = sortedEntries.flatMap((entry, ix) => {
    return { ...entry, rank: ix + 1 }
  })

  return filteredEntries
}
// #endregion
