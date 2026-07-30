import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  ElementData,
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsOpen,
  HatchetHandlers,
  type ElementBlockInput,
  type ElementResultsChoices,
  type ElementResultsSelection,
  type ElementStackInput,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getCachedBlockResults,
  getInitialInstanceResults,
  levelFromXp,
  propagateActivityToElements,
  recomputeDerivedPermissions,
  signJWT,
  updateLiveQuizBlockResultsFromCache,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import generatePassword from 'generate-password'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import { min } from 'mathjs'
import schedule from 'node-schedule'
import { createHash, createHmac } from 'node:crypto'
import { omitBy, pick, prop, sortBy } from 'remeda'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { computeRanks } from '../lib/util.js'
import { getPermissionBooleans } from './activities.js'
import {
  applyRegularLiveQuizRewardPlan,
  calculateLiveQuizRewardPlan,
  hasSampleSolutionQuestion,
  loadRankAchievementRewards,
  shouldAwardRankAchievements,
  type LiveQuizRewardParticipant,
  type LiveQuizRewardPlan,
} from './liveQuizRewards.js'
import { sendTeamsNotification } from './notifications.js'
import { upsertDailyTimelineEntry } from './participants.js'
import { computeStackEvaluation } from './stacks.js'

// TODO: rework scheduling for serverless
const scheduledJobs: Record<string, any> = {}

const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

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

  // if the activity is part of an assessment course, the course assignment can only be modified by course admins / owners
  const isCourseAdminOwner = !!existingActivity?.course?._count.permissions
  if (
    existingActivity?.isAssessmentEnabled &&
    !isCourseAdminOwner &&
    (courseId === null || courseId !== existingActivity?.courseId)
  ) {
    throw new GraphQLError(
      'Assessment live quizzes can only be modified by course admins or owners'
    )
  }

  // check if a new pin code is required
  const requiresNewPin =
    pinProtection && // 1) pin protection is required (corresponding setting or assessment course)
    (!existingActivity || // 2.1) assign new pin on activity creation
      ((courseId || existingActivity.courseId) && // 2.2) assign new pin on course assignment change (course defined at least before or after)
        courseId !== existingActivity.courseId) ||
      (existingActivity && !existingActivity.courseId && !courseId)) // 2.3) assign new pin on pin setting change with no course assigned before and after edit

  // find a new pin code that is still available, if required
  let newPinCode: string | undefined | null = existingActivity?.pinCode
  if (requiresNewPin) {
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
    pointsMultiplier: Math.max(multiplier, 1),
    defaultPoints:
      typeof defaultPoints !== 'undefined' && defaultPoints !== null
        ? Math.max(defaultPoints, 0)
        : undefined,
    defaultCorrectPoints:
      typeof defaultCorrectPoints !== 'undefined' &&
      defaultCorrectPoints !== null
        ? Math.max(defaultCorrectPoints, 0)
        : undefined,
    maxBonusPoints:
      typeof maxBonusPoints !== 'undefined' && maxBonusPoints !== null
        ? Math.max(maxBonusPoints, 0)
        : undefined,
    timeToZeroBonus:
      typeof timeToZeroBonus !== 'undefined' && timeToZeroBonus !== null
        ? Math.max(timeToZeroBonus, 1)
        : undefined,
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
              pointsMultiplier: Math.max(multiplier, 1) * elementMultiplier,
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
    courseId: isCourseAdminOwner ? activity.course?.id : null, // only return course id if the user can access corresponding course overview
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

    // depending on the quiz assessment setting, select the corresponding redis instance
    const redis = quiz.isAssessmentEnabled
      ? ctx.redisAssessmentExec
      : ctx.redisExec

    switch (quiz.status) {
      case DB.PublicationStatus.PUBLISHED:
        return quiz

      case DB.PublicationStatus.DRAFT:
      case DB.PublicationStatus.SCHEDULED: {
        try {
          const pipeline = redis.pipeline()
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

        // remove the scheduled hatchet publication task, if it exists
        if (quiz.scheduledPublicationTaskId) {
          try {
            await ctx.hatchet.scheduled.delete(quiz.scheduledPublicationTaskId)
          } catch (error) {
            console.error(
              `Failed to delete scheduled task for live quiz ${id}:`,
              error
            )
          }
        }

        // generate a random pin code
        const startedLiveQuiz = await ctx.prisma.liveQuiz.update({
          where: { id },
          data: {
            status: DB.PublicationStatus.PUBLISHED,
            startedAt: new Date(),
            scheduledPublicationTaskId: null,
          },
        })

        await sendTeamsNotification({
          scope: 'graphql/startLiveQuiz',
          text: `START Live quiz ${quiz.name} with id ${quiz.id}.`,
        })

        return startedLiveQuiz
      }
    }
  } catch (error) {
    await sendTeamsNotification({
      scope: 'graphql/startLiveQuiz',
      text: `ERROR - failed to start live quiz: ${error}`,
    })
    throw error
  }
}

