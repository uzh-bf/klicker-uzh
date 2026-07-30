import { prisma } from '@klicker-uzh/prisma'

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
}
