import { Hatchet } from '@hatchet-dev/typescript-sdk'
import { PrismaClient } from '@klicker-uzh/prisma'

function initializePrisma() {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  })

  return prisma
}

type UserEmailSettingsInput = {
  userId: string
  projectUpdates: boolean
}
export function changeUserEmailSettings(hatchet: Hatchet) {
  const emailChangeTask = hatchet.task({
    name: 'simple',
    retries: 3,
    fn: async ({ userId, projectUpdates }: UserEmailSettingsInput) => {
      const prisma = initializePrisma()

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { sendProjectUpdates: projectUpdates },
        })
      } catch (error) {
        console.error('Error updating user email settings:', error)
        throw error // rethrow to allow Hatchet to handle retries
      }

      prisma.$disconnect()
      return { success: true }
    },
  })

  return emailChangeTask
}
