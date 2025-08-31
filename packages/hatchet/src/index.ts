import type { HatchetClient } from '@hatchet-dev/typescript-sdk'
import {
  finalRandomGroupAssignments,
  runningRandomGroupAssignments,
  sendPushNotifications,
  sendTeamsNotifications,
  updateGroupAverageScores,
  updateWeeklyTimelineEntries,
} from '@klicker-uzh/graphql'
import { prisma } from '@klicker-uzh/prisma'
import { AccessMode, PublicationStatus } from '@klicker-uzh/prisma/client'
import type EventEmitter from 'events'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

export * from './client.js'

export function prepareHatchetTasks({
  hatchet,
  pubSub,
  emitter,
  redisExec,
  redisCache,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisCache?: Redis
}) {
  // ! ACTIVITY PUBLICATION TASKS
  // #region
  const publishScheduledMicroLearningTask = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      try {
        // check if the microlearning exists and if its start date is in the past
        const microLearning = await prisma.microLearning.findUnique({
          where: {
            id: microLearningId,
            scheduledStartAt: { lte: new Date() },
            status: PublicationStatus.SCHEDULED,
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
          data: { status: PublicationStatus.PUBLISHED },
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

  const publishScheduledGroupActivityTask = hatchet.task({
    name: 'publish-scheduled-group-activity',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      try {
        // check if the group activity exists and if its start date is in the past
        const groupActivity = await prisma.groupActivity.findUnique({
          where: {
            id: groupActivityId,
            scheduledStartAt: { lte: new Date() },
            status: PublicationStatus.SCHEDULED,
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
          data: { status: PublicationStatus.PUBLISHED },
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

  const publishScheduledPracticeQuizTask = hatchet.task({
    name: 'publish-scheduled-practice-quiz',
    retries: 3,
    fn: async ({ practiceQuizId }: { practiceQuizId: string }) => {
      try {
        // check if the practice quiz exists and if its availableFrom date is in the past
        const practiceQuiz = await prisma.practiceQuiz.findUnique({
          where: {
            id: practiceQuizId,
            isDeleted: false,
            status: PublicationStatus.SCHEDULED,
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
          data: { status: PublicationStatus.PUBLISHED },
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

  const publishScheduledLiveQuizTask = hatchet.task({
    name: 'publish-scheduled-live-quiz',
    retries: 3,
    fn: async ({ liveQuizId }: { liveQuizId: string }) => {
      try {
        // check if the live quiz exists and if its availableFrom date is in the past
        const liveQuiz = await prisma.liveQuiz.findUnique({
          where: {
            id: liveQuizId,
            isDeleted: false,
            status: PublicationStatus.SCHEDULED,
            availableFrom: { lte: new Date() },
          },
        })

        if (!liveQuiz) {
          sendTeamsNotifications(
            'hatchet/live-quiz-start',
            `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`
          )
          throw new Error(
            `Live quiz with ID ${liveQuizId} not found or scheduled start time is not in the past yet.`
          )
        }

        // start the live quiz
        await redisExec
          .pipeline()
          .hmset(`lq:${liveQuiz.id}:meta`, {
            namespace: liveQuiz.namespace,
            startedAt: Number(new Date()),
          })
          .exec()

        // generate a random pin code
        const pinCode = 100000 + Math.floor(Math.random() * 900000)
        const startedLiveQuiz = await prisma.liveQuiz.update({
          where: { id: liveQuizId },
          data: {
            status: PublicationStatus.PUBLISHED,
            startedAt: new Date(),
            pinCode:
              liveQuiz.accessMode === AccessMode.RESTRICTED ? pinCode : null,
          },
        })

        await sendTeamsNotifications(
          'hatchet/live-quiz-start',
          `START Live quiz ${startedLiveQuiz.name} with id ${startedLiveQuiz.id}.`
        )

        // invalidate the cache for the live quiz
        emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: startedLiveQuiz.id,
        })

        return { success: true }
      } catch (error) {
        console.error('Error publishing scheduled live quiz:', error)
        sendTeamsNotifications(
          'hatchet/live-quiz-start',
          `Error publishing live quiz with ID ${liveQuizId}: ${error}`
        )
        throw error // rethrow to allow Hatchet to handle retries
      } finally {
        await prisma.$disconnect()
      }
    },
  })

  // #endregion

  // ! ACTIVITY ENDING TASKS
  // #region
  const endExpiredMicroLearningTask = hatchet.task({
    name: 'end-expired-micro-learnings',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      try {
        const microLearning = await prisma.microLearning.findUnique({
          where: {
            id: microLearningId,
            isDeleted: false,
            status: PublicationStatus.PUBLISHED,
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
          data: { status: PublicationStatus.ENDED },
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

  const endExpiredGroupActivityTask = hatchet.task({
    name: 'end-expired-group-activities',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      try {
        const groupActivity = await prisma.groupActivity.findUnique({
          where: {
            id: groupActivityId,
            isDeleted: false,
            status: PublicationStatus.PUBLISHED,
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
          data: { status: PublicationStatus.ENDED },
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

  // #endregion

  // ! CRONJOBS
  // #region
  const updateGroupAverageScoresTask = hatchet.task({
    name: 'update-group-average-scores',
    retries: 3,
    onCrons: [
      '5 0 * * *', // running daily at 12:05 AM (UTC)
    ],
    fn: async () => {
      const success = await updateGroupAverageScores(prisma, emitter)
      return { success }
    },
  })

  const runningRandomGroupAssignmentsTask = hatchet.task({
    name: 'running-random-group-assignments',
    retries: 3,
    onCrons: [
      '10 0 * * *', // running daily at 12:10 AM (UTC)
    ],
    fn: async () => {
      const success = await runningRandomGroupAssignments(prisma, emitter)
      return { success }
    },
  })

  const finalRandomGroupAssignmentsTask = hatchet.task({
    name: 'final-random-group-assignments',
    retries: 3,
    onCrons: [
      '15 0 * * *', // running daily at 12:15 AM (UTC)
    ],
    fn: async () => {
      const success = await finalRandomGroupAssignments(prisma, emitter)
      return { success }
    },
  })

  const updateWeeklyTimelineEntriesTask = hatchet.task({
    name: 'update-weekly-timeline-entries',
    retries: 3,
    onCrons: [
      '20 0 * * *', // running daily at 12:20 AM (UTC)
    ],
    fn: async () => {
      const success = await updateWeeklyTimelineEntries(prisma)
      return { success }
    },
  })

  const sendPushNotificationsTask = hatchet.task({
    name: 'send-push-notifications',
    retries: 3,
    onCrons: [
      '*/5 * * * *', // runs every 5 minutes
    ],
    fn: async () => {
      const success = await sendPushNotifications(prisma)
      return { success }
    },
  })
  // #endregion

  return {
    updateGroupAverageScoresTask,
    runningRandomGroupAssignmentsTask,
    finalRandomGroupAssignmentsTask,
    updateWeeklyTimelineEntriesTask,
    sendPushNotificationsTask,
    publishScheduledGroupActivityTask,
    publishScheduledLiveQuizTask,
    publishScheduledMicroLearningTask,
    publishScheduledPracticeQuizTask,
    endExpiredGroupActivityTask,
    endExpiredMicroLearningTask,
  }
}
