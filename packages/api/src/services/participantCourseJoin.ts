import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'node:events'

export async function checkValidCoursePin({
  pin,
  prisma,
}: {
  pin: number
  prisma: PrismaClient
}) {
  const course = await prisma.course.findUnique({
    where: { pinCode: pin },
    select: { id: true, pinCode: true },
  })

  if (!course || course.pinCode !== pin) return null

  return course.id
}

export async function joinCourseWithPin({
  emitter,
  participantId,
  pin,
  prisma,
}: {
  emitter?: EventEmitter
  participantId: string
  pin: number
  prisma: PrismaClient
}) {
  const course = await prisma.course.findUnique({
    where: { pinCode: pin, isAssessmentEnabled: false },
    select: { id: true, isAssessmentEnabled: true, pinCode: true },
  })

  if (!course || course.pinCode !== pin || course.isAssessmentEnabled) {
    return null
  }

  const updatedParticipant = await prisma.participant.update({
    where: { id: participantId },
    data: {
      participations: {
        connectOrCreate: {
          where: {
            courseId_participantId: {
              courseId: course.id,
              participantId,
            },
          },
          create: { course: { connect: { id: course.id } } },
        },
      },
    },
    select: { id: true },
  })

  emitter?.emit('invalidate', {
    typename: 'Participant',
    id: updatedParticipant.id,
  })

  return updatedParticipant
}
