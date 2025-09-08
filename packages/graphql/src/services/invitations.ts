import type { ContextWithUser } from '../lib/context.js'

export async function getCourseInvitations(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const invitations = await ctx.prisma.participantInvitation.findMany({
    where: { courseId },
    include: {
      participant: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      course: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { invitedAt: 'desc' }],
  })

  return invitations
}

export async function getParticipantInvitations(
  { participantId }: { participantId: string },
  ctx: ContextWithUser
) {
  const invitations = await ctx.prisma.participantInvitation.findMany({
    where: {
      participantId,
      status: 'ACCEPTED',
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          displayName: true,
          isAssessmentEnabled: true,
        },
      },
    },
    orderBy: { acceptedAt: 'desc' },
  })

  return invitations
}

export async function createInvitations(
  { courseId, emails }: { courseId: string; emails: string[] },
  ctx: ContextWithUser
) {
  // Verify the course exists and is assessment enabled
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) {
    throw new Error('Course not found')
  }

  if (!course.isAssessmentEnabled) {
    throw new Error('Only assessment courses can have invitations')
  }

  const normalizedEmails = emails.map((email) => email.toLowerCase().trim())

  let created = 0
  let duplicates = 0
  const errors: string[] = []

  for (const email of normalizedEmails) {
    // Basic email validation
    if (!email.includes('@')) {
      errors.push(`Invalid email format: ${email}`)
      continue
    }

    try {
      await ctx.prisma.participantInvitation.create({
        data: {
          email,
          courseId,
          status: 'PENDING',
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        duplicates++
      } else {
        errors.push(`Error creating invitation for ${email}: ${error.message}`)
      }
    }
  }

  return {
    created,
    duplicates,
    errors,
  }
}

export async function getInvitationStatistics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const [total, pending, accepted] = await Promise.all([
    ctx.prisma.participantInvitation.count({
      where: { courseId },
    }),
    ctx.prisma.participantInvitation.count({
      where: {
        courseId,
        status: 'PENDING',
      },
    }),
    ctx.prisma.participantInvitation.count({
      where: {
        courseId,
        status: 'ACCEPTED',
      },
    }),
  ])

  return {
    total,
    pending,
    accepted,
  }
}
