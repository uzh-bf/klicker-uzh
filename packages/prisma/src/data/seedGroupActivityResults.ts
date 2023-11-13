import Prisma from '../../dist'

async function seed(prisma: Prisma.PrismaClient) {
  const results: Record<
    number,
    { points: number; maxPoints: number; message: string }
  > = {
    1: {
      points: 1, // 50 per question
      maxPoints: 1, // 50 per question
      message: '[Feedback als PDF](LINK TO PDF)',
    },
  }

  const instanceIds = Object.keys(results).map((id) => parseInt(id))
  const groupActivityInstances1 = await prisma.groupActivityInstance.findMany({
    where: {
      id: {
        in: instanceIds,
      },
    },
    include: {
      group: {
        include: {
          participants: true,
        },
      },
    },
  })

  let promises = []
  for (const [key, value] of Object.entries(results)) {
    promises.push(
      prisma.groupActivityInstance.update({
        where: {
          id: parseInt(key),
        },
        data: {
          results: value,
        },
      })
    )
  }

  // create a map between participants and achievements
  const participantAchievementMap = groupActivityInstances1.reduce<
    Record<string, number[]>
  >((acc, instance) => {
    const { points, maxPoints } = results[instance.id]

    instance.group.participants.forEach((participant) => {
      acc[participant.id] = [9]
      if (points / maxPoints >= 0.5) {
        acc[participant.id].push(8)
      }
    })

    return acc
  }, {})

  // achieve the instances for the participants and add this to the promises
  Object.entries(participantAchievementMap).forEach(
    ([participantId, achievementIds]) => {
      achievementIds.forEach((id) => {
        promises.push(
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
      })
    }
  )

  await prisma.$transaction(promises)
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
