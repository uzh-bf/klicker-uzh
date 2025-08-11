import * as DB from '@klicker-uzh/prisma'
import { ActivityType, SharingType } from '@klicker-uzh/types'
import {
  PrismaTransactionClient,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { sortBy } from 'remeda'
import { ContextWithUser } from 'src/lib/context.js'
import { POINTS_PER_GROUP_ACTIVITY_ELEMENT } from './groups.js'
import { POINTS_PER_INSTANCE } from './stacks.js'

export async function getUserActivitiesCourses(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: {
          courseId: { not: null },
          course: { isArchived: false },
        },
        include: {
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
      },
    },
  })

  return (
    user?.objects
      .filter(
        (object) =>
          object.course!._count.liveQuizzes > 0 ||
          object.course!._count.practiceQuizzes > 0 ||
          object.course!._count.microLearnings > 0 ||
          object.course!._count.groupActivities > 0
      )
      .map((object) => ({
        id: object.courseId!,
        name: object.course!.name,
      })) ?? []
  )
}

export function getPermissionBooleans({
  permissionLevel,
  derived,
  directGroupPermission,
}) {
  return {
    isOwner: permissionLevel === DB.PermissionLevel.OWNER,
    isManager:
      permissionLevel === DB.PermissionLevel.OWNER ||
      permissionLevel === DB.PermissionLevel.ADMIN,
    isEditor:
      permissionLevel === DB.PermissionLevel.OWNER ||
      permissionLevel === DB.PermissionLevel.ADMIN ||
      permissionLevel === DB.PermissionLevel.WRITE,
    isExecutor:
      permissionLevel === DB.PermissionLevel.EXECUTE ||
      permissionLevel === DB.PermissionLevel.WRITE ||
      permissionLevel === DB.PermissionLevel.ADMIN ||
      permissionLevel === DB.PermissionLevel.OWNER,
    isShared: permissionLevel !== DB.PermissionLevel.OWNER,
    isRemovable:
      permissionLevel !== DB.PermissionLevel.OWNER &&
      !derived &&
      !directGroupPermission,
    sharingType:
      permissionLevel === DB.PermissionLevel.OWNER
        ? SharingType.OWNED
        : derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED,
  }
}

