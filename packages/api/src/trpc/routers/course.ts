import { PermissionLevel, type Prisma } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActiveUserCourse,
  toActiveUserCourseWithoutPermissions,
  toBasicCourseInformation,
  toControlCourse,
  toControlCourseListItem,
  toCourseSummary,
  toManageCourseListItem,
} from '../dto/course.js'
import { publicProcedure, router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import {
  activeUserCoursesInput,
  basicCourseInformationInput,
  controlCourseInput,
  courseActivityIdsInput,
  courseSummaryInput,
} from '../schemas/course.js'

const courseExecutePermissionLevels = [
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

const activeUserCourseSelect = {
  id: true,
  name: true,
  displayName: true,
  color: true,
  pinCode: true,
  isArchived: true,
  isGamificationEnabled: true,
  isAssessmentEnabled: true,
  isGroupCreationEnabled: true,
  description: true,
  startDate: true,
  endDate: true,
  groupDeadlineDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CourseSelect

async function getActivityCourse(
  prisma: TRPCContextWithUser['prisma'],
  {
    activityId,
    activityType,
  }: {
    activityId: string
    activityType: ActivityType
  }
) {
  switch (activityType) {
    case ActivityType.LIVE_QUIZ: {
      const liveQuiz = await prisma.liveQuiz.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return liveQuiz?.course ?? null
    }
    case ActivityType.PRACTICE_QUIZ: {
      const practiceQuiz = await prisma.practiceQuiz.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return practiceQuiz?.course ?? null
    }
    case ActivityType.MICRO_LEARNING: {
      const microLearning = await prisma.microLearning.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return microLearning?.course ?? null
    }
    case ActivityType.GROUP_ACTIVITY: {
      const groupActivity = await prisma.groupActivity.findUnique({
        where: { id: activityId },
        select: { course: { select: activeUserCourseSelect } },
      })

      return groupActivity?.course ?? null
    }
  }

  return null
}

export const courseRouter = router({
  basicCourseInformation: publicProcedure
    .input(basicCourseInformationInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          displayName: true,
          description: true,
          color: true,
          owner: {
            select: {
              shortname: true,
            },
          },
        },
      })

      return {
        basicCourseInformation: toBasicCourseInformation(course),
      }
    }),

  controlCourses: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      include: { courses: { orderBy: { createdAt: 'desc' } } },
    })

    return {
      controlCourses: user?.courses.map(toControlCourseListItem) ?? [],
    }
  }),

  userCourses: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      select: {
        objects: {
          where: { courseId: { not: null } },
          select: {
            course: {
              select: {
                id: true,
                name: true,
                displayName: true,
                color: true,
                isArchived: true,
                isGamificationEnabled: true,
                isAssessmentEnabled: true,
                isGroupCreationEnabled: true,
                description: true,
                startDate: true,
                endDate: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    permissions: true,
                  },
                },
              },
            },
            derived: true,
            directPermission: {
              select: {
                userGroupId: true,
              },
            },
            permissionLevel: true,
          },
          orderBy: [{ course: { endDate: 'desc' } }],
        },
      },
    })

    return {
      userCourses:
        user?.objects
          .flatMap((object) => {
            const course = toManageCourseListItem(object)
            return course ? [course] : []
          })
          .sort((a, b) => {
            return a.isArchived === b.isArchived ? 0 : a.isArchived ? 1 : -1
          }) ?? [],
    }
  }),

  activeUserCourses: userProcedure
    .input(activeUserCoursesInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.sub },
        select: {
          objects: {
            where: {
              courseId: { not: null },
              course: {
                endDate: { gte: new Date() },
                isArchived: false,
              },
            },
            select: {
              course: {
                select: activeUserCourseSelect,
              },
              permissionLevel: true,
            },
            orderBy: [
              { course: { startDate: 'asc' } },
              { course: { name: 'asc' } },
            ],
          },
        },
      })

      const activeUserCourses =
        user?.objects.flatMap((object) => {
          const course = toActiveUserCourse(object)
          return course ? [course] : []
        }) ?? []

      if (!input?.activityId || input.activityType == null) {
        return { activeUserCourses }
      }

      const hasAccess = await hasActivityPermission(
        ctx as TRPCContextWithUser,
        {
          activityId: input.activityId,
          activityType: input.activityType,
        },
        PermissionLevel.WRITE
      )

      if (!hasAccess) return { activeUserCourses }

      const activityCourse = toActiveUserCourseWithoutPermissions(
        await getActivityCourse(prisma, {
          activityId: input.activityId,
          activityType: input.activityType,
        })
      )

      if (!activityCourse) return { activeUserCourses }

      const augmentedCourses = activeUserCourses.some(
        (course) => course.id === activityCourse.id
      )
        ? activeUserCourses
        : [...activeUserCourses, activityCourse]

      return {
        activeUserCourses: [...augmentedCourses].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        ),
      }
    }),

  activityIds: userProcedure
    .input(courseActivityIdsInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.sub },
        include: {
          objects: {
            where: {
              OR: [
                {
                  liveQuiz: {
                    isDeleted: false,
                    courseId: input.courseId ?? null,
                  },
                },
                ...(input.courseId
                  ? [
                      {
                        practiceQuiz: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
                  : []),
                ...(input.courseId
                  ? [
                      {
                        microLearning: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
                  : []),
                ...(input.courseId
                  ? [
                      {
                        groupActivity: {
                          isDeleted: false,
                          courseId: input.courseId,
                        },
                      },
                    ]
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

      if (!user) return { courseActivityIds: null }

      return {
        courseActivityIds: user.objects.reduce<{
          liveQuizzes: { id: string; name: string }[]
          practiceQuizzes: { id: string; name: string }[]
          microLearnings: { id: string; name: string }[]
          groupActivities: { id: string; name: string }[]
        }>(
          (acc, object) => {
            if (object.liveQuiz) {
              acc.liveQuizzes.push({
                id: object.liveQuiz.id,
                name: object.liveQuiz.name,
              })
            } else if (object.practiceQuiz) {
              acc.practiceQuizzes.push({
                id: object.practiceQuiz.id,
                name: object.practiceQuiz.name,
              })
            } else if (object.microLearning) {
              acc.microLearnings.push({
                id: object.microLearning.id,
                name: object.microLearning.name,
              })
            } else if (object.groupActivity) {
              acc.groupActivities.push({
                id: object.groupActivity.id,
                name: object.groupActivity.name,
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
        ),
      }
    }),

  summary: userProcedure
    .input(courseSummaryInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseSummary: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          _count: {
            select: {
              liveQuizzes: { where: { isDeleted: false } },
              practiceQuizzes: { where: { isDeleted: false } },
              microLearnings: { where: { isDeleted: false } },
              groupActivities: { where: { isDeleted: false } },
              leaderboard: true,
              participantGroups: true,
              participations: true,
            },
          },
        },
      })

      return {
        courseSummary: toCourseSummary(course),
      }
    }),

  controlCourse: userProcedure
    .input(controlCourseInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const permission = await prisma.derivedPermission.findFirst({
        where: {
          courseId: input.courseId,
          userId: ctx.user.sub,
          permissionLevel: {
            in: courseExecutePermissionLevels,
          },
        },
      })

      if (!permission) {
        return { controlCourse: null }
      }

      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: {
          liveQuizzes: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return {
        controlCourse: toControlCourse(course),
      }
    }),
})
