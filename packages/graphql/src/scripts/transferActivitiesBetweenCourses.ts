import { prisma } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'

// ! Script to transfer a set of activities between courses
async function run() {
  const emitter = new EventEmitter()

  // ! Set old and new user IDs and the course IDs, which should be transferred including all activities and elements
  const oldCourseId = ''
  const newCourseId = ''
  const liveQuizIds: string[] = []
  const practiceQuizIds: string[] = []
  const microLearningIds: string[] = []
  const groupActivityIds: string[] = []
  const chatbotIds: string[] = []

  // fetch all content of the old user
  const oldCourse = await prisma.course.findUnique({
    where: { id: oldCourseId },
    include: {
      owner: true,
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
      chatbots: true,
    },
  })
  const newCourse = await prisma.course.findUnique({
    where: { id: newCourseId },
    include: {
      owner: true,
    },
  })

  if (!oldCourse) {
    throw new Error(`Origin course with ID ${oldCourseId} not found`)
  }
  if (!newCourse) {
    throw new Error(`Destination course with ID ${newCourseId} not found`)
  }

  if (oldCourse.owner.id !== newCourse.owner.id) {
    throw new Error(
      `Old course owner and new course owner are not the same user (ID: ${oldCourse.ownerId})`
    )
  }
  const oldUserId = oldCourse.owner.id
  const newUserId = newCourse.owner.id

  await prisma.$transaction(
    async (prisma) => {
      // migrate live quizzes to new owner
      let liveQuizCounter = 0
      for (const {
        id: liveQuizId,
        name: liveQuizName,
      } of oldCourse.liveQuizzes) {
        if (!liveQuizIds.includes(liveQuizId)) {
          continue
        }

        console.log(
          `Transferring live quiz: ${liveQuizName} (ID: ${liveQuizId}, ${++liveQuizCounter}/${liveQuizIds.length})`
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
            userId: oldUserId,
            updateAccessRequests: true,
          },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          {
            liveQuizId,
            userId: newUserId,
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
        if (!practiceQuizIds.includes(practiceQuizId)) {
          continue
        }

        console.log(
          `Transferring practice quiz: ${practiceQuizName} (ID: ${practiceQuizId}; ${++practiceQuizCounter}/${practiceQuizIds.length})`
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
          { practiceQuizId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { practiceQuizId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate microlearnings to new owner
      let microLearningCounter = 0
      for (const {
        id: microLearningId,
        name: microLearningName,
      } of oldCourse.microLearnings) {
        if (!microLearningIds.includes(microLearningId)) {
          continue
        }

        console.log(
          `Transferring microlearning: ${microLearningName} (ID: ${microLearningId}; ${++microLearningCounter}/${microLearningIds.length})`
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
          { microLearningId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { microLearningId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate group activities to new owner
      let groupActivityCounter = 0
      for (const {
        id: groupActivityId,
        name: groupActivityName,
      } of oldCourse.groupActivities) {
        if (!groupActivityIds.includes(groupActivityId)) {
          continue
        }

        console.log(
          `Transferring group activity: ${groupActivityName} (ID: ${groupActivityId}; ${++groupActivityCounter}/${oldCourse.groupActivities.length})`
        )

        await prisma.groupActivity.update({
          where: { id: groupActivityId },
          data: { courseId: newCourseId },
        })

        emitter.emit('invalidate', {
          typename: 'GroupActivity',
          id: groupActivityId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          { groupActivityId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { groupActivityId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate chatbots to new owner
      let chatbotCounter = 0
      for (const { id: chatbotId, name: chatbotName } of oldCourse.chatbots) {
        if (!chatbotIds.includes(chatbotId)) {
          continue
        }

        console.log(
          `Transferring chatbot: ${chatbotName} (ID: ${chatbotId}; ${++chatbotCounter}/${chatbotIds.length})`
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