export async function getUserActivities(
  {
    statusFilter,
    activityTypeFilter,
    courseId,
    withoutCourse,
    searchString,
    showOwned = true,
    showShared = true,
    showDependencies = true,
    numEntries,
    offset,
  }: {
    statusFilter?: DB.PublicationStatus[] | null
    activityTypeFilter?: ActivityType | null
    courseId?: string | null
    withoutCourse?: boolean | null
    searchString?: string | null
    showOwned?: boolean | null
    showShared?: boolean | null
    showDependencies?: boolean | null
    numEntries?: number | null
    offset?: number | null
  },
  ctx: ContextWithUser
) {
  // where clause needed for filtering the desired activities
  const activityFilteringClause = {
    // depending on the shared access flags, determine the required access levels
    permissionLevel:
      showOwned && showShared
        ? undefined
        : {
            in: [
              ...(showOwned ? [DB.PermissionLevel.OWNER] : []),
              ...(showShared
                ? [
                    DB.PermissionLevel.ADMIN,
                    DB.PermissionLevel.WRITE,
                    DB.PermissionLevel.EXECUTE,
                    DB.PermissionLevel.READ,
                  ]
                : []),
            ],
          },
    // chose whether to include objects that are available through derived access
    derived: showDependencies ? undefined : false,
    OR: [
      ...(!activityTypeFilter || activityTypeFilter === ActivityType.LIVE_QUIZ
        ? [
            {
              liveQuizId: { not: null },
              liveQuiz: {
                status:
                  statusFilter && statusFilter.length > 0
                    ? { in: statusFilter }
                    : undefined,
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
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                      {
                        displayName: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                    ]
                  : undefined,
              },
            },
          ]
        : []),
      ...(!withoutCourse &&
      (!activityTypeFilter || activityTypeFilter === ActivityType.PRACTICE_QUIZ)
        ? [
            {
              practiceQuizId: { not: null },
              practiceQuiz: {
                status:
                  statusFilter && statusFilter.length > 0
                    ? { in: statusFilter }
                    : undefined,
                courseId: courseId ?? undefined,
                OR: searchString
                  ? [
                      {
                        name: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                      {
                        displayName: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                    ]
                  : undefined,
              },
            },
          ]
        : []),
      ...(!withoutCourse &&
      (!activityTypeFilter ||
        activityTypeFilter === ActivityType.MICRO_LEARNING)
        ? [
            {
              microLearningId: { not: null },
              microLearning: {
                status:
                  statusFilter && statusFilter.length > 0
                    ? { in: statusFilter }
                    : undefined,
                courseId: courseId ?? undefined,
                OR: searchString
                  ? [
                      {
                        name: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                      {
                        displayName: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                    ]
                  : undefined,
              },
            },
          ]
        : []),
      ...(!withoutCourse &&
      (!activityTypeFilter ||
        activityTypeFilter === ActivityType.GROUP_ACTIVITY)
        ? [
            {
              groupActivityId: { not: null },
              groupActivity: {
                status:
                  statusFilter && statusFilter.length > 0
                    ? { in: statusFilter }
                    : undefined,
                courseId: courseId ?? undefined,
                OR: searchString
                  ? [
                      {
                        name: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                      {
                        displayName: {
                          contains: searchString,
                          mode: 'insensitive' as DB.Prisma.QueryMode,
                        },
                      },
                    ]
                  : undefined,
              },
            },
          ]
        : []),
    ],
  }

  // fetch all activities that are available to the user
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      _count: { select: { objects: { where: activityFilteringClause } } },
      objects: {
        where: activityFilteringClause,
        include: {
          directPermission: true,
          liveQuiz: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  language: true,
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
              templateInfo: { select: { id: true } },
              blocks: {
                include: { _count: { select: { elements: true } } },
                orderBy: { order: 'asc' },
              },
              _count: { select: { permissions: true } },
            },
          },
          practiceQuiz: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  language: true,
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
              templateInfo: { select: { id: true } },
              stacks: {
                include: { _count: { select: { elements: true } } },
                orderBy: { order: 'asc' },
              },
              _count: { select: { permissions: true } },
            },
          },
          microLearning: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  language: true,
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
              templateInfo: { select: { id: true } },
              stacks: {
                include: { _count: { select: { elements: true } } },
                orderBy: { order: 'asc' },
              },
              _count: { select: { permissions: true } },
            },
          },
          groupActivity: {
            include: {
              course: {
                include: {
                  _count: {
                    select: {
                      participantGroups: true,
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
              templateInfo: { select: { id: true } },
              stacks: {
                include: { _count: { select: { elements: true } } },
                orderBy: { order: 'asc' },
              },
              _count: { select: { permissions: true } },
            },
          },
        },
        take: numEntries ?? undefined,
        skip: offset ?? undefined,
      },
    },
  })

  if (!user) {
    return null
  }

  // map the activities to a unified format
  const activities = user.objects.flatMap((object) => {
    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permissionLevel: object.permissionLevel,
      derived: object.derived,
      directGroupPermission: object.directPermission?.userGroupId !== null,
    })

    if (object.liveQuiz) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.liveQuiz.isDeleted) {
        return []
      }

      return {
        id: object.liveQuiz.id,
        templateId: object.liveQuiz.templateInfo?.id ?? null,
        name: object.liveQuiz.name,
        displayName: object.liveQuiz.displayName,
        reviewStatus: object.liveQuiz.reviewStatus,
        type: ActivityType.LIVE_QUIZ,
        status: object.liveQuiz.status,
        courseId: object.liveQuiz.course?.id,
        courseName: object.liveQuiz.course?.name,
        courseLanguage: object.liveQuiz.course?.language,
        courseStartDate: object.liveQuiz.course?.startDate,
        numOfStacks: object.liveQuiz.blocks.length,
        numOfElements: object.liveQuiz.blocks.reduce(
          (acc, block) => acc + block._count.elements,
          0
        ),
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.liveQuiz.areInstancesOutdated,
        isGamificationEnabled: object.liveQuiz.isGamificationEnabled,
        isAssessmentEnabled: object.liveQuiz.isAssessmentEnabled,
        numSharedUsers: isManager
          ? object.liveQuiz._count.permissions - 1
          : undefined,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        isActivityReviewer:
          (object.liveQuiz.courseId === null &&
            (object.permissionLevel === DB.PermissionLevel.OWNER ||
              object.permissionLevel === DB.PermissionLevel.ADMIN)) ||
          (!!object.liveQuiz.course &&
            object.liveQuiz.course._count.permissions > 0),
        sharingType,
        updatedAt: object.liveQuiz.updatedAt,
      }
    } else if (object.practiceQuiz) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.practiceQuiz.isDeleted) {
        return []
      }

      return {
        id: object.practiceQuiz.id,
        templateId: object.practiceQuiz.templateInfo?.id ?? null,
        name: object.practiceQuiz.name,
        displayName: object.practiceQuiz.displayName,
        reviewStatus: object.practiceQuiz.reviewStatus,
        type: ActivityType.PRACTICE_QUIZ,
        status: object.practiceQuiz.status,
        courseId: object.practiceQuiz.course?.id,
        courseName: object.practiceQuiz.course?.name,
        courseLanguage: object.practiceQuiz.course?.language,
        courseStartDate: object.practiceQuiz.course?.startDate,
        numOfStacks: object.practiceQuiz.stacks.length,
        numOfElements: object.practiceQuiz.stacks.reduce(
          (acc, block) => acc + block._count.elements,
          0
        ),
        automaticPublicationAt: object.practiceQuiz.availableFrom,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.practiceQuiz.areInstancesOutdated,
        isGamificationEnabled: object.practiceQuiz.isGamificationEnabled,
        isAssessmentEnabled: object.practiceQuiz.isAssessmentEnabled,
        numSharedUsers: isManager
          ? object.practiceQuiz._count.permissions - 1
          : undefined,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        isActivityReviewer: object.practiceQuiz.course._count.permissions > 0,
        sharingType,
        updatedAt: object.practiceQuiz.updatedAt,
      }
    } else if (object.microLearning) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.microLearning.isDeleted) {
        return []
      }

      return {
        id: object.microLearning.id,
        templateId: object.microLearning.templateInfo?.id ?? null,
        name: object.microLearning.name,
        displayName: object.microLearning.displayName,
        reviewStatus: object.microLearning.reviewStatus,
        type: ActivityType.MICRO_LEARNING,
        status: object.microLearning.status,
        courseId: object.microLearning.course?.id,
        courseName: object.microLearning.course?.name,
        courseLanguage: object.microLearning.course?.language,
        courseStartDate: object.microLearning.course?.startDate,
        numOfStacks: object.microLearning.stacks.length,
        numOfElements: object.microLearning.stacks.reduce(
          (acc, block) => acc + block._count.elements,
          0
        ),
        scheduledStartAt: object.microLearning.scheduledStartAt,
        scheduledEndAt: object.microLearning.scheduledEndAt,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.microLearning.areInstancesOutdated,
        isGamificationEnabled: object.microLearning.isGamificationEnabled,
        isAssessmentEnabled: object.microLearning.isAssessmentEnabled,
        numSharedUsers: isManager
          ? object.microLearning._count.permissions - 1
          : undefined,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        isActivityReviewer: object.microLearning.course._count.permissions > 0,
        sharingType,
        updatedAt: object.microLearning.updatedAt,
      }
    } else if (object.groupActivity) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.groupActivity.isDeleted) {
        return []
      }

      return {
        id: object.groupActivity.id,
        templateId: object.groupActivity.templateInfo?.id ?? null,
        name: object.groupActivity.name,
        displayName: object.groupActivity.displayName,
        reviewStatus: object.groupActivity.reviewStatus,
        type: ActivityType.GROUP_ACTIVITY,
        status: object.groupActivity.status,
        courseId: object.groupActivity.course?.id,
        courseName: object.groupActivity.course?.name,
        courseLanguage: object.groupActivity.course?.language,
        courseStartDate: object.groupActivity.course?.startDate,
        numOfStacks: object.groupActivity.stacks.length,
        numOfElements: object.groupActivity.stacks.reduce(
          (acc, block) => acc + block._count.elements,
          0
        ),
        scheduledStartAt: object.groupActivity.scheduledStartAt,
        scheduledEndAt: object.groupActivity.scheduledEndAt,
        groupDeadlineDate: object.groupActivity.course.groupDeadlineDate,
        numOfParticipantGroups:
          object.groupActivity.course._count.participantGroups,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.groupActivity.areInstancesOutdated,
        isGamificationEnabled: object.groupActivity.isGamificationEnabled,
        isAssessmentEnabled: object.groupActivity.isAssessmentEnabled,
        numSharedUsers: isManager
          ? object.groupActivity._count.permissions - 1
          : undefined,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        isActivityReviewer: object.groupActivity.course._count.permissions > 0,
        sharingType,
        updatedAt: object.groupActivity.updatedAt,
      }
    }

    return []
  })

  // the activities should be ordered as follows:
  // 1) first by active vs inactive status (active: published, scheduled, draft, template; inactive: ended, graded)
  // 2) then by type: live quiz, microlearning, practice quiz, group activity
  // 3) then by status within the active/inactive groups
  // 4) then by start date / updated date
  const activityTypeOrder = {
    [ActivityType.LIVE_QUIZ]: 1,
    [ActivityType.MICRO_LEARNING]: 2,
    [ActivityType.PRACTICE_QUIZ]: 3,
    [ActivityType.GROUP_ACTIVITY]: 4,
  }

  const activityStatusOrder = {
    [DB.PublicationStatus.PUBLISHED]: 1,
    [DB.PublicationStatus.SCHEDULED]: 2,
    [DB.PublicationStatus.DRAFT]: 3,
    [DB.PublicationStatus.TEMPLATE]: 4,
    [DB.PublicationStatus.ENDED]: 2,
    [DB.PublicationStatus.GRADED]: 1,
  }

  // helper function to determine if a status is active or inactive
  const isActiveStatus = (status: DB.PublicationStatus): boolean => {
    return (
      status === DB.PublicationStatus.PUBLISHED ||
      status === DB.PublicationStatus.SCHEDULED ||
      status === DB.PublicationStatus.DRAFT ||
      status === DB.PublicationStatus.TEMPLATE
    )
  }

  return {
    numOfActivities: user._count.objects,
    activities: sortBy(
      activities,
      // first order by active/inactive (active first)
      (activity) => (isActiveStatus(activity.status) ? 0 : 1),
      // then order by activity type
      (activity) => activityTypeOrder[activity.type],
      // then order by status within each group
      (activity) => activityStatusOrder[activity.status] || 100,
      // then by scheduled start date or updated date
      (activity) => {
        if (activity.scheduledStartAt) {
          return -new Date(activity.scheduledStartAt).getTime()
        }
        return -new Date(activity.updatedAt).getTime()
      }
    ),
  }
}

