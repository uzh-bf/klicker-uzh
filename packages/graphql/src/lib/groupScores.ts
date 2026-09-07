import * as DB from '@klicker-uzh/prisma/client'
import { Prisma } from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'

export async function refreshParticipantGroupScores(
  prisma: PrismaTransactionClient,
  where: DB.Prisma.ParticipantGroupWhereInput
): Promise<string[]> {
  const groups = await prisma.participantGroup.findMany({
    where,
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const groupIds = groups.map((group) => group.id)

  if (groupIds.length === 0) return []

  await prisma.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "ParticipantGroup"
      WHERE "id"::text IN (${Prisma.join(groupIds)})
      ORDER BY "id"
      FOR UPDATE
    `
  )

  const groupsWithMembers = await prisma.participantGroup.findMany({
    where: { id: { in: groupIds } },
    select: {
      id: true,
      courseId: true,
      averageMemberScore: true,
      participants: {
        select: {
          leaderboards: {
            where: {
              type: DB.LeaderboardType.COURSE,
            },
            select: { courseId: true, score: true },
          },
        },
      },
    },
  })

  const touchedGroupIds: string[] = []
  for (const group of groupsWithMembers) {
    const sum = group.participants.reduce((total, participant) => {
      const leaderboard = participant.leaderboards.find(
        (entry) => entry.courseId === group.courseId
      )
      return total + (leaderboard?.score ?? 0)
    }, 0)
    const averageMemberScore =
      group.participants.length > 1
        ? Math.round(sum / group.participants.length)
        : 0

    if (averageMemberScore === group.averageMemberScore) continue

    await prisma.participantGroup.update({
      where: { id: group.id },
      data: { averageMemberScore },
    })
    touchedGroupIds.push(group.id)
  }

  return touchedGroupIds
}
