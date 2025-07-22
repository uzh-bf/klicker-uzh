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

export function publishScheduledGroupActivity(hatchet: Hatchet) {
  const publishScheduledGroupActivityTask = hatchet.task({
    name: 'publish-scheduled-group-activity',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()

      try {
        // check if the group activity exists and if its start date is in the past
        const groupActivity = await prisma.groupActivity.findUnique({
          where: {
            id: groupActivityId,
            scheduledStartAt: { lte: new Date() },
            status: Prisma.PublicationStatus.SCHEDULED,
          },
        })

        if (!groupActivity) {
          sendTeamsNotifications(
            'hatchet/group-activity-start',
            `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`
          )
          throw new Error(
            `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`
          )
        }

        // publish the group activity
        await prisma.groupActivity.update({
          where: { id: groupActivityId },
          data: { status: Prisma.PublicationStatus.PUBLISHED },
        })

        // send a teams notification
        await sendTeamsNotifications(
          'graphql/publishScheduledGroupActivitys',
          `Successfully published scheduled group activity ${groupActivity.id}`
        )

        // invalidate the cache for the group activity
        emitter.emit('invalidate', {
          typename: 'GroupActivity',
          id: groupActivity.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error publishing scheduled group activity:', error)
        sendTeamsNotifications(
          'hatchet/group-activity-start',
          `Error publishing group activity with ID ${groupActivityId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  return publishScheduledGroupActivityTask
}

export function publishScheduledPracticeQuiz(hatchet: Hatchet) {
  const publishScheduledPracticeQuizTask = hatchet.task({
    name: 'publish-scheduled-practice-quiz',
    retries: 3,
    fn: async ({ practiceQuizId }: { practiceQuizId: string }) => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()

      try {
        // check if the practice quiz exists and if its availableFrom date is in the past
        const practiceQuiz = await prisma.practiceQuiz.findUnique({
          where: {
            id: practiceQuizId,
            isDeleted: false,
            status: Prisma.PublicationStatus.SCHEDULED,
            availableFrom: { lte: new Date() },
          },
        })

        if (!practiceQuiz) {
          sendTeamsNotifications(
            'hatchet/practice-quiz-start',
            `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`
          )
          throw new Error(
            `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`
          )
        }

        // publish the practice quiz
        const updatedPracticeQuiz = await prisma.practiceQuiz.update({
          where: { id: practiceQuizId, isDeleted: false },
          data: { status: Prisma.PublicationStatus.PUBLISHED },
          include: { stacks: true },
        })

        // send a teams notification
        await sendTeamsNotifications(
          'graphql/publishScheduledPracticeQuizs',
          `Successfully published scheduled practice quiz ${updatedPracticeQuiz.id}`
        )

        // link stacks of practice quiz to course
        await prisma.course.update({
          where: { id: updatedPracticeQuiz.courseId },
          data: {
            elementStacks: {
              connect: updatedPracticeQuiz.stacks.map((stack) => ({
                id: stack.id,
              })),
            },
          },
        })

        // invalidate the cache for the microlearning
        emitter.emit('invalidate', {
          typename: 'PracticeQuiz',
          id: updatedPracticeQuiz.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error publishing scheduled practice quiz:', error)
        sendTeamsNotifications(
          'hatchet/practice-quiz-start',
          `Error publishing practice quiz with ID ${practiceQuizId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  return publishScheduledPracticeQuizTask
}