async function updateInstanceMultipliers(
  {
    instances,
    newActivityMultiplier,
  }: { instances: DB.ElementInstance[]; newActivityMultiplier: number },
  prisma: PrismaTransactionClient
) {
  // compute new multipliers for each instance based on element multiplier and activity multiplier
  const instanceMultiplierMap = instances.reduce<{
    [instanceId: number]: number
  }>((acc, instance) => {
    acc[instance.id] =
      instance.elementData.pointsMultiplier * newActivityMultiplier
    return acc
  }, {})

  // store the new multiplier in the instance options
  await Promise.all(
    instances.map((instance) => {
      const newMultiplier = instanceMultiplierMap[instance.id]

      if (newMultiplier) {
        return prisma.elementInstance.update({
          where: { id: instance.id },
          data: {
            options: {
              ...instance.options,
              pointsMultiplier: newMultiplier,
            },
          },
        })
      }
    })
  )
}

export async function applyActivityBatchOperations(
  {
    activityIds,
    multiplier,
    courseId,
    basePoints,
    correctnessPoints,
    bonusPoints,
    timeToZeroBonus,
  }: {
    activityIds: string[]
    multiplier?: number | null
    courseId?: string | null
    basePoints?: number | null
    correctnessPoints?: number | null
    bonusPoints?: number | null
    timeToZeroBonus?: number | null
  },
  ctx: ContextWithUser
) {
  if (activityIds.length === 0) {
    return 0
  }

  // fetch the course to which the activities should be assigned, if defined
  const newCourse = courseId
    ? await ctx.prisma.course.findUnique({
        where: {
          id: courseId,
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionLevel: {
                in: [
                  DB.PermissionLevel.OWNER,
                  DB.PermissionLevel.ADMIN,
                  DB.PermissionLevel.WRITE,
                  DB.PermissionLevel.EXECUTE,
                  DB.PermissionLevel.READ,
                ],
              },
            },
          },
        },
      })
    : undefined

  // if the course does not exist or the multiplier should be changed despite
  // the course not being gamified / assessment-relevant, return early
  // skip if the courseId is undefined -> course not assigned and check is irrelevant
  if (
    courseId &&
    (!newCourse ||
      (typeof multiplier !== 'undefined' &&
        multiplier !== null &&
        !newCourse.isGamificationEnabled &&
        !newCourse.isAssessmentEnabled))
  ) {
    return 0
  }

  // at least write permissions on the activities are required
  const requiredPermissionLevels = [
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ]

  // only draft and scheduled activities can be updated
  const allowedActivityStatus = [
    DB.PublicationStatus.DRAFT,
    DB.PublicationStatus.SCHEDULED,
  ]

  // check if the live quiz grading logic should be manipulated
  const setLiveQuizPoints =
    typeof basePoints !== 'undefined' &&
    basePoints !== null &&
    typeof correctnessPoints !== 'undefined' &&
    correctnessPoints !== null &&
    typeof bonusPoints !== 'undefined' &&
    bonusPoints !== null &&
    typeof timeToZeroBonus !== 'undefined' &&
    timeToZeroBonus !== null

  // check if a new multiplier should be set (requires gamification or assessment flag)
  const setMultiplier = typeof multiplier !== 'undefined' && multiplier !== null

  // fetch all live quizzes that should be updated
  const liveQuizzes = await ctx.prisma.liveQuiz.findMany({
    where: {
      id: { in: activityIds },
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: { in: requiredPermissionLevels },
        },
      },
      status: { in: allowedActivityStatus },
      // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
      OR:
        setMultiplier && !newCourse
          ? [{ isGamificationEnabled: true }, { isAssessmentEnabled: true }]
          : undefined,
    },
    include: { blocks: { include: { elements: true } } },
  })

  // fetch all practice quizzes that should be updated
  const practiceQuizzes = !setLiveQuizPoints
    ? await ctx.prisma.practiceQuiz.findMany({
        where: {
          id: { in: activityIds },
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionLevel: { in: requiredPermissionLevels },
            },
          },
          status: { in: allowedActivityStatus },
          // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
          OR:
            setMultiplier && !newCourse
              ? [{ isGamificationEnabled: true }, { isAssessmentEnabled: true }]
              : undefined,
        },
        include: { stacks: { include: { elements: true } } },
      })
    : []

  // fetch all microlearnings that should be updated
  const microLearnings = !setLiveQuizPoints
    ? await ctx.prisma.microLearning.findMany({
        where: {
          id: { in: activityIds },
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionLevel: { in: requiredPermissionLevels },
            },
          },
          status: { in: allowedActivityStatus },
          // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
          OR:
            setMultiplier && !newCourse
              ? [{ isGamificationEnabled: true }, { isAssessmentEnabled: true }]
              : undefined,
          // if a new course is assigned, the entire availability interval of the activity should lie inside the course duration
          scheduledStartAt: newCourse
            ? { gte: newCourse.startDate }
            : undefined,
          scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
        },
        include: { stacks: { include: { elements: true } } },
      })
    : []

  // fetch all group activities that should be updated
  const groupActivities =
    !setLiveQuizPoints && (!newCourse || newCourse.isGroupCreationEnabled) // if the course is updated, group creation needs to be enabled
      ? await ctx.prisma.groupActivity.findMany({
          where: {
            id: { in: activityIds },
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionLevel: { in: requiredPermissionLevels },
              },
            },
            status: { in: allowedActivityStatus },
            // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
            OR:
              setMultiplier && !newCourse
                ? [
                    { isGamificationEnabled: true },
                    { isAssessmentEnabled: true },
                  ]
                : undefined,
            // if a new course is assigned, the group formation deadline should be before the start of the group activity
            // (start date of course does not need to be verified, since group formation deadline is always after start date)
            scheduledStartAt: newCourse
              ? { gte: newCourse.groupDeadlineDate }
              : undefined,
            // if a new course is assigned, the group activity should end before the end of the course
            scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
          },
          include: { stacks: { include: { elements: true } } },
        })
      : []

  // apply activity updates
  let updatedLiveQuizzes: string[] = []
  let updatedPracticeQuizzes: string[] = []
  let updatedMicroLearnings: string[] = []
  let updatedGroupActivities: string[] = []

  // update live quizzes (including gamification / assessment flags & all instances - depending on the required updates)
  for (const liveQuiz of liveQuizzes) {
    const updatedLiveQuiz = await ctx.prisma.$transaction(async (tx) => {
      const modifiedLiveQuiz = await tx.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: {
          // course re-assignment (including update of gamification and assessment flags)
          course: newCourse ? { connect: { id: newCourse.id } } : undefined,
          isGamificationEnabled: newCourse
            ? { set: newCourse.isGamificationEnabled }
            : undefined,
          isAssessmentEnabled: newCourse
            ? { set: newCourse.isAssessmentEnabled }
            : undefined,
          // multiplier updates
          pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
          // if defined, set custom grading logic components
          defaultPoints: setLiveQuizPoints ? { set: basePoints } : undefined,
          defaultCorrectPoints: setLiveQuizPoints
            ? { set: correctnessPoints }
            : undefined,
          maxBonusPoints: setLiveQuizPoints ? { set: bonusPoints } : undefined,
          timeToZeroBonus: setLiveQuizPoints
            ? { set: timeToZeroBonus }
            : undefined,
          // if set before, update the review status
          reviewStatus:
            liveQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
              ? { set: DB.ReviewStatus.MODIFIED_AFTER_REVIEW }
              : undefined,
        },
      })

      // if the multiplier was changed, update the instances of the live quiz accordingly
      if (setMultiplier) {
        // get all instances that have a pointsMultiplier defined
        const instances = liveQuiz.blocks
          .flatMap((block) => block.elements)
          .filter(
            (instance) =>
              'options' in instance &&
              instance.options &&
              'pointsMultiplier' in instance.options
          )

        await updateInstanceMultipliers(
          {
            instances,
            newActivityMultiplier: modifiedLiveQuiz.pointsMultiplier,
          },
          tx
        )
      }

      // if the course assignment was changed, update the derived pemissions on the quiz
      if (newCourse) {
        await recomputeDerivedPermissions(
          { liveQuizId: modifiedLiveQuiz.id },
          tx
        )
      }

      return modifiedLiveQuiz
    })

    updatedLiveQuizzes.push(updatedLiveQuiz.id)
  }

  if (!setLiveQuizPoints) {
    // update practice quizzes (including gamification / assessment flags & all instances - depending on the required updates)
    for (const practiceQuiz of practiceQuizzes) {
      const updatedPracticeQuiz = await ctx.prisma.$transaction(async (tx) => {
        const modifiedPracticeQuiz = await tx.practiceQuiz.update({
          where: { id: practiceQuiz.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: newCourse ? { connect: { id: newCourse.id } } : undefined,
            isGamificationEnabled: newCourse
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: newCourse
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              practiceQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
                ? { set: DB.ReviewStatus.MODIFIED_AFTER_REVIEW }
                : undefined,
          },
        })

        // if the multiplier was changed, update the instances of the practice quiz accordingly
        if (setMultiplier) {
          // get all instances that have a pointsMultiplier defined
          const instances = practiceQuiz.stacks
            .flatMap((stack) => stack.elements)
            .filter(
              (instance) =>
                'options' in instance &&
                instance.options &&
                'pointsMultiplier' in instance.options
            )

          await updateInstanceMultipliers(
            {
              instances,
              newActivityMultiplier: modifiedPracticeQuiz.pointsMultiplier,
            },
            tx
          )
        }

        // if the course assignment was changed, update the derived pemissions on the quiz
        if (newCourse) {
          await recomputeDerivedPermissions(
            { practiceQuizId: modifiedPracticeQuiz.id },
            tx
          )
        }

        return modifiedPracticeQuiz
      })

      updatedPracticeQuizzes.push(updatedPracticeQuiz.id)
    }

    // update microlearnings (including gamification / assessment flags & all instances - depending on the required updates)
    for (const microLearning of microLearnings) {
      const updatedMicroLearning = await ctx.prisma.$transaction(async (tx) => {
        const modifiedMicroLearning = await tx.microLearning.update({
          where: { id: microLearning.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: newCourse ? { connect: { id: newCourse.id } } : undefined,
            isGamificationEnabled: newCourse
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: newCourse
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              microLearning.reviewStatus === DB.ReviewStatus.REVIEWED
                ? { set: DB.ReviewStatus.MODIFIED_AFTER_REVIEW }
                : undefined,
          },
        })

        // if the multiplier was changed, update the instances of the microlearning accordingly
        if (setMultiplier) {
          // get all instances that have a pointsMultiplier defined
          const instances = microLearning.stacks
            .flatMap((stack) => stack.elements)
            .filter(
              (instance) =>
                'options' in instance &&
                instance.options &&
                'pointsMultiplier' in instance.options
            )

          await updateInstanceMultipliers(
            {
              instances,
              newActivityMultiplier: modifiedMicroLearning.pointsMultiplier,
            },
            tx
          )
        }

        // if the course assignment was changed, update the derived pemissions on the quiz
        if (newCourse) {
          await recomputeDerivedPermissions(
            { microLearningId: modifiedMicroLearning.id },
            tx
          )
        }

        return modifiedMicroLearning
      })

      updatedMicroLearnings.push(updatedMicroLearning.id)
    }

    // update group activities (including gamification / assessment flags & all instances - depending on the required updates)
    for (const groupActivity of groupActivities) {
      const updatedGroupActivity = await ctx.prisma.$transaction(async (tx) => {
        const modifiedGroupActivity = await tx.groupActivity.update({
          where: { id: groupActivity.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: newCourse ? { connect: { id: newCourse.id } } : undefined,
            isGamificationEnabled: newCourse
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: newCourse
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              groupActivity.reviewStatus === DB.ReviewStatus.REVIEWED
                ? { set: DB.ReviewStatus.MODIFIED_AFTER_REVIEW }
                : undefined,
          },
        })

        // if the multiplier was changed, update the instances of the group activity accordingly
        if (setMultiplier) {
          // get all instances that have a pointsMultiplier defined
          const instances = groupActivity.stacks
            .flatMap((stack) => stack.elements)
            .filter(
              (instance) =>
                'options' in instance &&
                instance.options &&
                'pointsMultiplier' in instance.options
            )

          await updateInstanceMultipliers(
            {
              instances,
              newActivityMultiplier: modifiedGroupActivity.pointsMultiplier,
            },
            tx
          )
        }

        // if the course assignment was changed, update the derived pemissions on the quiz
        if (newCourse) {
          await recomputeDerivedPermissions(
            { groupActivityId: modifiedGroupActivity.id },
            tx
          )
        }

        return modifiedGroupActivity
      })

      updatedGroupActivities.push(updatedGroupActivity.id)
    }
  }

  return (
    updatedLiveQuizzes.length +
    updatedPracticeQuizzes.length +
    updatedMicroLearnings.length +
    updatedGroupActivities.length
  )
}

