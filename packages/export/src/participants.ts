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
            select: {
              ssoType: true,
              ssoId: true,
              ssoEmail: true,
              isPrimary: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { participant: { email: 'asc' } },
  })
}

type ParticipationRow = Awaited<ReturnType<typeof fetchParticipants>>[number]
type ParticipantAccountRow = ParticipationRow['participant']['accounts'][number]

function pickParticipantAccount(accounts: ParticipantAccountRow[]) {
  return [...accounts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1

    const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime()
    if (createdAtDiff !== 0) return createdAtDiff

    const typeDiff = a.ssoType.localeCompare(b.ssoType)
    if (typeDiff !== 0) return typeDiff

    return a.ssoId.localeCompare(b.ssoId)
  })[0]
}

export function transformParticipant(row: ParticipationRow): unknown[] {
  const account = pickParticipantAccount(row.participant.accounts)
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
