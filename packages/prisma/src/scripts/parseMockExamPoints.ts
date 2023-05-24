import { LeaderboardType, PrismaClient } from '../client'

import { mockExam } from '../data/mockExam'

async function main() {
  const prisma = new PrismaClient()

  const results = (
    await Promise.all(
      Object.entries(mockExam).flatMap(async ([username, points]) => {
        const participant = await prisma.participant.findUnique({
          where: {
            username,
          },
          include: {
            leaderboards: {
              where: {
                type: LeaderboardType.COURSE,
                courseId: 'f7ceeba0-ef5a-4d0b-a992-a44a1395cbf9',
              },
            },
          },
        })

        if (!participant?.leaderboards[0]) {
          return
        }

        return {
          leaderboardId: participant.leaderboards[0].id,
          points: Math.round((points / 90) * 1500),
        }
      })
    )
  ).filter(Boolean)

  await prisma.$transaction(
    results.map(({ leaderboardId, points }: any) =>
      prisma.leaderboardEntry.update({
        where: {
          id: leaderboardId,
        },
        data: {
          score: {
            increment: points,
          },
        },
      })
    )
  )
}

main()