export async function getLiveQuizDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      course: true,
      blocks: {
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
                          DB.PermissionLevel.WRITE,
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
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

  if (!liveQuiz) {
    return null
  }

  const arePointsAwarded =
    liveQuiz.isGamificationEnabled || liveQuiz.isAssessmentEnabled
  const defaultPoints = liveQuiz.defaultPoints
  const defaultCorrectPoints = liveQuiz.defaultCorrectPoints
  const defaultMaxBonusPoints = liveQuiz.maxBonusPoints
  const pointsMultiplierActivity = liveQuiz.pointsMultiplier

  const stacks = liveQuiz.blocks.map((block) => {
    const elements = block.elements.map((instance) => {
      const { elementData } = instance
      const hasSampleSolution =
        'options' in elementData &&
        'hasSampleSolution' in elementData.options &&
        ((elementData.options as { hasSampleSolution?: boolean })
          .hasSampleSolution ??
          false)
      const isEditor = !!instance.element.permissions?.[0]

      if (!arePointsAwarded) {
        return {
          basePoints: 0,
          correctnessPoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          hasSampleSolution,
          isEditor,
          instance,
        }
      }

      const hasBasePoints =
        instance.elementType !== DB.ElementType.FLASHCARD &&
        instance.elementType !== DB.ElementType.CONTENT &&
        (instance.options.basePoints ?? false)
      const pointsMultiplier = instance.options.pointsMultiplier ?? 1

      const basePoints = hasBasePoints ? defaultPoints : 0
      const correctnessPoints = hasSampleSolution
        ? pointsMultiplier * defaultCorrectPoints
        : 0
      const bonusPoints = hasSampleSolution
        ? pointsMultiplier * defaultMaxBonusPoints
        : 0
      const totalPoints = basePoints + (correctnessPoints + bonusPoints)

      return {
        basePoints,
        correctnessPoints,
        bonusPoints,
        totalPoints,
        hasSampleSolution,
        isEditor,
        instance,
      }
    })

    return {
      id: block.id,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
      timeLimit: block.timeLimit,
      stackPoints: arePointsAwarded
        ? elements.reduce((acc, el) => acc + el.totalPoints, 0)
        : null,
      elements,
    }
  })

  const {
    totalBasePoints,
    totalCorrectnessPoints,
    totalBonusPoints,
    totalPoints,
  } = arePointsAwarded
    ? stacks.reduce(
        (acc, stack) => {
          for (const el of stack.elements) {
            acc.totalBasePoints += el.basePoints
            acc.totalCorrectnessPoints += el.correctnessPoints
            acc.totalBonusPoints += el.bonusPoints
          }
          acc.totalPoints += stack.stackPoints ?? 0
          return acc
        },
        {
          totalBasePoints: 0,
          totalCorrectnessPoints: 0,
          totalBonusPoints: 0,
          totalPoints: 0,
        }
      )
    : {
        totalBasePoints: 0,
        totalCorrectnessPoints: 0,
        totalBonusPoints: 0,
        totalPoints: 0,
      }

  return {
    id: liveQuiz.id,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    arePointsAwarded,
    pointsMultiplier: pointsMultiplierActivity,
    totalBasePoints,
    totalCorrectnessPoints,
    totalBonusPoints,
    totalPoints,
    stacks,
  }
}

