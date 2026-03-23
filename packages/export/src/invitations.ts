import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const INVITATION_HEADERS = [
  'invitationId',
  'email',
  'matriculationNumber',
  'status',
  'invitedAt',
  'acceptedAt',
  'participantId',
]

export async function fetchInvitations(
  prisma: ReadonlyPrismaClient,
  courseId: string
) {
  return prisma.participantInvitation.findMany({
    where: { courseId },
    select: {
      id: true,
      email: true,
      matriculationNumber: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      participant: { select: { id: true } },
    },
    orderBy: { email: 'asc' },
  })
}

type InvitationRow = Awaited<ReturnType<typeof fetchInvitations>>[number]

export function transformInvitation(row: InvitationRow): unknown[] {
  return [
    row.id,
    row.email,
    row.matriculationNumber ?? '',
    row.status,
    row.invitedAt.toISOString(),
    row.acceptedAt?.toISOString() ?? '',
    row.participant?.id ?? '',
  ]
}
