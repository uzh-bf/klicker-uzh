import type { PrismaClient } from '@klicker-uzh/prisma/client'

export const PARTICIPANT_HEADERS = [
  'participantId',
  'username',
  'email',
  'participantIsActive',
  'isSSOAccount',
  'participationId',
  'participationIsActive',
  'participationCreatedAt',
  'ssoType',
  'ssoId',
  'ssoEmail',
  'participantCreatedAt',
]

export async function fetchParticipants(
  prisma: PrismaClient,
  courseId: string
) {
  return prisma.participation.findMany({
    where: { courseId },
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      participant: {
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          isSSOAccount: true,
          createdAt: true,
          accounts: {
            select: { ssoType: true, ssoId: true, ssoEmail: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { participant: { username: 'asc' } },
  })
}

type ParticipationRow = Awaited<ReturnType<typeof fetchParticipants>>[number]

export function transformParticipant(row: ParticipationRow): unknown[] {
  const account = row.participant.accounts[0]
  return [
    row.participant.id,
    row.participant.username,
    row.participant.email ?? '',
    row.participant.isActive,
    row.participant.isSSOAccount,
    row.id,
    row.isActive,
    row.createdAt.toISOString(),
    account?.ssoType ?? '',
    account?.ssoId ?? '',
    account?.ssoEmail ?? '',
    row.participant.createdAt.toISOString(),
  ]
}
