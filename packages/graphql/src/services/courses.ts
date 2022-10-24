import { pick } from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

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

export async function joinCourseWithPin(
  { courseId, pin }: { courseId: string; pin: number },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course || course.pinCode !== pin) {
    return null
  }

  // update the participants participations and set the newest one to be active
  const updatedParticipant = await ctx.prisma.participant.update({
    where: { id: ctx.user.sub },
    data: {
      participations: {
        connectOrCreate: {
          where: {
            courseId_participantId: { courseId, participantId: ctx.user.sub },
          },
          create: { course: { connect: { id: courseId } }, isActive: true },
        },
      },
    },
  })

  return updatedParticipant
}
