import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toBasicCourseInformation,
  toControlCourse,
  toControlCourseListItem,
  toCourseSummary,
  toManageCourseListItem,
} from '../dto/course.js'
import { publicProcedure, router } from '../init.js'
import { hasCoursePermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import {
  basicCourseInformationInput,
  controlCourseInput,
  courseSummaryInput,
} from '../schemas/course.js'

const courseExecutePermissionLevels = [
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

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
