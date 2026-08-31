import { prisma } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  InvitationStatus,
  type ParticipantInvitation,
  Prisma,
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
const invitationTransactionRetryLimit = 3
type InvitationTransactionErrorCode = 'P2002' | 'P2034'
type InvitationResultErrorCode = 'invalid_email'

export const MAX_PARTICIPANT_INVITATION_IMPORT_SIZE = 200
export const DEFAULT_PARTICIPANT_INVITATION_PAGE_SIZE = 50
export const MAX_PARTICIPANT_INVITATION_PAGE_SIZE = 50

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
  errorCode?: InvitationResultErrorCode
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

function isPrismaError(error: unknown, code: InvitationTransactionErrorCode) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

export function isSoleEligibleParticipant(
  participantIds: string[],
  participantId: string
) {
  return participantIds.length === 1 && participantIds[0] === participantId
}

export async function withSerializableInvitationTransaction<T>(
  prismaClient: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  retryableCodes: readonly InvitationTransactionErrorCode[] = ['P2034']
): Promise<T> {
  for (let attempt = 0; attempt < invitationTransactionRetryLimit; attempt++) {
    try {
      return await prismaClient.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (
        !retryableCodes.some((code) => isPrismaError(error, code)) ||
        attempt === invitationTransactionRetryLimit - 1
      ) {
        throw error
      }
    }
  }

  throw new Error('Invitation transaction retry limit exceeded')
}

/**
 * Creates participant invitations and automatically accepts them for existing verified users
 * Only uses ParticipantAccount SSO IDs for matching (not participant.email which is unvalidated)
 */
export interface CreateInvitationsOptions {
  emailMode?: InvitationEmailMode
}

export interface ParticipantInvitationPage {
  invitations: ParticipantInvitation[]
  totalCount: number
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
    where: { id: courseId, isDeleted: false },
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
        errorCode: 'invalid_email',
        error: 'Invalid email format',
      })
      continue
    }

    const existingResult = await recordExistingInvitationIfPresent(
      normalizedEmail,
      courseId,
      normalizedMatriculationNumber,
      prismaClient
    )

    if (existingResult) {
      results.push(existingResult)
      continue
    }

    const participantId = await findEligibleParticipantId(
      normalizedEmail,
      emailMode,
      prismaClient
    )

    if (participantId) {
      try {
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
      } catch (error: unknown) {
        if (!isPrismaError(error, 'P2002')) throw error
      }
    }

    results.push(
      await createOrRecordPendingInvitation(
        normalizedEmail,
        courseId,
        normalizedMatriculationNumber,
        prismaClient
      )
    )
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

async function recordExistingInvitationIfPresent(
  normalizedEmail: string,
  courseId: string,
  matriculationNumber: string | null,
  prismaClient: PrismaClient
): Promise<InvitationResult | null> {
  const existingInvitation =
    await prismaClient.participantInvitation.findUnique({
      where: {
        email_courseId: {
          email: normalizedEmail,
          courseId,
        },
      },
    })

  if (!existingInvitation) return null

  return withSerializableInvitationTransaction(prismaClient, async (tx) => {
    const currentInvitation = await tx.participantInvitation.findUnique({
      where: {
        email_courseId: {
          email: normalizedEmail,
          courseId,
        },
      },
    })

    if (!currentInvitation) return null

    return recordDuplicateInvitation(
      currentInvitation,
      normalizedEmail,
      matriculationNumber,
      tx
    )
  })
}

async function createOrRecordPendingInvitation(
  normalizedEmail: string,
  courseId: string,
  matriculationNumber: string | null,
  prismaClient: PrismaClient
): Promise<InvitationResult> {
  return withSerializableInvitationTransaction(
    prismaClient,
    async (tx) => {
      const existingInvitation = await tx.participantInvitation.findUnique({
        where: {
          email_courseId: {
            email: normalizedEmail,
            courseId,
          },
        },
      })

      if (existingInvitation) {
        const duplicateResult = await recordDuplicateInvitation(
          existingInvitation,
          normalizedEmail,
          matriculationNumber,
          tx
        )

        if (duplicateResult) return duplicateResult
      }

      const invitation = await tx.participantInvitation.create({
        data: {
          email: normalizedEmail,
          courseId,
          status: InvitationStatus.PENDING,
          matriculationNumber,
        },
      })

      return {
        email: normalizedEmail,
        status: 'created',
        invitationId: invitation.id,
      }
    },
    ['P2002', 'P2034']
  )
}

async function recordDuplicateInvitation(
  existingInvitation: ParticipantInvitation,
  normalizedEmail: string,
  normalizedMatriculationNumber: string | null,
  prismaClient: Pick<PrismaClient, 'participantInvitation'>
): Promise<InvitationResult | null> {
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
      const currentInvitation =
        await prismaClient.participantInvitation.findUnique({
          where: { id: existingInvitation.id },
        })

      if (!currentInvitation) return null

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
  return withSerializableInvitationTransaction(prismaClient, async (tx) => {
    const eligibleParticipantIds = await findEligibleParticipantIds(
      email,
      emailMode,
      tx
    )

    if (!isSoleEligibleParticipant(eligibleParticipantIds, participantId)) {
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
    where: { id: courseId, isDeleted: false },
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

export async function getAssessmentParticipantInvitationPage(
  {
    courseId,
    numEntries,
    offset,
  }: {
    courseId: string
    numEntries?: number | null
    offset?: number | null
  },
  ctx: ContextWithUser
): Promise<ParticipantInvitationPage> {
  await requireAssessmentCourse(courseId, ctx.prisma)

  const take = Math.min(
    Math.max(numEntries ?? DEFAULT_PARTICIPANT_INVITATION_PAGE_SIZE, 1),
    MAX_PARTICIPANT_INVITATION_PAGE_SIZE
  )
  const skip = Math.max(offset ?? 0, 0)
  const where = { courseId }
  const [invitations, totalCount] = await Promise.all([
    ctx.prisma.participantInvitation.findMany({
      where,
      orderBy: [{ invitedAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    }),
    ctx.prisma.participantInvitation.count({ where }),
  ])

  return { invitations, totalCount }
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

  if (invitations.length > MAX_PARTICIPANT_INVITATION_IMPORT_SIZE) {
    throw new GraphQLError(
      `Invitation imports are limited to ${MAX_PARTICIPANT_INVITATION_IMPORT_SIZE} rows.`,
      { extensions: { code: 'INVITATION_IMPORT_LIMIT_EXCEEDED' } }
    )
  }

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