export async function scheduleLiveQuiz(
  { id, availableFrom }: { id: string; availableFrom?: Date | null },
  ctx: ContextWithUser
) {
  // if the live quiz starts in the future, change its status to scheduled, otherwise publish it
  if (availableFrom && dayjs(availableFrom).isAfter(dayjs())) {
    try {
      // schedule the task to publish the live quiz
      const scheduledTask = await ctx.tasks.publishScheduledLiveQuiz.schedule(
        availableFrom,
        { liveQuizId: id }
      )
      const taskId = scheduledTask.metadata.id

      // change the status of the live quiz to scheduled
      const updatedQuiz = await ctx.prisma.liveQuiz.update({
        where: { id, isDeleted: false },
        data: {
          availableFrom,
          status: DB.PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: taskId,
        },
      })

      ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
      return updatedQuiz
    } catch (error) {
      console.error('Error scheduling live quiz publication:', error)
      return null
    }
  } else {
    const startedLiveQuiz = await startLiveQuiz({ id }, ctx)
    return startedLiveQuiz
  }
}

export async function unpublishLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
  })

  if (!liveQuiz) {
    return null
  }

  // remove the scheduled hatchet publication task, if it exists
  if (liveQuiz.scheduledPublicationTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(liveQuiz.scheduledPublicationTaskId)
    } catch (error) {
      console.error(
        `Failed to delete scheduled task for live quiz ${id}:`,
        error
      )
    }
  }

  // reset the status of the live quiz to draft and remove the availableFrom date
  const updatedLiveQuiz = await ctx.prisma.liveQuiz.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: {
      availableFrom: null,
      status: DB.PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
  return updatedLiveQuiz
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

  // depending on the quiz assessment setting, select the corresponding redis instance
  const redis = liveQuiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

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
    const redisMulti = redis.pipeline()
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
                {
                  issuer: process.env.APP_ORIGIN_ASSESSMENT_API,
                  issuedAt: updatedQuiz.activeBlock?.startedAt ?? new Date(0),
                }
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
  const redisMulti = updatedQuiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec.pipeline()
    : ctx.redisExec.pipeline()

  updatedQuiz.activeBlock!.elements.forEach((instance) => {
    const elementData = instance.elementData

    const commonInfo = {
      namespace: updatedQuiz.namespace,
      startedAt: Number(new Date()),
      sessionBlockId: blockId,
      liveQuizId: updatedQuiz.id,
      courseId: updatedQuiz.courseId ?? '',
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
  let isAssessmentEnabled = false
  try {
    const res = await updateLiveQuizBlockResultsFromCache({
      quizId,
      blockId,
      prisma: ctx.prisma,
      redisExec: ctx.redisExec,
      redisAssessmentExec: ctx.redisAssessmentExec,
      updateResults: true,
      updateLeaderboards: true, // always update the leaderboard when a block is closed
    })

    // if the update was not successful, return false
    if (!res) return false

    const updatedQuiz = res.updatedQuiz
    const activeInstanceIds = res.activeInstanceIds
    isAssessmentEnabled = updatedQuiz.isAssessmentEnabled

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
      id: updatedQuiz.id,
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
      // select the correct redis cache for the live quiz depending on the assessment flag
      const redis = updatedQuiz.isAssessmentEnabled
        ? ctx.redisAssessmentExec.pipeline()
        : ctx.redisExec.pipeline()

      // add the blockClosedAt timestamp to the instance info cache
      for (const instanceId of activeInstanceIds) {
        redis.hset(
          `lq:${updatedQuiz.id}:i:${instanceId}:info`,
          'blockClosedAt',
          Number(updatedBlock.closedAt)
        )
      }
      await redis.exec()
    }
  } catch (error: any) {
    await sendTeamsNotification({
      scope: 'graphql/deactivateLiveQuizBlock',
      text: `ERROR - failed to deactivate block ${blockId} in live quiz ${
        quizId
      } with active block ${blockId}: ${error?.message || error}`,
    })

    throw error
  }

  try {
    // schedule another aggregation event through hatchet that runs 5 minutes after block closure
    // -> heuristic: by then, all submissions should have been processed and the aggregated results on the instance should be final
    if (isAssessmentEnabled) {
      await ctx.tasks.aggregateLiveQuizBlockResultsAssessment.schedule(
        dayjs().add(5, 'minute').toDate(),
        { liveQuizId: quizId, blockId }
      )
    } else {
      await ctx.tasks.aggregateLiveQuizBlockResultsStandard.schedule(
        dayjs().add(5, 'minute').toDate(),
        { liveQuizId: quizId, blockId }
      )
    }
  } catch (error) {
    console.error(
      `Failed to schedule aggregation task for closed block ${blockId} in live quiz ${quizId}:`,
      error
    )
  }

  return true
}

async function removeCacheEntriesBlock({
  liveQuizId,
  blockId,
  block,
  isLastBlock,
  redis,
}: {
  liveQuizId: string
  blockId: number
  block: DB.ElementBlock & { elements: DB.ElementInstance[] }
  isLastBlock: boolean
  redis: Redis
}) {
  if (isLastBlock) {
    // if the last block was closed, clean up the entire cache for this live quiz
    const keys = await redis.keys(`lq:${liveQuizId}:*`)
    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        // set an expiration time of 1 day to all hash sets of the live quiz
        pipe.expire(key, 60 * 60 * 24)
      }
      await pipe.exec()
    }
  } else {
    // only remove information from the cache that is specific to the closed block and the instances therein
    const instanceIds = block.elements.map((instance) => instance.id)
    const instanceKeysNested = await Promise.all(
      instanceIds.map(
        async (id) => await redis.keys(`lq:${liveQuizId}:i:${id}:*`)
      )
    )
    const instanceKeys = instanceKeysNested.flat()
    const blockKeys = await redis.keys(`lq:${liveQuizId}:b:${blockId}:*`)
    const keys = [...instanceKeys, ...blockKeys]

    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        // set an expiration time of 1 day to all hash sets of the live quiz
        pipe.expire(key, 60 * 60 * 24)
      }
      await pipe.exec()
    }
  }
}

