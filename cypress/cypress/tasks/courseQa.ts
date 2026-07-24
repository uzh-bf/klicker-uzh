import { prisma } from '@klicker-uzh/prisma'
import { PermissionLevel } from '@klicker-uzh/prisma/client'

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
}
