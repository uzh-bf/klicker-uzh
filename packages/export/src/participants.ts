import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const PARTICIPANT_HEADERS = [
  'participantId',
  'email',
  'participationIsActive',
  'participationCreatedAt',
  'ssoType',
  'ssoId',
  'ssoEmail',
  'participantCreatedAt',
]

export async function fetchParticipants(
  prisma: ReadonlyPrismaClient,
  courseId: string
) {
  return prisma.participation.findMany({
    where: { courseId },
    select: {
      isActive: true,
      createdAt: true,
      participant: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          accounts: {
            select: { ssoType: true, ssoId: true, ssoEmail: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { participant: { email: 'asc' } },
  })
}

type ParticipationRow = Awaited<ReturnType<typeof fetchParticipants>>[number]

export function transformParticipant(row: ParticipationRow): unknown[] {
  const account = row.participant.accounts[0]
  return [
    row.participant.id,
    row.participant.email ?? '',
    row.isActive,
    row.createdAt.toISOString(),
    account?.ssoType ?? '',
    account?.ssoId ?? '',
    account?.ssoEmail ?? '',
    row.participant.createdAt.toISOString(),
  ]
}