function aggregateLiveQuizResponses({
  responses,
  elementData,
}: {
  responses: DB.LiveQuizResponse[]
  elementData: ElementData
}): ElementInstanceResults {
  switch (elementData.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsChoices
      return responses.reduce<ElementResultsChoices>((acc, submission) => {
        if (!submission.response || !('choices' in submission.response))
          return acc

        acc.total += 1
        submission.response.choices.forEach((choice) => {
          if (choice.selected && choice.ix in acc.choices) {
            acc.choices[choice.ix] = (acc.choices[choice.ix] ?? 0) + 1
          }
        })

        return acc
      }, initialResults)
    }
    case DB.ElementType.NUMERICAL: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!submission.response || !('value' in submission.response))
          return acc

        const cleanResponseValue = parseFloat(String(submission.response.value))
        if (!isNaN(cleanResponseValue)) {
          const MD5 = createHash('md5')
          MD5.update(String(cleanResponseValue))
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: String(cleanResponseValue),
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === DB.ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case DB.ElementType.FREE_TEXT: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsOpen

      return responses.reduce<ElementResultsOpen>((acc, submission) => {
        if (!submission.response || !('value' in submission.response))
          return acc

        const cleanResponseValue = submission.response.value.trim()
        if (cleanResponseValue.length > 0) {
          const MD5 = createHash('md5')
          MD5.update(cleanResponseValue)
          const responseHash = MD5.digest('hex')
          if (responseHash in acc.responses) {
            acc.responses[responseHash]!.count += 1
          } else {
            acc.responses[responseHash] = {
              value: cleanResponseValue,
              count: 1,
              correct: elementData.options.hasSampleSolution
                ? submission.correctness === DB.ResponseCorrectness.CORRECT
                : undefined,
            }
          }

          acc.total += 1
        }

        return acc
      }, initialResults)
    }
    case DB.ElementType.SELECTION: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsSelection

      return responses.reduce<ElementResultsSelection>((acc, submission) => {
        if (!submission.response || !('selection' in submission.response))
          return acc

        submission.response.selection
          .filter((ix) => ix !== -1 && typeof ix !== 'undefined' && ix !== null)
          .forEach((ix) => {
            if (ix in acc.selections) {
              acc.selections[ix] = (acc.selections[ix] ?? 0) + 1
            }
          })

        acc.total += 1
        return acc
      }, initialResults)
    }
    case DB.ElementType.CASE_STUDY: {
      const initialResults = getInitialInstanceResults(
        elementData
      ) as ElementResultsCaseStudy

      return responses.reduce<ElementResultsCaseStudy>((acc, submission) => {
        if (!submission.response || !('assessment' in submission.response))
          return acc

        Object.entries(submission.response.assessment).forEach(
          ([caseId, itemResponses]) => {
            Object.entries(itemResponses).forEach(
              ([itemId, criterionResponses]) => {
                Object.entries(criterionResponses).forEach(
                  ([criterionId, criterionResponse]) => {
                    if (
                      criterionResponse === null ||
                      typeof criterionResponse !== 'number' ||
                      typeof acc.assessments[caseId]?.[itemId]?.[
                        criterionId
                      ] === 'undefined'
                    ) {
                      return acc
                    }

                    // compute the hash of the response
                    const MD5 = createHash('md5')
                    MD5.update(String(criterionResponse))
                    const responseHash = MD5.digest('hex')

                    // if the response already exists, increment the counter, otherwise create a new entry
                    if (
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ]
                    ) {
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ]!.count += 1
                    } else {
                      acc.assessments[caseId]![itemId]![criterionId]![
                        responseHash
                      ] = {
                        value: criterionResponse,
                        count: 1,
                      }
                    }
                  }
                )
              }
            )
          }
        )

        acc.total += 1
        return acc
      }, initialResults)
    }
    case DB.ElementType.CONTENT: {
      return { total: responses.length }
    }
    default:
      return { total: 0 }
  }
}

type LiveQuizForEnding = DB.Prisma.LiveQuizGetPayload<{
  include: {
    course: true
    blocks: { include: { elements: true } }
  }
}>

const MIN_PRISMA_INT = -2147483648
const MAX_PRISMA_INT = 2147483647

function invalidLiveQuizRewardData(message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'LIVE_QUIZ_REWARD_DATA_INVALID' },
  })
}

