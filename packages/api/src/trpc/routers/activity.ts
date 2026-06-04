import { PermissionLevel, Prisma } from '@klicker-uzh/prisma/client'
import { ActivityType, SortByType } from '@klicker-uzh/types'
import { getPrisma } from '../context.js'
import {
  toAsyncActivityDetails,
  toLiveQuizActivityDetails,
  toOutdatedElementInstanceInfo,
  toUserActivitiesCourseListItem,
  toUserActivityOverviewItem,
} from '../dto/activity.js'
import { router } from '../init.js'
import { hasActivityPermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import {
  activityDetailsInput,
  outdatedElementInstancesInput,
  userActivitiesInput,
} from '../schemas/activity.js'

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
