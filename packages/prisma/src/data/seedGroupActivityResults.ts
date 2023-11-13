import Prisma from '../../dist'

async function seed(prisma: Prisma.PrismaClient) {
  const results: Record<
    number,
    { points: number; maxPoints: number; message: string }
  > = {
    1: {
      points: 150, // 50 per question
      maxPoints: 200, // 50 per question
      message: '[Feedback als PDF](LINK TO PDF)',
    },
  }

  let promises = []
  for (const [key, value] of Object.entries(results)) {
    promises.push(
      ...(await seedResults(
        { instanceId: parseInt(key), result: value },
        prisma
      ))
    )
  }

  await prisma.$transaction(promises)
}

interface SeedResultsArgs {
  instanceId: number
  result: { points: number; maxPoints: number; message: string }
}

async function seedResults(
  { instanceId, result }: SeedResultsArgs,
  prisma: Prisma.PrismaClient
) {
  // TODO: adapt ids to values from ids object
  const groupActivityInstance = await prisma.groupActivityInstance.findFirst({
    where: {
      id: instanceId,
    },
    include: {
      group: {
        include: {
          participants: true,
          course: true,
        },
      },
    },
  })

  if (!groupActivityInstance) {
    throw new Error(`No group activity instance found for id ${instanceId}`)
  }

  const courseId = groupActivityInstance.group.courseId

  if (!courseId) {
    throw new Error(
      `No course id found for group activity instance ${instanceId}`
    )
  }

  let promises = []
  promises.push(
    prisma.groupActivityInstance.update({
      where: {
        id: instanceId,
      },
      data: {
        results: result,
        group: {
          update: {
            groupActivityScore: {
              increment: result.points,
            },
          },
        },
      },
    })
  )

  // create a map between participants and achievement ids
  const participantAchievementMap =
    groupActivityInstance.group.participants.reduce<Record<string, number[]>>(
      (acc, participant) => {
        acc[participant.id] = [9]
        if (result.points / result.maxPoints >= 0.5) {
          acc[participant.id].push(8)
        }
        return acc
      },
      {}
    )

  // get achievements with the ids used above and map the ids to the points and experience points
  const participationAchievement = await prisma.achievement.findUnique({
    where: {
      id: 9,
    },
  })
  const passedAchievement = await prisma.achievement.findUnique({
    where: {
      id: 8,
    },
  })

  if (!participationAchievement || !passedAchievement) {
    throw new Error('Achievements not found')
  }

  // award experience points to the participants
  const participantIds = Object.keys(participantAchievementMap)
  promises.push(
    ...participantIds.map((participantId) =>
      prisma.participant.update({
        where: {
          id: participantId,
        },
        data: {
          xp: {
            increment:
              (participationAchievement.rewardedXP ?? 0) +
              (result.points / result.maxPoints >= 0.5 ? 1 : 0) *
                (passedAchievement.rewardedXP ?? 0),
          },
        },
      })
    )
  )

  // update participation with achievement points on the course leaderboard
  const leaderboardParticipantIds = await Promise.allSettled(
    participantIds.map(async (participantId) => {
      return prisma.leaderboardEntry.findUniqueOrThrow({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId,
            courseId: courseId,
          },
        },
      })
    })
  ).then((result) =>
    result.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value.participantId
      return []
    })
  )

  promises.push(
    ...leaderboardParticipantIds.map((participantId) =>
      prisma.leaderboardEntry.update({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            participantId,
            courseId: courseId,
          },
        },
        data: {
          score: {
            increment:
              (participationAchievement.rewardedPoints ?? 0) +
              (result.points / result.maxPoints >= 0.5 ? 1 : 0) *
                (passedAchievement.rewardedPoints ?? 0),
          },
        },
      })
    )
  )

  // award achievements to participants
  Object.entries(participantAchievementMap).forEach(
    ([participantId, achievementIds]) => {
      promises.push(
        ...achievementIds.map((id) =>
          prisma.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: participantId,
                achievementId: id,
              },
            },
            create: {
              participantId: participantId,
              achievementId: id,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {
              achievedCount: {
                increment: 1,
              },
            },
          })
        )
      )
    }
  )

  return promises
}

const prismaClient = new Prisma.PrismaClient()

await seed(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
