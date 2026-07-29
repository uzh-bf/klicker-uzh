import { ContextWithUser } from '@/lib/context.js'
import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType, SortByType } from '@klicker-uzh/types'
import {
  PrismaTransactionClient,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import generatePassword from 'generate-password'
import { POINTS_PER_GROUP_ACTIVITY_ELEMENT } from './groups.js'
import {
  assertLiveQuizResponseCollectionCompatibility,
  lockCourseLiveQuizResponseCollectionState,
  resolveLiveQuizResponseCollectionMode,
} from './liveQuizResponseCollection.js'
import { POINTS_PER_INSTANCE } from './stacks.js'

export async function getUserActivitiesCourses(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: { courseId: { not: null } },
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
        orderBy: { course: { endDate: 'desc' } },
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
    multiplier,
    reviewStatus,
    isGamificationEnabled,
    isAssessmentEnabled,
    isPinProtected,
    sortByType,
    sortByAsc,
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
    multiplier?: number | null
    reviewStatus?: DB.ReviewStatus | null
    isGamificationEnabled?: boolean | null
    isAssessmentEnabled?: boolean | null
    isPinProtected?: boolean | null
    sortByType: SortByType
    sortByAsc: boolean
    numEntries?: number | null
    offset?: number | null
  },
  ctx: ContextWithUser
) {
  const whereClause = {
    userId: ctx.user.sub,
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
    // status filter
    status:
      statusFilter && statusFilter.length > 0
        ? { in: statusFilter }
        : undefined,
    // activity multiplier filter
    pointsMultiplier: multiplier ? { equals: multiplier } : undefined,
    // review status filter
    reviewStatus: reviewStatus ? { equals: reviewStatus } : undefined,
    // filter by activity type, if an activity type filter is set
    type: activityTypeFilter ? { equals: activityTypeFilter } : undefined,
    // activity mode (gamification, assessment, pin protection) filters
    isGamificationEnabled: isGamificationEnabled
      ? { equals: isGamificationEnabled }
      : undefined,
    isAssessmentEnabled: isAssessmentEnabled
      ? { equals: isAssessmentEnabled }
      : undefined,
    pinCode: isPinProtected ? { not: null } : undefined,
    // course filter
    courseId: courseId
      ? { equals: courseId }
      : withoutCourse
        ? null
        : undefined,
    // search string
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
  }

  const [activitiesFromView, totalCount] = await Promise.all([
    ctx.prisma.userActivities.findMany({
      where: whereClause,
      orderBy: [
        ...(sortByType === SortByType.CREATED
          ? [{ createdAt: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder }]
          : []),
        ...(sortByType === SortByType.MODIFIED
          ? [{ updatedAt: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder }]
          : []),
        ...(sortByType === SortByType.TITLE
          ? [{ name: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder }]
          : []),
        ...(sortByType === SortByType.TYPE
          ? [{ typeOrder: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder }]
          : []),
        ...(sortByType === SortByType.STATUS
          ? [{ status: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder }]
          : []),
        // break ties using the modification date
        { updatedAt: 'desc' as DB.Prisma.SortOrder },
      ],
      take: numEntries ?? undefined,
      skip: offset ?? undefined,
    }),
    ctx.prisma.userActivities.count({ where: whereClause }),
  ])

  // map the fetched activities to the return type
  const activities = activitiesFromView.flatMap((activity) => {
    const {
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      sharingType,
    } = getPermissionBooleans({
      permissionLevel: activity.permissionLevel,
      derived: activity.derived,
      directGroupPermission: activity.directPermissionUserGroupId !== null,
    })

    // if only derived access to the activity is given and it is soft deleted, do not show it in the overview
    if (activity.derived && activity.isDeleted) {
      return []
    }

    // return all relevant information for the activity
    return {
      ...activity,
      type: activity.type as ActivityType,
      derivedAccess: activity.derived,
      numSharedUsers: activity.numActivityPermissions,
      isOwner,
      isManager,
      isEditor,
      isExecutor,
      isShared,
      isRemovable,
      isActivityReviewer:
        (activity.type === ActivityType.LIVE_QUIZ &&
          activity.courseId === null &&
          (activity.permissionLevel === DB.PermissionLevel.OWNER ||
            activity.permissionLevel === DB.PermissionLevel.ADMIN)) ||
        activity.isUserCourseAdmin,
      pinCode:
        activity.type === ActivityType.LIVE_QUIZ ? activity.pinCode : null,
      sharingType,
    }
  })

  // // the activities should be ordered as follows:
  // // 1) first by active vs inactive status (active: published, scheduled, draft, template; inactive: ended, graded)
  // // 2) then by type: live quiz, microlearning, practice quiz, group activity
  // // 3) then by status within the active/inactive groups
  // // 4) then by start date / updated date
  // const activityTypeOrder = {
  //   [ActivityType.LIVE_QUIZ]: 1,
  //   [ActivityType.MICRO_LEARNING]: 2,
  //   [ActivityType.PRACTICE_QUIZ]: 3,
  //   [ActivityType.GROUP_ACTIVITY]: 4,
  // }

  // const activityStatusOrder = {
  //   [DB.PublicationStatus.PUBLISHED]: 1,
  //   [DB.PublicationStatus.SCHEDULED]: 2,
  //   [DB.PublicationStatus.DRAFT]: 3,
  //   [DB.PublicationStatus.TEMPLATE]: 4,
  //   [DB.PublicationStatus.ENDED]: 2,
  //   [DB.PublicationStatus.GRADED]: 1,
  // }

  // // helper function to determine if a status is active or inactive
  // const isActiveStatus = (status: DB.PublicationStatus): boolean => {
  //   return (
  //     status === DB.PublicationStatus.PUBLISHED ||
  //     status === DB.PublicationStatus.SCHEDULED ||
  //     status === DB.PublicationStatus.DRAFT ||
  //     status === DB.PublicationStatus.TEMPLATE
  //   )
  // }

  // return {
  //   numOfActivities: user._count.objects,
  //   activities: sortBy(
  //     activities,
  //     // first order by active/inactive (active first)
  //     (activity) => (isActiveStatus(activity.status) ? 0 : 1),
  //     // then order by activity type
  //     (activity) => activityTypeOrder[activity.type],
  //     // then order by status within each group
  //     (activity) => activityStatusOrder[activity.status] || 100,
  //     // then by scheduled start date or updated date
  //     (activity) => {
  //       if (activity.scheduledStartAt) {
  //         return -new Date(activity.scheduledStartAt).getTime()
  //       }
  //       return -new Date(activity.updatedAt).getTime()
  //     }
  //   ),
  // }

  // TODO: correctly get number of activities instead of using length here!!!
  return { numOfActivities: totalCount, activities }
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

      if (typeof newMultiplier !== 'undefined') {
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
      AND: [
        // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
        ...((setMultiplier && !newCourse) || setLiveQuizPoints
          ? [
              {
                OR: [
                  { isGamificationEnabled: true },
                  { isAssessmentEnabled: true },
                ],
              },
            ]
          : []),
        // activities in assessment mode can only be assigned to another course (and thereby removed from it) by an admin of the assessment course
        {
          OR: [
            { courseId: null },
            { isAssessmentEnabled: false },
            {
              isAssessmentEnabled: true,
              course: {
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [DB.PermissionLevel.OWNER, DB.PermissionLevel.ADMIN],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    include: { blocks: { include: { elements: true } } },
  })

  if (newCourse) {
    for (const liveQuiz of liveQuizzes) {
      assertLiveQuizResponseCollectionCompatibility({
        isGamificationEnabled: newCourse.isGamificationEnabled,
        responseCollectionMode: resolveLiveQuizResponseCollectionMode({
          isAssessmentEnabled: newCourse.isAssessmentEnabled,
          requestedMode: liveQuiz.responseCollectionMode,
        }),
      })
    }
  }

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
          AND: [
            // if the practice quiz is assigned to a new course, the scheduled publication date must lie within the course duration (or be null -> draft)
            ...(newCourse
              ? [
                  {
                    OR: [
                      { availableFrom: null },
                      {
                        availableFrom: {
                          gte: newCourse.startDate,
                          lte: newCourse.endDate,
                        },
                      },
                    ],
                  },
                ]
              : []),
            // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
            ...(setMultiplier && !newCourse
              ? [
                  {
                    OR: [
                      { isGamificationEnabled: true },
                      { isAssessmentEnabled: true },
                    ],
                  },
                ]
              : []),
            // activities in assessment mode can only be assigned to another course (and thereby removed from it) by an admin of the assessment course
            {
              OR: [
                { isAssessmentEnabled: false },
                {
                  isAssessmentEnabled: true,
                  course: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                        permissionLevel: {
                          in: [
                            DB.PermissionLevel.OWNER,
                            DB.PermissionLevel.ADMIN,
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
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
          // if a new course is assigned, the entire availability interval of the activity should lie inside the course duration
          scheduledStartAt: newCourse
            ? { gte: newCourse.startDate }
            : undefined,
          scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
          AND: [
            // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
            ...(setMultiplier && !newCourse
              ? [
                  {
                    OR: [
                      { isGamificationEnabled: true },
                      { isAssessmentEnabled: true },
                    ],
                  },
                ]
              : []),
            // activities in assessment mode can only be assigned to another course (and thereby removed from it) by an admin of the assessment course
            {
              OR: [
                { isAssessmentEnabled: false },
                {
                  isAssessmentEnabled: true,
                  course: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                        permissionLevel: {
                          in: [
                            DB.PermissionLevel.OWNER,
                            DB.PermissionLevel.ADMIN,
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
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
            // if a new course is assigned, the group formation deadline should be before the start of the group activity
            // (start date of course does not need to be verified, since group formation deadline is always after start date)
            scheduledStartAt: newCourse
              ? { gte: newCourse.groupDeadlineDate }
              : undefined,
            // if a new course is assigned, the group activity should end before the end of the course
            scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
            AND: [
              // if no new course is assigned, but the multiplier is updated, the activity needs to be already gamified / in assessment mode
              ...(setMultiplier && !newCourse
                ? [
                    {
                      OR: [
                        { isGamificationEnabled: true },
                        { isAssessmentEnabled: true },
                      ],
                    },
                  ]
                : []),
              // activities in assessment mode can only be assigned to another course (and thereby removed from it) by an admin of the assessment course
              {
                OR: [
                  { isAssessmentEnabled: false },
                  {
                    isAssessmentEnabled: true,
                    course: {
                      permissions: {
                        some: {
                          userId: ctx.user.sub,
                          permissionLevel: {
                            in: [
                              DB.PermissionLevel.OWNER,
                              DB.PermissionLevel.ADMIN,
                            ],
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ],
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
      // check if the course is different from before
      const isCourseChanged = !!newCourse && liveQuiz.courseId !== newCourse.id
      const lockedCourseState = isCourseChanged
        ? await lockCourseLiveQuizResponseCollectionState({
            prisma: tx,
            courseId: newCourse!.id,
          })
        : null
      if (isCourseChanged && !lockedCourseState) {
        throw new Error('Target course no longer exists')
      }
      const targetCourse = lockedCourseState?.course ?? newCourse
      if (isCourseChanged && targetCourse) {
        assertLiveQuizResponseCollectionCompatibility({
          isGamificationEnabled: targetCourse.isGamificationEnabled,
          responseCollectionMode: resolveLiveQuizResponseCollectionMode({
            isAssessmentEnabled: targetCourse.isAssessmentEnabled,
            requestedMode: liveQuiz.responseCollectionMode,
          }),
        })
      }

      // if required, find a new pin code for the live quiz that is still available
      let newPinCode: string | null = null
      if (isCourseChanged && targetCourse?.isAssessmentEnabled) {
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
          const existingLiveQuiz = await tx.liveQuiz.findUnique({
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

      const modifiedLiveQuiz = await tx.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: {
          // course re-assignment (including update of gamification and assessment flags)
          course: isCourseChanged
            ? { connect: { id: targetCourse!.id } }
            : undefined,
          isGamificationEnabled: isCourseChanged
            ? { set: targetCourse!.isGamificationEnabled }
            : undefined,
          isAssessmentEnabled: isCourseChanged
            ? { set: targetCourse!.isAssessmentEnabled }
            : undefined,
          responseCollectionMode:
            isCourseChanged && targetCourse!.isAssessmentEnabled
              ? {
                  set: DB.LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
                }
              : undefined,
          // if the course is changed to an assessment course, assign a pin
          pinCode: isCourseChanged ? newPinCode : undefined,
          // multiplier updates
          pointsMultiplier: setMultiplier
            ? { set: Math.max(multiplier, 1) }
            : undefined,
          // if defined, set custom grading logic components
          defaultPoints: setLiveQuizPoints
            ? { set: Math.max(basePoints, 0) }
            : undefined,
          defaultCorrectPoints: setLiveQuizPoints
            ? { set: Math.max(correctnessPoints, 0) }
            : undefined,
          maxBonusPoints: setLiveQuizPoints
            ? { set: Math.max(bonusPoints, 0) }
            : undefined,
          timeToZeroBonus: setLiveQuizPoints
            ? { set: Math.max(timeToZeroBonus, 1) }
            : undefined,
          // if set before, update the review status
          reviewStatus:
            liveQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
              ? {
                  set: isCourseChanged
                    ? DB.ReviewStatus.INCOMPLETE
                    : DB.ReviewStatus.MODIFIED_AFTER_REVIEW,
                }
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
        // check if the course is different from before
        const isCourseChanged =
          !!newCourse && practiceQuiz.courseId !== newCourse.id

        const modifiedPracticeQuiz = await tx.practiceQuiz.update({
          where: { id: practiceQuiz.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: isCourseChanged
              ? { connect: { id: newCourse.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              practiceQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? DB.ReviewStatus.INCOMPLETE
                      : DB.ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
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
        // check if the course is different from before
        const isCourseChanged =
          !!newCourse && microLearning.courseId !== newCourse.id

        const modifiedMicroLearning = await tx.microLearning.update({
          where: { id: microLearning.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: isCourseChanged
              ? { connect: { id: newCourse.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              microLearning.reviewStatus === DB.ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? DB.ReviewStatus.INCOMPLETE
                      : DB.ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
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
        // check if the course is different from before
        const isCourseChanged =
          !!newCourse && groupActivity.courseId !== newCourse.id

        const modifiedGroupActivity = await tx.groupActivity.update({
          where: { id: groupActivity.id },
          data: {
            // course re-assignment (including update of gamification and assessment flags)
            course: isCourseChanged
              ? { connect: { id: newCourse.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse.isAssessmentEnabled }
              : undefined,
            // multiplier updates
            pointsMultiplier: setMultiplier ? { set: multiplier } : undefined,
            // if set before, update the review status
            reviewStatus:
              groupActivity.reviewStatus === DB.ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? DB.ReviewStatus.INCOMPLETE
                      : DB.ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
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
      owner: true,
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
      const isEditor = instance.element._count.permissions > 0
      const isDeleted = instance.element.isDeleted

      if (!arePointsAwarded) {
        return {
          basePoints: 0,
          correctnessPoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          hasSampleSolution,
          isEditor,
          isDeleted,
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
        isDeleted,
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

  const isActivityManager = liveQuiz._count.permissions > 0
  return {
    ...liveQuiz,
    isActivityReviewer:
      (liveQuiz.courseId === null && liveQuiz._count.permissions > 0) ||
      (!!liveQuiz.course && liveQuiz.course._count.permissions > 0),
    isActivityManager,
    ownerShortname: liveQuiz.owner.shortname,
    ownerEmail: isActivityManager ? liveQuiz.owner.email : null,
    isPinProtected: !!liveQuiz.pinCode,
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
      isDeleted: boolean
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
        isDeleted: instance.element.isDeleted,
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
    stackTitle: stack.displayName,
    stackDescription: stack.description,
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
      owner: true,
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

  const isActivityManager = practiceQuiz._count.permissions > 0
  return {
    ...practiceQuiz,
    isActivityReviewer: practiceQuiz.course._count.permissions > 0,
    isActivityManager,
    isPinProtected: false,
    ownerShortname: practiceQuiz.owner.shortname,
    ownerEmail: isActivityManager ? practiceQuiz.owner.email : null,
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
      owner: true,
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

  const isActivityManager = microLearning._count.permissions > 0
  return {
    ...microLearning,
    isActivityReviewer: microLearning.course._count.permissions > 0,
    isActivityManager,
    isPinProtected: false,
    ownerShortname: microLearning.owner.shortname,
    ownerEmail: isActivityManager ? microLearning.owner.email : null,
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
      owner: true,
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
      course: {
        include: {
          _count: {
            select: {
              participantGroups: true,
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

  const isActivityManager = groupActivity._count.permissions > 0
  return {
    ...groupActivity,
    isActivityReviewer: groupActivity.course._count.permissions > 0,
    isActivityManager,
    isPinProtected: false,
    ownerShortname: groupActivity.owner.shortname,
    ownerEmail: isActivityManager ? groupActivity.owner.email : null,
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

export async function getCourseActivityIds(
  { courseId }: { courseId?: string | null },
  ctx: ContextWithUser
) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      objects: {
        where: {
          OR: [
            { liveQuiz: { isDeleted: false, courseId: courseId ?? null } },
            ...(courseId
              ? [{ practiceQuiz: { isDeleted: false, courseId } }]
              : []),
            ...(courseId
              ? [{ microLearning: { isDeleted: false, courseId } }]
              : []),
            ...(courseId
              ? [{ groupActivity: { isDeleted: false, courseId } }]
              : []),
          ],
        },
        include: {
          liveQuiz: { select: { id: true, name: true } },
          practiceQuiz: { select: { id: true, name: true } },
          microLearning: { select: { id: true, name: true } },
          groupActivity: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!user) return null

  const { liveQuizzes, practiceQuizzes, microLearnings, groupActivities } =
    user.objects.reduce<{
      liveQuizzes: { id: string; name: string }[]
      practiceQuizzes: { id: string; name: string }[]
      microLearnings: { id: string; name: string }[]
      groupActivities: { id: string; name: string }[]
    }>(
      (acc, obj) => {
        if (obj.liveQuiz) {
          acc.liveQuizzes.push({ id: obj.liveQuiz.id, name: obj.liveQuiz.name })
        } else if (obj.practiceQuiz) {
          acc.practiceQuizzes.push({
            id: obj.practiceQuiz.id,
            name: obj.practiceQuiz.name,
          })
        } else if (obj.microLearning) {
          acc.microLearnings.push({
            id: obj.microLearning.id,
            name: obj.microLearning.name,
          })
        } else if (obj.groupActivity) {
          acc.groupActivities.push({
            id: obj.groupActivity.id,
            name: obj.groupActivity.name,
          })
        }
        return acc
      },
      {
        liveQuizzes: [],
        practiceQuizzes: [],
        microLearnings: [],
        groupActivities: [],
      }
    )

  return {
    liveQuizzes,
    practiceQuizzes,
    microLearnings,
    groupActivities,
  }
}