function getAsynchronousActivityElementInstanceDetails({
  instance,
  isGroupActivity,
}: {
  instance: DB.ElementInstance
  isGroupActivity: boolean
}): { points: number; hasSampleSolution: boolean } {
  // check if question has sample solution (type checking relevant for content and flashcard)
  const { elementData } = instance
  const hasSampleSolution =
    'options' in elementData &&
    'hasSampleSolution' in elementData.options &&
    (elementData.options.hasSampleSolution ?? false)

  // extract points multiplier from instance options
  const pointsMultiplier = instance.options.pointsMultiplier ?? 1

  // set default points for asynchronous activities
  const defaultBasePoints = isGroupActivity
    ? POINTS_PER_GROUP_ACTIVITY_ELEMENT
    : POINTS_PER_INSTANCE

  const points = hasSampleSolution ? pointsMultiplier * defaultBasePoints : 0
  return { points, hasSampleSolution }
}

function getAsyncActivityPointsElements({
  stack,
  isGroupActivity = false,
  arePointsAwarded,
}: {
  stack: DB.ElementStack & {
    elements: (DB.ElementInstance & {
      element: DB.Element & { permissions: DB.DerivedPermission[] }
    })[]
  }
  isGroupActivity?: boolean
  arePointsAwarded: boolean
}) {
  const { elements, stackPoints } = stack.elements.reduce<{
    elements: {
      totalPoints: number
      hasSampleSolution: boolean
      isEditor: boolean
      instance: DB.ElementInstance
    }[]
    stackPoints: number
  }>(
    (acc, instance) => {
      const { points, hasSampleSolution } = arePointsAwarded
        ? getAsynchronousActivityElementInstanceDetails({
            instance,
            isGroupActivity,
          })
        : {
            points: 0,
            hasSampleSolution:
              ('options' in instance.elementData &&
                'hasSampleSolution' in instance.elementData.options &&
                instance.elementData.options.hasSampleSolution) ??
              false,
          }

      acc.elements.push({
        totalPoints: points,
        hasSampleSolution,
        isEditor: !!instance.element.permissions?.[0],
        instance,
      })
      acc.stackPoints += points
      return acc
    },
    { elements: [], stackPoints: 0 }
  )

  return {
    id: stack.id,
    numOfParticipants: stack.elements[0]
      ? stack.elements[0].results.total +
        stack.elements[0].anonymousResults.total
      : 0,
    stackPoints: arePointsAwarded ? stackPoints : null,
    elements,
  }
}

