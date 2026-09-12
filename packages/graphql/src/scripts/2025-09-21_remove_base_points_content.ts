import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
// ! IMPORTANT INFORMATION
// This script sets the basePoints setting of all content elements and flashcards to false and updates corresponding instances
// At the same time, live quiz responses where non-zero amounts of base points were awarded for content elements are updated (alongside the audit log)

const DRY_RUN = true

async function run() {
  const hatchetClient = HatchetClient.init({
    token: process.env.HATCHET_CLIENT_TOKEN,
    host_port: 'localhost:7070',
    tls_config: {
      tls_strategy: 'none',
    },
  })

  // fetch all elements that are of type content or flashcard and have their base points set to true
  const elements = await prisma.element.findMany({
    where: {
      type: { in: ['CONTENT', 'FLASHCARD'] },
      basePoints: true,
    },
  })
  console.log('Found elements to update:', elements.length)

  // update the corresponding elements in batches of 100
  if (!DRY_RUN) {
    const batchSize = 100
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize)

      await Promise.all(
        batch.map((element) =>
          prisma.element.update({
            where: {
              id: element.id,
              type: { in: ['CONTENT', 'FLASHCARD'] },
              basePoints: true,
            },
            data: { basePoints: false },
          })
        )
      )

      console.log(`Updated batch ${i / batchSize + 1} of elements`)
    }
  }

  // identify all element instances that belong to a content or flashcard element
  const instances = await prisma.elementInstance.findMany({
    where: {
      elementType: { in: ['CONTENT', 'FLASHCARD'] },
      options: { path: ['basePoints'], equals: true },
    },
  })
  console.log('Found element instances to update:', instances.length)

  // update the corresponding element instances in batches of 100
  if (!DRY_RUN) {
    const batchSize = 100
    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize)

      await Promise.all(
        batch.map((instance) =>
          prisma.elementInstance.update({
            where: { id: instance.id },
            data: {
              options: {
                ...instance.options,
                basePoints: false,
              },
            },
          })
        )
      )

      console.log(`Updated batch ${i / batchSize + 1} of element instances`)
    }
  }

  // identify all live quiz responses that are linked to content elements and have non-zero base points
  const responses = await prisma.liveQuizResponse.findMany({
    where: {
      instance: { elementType: 'CONTENT' },
      basePoints: { gt: 0 },
    },
  })
  console.log('Found live quiz responses to update:', responses.length)

  // update the corresponding live quiz responses individually with a transaction
  if (!DRY_RUN) {
    for (const response of responses) {
      await prisma.$transaction(async (tx) => {
        // update the response
        await tx.liveQuizResponse.update({
          where: { id: response.id },
          data: { basePoints: 0 },
        })

        // send audit log message to hatchet
        const logMessage = `[CORRECTION] [Base Points Content Elements] Removed base points from live quiz response ${response.id} by participant ${response.participantId} for content element instance ${response.instanceId} (was ${response.basePoints})`
        await hatchetClient.events.push('create-audit-log-entry', {
          info: logMessage,
        })
        console.log(logMessage)
      })
    }
    console.log(`Updated ${responses.length} live quiz responses`)
  }

  // return / exit the process
  return process.exit(0)
}

await run()
