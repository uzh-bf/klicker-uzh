import { pick } from 'ramda'
import { ContextWithOptionalUser } from '../lib/context'

export async function getBasicCourseInformation(
  { courseId }: { courseId: string },
  ctx: ContextWithOptionalUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) {
    return null
  }
  return pick(['id', 'name', 'displayName', 'description', 'color'], course)
}
