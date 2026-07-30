import { prisma } from '@klicker-uzh/prisma'
import {
  DiscussionScopeType,
  DiscussionSpaceType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'

export const courseQATasks = {
  async setCourseQAFlags({
    courseName,
    isCourseQARolloutEnabled,
    isCourseQAEnabled,
    isCourseQAAnonymousEnabled,
    isGamificationEnabled,
    isAssessmentEnabled,
    description,
  }: {
    courseName: string
    isCourseQARolloutEnabled?: boolean
    isCourseQAEnabled?: boolean
    isCourseQAAnonymousEnabled?: boolean
    isGamificationEnabled?: boolean
    isAssessmentEnabled?: boolean
    description?: string | null
  }) {
    const course = await prisma.course.findFirst({
      where: { name: courseName },
    })
    if (!course) return false

    await prisma.course.update({
      where: { id: course.id },
      data: {
        ...(typeof isCourseQARolloutEnabled === 'boolean' && {
          isCourseQARolloutEnabled,
        }),
        ...(typeof isCourseQAEnabled === 'boolean' && {
          isCourseQAEnabled,
        }),
        ...(typeof isCourseQAAnonymousEnabled === 'boolean' && {
          isCourseQAAnonymousEnabled,
        }),
        ...(typeof isGamificationEnabled === 'boolean' && {
          isGamificationEnabled,
        }),
        ...(typeof isAssessmentEnabled === 'boolean' && {
          isAssessmentEnabled,
        }),
        ...(description !== undefined && { description }),
      },
    })
    return true
  },

  async getCourseOverviewSettings({ courseName }: { courseName: string }) {
    return prisma.course.findFirst({
      where: { name: courseName },
      select: {
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
        description: true,
      },
    })
  },

  async grantCourseReadAccess({
    courseName,
    userEmail,
  }: {
    courseName: string
    userEmail: string
  }) {
    const [course, user] = await Promise.all([
      prisma.course.findFirst({ where: { name: courseName } }),
      prisma.user.findUnique({ where: { email: userEmail } }),
    ])
    if (!course || !user) return false

    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: user.id,
        },
      },
      create: {
        courseId: course.id,
        userId: user.id,
        permissionLevel: PermissionLevel.READ,
      },
      update: {
        permissionLevel: PermissionLevel.READ,
      },
    })
    return true
  },

  async seedCourseDiscussionThreads({
    courseName,
    contents,
    replaceExisting = false,
  }: {
    courseName: string
    contents: string[]
    replaceExisting?: boolean
  }) {
    const course = await prisma.course.findFirst({
      where: { name: courseName },
      select: { id: true },
    })
    if (!course) return false

    const space = await prisma.discussionSpace.upsert({
      where: { courseId: course.id },
      create: {
        courseId: course.id,
        spaceType: DiscussionSpaceType.COURSE,
      },
      update: {},
    })
    const scope = await prisma.discussionScope.upsert({
      where: {
        spaceId_scopeKey: {
          spaceId: space.id,
          scopeKey: `course:${course.id}`,
        },
      },
      create: {
        spaceId: space.id,
        scopeType: DiscussionScopeType.COURSE,
        scopeKey: `course:${course.id}`,
        scopeLabel: 'Course',
      },
      update: {},
    })
    if (replaceExisting) {
      await prisma.discussionThread.deleteMany({
        where: {
          scope: {
            spaceId: space.id,
          },
        },
      })
    }
    const createdAt = Date.now()

    await prisma.discussionThread.createMany({
      data: contents.map((content, index) => ({
        scopeId: scope.id,
        content,
        createdAt: new Date(createdAt - (contents.length - index) * 1000),
        lastActivityAt: new Date(createdAt - (contents.length - index) * 1000),
      })),
    })
    return true
  },
}
