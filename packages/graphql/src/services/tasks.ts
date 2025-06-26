import { Hatchet } from '@hatchet-dev/typescript-sdk'
import * as Prisma from '@klicker-uzh/prisma'
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

export function changeUserEmailSettings(hatchet: Hatchet) {
  const changeUserEmailSettingsTask = hatchet.task({
    name: 'change-user-email-settings',
    retries: 3,
    fn: async ({
      userId,
      projectUpdates,
    }: {
      userId: string
      projectUpdates: boolean
    }) => {
      const prisma = initializePrisma()

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { sendProjectUpdates: projectUpdates },
        })
      } catch (error) {
        console.error('Error updating user email settings:', error)
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }

      return { success: true }
    },
  })

  return changeUserEmailSettingsTask
}

export function publishScheduledMicroLearning(hatchet: Hatchet) {
  const publishScheduledMicroLearningTask = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      const prisma = initializePrisma()

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

        // TODO: trigger subscription update / cache invalidation

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
