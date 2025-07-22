import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'
import { Hatchet } from '@hatchet-dev/typescript-sdk'
import * as Prisma from '@klicker-uzh/prisma'
import EventEmitter from 'events'
import { createPubSub } from 'graphql-yoga'
import { Redis } from 'ioredis'
import { sendTeamsNotifications } from '../lib/util.js'
import {
  finalRandomGroupAssignments as finalRandomGroupAssignmentsFunction,
  runningRandomGroupAssignments as runningRandomGroupAssignmentsFunction,
  updateGroupAverageScores as updateGroupAverageScoresFunction,
} from './groups.js'
import { sendPushNotifications as sendPushNotificationsFunction } from './notifications.js'
import { updateWeeklyTimelineEntries as updateWeeklyTimelineEntriesFunction } from './participants.js'

// ! SETUP
// #region
function initializePrisma() {
  const prisma = new Prisma.PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  })

  return prisma
}

function initializeSubscriptions() {
  const publishClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const subscribeClient = new Redis({
    family: 4,
    host: process.env.REDIS_CACHE_HOST ?? 'localhost',
    password: process.env.REDIS_CACHE_PASS ?? '',
    port: Number(process.env.REDIS_CACHE_PORT) ?? 6380,
    tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
  })

  const eventTarget = createRedisEventTarget({
    publishClient,
    subscribeClient,
  })
  const pubSub = createPubSub({ eventTarget })
  return pubSub
}
// #endregion

// ! ACTIVITY PUBLICATION TASKS
// #region
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
// #endregion

// ! ACTIVITY ENDING TASKS
// #region
export function endExpiredMicroLearning(hatchet: Hatchet) {
  const endExpiredMicroLearningTask = hatchet.task({
    name: 'end-expired-micro-learnings',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()
      const pubSub = initializeSubscriptions()

      try {
        const microLearning = await prisma.microLearning.findUnique({
          where: {
            id: microLearningId,
            isDeleted: false,
            status: Prisma.PublicationStatus.PUBLISHED,
            scheduledEndAt: { lte: new Date() },
          },
        })

        if (!microLearning) {
          sendTeamsNotifications(
            'hatchet/microlearning-end',
            `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`
          )
          throw new Error(
            `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`
          )
        }

        // end the microlearning
        const updatedMicroLearning = await prisma.microLearning.update({
          where: { id: microLearningId },
          data: { status: Prisma.PublicationStatus.ENDED },
        })

        await sendTeamsNotifications(
          'hatchet/microlearning-end',
          `Successfully ended expired microlearning ${updatedMicroLearning.id}`
        )

        // publish the event to subscribers
        pubSub.publish('microLearningEnded', updatedMicroLearning)
        emitter.emit('invalidate', {
          typename: 'MicroLearning',
          id: updatedMicroLearning.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error ending expired microlearning:', error)
        sendTeamsNotifications(
          'hatchet/microlearning-end',
          `Error ending microlearning with ID ${microLearningId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  return endExpiredMicroLearningTask
}

export function endExpiredGroupActivity(hatchet: Hatchet) {
  const endExpiredGroupActivityTask = hatchet.task({
    name: 'end-expired-group-activities',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()
      const pubSub = initializeSubscriptions()

      try {
        const groupActivity = await prisma.groupActivity.findUnique({
          where: {
            id: groupActivityId,
            isDeleted: false,
            status: Prisma.PublicationStatus.PUBLISHED,
            scheduledEndAt: { lte: new Date() },
          },
        })

        if (!groupActivity) {
          sendTeamsNotifications(
            'hatchet/group-activity-end',
            `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`
          )
          throw new Error(
            `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`
          )
        }

        // end the group activity
        const updatedGroupActivity = await prisma.groupActivity.update({
          where: { id: groupActivityId },
          data: { status: Prisma.PublicationStatus.ENDED },
        })

        await sendTeamsNotifications(
          'hatchet/group-activity-end',
          `Successfully ended expired group activity ${updatedGroupActivity.id}`
        )

        // publish the event to subscribers
        pubSub.publish('groupActivityEnded', updatedGroupActivity)
        pubSub.publish('singleGroupActivityEnded', updatedGroupActivity)
        emitter.emit('invalidate', {
          typename: 'GroupActivity',
          id: updatedGroupActivity.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error ending expired group activity:', error)
        sendTeamsNotifications(
          'hatchet/group-activity-end',
          `Error ending group activity with ID ${groupActivityId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  return endExpiredGroupActivityTask
}
// #endregion

// ! CRONJOBS
// #region
export function updateGroupAverageScoresCron(hatchet: Hatchet) {
  const updateGroupAverageScoresTask = hatchet.task({
    name: 'update-group-average-scores',
    retries: 3,
    onCrons: [
      '5 0 * * *', // running daily at 12:05 AM (UTC)
    ],
    fn: async () => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()

      const success = await updateGroupAverageScoresFunction(prisma, emitter)
      return { success }
    },
  })

  return updateGroupAverageScoresTask
}

export function runningRandomGroupAssignmentsCron(hatchet: Hatchet) {
  const runningRandomGroupAssignmentsTask = hatchet.task({
    name: 'running-random-group-assignments',
    retries: 3,
    onCrons: [
      '10 0 * * *', // running daily at 12:10 AM (UTC)
    ],
    fn: async () => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()
      const success = await runningRandomGroupAssignmentsFunction(
        prisma,
        emitter
      )
      return { success }
    },
  })

  return runningRandomGroupAssignmentsTask
}

export function finalRandomGroupAssignmentsCron(hatchet: Hatchet) {
  const finalRandomGroupAssignmentsTask = hatchet.task({
    name: 'final-random-group-assignments',
    retries: 3,
    onCrons: [
      '15 0 * * *', // running daily at 12:15 AM (UTC)
    ],
    fn: async () => {
      const prisma = initializePrisma()
      const emitter = new EventEmitter()
      const success = await finalRandomGroupAssignmentsFunction(prisma, emitter)
      return { success }
    },
  })

  return finalRandomGroupAssignmentsTask
}

export function updateWeeklyTimelineEntriesCron(hatchet: Hatchet) {
  const updateWeeklyTimelineEntriesTask = hatchet.task({
    name: 'update-weekly-timeline-entries',
    retries: 3,
    onCrons: [
      '20 0 * * *', // running daily at 12:20 AM (UTC)
    ],
    fn: async () => {
      const prisma = initializePrisma()
      const success = await updateWeeklyTimelineEntriesFunction(prisma)
      return { success }
    },
  })

  return updateWeeklyTimelineEntriesTask
}

export function sendPushNotificationsCron(hatchet: Hatchet) {
  const sendPushNotificationsTask = hatchet.task({
    name: 'send-push-notifications',
    retries: 3,
    onCrons: [
      '*/5 * * * *', // runs every 5 minutes
    ],
    fn: async () => {
      const prisma = initializePrisma()
      const success = await sendPushNotificationsFunction(prisma)
      return { success }
    },
  })

  return sendPushNotificationsTask
}
// #endregion
