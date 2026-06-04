import { PermissionLevel, Prisma } from '@klicker-uzh/prisma/client'
import { SortByType } from '@klicker-uzh/types'
import { getPrisma } from '../context.js'
import {
  toUserActivitiesCourseListItem,
  toUserActivityOverviewItem,
} from '../dto/activity.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'
import { userActivitiesInput } from '../schemas/activity.js'

export const activityRouter = router({
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