function parseCanonicalRewardInteger(value: string, dataName: string) {
  if (!/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(value)) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} reward data`)
  }

  const parsedValue = Number(value)
  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < MIN_PRISMA_INT ||
    parsedValue > MAX_PRISMA_INT
  ) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} reward data`)
  }

  return parsedValue
}

function parseRedisHashResult(result: unknown, dataName: string) {
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    result[0] !== null ||
    typeof result[1] !== 'object' ||
    result[1] === null ||
    Array.isArray(result[1]) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(result[1])) ||
    !Object.values(result[1]).every((value) => typeof value === 'string')
  ) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} snapshot`)
  }

  return result[1] as Record<string, string>
}

async function snapshotRegularLiveQuizRewards({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<Map<string, { score?: number; xp?: number }>> {
  const snapshot = redis.multi()
  snapshot.hgetall(`lq:${liveQuizId}:lb`)
  snapshot.hgetall(`lq:${liveQuizId}:xp`)
  const snapshotResult = await snapshot.exec()

  if (!Array.isArray(snapshotResult) || snapshotResult.length !== 2) {
    throw invalidLiveQuizRewardData('Invalid live quiz reward snapshot')
  }

  const quizLeaderboard = parseRedisHashResult(snapshotResult[0], 'leaderboard')
  const quizXp = parseRedisHashResult(snapshotResult[1], 'XP')
  const cachedRewards = new Map<string, { score?: number; xp?: number }>()

  for (const [participantId, value] of Object.entries(quizXp)) {
    const xp = parseCanonicalRewardInteger(value, 'XP')
    cachedRewards.set(participantId, { xp })
  }

  for (const [participantId, value] of Object.entries(quizLeaderboard)) {
    const score = parseCanonicalRewardInteger(value, 'leaderboard')
    cachedRewards.set(participantId, {
      ...cachedRewards.get(participantId),
      score,
    })
  }

  return cachedRewards
}

async function loadRegularLiveQuizRewardParticipants({
  liveQuiz,
  cachedRewards,
  tx,
}: {
  liveQuiz: LiveQuizForEnding
  cachedRewards: Map<string, { score?: number; xp?: number }>
  tx: DB.Prisma.TransactionClient
}): Promise<LiveQuizRewardParticipant[]> {
  const participantIds = Array.from(cachedRewards.keys())
  if (participantIds.length === 0) {
    return []
  }

  const participationsQuery: Promise<
    { id: number; isActive: boolean; participantId: string }[]
  > = liveQuiz.courseId
    ? tx.participation.findMany({
        where: {
          courseId: liveQuiz.courseId,
          participantId: { in: participantIds },
        },
        select: { id: true, isActive: true, participantId: true },
      })
    : Promise.resolve([])
  const [participants, participations] = await Promise.all([
    tx.participant.findMany({
      where: { id: { in: participantIds } },
      select: { id: true },
    }),
    participationsQuery,
  ])
  const existingParticipantIds = new Set(
    participants.map((participant) => participant.id)
  )
  const participationByParticipantId = new Map(
    participations.map((participation) => [
      participation.participantId,
      participation,
    ])
  )

  return Array.from(cachedRewards.entries()).flatMap(
    ([participantId, { score, xp }]) => {
      if (!existingParticipantIds.has(participantId)) {
        return []
      }

      const participation = participationByParticipantId.get(participantId)
      return [
        {
          participantId,
          participationId: participation?.id ?? null,
          courseId: liveQuiz.courseId,
          hasActiveParticipation: participation?.isActive ?? false,
          isCourseGamificationEnabled:
            liveQuiz.course?.isGamificationEnabled ?? false,
          score,
          xp,
        },
      ]
    }
  )
}

async function endRegularLiveQuiz(
  liveQuiz: LiveQuizForEnding,
  ctx: ContextWithUser
) {
  const endedAt = new Date()
  const cachedRewards = await snapshotRegularLiveQuizRewards({
    liveQuizId: liveQuiz.id,
    redis: ctx.redisExec,
  })

  try {
    return await ctx.prisma.$transaction(
      async (tx) => {
        const transitioned = await tx.liveQuiz.updateMany({
          where: {
            id: liveQuiz.id,
            status: DB.PublicationStatus.PUBLISHED,
            activeRewardRunId: null,
            rewardRuns: {
              none: { status: DB.LiveQuizRewardRunStatus.APPLIED },
            },
          },
          data: {
            status: DB.PublicationStatus.ENDED,
            finishedAt: endedAt,
          },
        })

        if (transitioned.count !== 1) {
          throw new GraphQLError('Live quiz could not transition to ended', {
            extensions: { code: 'LIVE_QUIZ_END_CONFLICT' },
          })
        }

        const authoritativeLiveQuiz = await tx.liveQuiz.findUniqueOrThrow({
          where: { id: liveQuiz.id },
          include: {
            course: true,
            blocks: {
              include: { elements: { orderBy: { order: 'asc' } } },
              orderBy: { id: 'asc' },
            },
          },
        })
        let plan: LiveQuizRewardPlan

        if (authoritativeLiveQuiz.isGamificationEnabled) {
          const participants = await loadRegularLiveQuizRewardParticipants({
            liveQuiz: authoritativeLiveQuiz,
            cachedRewards,
            tx,
          })
          const achievements = await loadRankAchievementRewards(tx)
          plan = calculateLiveQuizRewardPlan({
            participants,
            achievements,
            awardAchievements: shouldAwardRankAchievements({
              hasSampleSolution: hasSampleSolutionQuestion(
                authoritativeLiveQuiz.blocks
              ),
              participants,
            }),
            endedAt,
          })
        } else {
          plan = {
            endedAt,
            isLegacyReconstructed: false,
            entries: [],
          }
        }

        await tx.temporaryLeaderboardEntry.deleteMany({
          where: {
            quizId: liveQuiz.id,
            score: 0,
            createdAt: {
              equals: tx.temporaryLeaderboardEntry.fields.updatedAt,
            },
          },
        })

        await applyRegularLiveQuizRewardPlan({
          liveQuizId: liveQuiz.id,
          plan,
          tx,
        })

        return {
          liveQuiz: await tx.liveQuiz.findUniqueOrThrow({
            where: { id: liveQuiz.id },
          }),
          didTransition: true,
        }
      },
      {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60000,
      }
    )
  } catch (error) {
    const isTransitionConflict =
      error instanceof GraphQLError &&
      error.extensions.code === 'LIVE_QUIZ_END_CONFLICT'
    const isSerializableConflict =
      error instanceof DB.Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'

    if (!isTransitionConflict && !isSerializableConflict) {
      throw error
    }

    const endedLiveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: { id: liveQuiz.id },
      include: {
        activeRewardRun: {
          select: { liveQuizId: true, status: true },
        },
      },
    })

    if (
      endedLiveQuiz?.status === DB.PublicationStatus.ENDED &&
      endedLiveQuiz.activeRewardRun?.liveQuizId === liveQuiz.id &&
      endedLiveQuiz.activeRewardRun.status ===
        DB.LiveQuizRewardRunStatus.APPLIED
    ) {
      return { liveQuiz: endedLiveQuiz, didTransition: false }
    }

    if (isSerializableConflict) {
      throw new GraphQLError('Live quiz could not transition to ended', {
        extensions: { code: 'LIVE_QUIZ_END_CONFLICT' },
      })
    }

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

  if (!quiz.isAssessmentEnabled) {
    try {
      const { liveQuiz: endedLiveQuiz, didTransition } =
        await endRegularLiveQuiz(quiz, ctx)

      if (didTransition) {
        await sendTeamsNotification({
          scope: 'graphql/endLiveQuiz',
          text: `END Live quiz ${quiz.name} with id ${quiz.id}.`,
        })
      }

      return endedLiveQuiz
    } catch (error) {
      await sendTeamsNotification({
        scope: 'graphql/endLiveQuiz',
        text: `ERROR - failed to end live quiz ${quiz.name} with id ${quiz.id}: ${error}`,
      })
      throw error
    }
  }

  // depending on the quiz assessment setting, select the corresponding redis instance
  const redis = quiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

  // update course leaderboard and participant XP
  try {
    const quizLB = await redis.hgetall(`lq:${id}:lb`)
    const quizXP = await redis.hgetall(`lq:${id}:xp`)
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

    const endedLiveQuiz = await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        status: DB.PublicationStatus.ENDED,
        finishedAt: new Date(),
      },
    })

    await sendTeamsNotification({
      scope: 'graphql/endLiveQuiz',
      text: `END Live quiz ${quiz.name} with id ${quiz.id}.`,
    })

    return endedLiveQuiz
  } catch (error) {
    await sendTeamsNotification({
      scope: 'graphql/endLiveQuiz',
      text: `ERROR - failed to end live quiz ${quiz.name} with id ${quiz.id}: ${error}`,
    })
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

  // depending on the quiz assessment setting, select the corresponding redis instance
  const redis = liveQuiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

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
      redisExec: redis,
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
          where: { id: instance.id },
          data: { results: initialResults, anonymousResults: initialResults },
        })
      }),
    ])

    // depending on the quiz assessment setting, select the corresponding redis instance
    const redis = quiz.isAssessmentEnabled
      ? ctx.redisAssessmentExec
      : ctx.redisExec

    // unlink all cache keys from the redis cache
    const keys = await redis.keys(`lq:${id}:*`)
    const pipe = redis.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    await sendTeamsNotification({
      scope: 'graphql/abortLiveQuiz',
      text: `CANCEL Live quiz ${quiz.name} with id ${quiz.id}.`,
    })

    return updatedQuiz
  } catch (error) {
    await sendTeamsNotification({
      scope: 'graphql/abortLiveQuiz',
      text: `ERROR - failed to cancel live quiz ${quiz.name} with id ${quiz.id}: ${error}`,
    })
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

  // depending on the quiz assessment setting, select the corresponding redis instance
  const redis = liveQuiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

  // load results from active block as well
  let activeBlockWithResults:
    | (DB.ElementBlock & { elements: DB.ElementInstance[] })
    | undefined
  if (liveQuiz.activeBlockId && liveQuiz.activeBlock) {
    const cachedResults = await getCachedBlockResults({
      redisExec: redis,
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
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    pinCode: liveQuiz.pinCode,
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

        // remove the scheduled hatchet publication task, if it exists
        if (
          quiz.status === DB.PublicationStatus.SCHEDULED &&
          quiz.scheduledPublicationTaskId
        ) {
          try {
            await ctx.hatchet.scheduled.delete(quiz.scheduledPublicationTaskId)
          } catch (error) {
            console.error(
              `Failed to delete scheduled task for live quiz ${id}:`,
              error
            )
          }
        }

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

export async function resetAssessmentLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // the live quiz that should be reset must be an ended assessment quiz
  // the user that is resetting the quiz must be an admin or owner of the corresponding assessment course
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      isAssessmentEnabled: true,
      status: DB.PublicationStatus.ENDED,
      course: {
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
    await ctx.hatchet.events.push('create-audit-log-entry', {
      info: `[INFO] [Reset Assessment Live Quiz] Assessment course admin with ID ${ctx.user.sub} initiated reset of live quiz with ID ${id}.`,
    })

    // loop through the blocks and element instances and document the number of deducted points
    for (const block of liveQuiz.blocks) {
      for (const instance of block.elements) {
        await Promise.all(
          instance.liveQuizResponses.map(async (response) => {
            await ctx.hatchet.events.push('create-audit-log-entry', {
              info: `[INFO] [Reset Assessment Live Quiz] Deducted ${response.basePoints} base points, ${response.correctnessPoints} correctness points, and ${response.bonusPoints} bonus points from participant with ID ${response.participantId} for element instance with ID ${instance.id} in block with ID ${block.id} in live quiz with ID ${id}.`,
            })
          })
        )
      }
    }

    // update the live quiz (reset it to draft status, remove all responses, reset results)
    const updatedQuiz = await ctx.prisma.$transaction(
      async (tx) => {
        // reset the live quiz
        const updatedLiveQuiz = await tx.liveQuiz.update({
          where: { id },
          data: {
            status: DB.PublicationStatus.DRAFT,
            startedAt: null,
            finishedAt: null,
            feedbacks: { deleteMany: {} },
            confusionFeedbacks: { deleteMany: {} },
            leaderboard: { deleteMany: {} },
            temporaryLeaderboard: { deleteMany: {} }, // should not be set for assessment live quizzes
          },
          include: {
            course: true,
            permissions: {
              where: { userId: ctx.user.sub },
              include: { directPermission: true },
            },
            _count: { select: { permissions: true } },
          },
        })

        // reset all blocks and the contained element instances
        for (const block of liveQuiz.blocks) {
          // reset the block status
          await tx.elementBlock.update({
            where: { id: block.id },
            data: {
              status: DB.ElementBlockStatus.SCHEDULED,
              startedAt: null,
              closedAt: null,
              expiresAt: null,
              execution: { increment: 1 },
            },
          })

          // reset all instances with their results and delete the responses
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

        return updatedLiveQuiz
      },
      { timeout: 60000 }
    )

    await ctx.hatchet.events.push('create-audit-log-entry', {
      info: `[INFO] [Reset Assessment Live Quiz] Successfully reset assessment live quiz with ID ${id}.`,
    })

    ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
    const permission = updatedQuiz.permissions[0]!

    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permissionLevel: permission.permissionLevel,
      derived: permission.derived,
      directGroupPermission:
        permission.directPermission &&
        permission.directPermission.userGroupId !== null,
    })

    // reset all cache entries for the live quiz that potentially remain (due to pending block aggregations)
    // remaining pending aggregation tasks will automatically be aborted, since they are only executed for published or ended live quizzes
    const redis = liveQuiz.isAssessmentEnabled
      ? ctx.redisAssessmentExec
      : ctx.redisExec
    const keys = await redis.keys(`lq:${liveQuiz.id}:*`)
    if (keys.length > 0) {
      const pipe = redis.pipeline()
      for (const key of keys) {
        pipe.unlink(key)
      }
      await pipe.exec()
    }

    return {
      id: updatedQuiz.id,
      templateId: null,
      name: updatedQuiz.name,
      displayName: updatedQuiz.displayName,
      reviewStatus: updatedQuiz.reviewStatus,
      isGamificationEnabled: updatedQuiz.isGamificationEnabled,
      isAssessmentEnabled: updatedQuiz.isAssessmentEnabled,
      type: ActivityType.LIVE_QUIZ,
      status: updatedQuiz.status,
      courseId: updatedQuiz.course!.id,
      courseName: updatedQuiz.course!.name,
      courseStartDate: updatedQuiz.course!.startDate,
      courseLanguage: updatedQuiz.course!.language,
      numOfStacks: liveQuiz.blocks.length,
      numOfElements: liveQuiz.blocks.reduce(
        (acc, block) => acc + block.elements.length,
        0
      ),
      permissionLevel: permission.permissionLevel,
      derivedAccess: permission.derived,
      areInstancesOutdated: updatedQuiz.areInstancesOutdated,
      numSharedUsers: updatedQuiz._count.permissions - 1,
      pinCode: updatedQuiz.pinCode,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      isActivityReviewer: true, // requirement for this action
      sharingType,
      updatedAt: updatedQuiz.updatedAt,
    }
  } catch (error) {
    await ctx.hatchet.events.push('create-audit-log-entry', {
      info: `[ERROR] [Reset Assessment Live Quiz] Failed to reset live quiz with ID ${id}: ${error}`,
    })

    return null
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
  const quizInfo = await ctx.prisma.liveQuiz.findUnique({ where: { id } })

  // if the quiz is not available, return early
  if (!quizInfo || quizInfo.status !== DB.PublicationStatus.PUBLISHED) {
    return null
  }

  // if the live quiz is an assessment live quiz, verify that the user
  // is logged in and a participant in the corresponding course
  if (quizInfo.isAssessmentEnabled) {
    // if the user is not logged in, send them to the the assessment login page
    if (
      !ctx.user?.sub ||
      ctx.user.role !== DB.UserRole.PARTICIPANT ||
      ctx.user.scope !== DB.UserLoginScope.EDUID
    ) {
      throw new GraphQLError('UNAUTHORIZED_ASSESSMENT', {
        extensions: { code: 'FORBIDDEN' },
      })
    }

    // if the user is logged in as an eduid participant, but not part of the course, return an error
    // -> frontend should redirect to the assessment home page
    if (quizInfo.courseId) {
      const participation = await ctx.prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: quizInfo.courseId,
            participantId: ctx.user.sub,
          },
        },
      })

      if (!participation) {
        throw new GraphQLError('MISSING_ASSESSMENT_COURSE_PARTICIPATION', {
          extensions: { code: 'FORBIDDEN' },
        })
      }
    }
  }

  // if a pin code is required, verify that the user has already entered a valid one
  if (quizInfo.pinCode) {
    const cookieName = `live-quiz-pin-${id}`
    const providedPin = ctx.req.cookies?.[cookieName]

    if (!providedPin) {
      throw new GraphQLError(
        quizInfo.isAssessmentEnabled
          ? 'LIVE_QUIZ_PIN_MISSING_ASSESSMENT'
          : 'LIVE_QUIZ_PIN_MISSING',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      )
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
          {
            issuer: process.env.APP_ORIGIN_ASSESSMENT_API,
            issuedAt: quiz.activeBlock?.startedAt ?? new Date(0),
          }
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

  return computeRanks(sortedEntries)
}
// #endregion

// ------ HATCHET SCHEDULED TASK HANDLER ------
// #region
export const handlePublishScheduledLiveQuiz: HatchetHandlers['handlePublishScheduledLiveQuiz'] =
  async ({ liveQuizId }, globalCtx, executionCtx) => {
    executionCtx.logger.info(
      `Publishing scheduled live quiz with ID ${liveQuizId}`
    )

    try {
      // check if the live quiz exists and if its availableFrom date is in the past
      const liveQuiz = await globalCtx.prisma.liveQuiz.findUnique({
        where: {
          id: liveQuizId,
          isDeleted: false,
          status: DB.PublicationStatus.SCHEDULED,
          availableFrom: { lte: new Date() },
        },
      })

      if (!liveQuiz) {
        await sendTeamsNotification({
          scope: 'hatchet/live-quiz-start',
          text: `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`
        )
      }

      // depending on the quiz assessment setting, select the corresponding redis instance
      const redis = liveQuiz.isAssessmentEnabled
        ? globalCtx.redisAssessmentExec
        : globalCtx.redisExec

      // start the live quiz
      await redis
        .pipeline()
        .hmset(`lq:${liveQuiz.id}:meta`, {
          namespace: liveQuiz.namespace,
          startedAt: Number(new Date()),
        })
        .exec()

      const startedLiveQuiz = await globalCtx.prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: {
          status: DB.PublicationStatus.PUBLISHED,
          startedAt: new Date(),
        },
      })

      await sendTeamsNotification({
        scope: 'hatchet/live-quiz-start',
        text: `START Live quiz ${startedLiveQuiz.name} with id ${startedLiveQuiz.id}.`,
      })

      // invalidate the cache for the live quiz
      globalCtx.emitter.emit('invalidate', {
        typename: 'LiveQuiz',
        id: startedLiveQuiz.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled live quiz:', error)
      await sendTeamsNotification({
        scope: 'hatchet/live-quiz-start',
        text: `Error publishing live quiz with ID ${liveQuizId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }

export const handleStandardLiveQuizBlockClosureAggregation: HatchetHandlers['handleStandardLiveQuizBlockClosureAggregation'] =
  async ({ liveQuizId, blockId }, globalCtx, executionCtx) => {
    executionCtx.logger.info(
      `Aggregating results for standard live quiz with ID ${liveQuizId} and block ID ${blockId}`
    )

    // verify that the live quiz is still running or ended (-> results of aborted live quizzes should not be updated)
    const quiz = await globalCtx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        status: {
          in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
        },
      },
      include: {
        blocks: { include: { elements: true }, orderBy: { order: 'asc' } },
      },
    })
    if (!quiz) return true
    if (quiz.blocks.length === 0) return false

    // check if the block that was closed is the last one of the quiz
    const isLastBlock = quiz.blocks[quiz.blocks.length - 1]!.id === blockId
    const block = quiz.blocks.find((b) => b.id === blockId)
    if (!block) return false

    // update the aggregated instance results based on the cache data after a waiting period for processing remaining submissions
    await updateLiveQuizBlockResultsFromCache({
      quizId: liveQuizId,
      blockId,
      prisma: globalCtx.prisma,
      redisExec: globalCtx.redisExec,
      redisAssessmentExec: globalCtx.redisAssessmentExec,
      // update the instance results based on the cache data again with the latest information
      updateResults: true,
      // only update the leaderboard for the quiz, if this is the last block of the quiz
      // -> otherwise leaderboard updates at the block closures of other blocks might interfere with this update
      updateLeaderboards: isLastBlock,
    })

    // remove all cache entries related to this block only (or the entire live quiz, if this was the last block)
    await removeCacheEntriesBlock({
      liveQuizId,
      blockId,
      block,
      isLastBlock,
      redis: globalCtx.redisExec,
    })

    return true
  }

