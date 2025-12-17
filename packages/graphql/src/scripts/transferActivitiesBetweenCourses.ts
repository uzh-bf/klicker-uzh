import { prisma } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'

// ! Script to transfer a set of activities between courses
async function run() {
  const emitter = new EventEmitter()

  // ! Set old and new user IDs and the course IDs, which should be transferred including all activities and elements
  const oldCourseId = ''
  const newCourseId = ''
  const liveQuizIds = new Set<string>([])
  const practiceQuizIds = new Set<string>([])
  const microLearningIds = new Set<string>([])
  const groupActivityIds = new Set<string>([])
  const chatbotIds = new Set<string>([])

  // fetch all content of the old user
  const oldCourse = await prisma.course.findUnique({
    where: { id: oldCourseId },
    include: {
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
      chatbots: true,
    },
  })
  const newCourse = await prisma.course.findUnique({
    where: { id: newCourseId },
  })

  if (!oldCourse) {
    throw new Error(`Origin course with ID ${oldCourseId} not found`)
  }
  if (!newCourse) {
    throw new Error(`Destination course with ID ${newCourseId} not found`)
  }

  if (oldCourse.ownerId !== newCourse.ownerId) {
    throw new Error(
      `Old course owner and new course owner are not the same user (ID: ${oldCourse.ownerId})`
    )
  }

  await prisma.$transaction(
    async (prisma) => {
      // migrate live quizzes to new owner
      let liveQuizCounter = 0
      for (const {
        id: liveQuizId,
        name: liveQuizName,
      } of oldCourse.liveQuizzes) {
        if (!liveQuizIds.has(liveQuizId)) {
          continue
        }

        console.log(
          `Transferring live quiz: ${liveQuizName} (ID: ${liveQuizId}, ${++liveQuizCounter}/${liveQuizIds.size})`
        )

        await prisma.liveQuiz.update({
          where: { id: liveQuizId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: liveQuizId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          {
            liveQuizId,
            updateAccessRequests: true,
          },
          prisma
        )
      }

      // migrate practice quizzes to new owner
      let practiceQuizCounter = 0
      for (const {
        id: practiceQuizId,
        name: practiceQuizName,
      } of oldCourse.practiceQuizzes) {
        if (!practiceQuizIds.has(practiceQuizId)) {
          continue
        }

        console.log(
          `Transferring practice quiz: ${practiceQuizName} (ID: ${practiceQuizId}; ${++practiceQuizCounter}/${practiceQuizIds.size})`
        )

        await prisma.practiceQuiz.update({
          where: { id: practiceQuizId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', {
          typename: 'PracticeQuiz',
          id: practiceQuizId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          {
            practiceQuizId,
            updateAccessRequests: true,
          },
          prisma
        )
      }

      // migrate microlearnings to new owner
      let microLearningCounter = 0
      for (const {
        id: microLearningId,
        name: microLearningName,
      } of oldCourse.microLearnings) {
        if (!microLearningIds.has(microLearningId)) {
          continue
        }

        console.log(
          `Transferring microlearning: ${microLearningName} (ID: ${microLearningId}; ${++microLearningCounter}/${microLearningIds.size})`
        )

        await prisma.microLearning.update({
          where: { id: microLearningId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', {
          typename: 'MicroLearning',
          id: microLearningId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          {
            microLearningId,
            updateAccessRequests: true,
          },
          prisma
        )
      }

      // migrate group activities to new owner
      let groupActivityCounter = 0
      for (const {
        id: groupActivityId,
        name: groupActivityName,
      } of oldCourse.groupActivities) {
        if (!groupActivityIds.has(groupActivityId)) {
          continue
        }

        console.log(
          `Transferring group activity: ${groupActivityName} (ID: ${groupActivityId}; ${++groupActivityCounter}/${groupActivityIds.size})`
        )

        await prisma.groupActivity.update({
          where: { id: groupActivityId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', {
          typename: 'GroupActivity',
          id: groupActivityId,
        })

        // recompute derived permissions
        await recomputeDerivedPermissions(
          {
            groupActivityId,
            updateAccessRequests: true,
          },
          prisma
        )
      }

      // migrate chatbots to new owner
      let chatbotCounter = 0
      for (const { id: chatbotId, name: chatbotName } of oldCourse.chatbots) {
        if (!chatbotIds.has(chatbotId)) {
          continue
        }

        console.log(
          `Transferring chatbot: ${chatbotName} (ID: ${chatbotId}; ${++chatbotCounter}/${chatbotIds.size})`
        )

        await prisma.chatbot.update({
          where: { id: chatbotId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', { typename: 'Chatbot', id: chatbotId })
      }
    },
    { timeout: 60 * 60 * 1000 } // timeout: 1h
  )
}

await run()
