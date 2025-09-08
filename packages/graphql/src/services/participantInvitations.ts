import { prisma } from '@klicker-uzh/prisma'
import { InvitationStatus } from '@klicker-uzh/prisma/client'

export interface InvitationResult {
  email: string
  status: 'created' | 'auto_accepted' | 'duplicate' | 'error'
  invitationId?: number
  participantId?: string
  error?: string
}

export interface CreateInvitationsResponse {
  totalProcessed: number
  created: number
  autoAccepted: number
  duplicates: number
  errors: number
  results: InvitationResult[]
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Creates participant invitations and automatically accepts them for existing verified users
 * Only uses ParticipantAccount SSO IDs for matching (not participant.email which is unvalidated)
 */
export async function createParticipantInvitations(
  courseId: string,
  emails: string[]
): Promise<CreateInvitationsResponse> {
  const results: InvitationResult[] = []
  let created = 0
  let autoAccepted = 0
  let duplicates = 0
  let errors = 0

  // Validate course exists and is assessment enabled
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) {
    throw new Error('Course not found')
  }

  if (!course.isAssessmentEnabled) {
    throw new Error(
      'Course is not assessment enabled. Only assessment courses can have invitations.'
    )
  }

  // Process all emails
  for (const rawEmail of emails) {
    const email = rawEmail.toLowerCase().trim()

    // Validate email format
    if (!validateEmail(email)) {
      results.push({
        email: rawEmail,
        status: 'error',
        error: 'Invalid email format',
      })
      errors++
      continue
    }

    try {
      // Check for existing invitation
      const existingInvitation = await prisma.participantInvitation.findUnique({
        where: {
          email_courseId: {
            email,
            courseId,
          },
        },
      })

      if (existingInvitation) {
        results.push({
          email,
          status: 'duplicate',
          invitationId: existingInvitation.id,
        })
        duplicates++
        continue
      }

      // Check for existing verified ParticipantAccount with matching ssoId
      const participantAccount = await prisma.participantAccount.findFirst({
        where: {
          ssoId: email,
          isVerified: true,
        },
        include: {
          participant: true,
        },
      })

      if (participantAccount?.participant) {
        // Auto-accept invitation for existing verified user
        const result = await autoAcceptInvitation(
          email,
          courseId,
          participantAccount.participant.id
        )

        results.push({
          email,
          status: 'auto_accepted',
          invitationId: result.invitationId,
          participantId: participantAccount.participant.id,
        })
        autoAccepted++
      } else {
        // Create pending invitation
        const invitation = await prisma.participantInvitation.create({
          data: {
            email,
            courseId,
            status: InvitationStatus.PENDING,
          },
        })

        results.push({
          email,
          status: 'created',
          invitationId: invitation.id,
        })
        created++
      }
    } catch (error: any) {
      results.push({
        email,
        status: 'error',
        error: error.message,
      })
      errors++
    }
  }

  return {
    totalProcessed: emails.length,
    created,
    autoAccepted,
    duplicates,
    errors,
    results,
  }
}

async function autoAcceptInvitation(
  email: string,
  courseId: string,
  participantId: string
): Promise<{ invitationId: number; participationId: number }> {
  // Use transaction to ensure data consistency
  const result = await prisma.$transaction(async (tx) => {
    // Create the invitation as ACCEPTED
    const invitation = await tx.participantInvitation.create({
      data: {
        email,
        courseId,
        status: InvitationStatus.ACCEPTED,
        participantId,
        acceptedAt: new Date(),
      },
    })

    // Create or update participation
    const participation = await tx.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
      create: {
        courseId,
        participantId,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })

    return {
      invitationId: invitation.id,
      participationId: participation.id,
    }
  })

  return result
}

/**
 * Get invitations for a course (for admin/debugging)
 */
export async function getCourseInvitations(courseId: string) {
  return await prisma.participantInvitation.findMany({
    where: { courseId },
    include: {
      participant: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { invitedAt: 'desc' }],
  })
}

/**
 * Get invitations for a participant (for debugging)
 */
export async function getParticipantInvitations(participantId: string) {
  return await prisma.participantInvitation.findMany({
    where: { participantId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
    orderBy: { invitedAt: 'desc' },
  })
}
