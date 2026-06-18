import {
  PermissionLevel,
  PublicationStatus,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActiveUserCourse,
  toActiveUserCourseWithoutPermissions,
  toBasicCourseInformation,
  toControlCourse,
  toControlCourseListItem,
  toCourseActivities,
  toCourseSummary,
  toManageCourseListItem,
} from '../dto/course.js'
import { publicProcedure, router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activeUserCoursesInput,
  basicCourseInformationInput,
  controlCourseInput,
  courseActivitiesInput,
  courseActivityIdsInput,
  courseSummaryInput,
  createCourseInput,
  deleteCourseInput,
  toggleArchiveCourseInput,
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

type ScheduledHatchetClient = {
  scheduled: {
    delete: (taskId: string) => Promise<unknown>
  }
}

async function deleteScheduledHatchetTask({
  ctx,
  taskId,
  failureMessage,
}: {
  ctx: TRPCContextWithUser
  taskId: string
  failureMessage: string
}) {
  const hatchet = ctx.hatchet as ScheduledHatchetClient | undefined

  if (!hatchet?.scheduled?.delete) {
    throw new Error('Hatchet client unavailable')
  }

  try {
    await hatchet.scheduled.delete(taskId)
  } catch {
    console.log(failureMessage)
  }
}

async function deleteCourseById(ctx: TRPCContextWithUser, id: string) {
  const prisma = getPrisma(ctx)
  const course = await prisma.course.findUnique({
    where: { id, isAssessmentEnabled: false },
    include: {
      liveQuizzes: true,
      practiceQuizzes: { include: { stacks: { include: { elements: true } } } },
      microLearnings: { include: { stacks: { include: { elements: true } } } },
      groupActivities: { include: { stacks: { include: { elements: true } } } },
    },
  })

  if (!course) {
    throw new Error('Course not found or permission denied')
  }

  const deletedCourse = await prisma.$transaction(
    async (tx) => {
      const deleted = await tx.course.delete({ where: { id } })

      for (const liveQuiz of course.liveQuizzes) {
        await recomputeDerivedPermissions({ liveQuizId: liveQuiz.id }, tx)
      }

      const elementIds = [
        ...new Set([
          ...course.practiceQuizzes.flatMap((quiz) =>
            quiz.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.microLearnings.flatMap((microLearning) =>
            microLearning.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
          ...course.groupActivities.flatMap((groupActivity) =>
            groupActivity.stacks.flatMap((stack) =>
              stack.elements.map((instance) => instance.elementId)
            )
          ),
        ]),
      ]

      for (const elementId of elementIds) {
        await recomputeDerivedPermissions({ elementId }, tx)
      }

      return deleted
    },
    { timeout: 60000 }
  )

  for (const practiceQuiz of course.practiceQuizzes) {
    if (practiceQuiz.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: practiceQuiz.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for practice quiz ${practiceQuiz.id}`,
      })
    }
  }

  for (const microLearning of course.microLearnings) {
    if (microLearning.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: microLearning.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for micro learning ${microLearning.id}`,
      })
    }

    if (microLearning.scheduledCompletionTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: microLearning.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion hatchet job for micro learning ${microLearning.id}`,
      })
    }
  }

  for (const groupActivity of course.groupActivities) {
    if (groupActivity.scheduledPublicationTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: groupActivity.scheduledPublicationTaskId,
        failureMessage: `Failed to delete scheduled publication hatchet job for group activity ${groupActivity.id}`,
      })
    }

    if (groupActivity.scheduledCompletionTaskId) {
      await deleteScheduledHatchetTask({
        ctx,
        taskId: groupActivity.scheduledCompletionTaskId,
        failureMessage: `Failed to delete scheduled completion hatchet job for group activity ${groupActivity.id}`,
      })
    }
  }

  ctx.emitter?.emit('invalidate', { typename: 'Course', id })
  return deletedCourse
}

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

  create: userFullAccessProcedure
    .input(createCourseInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const randomPin = Math.floor(Math.random() * 900000000 + 100000000)

      const course = await prisma.$transaction(
        async (tx) => {
          const newCourse = await tx.course.create({
            data: {
              name: input.name.trim(),
              displayName: input.displayName.trim(),
              description: input.description,
              language: input.language,
              color: input.color ?? '#CCD5ED',
              startDate: input.startDate,
              endDate: input.endDate,
              isGroupCreationEnabled: input.isGroupCreationEnabled,
              groupDeadlineDate: input.groupDeadlineDate,
              maxGroupSize: input.maxGroupSize,
              preferredGroupSize: input.preferredGroupSize,
              notificationEmail: input.notificationEmail,
              isGamificationEnabled: input.isGamificationEnabled,
              isAssessmentEnabled: false,
              pinCode: randomPin,
              owner: {
                connect: {
                  id: ctx.user.sub,
                },
              },
            },
          })

          await recomputeDerivedPermissions(
            {
              courseId: newCourse.id,
              userId: ctx.user.sub,
            },
            tx
          )

          return newCourse
        },
        { timeout: 60000 }
      )

      return {
        course: toManageCourseListItem({
          course: {
            ...course,
            _count: {
              permissions: 1,
            },
          },
          derived: false,
          directPermission: null,
          permissionLevel: PermissionLevel.OWNER,
        }),
      }
    }),

  toggleArchive: userProcedure
    .input(toggleArchiveCourseInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.ADMIN
        ))
      ) {
        return { course: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.update({
        where: { id: input.id, endDate: { lte: new Date() } },
        data: { isArchived: input.isArchived },
        select: {
          id: true,
          isArchived: true,
        },
      })

      return { course }
    }),

  delete: userProcedure
    .input(deleteCourseInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.id,
          PermissionLevel.ADMIN
        ))
      ) {
        return { course: null }
      }

      const course = await deleteCourseById(
        ctx as TRPCContextWithUser,
        input.id
      )

      return { course: { id: course.id } }
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

  activities: userProcedure
    .input(courseActivitiesInput)
    .query(async ({ ctx, input }) => {
      if (
        !(await hasCoursePermission(
          ctx as TRPCContextWithUser,
          input.courseId,
          PermissionLevel.READ
        ))
      ) {
        return { courseActivities: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          name: true,
          practiceQuizzes: {
            where: {
              isDeleted: false,
              status: PublicationStatus.PUBLISHED,
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          microLearnings: {
            where: {
              isDeleted: false,
              status: {
                in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED],
              },
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: { scheduledStartAt: 'desc' },
          },
        },
      })

      return {
        courseActivities: toCourseActivities(course),
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
