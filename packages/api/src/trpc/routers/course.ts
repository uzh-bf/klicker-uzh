import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { getPrisma } from '../context.js'
import { toControlCourse, toControlCourseListItem } from '../dto/course.js'
import { router } from '../init.js'
import { userProcedure } from '../procedures.js'
import { controlCourseInput } from '../schemas/course.js'

const courseExecutePermissionLevels = [
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

export const courseRouter = router({
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
