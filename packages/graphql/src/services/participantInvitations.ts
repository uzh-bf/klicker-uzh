import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  InvitationStatus,
  type ParticipantInvitation,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  InvitationEmailMode,
  normalizeEmail,
  normalizeMatriculationNumber,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import * as R from 'remeda'
import * as z from 'zod'
import type { ContextWithUser } from '../lib/context.js'

const invitationEmailSchema = z.string().email()

export interface InvitationResult {
  email: string
  status:
    | 'created'
    | 'auto_accepted'
    | 'duplicate'
    | 'duplicate_updated'
    | 'error'
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

export function deduplicateParticipantInvitationInputs(
  invitations: CreateParticipantInvitationInput[]
): CreateParticipantInvitationInput[] {
  const uniqueInvitations = new Map<string, CreateParticipantInvitationInput>()

  for (const invitation of invitations) {
    const normalizedEmail = invitation.email.toLowerCase()
    const existingInvitation = uniqueInvitations.get(normalizedEmail)

    if (
      !existingInvitation ||
      (existingInvitation.matriculationNumber == null &&
        invitation.matriculationNumber != null)
    ) {
      uniqueInvitations.set(normalizedEmail, invitation)
    }
  }

  return [...uniqueInvitations.values()]
}

function isPrismaError(error: unknown, code: 'P2002') {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
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
  options: CreateInvitationsOptions = {},
  prismaClient: PrismaClient = prisma
): Promise<CreateInvitationsResponse> {
  const results: InvitationResult[] = []

  const emailMode = options.emailMode ?? InvitationEmailMode.AffiliationsOnly

  // Validate course exists and has SSO enabled
  const course = await prismaClient.course.findUnique({
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

    if (
      !normalizedEmail ||
      !invitationEmailSchema.safeParse(normalizedEmail).success
    ) {
      results.push({
        email: rawEmail,
        status: 'error',
        error: 'Invalid email format',
      })
      continue
    }

    try {
      // Check for existing invitation
      const existingInvitation =
        await prismaClient.participantInvitation.findUnique({
          where: {
            email_courseId: {
              email: normalizedEmail,
              courseId,
            },
          },
        })

      if (existingInvitation) {
        results.push(
          await recordDuplicateInvitation(
            existingInvitation,
            normalizedEmail,
            normalizedMatriculationNumber,
            prismaClient
          )
        )
        continue
      }

      const participantId = await findEligibleParticipantId(
        normalizedEmail,
        emailMode,
        prismaClient
      )

      if (participantId) {
        // Auto-accept invitation for existing verified user
        const invitationId = await autoAcceptInvitation(
          normalizedEmail,
          courseId,
          participantId,
          normalizedMatriculationNumber,
          emailMode,
          prismaClient
        )

        if (invitationId !== null) {
          results.push({
            email: normalizedEmail,
            status: 'auto_accepted',
            invitationId,
            participantId,
          })
          continue
        }
      }

      // Create pending invitation
      const invitation = await prismaClient.participantInvitation.create({
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
    } catch (error: unknown) {
      if (!isPrismaError(error, 'P2002')) throw error

      const existingInvitation =
        await prismaClient.participantInvitation.findUnique({
          where: {
            email_courseId: {
              email: normalizedEmail,
              courseId,
            },
          },
        })

      if (!existingInvitation) throw error

      results.push(
        await recordDuplicateInvitation(
          existingInvitation,
          normalizedEmail,
          normalizedMatriculationNumber,
          prismaClient
        )
      )
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
    duplicates:
      (statusCounts.duplicate || 0) + (statusCounts.duplicate_updated || 0),
    errors: statusCounts.error || 0,
    results,
  }
}

async function recordDuplicateInvitation(
  existingInvitation: ParticipantInvitation,
  normalizedEmail: string,
  normalizedMatriculationNumber: string | null,
  prismaClient: PrismaClient
): Promise<InvitationResult> {
  const matriculationUpdated =
    existingInvitation.status === InvitationStatus.PENDING &&
    normalizedMatriculationNumber != null &&
    existingInvitation.matriculationNumber !== normalizedMatriculationNumber

  if (matriculationUpdated) {
    const updateResult = await prismaClient.participantInvitation.updateMany({
      where: {
        id: existingInvitation.id,
        status: InvitationStatus.PENDING,
        matriculationNumber: existingInvitation.matriculationNumber,
      },
      data: { matriculationNumber: normalizedMatriculationNumber },
    })

    if (updateResult.count === 0) {
      return {
        email: normalizedEmail,
        status: 'duplicate',
        invitationId: existingInvitation.id,
      }
    }
  }

  return {
    email: normalizedEmail,
    status: matriculationUpdated ? 'duplicate_updated' : 'duplicate',
    invitationId: existingInvitation.id,
  }
}

async function findEligibleParticipantId(
  normalizedEmail: string,
  emailMode: InvitationEmailMode,
  prismaClient: Pick<PrismaClient, 'participantAccount'>
): Promise<string | null> {
  const participantIds = await findEligibleParticipantIds(
    normalizedEmail,
    emailMode,
    prismaClient
  )
  return participantIds.length === 1 ? (participantIds[0] ?? null) : null
}

export async function findEligibleParticipantIds(
  normalizedEmail: string,
  emailMode: InvitationEmailMode,
  prismaClient: Pick<PrismaClient, 'participantAccount'>
): Promise<string[]> {
  const accounts = await prismaClient.participantAccount.findMany({
    where: {
      ssoEmail: normalizedEmail,
      isVerified: true,
      participant: { isActive: true },
      ...(emailMode === InvitationEmailMode.AffiliationsOnly
        ? { type: 'affiliation' }
        : {}),
    },
    select: { participantId: true },
  })

  return [...new Set(accounts.map((account) => account.participantId))]
}

async function autoAcceptInvitation(
  email: string,
  courseId: string,
  participantId: string,
  matriculationNumber: string | null,
  emailMode: InvitationEmailMode,
  prismaClient: PrismaClient
): Promise<number | null> {
  // Use transaction to ensure data consistency
  return prismaClient.$transaction(async (tx) => {
    const eligibleParticipantIds = await findEligibleParticipantIds(
      email,
      emailMode,
      tx
    )

    if (
      eligibleParticipantIds.length !== 1 ||
      eligibleParticipantIds[0] !== participantId
    ) {
      return null
    }

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
    await tx.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
      create: {
        courseId,
        participantId,
      },
      update: {},
    })

    return invitation.id
  })
}

async function requireAssessmentCourse(
  courseId: string,
  prismaClient: PrismaClient
) {
  const course = await prismaClient.course.findUnique({
    where: { id: courseId },
    select: { id: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new GraphQLError('Assessment course not found', {
      extensions: { code: 'ASSESSMENT_COURSE_NOT_FOUND' },
    })
  }

  if (!course.isAssessmentEnabled) {
    throw new GraphQLError('Course is not assessment-enabled', {
      extensions: { code: 'COURSE_NOT_ASSESSMENT' },
    })
  }
}

export async function getAssessmentParticipantInvitations(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
): Promise<ParticipantInvitation[]> {
  await requireAssessmentCourse(courseId, ctx.prisma)

  return ctx.prisma.participantInvitation.findMany({
    where: { courseId },
    orderBy: [{ invitedAt: 'desc' }, { id: 'desc' }],
  })
}

export async function createAssessmentParticipantInvitations(
  {
    courseId,
    invitations,
  }: {
    courseId: string
    invitations: CreateParticipantInvitationInput[]
  },
  ctx: ContextWithUser
): Promise<CreateInvitationsResponse> {
  await requireAssessmentCourse(courseId, ctx.prisma)

  return createParticipantInvitations(courseId, invitations, {}, ctx.prisma)
}

export async function deletePendingAssessmentParticipantInvitation(
  { courseId, invitationId }: { courseId: string; invitationId: number },
  ctx: ContextWithUser
): Promise<ParticipantInvitation> {
  await requireAssessmentCourse(courseId, ctx.prisma)

  const invitation = await ctx.prisma.participantInvitation.findFirst({
    where: { id: invitationId, courseId },
  })

  if (!invitation) {
    throw new GraphQLError('Participant invitation not found', {
      extensions: { code: 'INVITATION_NOT_FOUND' },
    })
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new GraphQLError('Only pending invitations can be deleted', {
      extensions: { code: 'INVITATION_NOT_PENDING' },
    })
  }

  const deleted = await ctx.prisma.participantInvitation.deleteMany({
    where: {
      id: invitationId,
      courseId,
      status: InvitationStatus.PENDING,
    },
  })

  if (deleted.count === 0) {
    throw new GraphQLError('Only pending invitations can be deleted', {
      extensions: { code: 'INVITATION_NOT_PENDING' },
    })
  }

  return invitation
}
