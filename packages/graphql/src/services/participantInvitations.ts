import { prisma } from '@klicker-uzh/prisma'
import { CourseAuthType, InvitationStatus } from '@klicker-uzh/prisma/client'
import {
  InvitationEmailMode,
  InvitationEmailMode as InvitationEmailModeValue,
  normalizeEmail,
  normalizeMatriculationNumber,
} from '@klicker-uzh/util'
import * as R from 'remeda'

export interface InvitationResult {
  email: string
  status: 'created' | 'auto_accepted' | 'duplicate' | 'duplicate_updated' | 'error'
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

export interface CreateParticipantInvitationInput {
  email: string
  matriculationNumber?: string | null
}

/**
 * Creates participant invitations and automatically accepts them for existing verified users
 * Only uses ParticipantAccount SSO IDs for matching (not participant.email which is unvalidated)
 */
export interface CreateInvitationsOptions {
  emailMode?: InvitationEmailMode
}

export async function createParticipantInvitations(
  courseId: string,
  invitations: CreateParticipantInvitationInput[],
  options: CreateInvitationsOptions = {}
): Promise<CreateInvitationsResponse> {
  const results: InvitationResult[] = []

  const emailMode = options.emailMode ?? InvitationEmailMode.AffiliationsOnly

  // Validate course exists and has SSO enabled
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course) {
    throw new Error('Course not found')
  }

  if (course.authType !== CourseAuthType.SSO) {
    throw new Error(
      'Course does not use SSO authentication. Only SSO courses can have invitations.'
    )
  }

  // Process all invitations
  for (const invitationInput of invitations) {
    const rawEmail = invitationInput.email
    const normalizedEmail = normalizeEmail(rawEmail)
    const normalizedMatriculationNumber = normalizeMatriculationNumber(
      invitationInput.matriculationNumber
    )

    if (!normalizedEmail) {
      results.push({
        email: rawEmail,
        status: 'error',
        error: 'Invalid email format',
      })
      continue
    }

    try {
      // Check for existing invitation
      const existingInvitation = await prisma.participantInvitation.findUnique({
        where: {
          email_courseId: {
            email: normalizedEmail,
            courseId,
          },
        },
      })

      if (existingInvitation) {
        const matriculationUpdated =
          normalizedMatriculationNumber &&
          existingInvitation.matriculationNumber !== normalizedMatriculationNumber

        if (matriculationUpdated) {
          await prisma.participantInvitation.update({
            where: { id: existingInvitation.id },
            data: {
              matriculationNumber: normalizedMatriculationNumber,
            },
          })
        }

        results.push({
          email: normalizedEmail,
          status: matriculationUpdated ? 'duplicate_updated' : 'duplicate',
          invitationId: existingInvitation.id,
        })
        continue
      }

      // Check for existing verified ParticipantAccount with matching email
      const participantAccount = await prisma.participantAccount.findFirst({
        where: {
          ssoEmail: normalizedEmail,
          isVerified: true,
          ...(emailMode === InvitationEmailModeValue.AffiliationsOnly
            ? { type: 'affiliation' }
            : {}),
        },
        include: {
          participant: true,
        },
      })

      if (participantAccount?.participant) {
        // Auto-accept invitation for existing verified user
        const result = await autoAcceptInvitation(
          normalizedEmail,
          courseId,
          participantAccount.participant.id,
          normalizedMatriculationNumber
        )

        results.push({
          email: normalizedEmail,
          status: 'auto_accepted',
          invitationId: result.invitationId,
          participantId: participantAccount.participant.id,
        })
      } else {
        // Create pending invitation
        const invitation = await prisma.participantInvitation.create({
          data: {
            email: normalizedEmail,
            courseId,
            status: InvitationStatus.PENDING,
            matriculationNumber: normalizedMatriculationNumber,
          },
        })

        results.push({
          email: normalizedEmail,
          status: 'created',
          invitationId: invitation.id,
        })
      }
    } catch (error: any) {
      results.push({
        email: normalizedEmail ?? rawEmail,
        status: 'error',
        error: error.message,
      })
    }
  }

  // Count results by status using Remeda
  const statusCounts = R.pipe(
    results,
    R.groupBy(R.prop('status')),
    R.mapValues((items) => items.length)
  )

  return {
    totalProcessed: invitations.length,
    created: statusCounts.created || 0,
    autoAccepted: statusCounts.auto_accepted || 0,
    duplicates: (statusCounts.duplicate || 0) + (statusCounts.duplicate_updated || 0),
    errors: statusCounts.error || 0,
    results,
  }
}

async function autoAcceptInvitation(
  email: string,
  courseId: string,
  participantId: string,
  matriculationNumber: string | null
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
        matriculationNumber,
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