export async function getPracticeQuizDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: {
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
                          DB.PermissionLevel.WRITE,
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
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

  if (!practiceQuiz) {
    return null
  }

  const arePointsAwarded =
    practiceQuiz.isGamificationEnabled || practiceQuiz.isAssessmentEnabled
  const pointsMultiplierActivity = practiceQuiz.pointsMultiplier
  const stacks = practiceQuiz.stacks.map((stack) =>
    getAsyncActivityPointsElements({ stack, arePointsAwarded })
  )

  const totalPoints = arePointsAwarded
    ? stacks.reduce((acc, stack) => {
        acc += stack.stackPoints ?? 0
        return acc
      }, 0)
    : 0

  return {
    id: practiceQuiz.id,
    name: practiceQuiz.name,
    displayName: practiceQuiz.displayName,
    arePointsAwarded,
    pointsMultiplier: pointsMultiplierActivity,
    totalPoints,
    stacks,
  }
}

export async function getMicroLearningDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: {
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
                          DB.PermissionLevel.WRITE,
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
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

  if (!microLearning) {
    return null
  }
  const arePointsAwarded =
    microLearning.isGamificationEnabled || microLearning.isAssessmentEnabled
  const pointsMultiplierActivity = microLearning.pointsMultiplier
  const stacks = microLearning.stacks.map((stack) =>
    getAsyncActivityPointsElements({ stack, arePointsAwarded })
  )

  const totalPoints = arePointsAwarded
    ? stacks.reduce((acc, stack) => {
        acc += stack.stackPoints ?? 0
        return acc
      }, 0)
    : 0

  return {
    id: microLearning.id,
    name: microLearning.name,
    displayName: microLearning.displayName,
    arePointsAwarded,
    pointsMultiplier: pointsMultiplierActivity,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints,
    stacks,
  }
}

