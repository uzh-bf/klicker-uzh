import { Hatchet } from '@hatchet-dev/typescript-sdk'
import * as Prisma from '@klicker-uzh/prisma'
import EventEmitter from 'events'
import { sendTeamsNotifications } from '../lib/util.js'

function initializePrisma() {
  const prisma = new Prisma.PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  })

  return prisma
}

export function publishScheduledMicroLearning(hatchet: Hatchet) {
  const publishScheduledMicroLearningTask = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()

      try {
        // check if the microlearning exists and if its start date is in the past
        const microLearning = await prisma.microLearning.findUnique({
          where: {
            id: microLearningId,
            scheduledStartAt: { lte: new Date() },
            status: Prisma.PublicationStatus.SCHEDULED,
          },
        })

        if (!microLearning) {
          sendTeamsNotifications(
            'hatchet/microlearning-start',
            `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`
          )
          throw new Error(
            `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`
          )
        }

        // publish the microlearning
        await prisma.microLearning.update({
          where: { id: microLearningId },
          data: { status: Prisma.PublicationStatus.PUBLISHED },
        })

        // send a teams notification
        await sendTeamsNotifications(
          'graphql/publishScheduledMicroLearnings',
          `Successfully published scheduled microlearning ${microLearning.id}`
        )

        // invalidate the cache for the microlearning
        emitter.emit('invalidate', {
          typename: 'MicroLearning',
          id: microLearning.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error publishing scheduled microlearning:', error)
        sendTeamsNotifications(
          'hatchet/microlearning-start',
          `Error publishing microlearning with ID ${microLearningId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  return publishScheduledMicroLearningTask
}
