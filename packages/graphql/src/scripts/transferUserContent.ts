import { prisma } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'

// ! Script to transfer the ownership of all objects of a user to another user
async function run() {
  const emitter = new EventEmitter()

  // ! Set old and new user IDs and the course IDs, which should be transferred including all activities and elements
  const oldUserId = ''
  const newUserId = ''

  // verify that the new user exists
  const newUser = await prisma.user.findUnique({
    where: { id: newUserId },
  })

  if (!newUser) {
    throw new Error(`Target user with ID ${newUserId} not found`)
  }

  // fetch all content of the old user
  const user = await prisma.user.findUnique({
    where: { id: oldUserId },
    include: {
      courses: true,
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
      questions: true,
      elementInstances: true,
      mediaFiles: true,
      tags: true,
      competencyTrees: true,
      competenceTrees: true,
      answerCollections: true,
      chatbots: true,
      chatbotDisclaimers: true,
      managedCatalogCollections: true,
    },
  })

  if (!user) {
    throw new Error(`Origin user with ID ${oldUserId} not found`)
  }

  await prisma.$transaction(
    async (prisma) => {
      // migrate courses to new owner
      let courseCounter = 0
      for (const { id: courseId, name: courseName } of user.courses) {
        console.log(
          `Transferring course: ${courseName} (ID: ${courseId}; ${++courseCounter}/${user.courses.length})`
        )

        await prisma.course.update({
          where: { id: courseId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'Course',
          id: courseId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          { courseId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { courseId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate live quizzes to new owner
      let liveQuizCounter = 0
      for (const { id: liveQuizId, name: liveQuizName } of user.liveQuizzes) {
        console.log(
          `Transferring live quiz: ${liveQuizName} (ID: ${liveQuizId}, ${++liveQuizCounter}/${user.liveQuizzes.length})`
        )

        await prisma.liveQuiz.update({
          where: { id: liveQuizId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: liveQuizId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          { liveQuizId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { liveQuizId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate practice quizzes to new owner
      let practiceQuizCounter = 0
      for (const {
        id: practiceQuizId,
        name: practiceQuizName,
      } of user.practiceQuizzes) {
        console.log(
          `Transferring practice quiz: ${practiceQuizName} (ID: ${practiceQuizId}; ${++practiceQuizCounter}/${user.practiceQuizzes.length})`
        )

        await prisma.practiceQuiz.update({
          where: { id: practiceQuizId },
          data: { ownerId: newUserId },
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
      } of user.microLearnings) {
        console.log(
          `Transferring microlearning: ${microLearningName} (ID: ${microLearningId}; ${++microLearningCounter}/${user.microLearnings.length})`
        )

        await prisma.microLearning.update({
          where: { id: microLearningId },
          data: { ownerId: newUserId },
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
      } of user.groupActivities) {
        console.log(
          `Transferring group activity: ${groupActivityName} (ID: ${groupActivityId}; ${++groupActivityCounter}/${user.groupActivities.length})`
        )

        await prisma.groupActivity.update({
          where: { id: groupActivityId },
          data: { ownerId: newUserId },
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

      // migrate elements to new owner
      let elementCounter = 0
      for (const { id: elementId, name: elementName } of user.questions) {
        console.log(
          `Transferring element: ${elementName} (ID: ${elementId}; ${++elementCounter}/${user.questions.length})`
        )

        await prisma.element.update({
          where: { id: elementId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'Element',
          id: elementId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          { elementId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { elementId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate answer collections to new owner
      let answerCollectionCounter = 0
      for (const {
        id: answerCollectionId,
        name: answerCollectionName,
      } of user.answerCollections) {
        console.log(
          `Transferring answer collection: ${answerCollectionName} (ID: ${answerCollectionId}; ${++answerCollectionCounter}/${user.answerCollections.length})`
        )

        await prisma.answerCollection.update({
          where: { id: answerCollectionId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'AnswerCollection',
          id: answerCollectionId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          { answerCollectionId, userId: oldUserId, updateAccessRequests: true },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          { answerCollectionId, userId: newUserId, updateAccessRequests: true },
          prisma
        )
      }

      // migrate catalog collections to new owner
      let catalogCollectionCounter = 0
      for (const {
        id: catalogCollectionId,
        name: catalogCollectionName,
      } of user.managedCatalogCollections) {
        console.log(
          `Transferring managed catalog collection: ${catalogCollectionName} (ID: ${catalogCollectionId}; ${++catalogCollectionCounter}/${user.managedCatalogCollections.length})`
        )

        await prisma.catalogCollection.update({
          where: { id: catalogCollectionId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'CatalogCollection',
          id: catalogCollectionId,
        })

        // recompute derived permissions for the old user (-> remove owner permissions)
        await recomputeDerivedPermissions(
          {
            catalogCollectionId,
            userId: oldUserId,
            updateAccessRequests: true,
          },
          prisma
        )

        // recompute derived permissions for the new user (-> add owner permissions)
        await recomputeDerivedPermissions(
          {
            catalogCollectionId,
            userId: newUserId,
            updateAccessRequests: true,
          },
          prisma
        )
      }

      // migrate element instances to new owner
      let instanceCounter = 0
      for (const { id: instanceId, elementData } of user.elementInstances) {
        console.log(
          `Transferring instance of element: ${elementData.name} (ID: ${instanceId}; ${++instanceCounter}/${user.elementInstances.length})`
        )

        await prisma.elementInstance.update({
          where: { id: instanceId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'ElementInstance',
          id: instanceId,
        })
      }

      // migrate tags to new owner
      let tagCounter = 0
      for (const { id: tagId, name: tagName } of user.tags) {
        console.log(
          `Transferring tag: ${tagName} (ID: ${tagId}; ${++tagCounter}/${user.tags.length})`
        )

        await prisma.tag.update({
          where: { id: tagId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', { typename: 'Tag', id: tagId })
      }

      // migrate media files to new owner
      let mediaFileCounter = 0
      for (const { id: mediaFileId } of user.mediaFiles) {
        console.log(
          `Transferring media file: ${mediaFileId} (${++mediaFileCounter}/${user.mediaFiles.length})`
        )

        await prisma.mediaFile.update({
          where: { id: mediaFileId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', { typename: 'MediaFile', id: mediaFileId })
      }

      // migrate competency trees to new owner
      let competencyTreeCounter = 0
      for (const { id: treeId, name: treeName } of user.competencyTrees) {
        console.log(
          `Transferring competency tree: ${treeName} (ID: ${treeId}; ${++competencyTreeCounter}/${user.competencyTrees.length})`
        )

        await prisma.competencyTree.update({
          where: { id: treeId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', { typename: 'CompetencyTree', id: treeId })
      }

      // migrate adaptive-learning competence trees to the new owner
      let competenceTreeCounter = 0
      for (const { id: treeId, name: treeName } of user.competenceTrees) {
        console.log(
          `Transferring competence tree: ${treeName} (ID: ${treeId}; ${++competenceTreeCounter}/${user.competenceTrees.length})`
        )

        await prisma.competenceTree.update({
          where: { id: treeId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', { typename: 'CompetenceTree', id: treeId })
      }

      // migrate chatbots to new owner
      let chatbotCounter = 0
      for (const { id: chatbotId, name: chatbotName } of user.chatbots) {
        console.log(
          `Transferring chatbot: ${chatbotName} (ID: ${chatbotId}; ${++chatbotCounter}/${user.chatbots.length})`
        )

        await prisma.chatbot.update({
          where: { id: chatbotId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', { typename: 'Chatbot', id: chatbotId })
      }

      // migrate chatbot disclaimers to new owner
      let disclaimerCounter = 0
      for (const {
        id: disclaimerId,
        name: disclaimerName,
      } of user.chatbotDisclaimers) {
        console.log(
          `Transferring chatbot disclaimer: ${disclaimerName} (ID: ${disclaimerId}; ${++disclaimerCounter}/${user.chatbotDisclaimers.length})`
        )

        await prisma.chatbotDisclaimer.update({
          where: { id: disclaimerId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'ChatbotDisclaimer',
          id: disclaimerId,
        })
      }
    },
    { timeout: 60 * 60 * 1000 } // timeout: 1h
  )
}

await run()