export async function getGroupActivityDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      course: {
        include: { _count: { select: { participantGroups: true } } },
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
                          DB.PermissionLevel.WRITE,
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
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

  if (!groupActivity) {
    return null
  }

  const arePointsAwarded =
    groupActivity.isGamificationEnabled || groupActivity.isAssessmentEnabled
  const pointsMultiplierActivity = groupActivity.pointsMultiplier
  const stacks = groupActivity.stacks.map((stack) =>
    getAsyncActivityPointsElements({
      stack,
      isGroupActivity: true,
      arePointsAwarded,
    })
  )

  const totalPoints = arePointsAwarded
    ? stacks.reduce((acc, stack) => {
        acc += stack.stackPoints ?? 0
        return acc
      }, 0)
    : 0

  return {
    id: groupActivity.id,
    name: groupActivity.name,
    displayName: groupActivity.displayName,
    arePointsAwarded,
    pointsMultiplier: pointsMultiplierActivity,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints,
    stacks,
  }
}

export async function setActivityReviewStatus(
  {
    activityId,
    activityType,
    isReviewed,
  }: {
    activityId: string
    activityType: ActivityType
    isReviewed: boolean
  },
  ctx: ContextWithUser
) {
  const reviewStatus = isReviewed
    ? DB.ReviewStatus.REVIEWED
    : DB.ReviewStatus.INCOMPLETE
  const acceptedPermissionLevels = [
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ]

  try {
    if (activityType === ActivityType.LIVE_QUIZ) {
      const liveQuiz = await ctx.prisma.liveQuiz.update({
        where: {
          id: activityId,
          OR: [
            {
              courseId: null,
              permissions: {
                some: {
                  userId: ctx.user.sub,
                  permissionLevel: { in: acceptedPermissionLevels },
                },
              },
            },
            {
              courseId: { not: null },
              course: {
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                    permissionLevel: { in: acceptedPermissionLevels },
                  },
                },
              },
            },
          ],
        },
        data: { reviewStatus },
      })

      return !!liveQuiz ? reviewStatus : null
    } else if (activityType === ActivityType.PRACTICE_QUIZ) {
      const practiceQuiz = await ctx.prisma.practiceQuiz.update({
        where: {
          id: activityId,
          course: {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        },
        data: { reviewStatus },
      })

      return !!practiceQuiz ? reviewStatus : null
    } else if (activityType === ActivityType.MICRO_LEARNING) {
      const microLearning = await ctx.prisma.microLearning.update({
        where: {
          id: activityId,
          course: {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        },
        data: { reviewStatus },
      })

      return !!microLearning ? reviewStatus : null
    } else if (activityType === ActivityType.GROUP_ACTIVITY) {
      const groupActivity = await ctx.prisma.groupActivity.update({
        where: {
          id: activityId,
          course: {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        },
        data: { reviewStatus },
      })

      return !!groupActivity ? reviewStatus : null
    }
  } catch (error) {
    console.error('Error setting activity review status:', error)
    return null
  }

  return null
}