export const handleAssessmentLiveQuizBlockClosureAggregation: HatchetHandlers['handleAssessmentLiveQuizBlockClosureAggregation'] =
  async ({ liveQuizId, blockId }, globalCtx, executionCtx) => {
    executionCtx.logger.info(
      `Aggregating results for assessment live quiz with ID ${liveQuizId} and block ID ${blockId}`
    )

    // verify that the live quiz is still running or ended (-> results of aborted live quizzes should not be updated)
    const quiz = await globalCtx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        status: {
          in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
        },
      },
      include: {
        blocks: {
          include: { elements: { include: { liveQuizResponses: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!quiz) {
      executionCtx.logger.info(
        `No quiz found for ID ${liveQuizId} in status PUBLISHED or ENDED`
      )
      return true
    }

    if (quiz.blocks.length === 0) {
      executionCtx.logger.error(`Quiz with ID ${liveQuizId} has no blocks`)
      return false
    }

    // check if the block that was closed is the last one of the quiz
    const isLastBlock = quiz.blocks[quiz.blocks.length - 1]!.id === blockId
    const block = quiz.blocks.find((b) => b.id === blockId)
    if (!block) {
      executionCtx.logger.error(
        `No block found with ID ${blockId} in quiz with ID ${liveQuizId}`
      )
      return false
    }

    if (block.elements.length === 0) {
      executionCtx.logger.error(
        `Block with ID ${blockId} in quiz with ID ${liveQuizId} has no elements`
      )
      return false
    }

    if (block.elements.every((el) => el.liveQuizResponses.length === 0)) {
      executionCtx.logger.info(
        `No responses found for any element in block with ID ${blockId} in quiz with ID ${liveQuizId}`
      )

      try {
        // remove all cache entries related to this block only (or the entire live quiz, if this was the last block)
        await removeCacheEntriesBlock({
          liveQuizId,
          blockId,
          block,
          isLastBlock,
          redis: globalCtx.redisAssessmentExec,
        })
      } catch (error) {
        executionCtx.logger.error(
          `Error removing cache entries for block with ID ${blockId} in quiz with ID ${liveQuizId}: ${error}`
        )
      }

      return true
    }

    // results are aggregated based on db data, only update the leaderboard if this is the last block
    if (isLastBlock && quiz.isGamificationEnabled) {
      executionCtx.logger.info(
        `Updating leaderboard in gamified live quiz with ID ${liveQuizId}`
      )

      await updateLiveQuizBlockResultsFromCache({
        quizId: liveQuizId,
        blockId,
        prisma: globalCtx.prisma,
        redisExec: globalCtx.redisExec,
        redisAssessmentExec: globalCtx.redisAssessmentExec,
        updateResults: false,
        updateLeaderboards: true,
      })
    }

    try {
      // update the instance results based on the live quiz response entries
      await globalCtx.prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: {
          blocks: {
            update: {
              where: { id: blockId },
              data: {
                elements: {
                  update: block.elements.map((instance) => ({
                    where: { id: Number(instance.id) },
                    // update the anonymous results for regular live quizzes and the normal results for assessment live quizzes
                    data: {
                      anonymousResults: quiz.isAssessmentEnabled
                        ? undefined
                        : aggregateLiveQuizResponses({
                            responses: instance.liveQuizResponses,
                            elementData: instance.elementData,
                          }),
                      results: quiz.isAssessmentEnabled
                        ? aggregateLiveQuizResponses({
                            responses: instance.liveQuizResponses,
                            elementData: instance.elementData,
                          })
                        : undefined,
                    },
                  })),
                },
              },
            },
          },
        },
      })
    } catch (error) {
      executionCtx.logger.error(
        `Error updating instance results for block with ID ${blockId} in quiz with ID ${liveQuizId} based on live quiz responses: ${error}`
      )
    }

    try {
      // remove all cache entries related to this block only (or the entire live quiz, if this was the last block)
      await removeCacheEntriesBlock({
        liveQuizId,
        blockId,
        block,
        isLastBlock,
        redis: globalCtx.redisAssessmentExec,
      })
    } catch (error) {
      executionCtx.logger.error(
        `Error removing cache entries for block with ID ${blockId} in quiz with ID ${liveQuizId}: ${error}`
      )
    }

    executionCtx.logger.info(
      `Successfully conducted final results update for instances in block with ID ${blockId} in quiz with ID ${liveQuizId}`
    )

    return true
  }
// #endregion
