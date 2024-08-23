import { getInitialInstanceStatistics } from '../../../util/dist'
import { ElementInstanceType, PrismaClient } from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  let updatedPQInstances = 0
  let updatedMLInstances = 0
  let updatedGAInstances = 0

  // ! Fetch all element instances separated by type
  const practiceQuizInstances = await prisma.elementInstance.findMany({
    where: {
      type: ElementInstanceType.PRACTICE_QUIZ,
      instanceStatistics: null,
    },
  })
  const microLearningInstances = await prisma.elementInstance.findMany({
    where: {
      type: ElementInstanceType.MICROLEARNING,
      instanceStatistics: null,
    },
  })
  const groupActivityInstances = await prisma.elementInstance.findMany({
    where: {
      type: ElementInstanceType.GROUP_ACTIVITY,
      instanceStatistics: null,
    },
  })

  // ! Update the instances with the initial statistics
  for (const instance of practiceQuizInstances) {
    console.log(
      `Processing practice quiz instance ${updatedPQInstances}/${practiceQuizInstances.length}`
    )
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        instanceStatistics: {
          upsert: {
            create:
              getInitialInstanceStatistics(ElementInstanceType.PRACTICE_QUIZ) ??
              {},
            update: {},
          },
        },
      },
    })

    updatedPQInstances++
  }

  for (const instance of microLearningInstances) {
    console.log(
      `Processing microlearning instance ${updatedMLInstances}/${microLearningInstances.length}`
    )
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        instanceStatistics: {
          upsert: {
            create:
              getInitialInstanceStatistics(ElementInstanceType.MICROLEARNING) ??
              {},
            update: {},
          },
        },
      },
    })

    updatedMLInstances++
  }

  for (const instance of groupActivityInstances) {
    console.log(
      `Processing group activity instance ${updatedGAInstances}/${groupActivityInstances.length}`
    )
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        instanceStatistics: {
          upsert: {
            create:
              getInitialInstanceStatistics(
                ElementInstanceType.GROUP_ACTIVITY
              ) ?? {},
            update: {},
          },
        },
      },
    })

    updatedGAInstances++
  }

  // Verify that all instances should have associated statistics now (since no live quiz instances without statistics exist yet)
  const allInstances = await prisma.elementInstance.findMany({
    include: {
      instanceStatistics: true,
    },
  })
  const instancesWithoutStatistics = allInstances.filter(
    (instance) => !instance.instanceStatistics
  )
  console.log(
    `Found ${instancesWithoutStatistics.length} instances without statistics`
  )

  console.log(`Updated ${updatedPQInstances} practice quiz instances`)
  console.log(`Updated ${updatedMLInstances} microlearning instances`)
  console.log(`Updated ${updatedGAInstances} group activity instances`)
}

await run()
