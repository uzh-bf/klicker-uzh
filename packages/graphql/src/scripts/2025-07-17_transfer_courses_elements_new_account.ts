import { PrismaClient } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'

// ! Script to transfer the ownership of courses and their entire content to another user
// ! NOTE: The script does not handle the reassignment of permissions, access requests, resources, etc. at the moment
async function run() {
  const prisma = new PrismaClient()
  const emitter = new EventEmitter()

  // ! Set old and new user IDs and the course IDs, which should be transferred including all activities and elements
  const courseIds = []
  const oldUserId = ''
  const newUserId = ''

  const courses = await prisma.course.findMany({
    where: {
      id: { in: courseIds },
      ownerId: oldUserId,
    },
    include: {
      liveQuizzes: {
        include: {
          blocks: {
            include: {
              elements: {
                include: {
                  element: {
                    include: { tags: true },
                  },
                },
              },
            },
          },
        },
      },
      practiceQuizzes: {
        include: {
          stacks: {
            include: {
              elements: {
                include: {
                  element: {
                    include: { tags: true },
                  },
                },
              },
            },
          },
        },
      },
      microLearnings: {
        include: {
          stacks: {
            include: {
              elements: {
                include: {
                  element: {
                    include: { tags: true },
                  },
                },
              },
            },
          },
        },
      },
      groupActivities: {
        include: {
          stacks: {
            include: {
              elements: {
                include: {
                  element: {
                    include: { tags: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const liveQuizIds = courses.flatMap((course) =>
    course.liveQuizzes.map((quiz) => quiz.id)
  )
  const practiceQuizIds = courses.flatMap((course) =>
    course.practiceQuizzes.map((quiz) => quiz.id)
  )
  const microLearningIds = courses.flatMap((course) =>
    course.microLearnings.map((ml) => ml.id)
  )
  const groupActivityIds = courses.flatMap((course) =>
    course.groupActivities.map((activity) => activity.id)
  )

  const instanceIds = Array.from(
    new Set(
      courses.flatMap((course) => [
        ...course.liveQuizzes.flatMap((quiz) =>
          quiz.blocks.flatMap((block) =>
            block.elements.map((instance) => instance.id)
          )
        ),
        ...course.practiceQuizzes.flatMap((quiz) =>
          quiz.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.id)
          )
        ),
        ...course.microLearnings.flatMap((ml) =>
          ml.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.id)
          )
        ),
        ...course.groupActivities.flatMap((activity) =>
          activity.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.id)
          )
        ),
      ])
    )
  )

  const elementIds = Array.from(
    new Set(
      courses.flatMap((course) => [
        ...course.liveQuizzes.flatMap((quiz) =>
          quiz.blocks.flatMap((block) =>
            block.elements.map((instance) => instance.element.id)
          )
        ),
        ...course.practiceQuizzes.flatMap((quiz) =>
          quiz.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.element.id)
          )
        ),
        ...course.microLearnings.flatMap((ml) =>
          ml.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.element.id)
          )
        ),
        ...course.groupActivities.flatMap((activity) =>
          activity.stacks.flatMap((stack) =>
            stack.elements.map((instance) => instance.element.id)
          )
        ),
      ])
    )
  )

  const tagIds = Array.from(
    new Set(
      courses.flatMap((course) => [
        ...course.liveQuizzes.flatMap((quiz) =>
          quiz.blocks.flatMap((block) =>
            block.elements.flatMap((instance) =>
              instance.element.tags.map((tag) => tag.id)
            )
          )
        ),
        ...course.practiceQuizzes.flatMap((quiz) =>
          quiz.stacks.flatMap((stack) =>
            stack.elements.flatMap((instance) =>
              instance.element.tags.map((tag) => tag.id)
            )
          )
        ),
        ...course.microLearnings.flatMap((ml) =>
          ml.stacks.flatMap((stack) =>
            stack.elements.flatMap((instance) =>
              instance.element.tags.map((tag) => tag.id)
            )
          )
        ),
        ...course.groupActivities.flatMap((activity) =>
          activity.stacks.flatMap((stack) =>
            stack.elements.flatMap((instance) =>
              instance.element.tags.map((tag) => tag.id)
            )
          )
        ),
      ])
    )
  )

  await prisma.$transaction(
    async (prisma) => {
      // migrate courses to new owner
      let courseCounter = 0
      for (const course of courses) {
        console.log(
          `Transferring course: ${course.name} (ID: ${course.id}; ${++courseCounter}/${courses.length})`
        )

        const updatedCourse = await prisma.course.update({
          where: { id: course.id },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'Course',
          id: updatedCourse.id,
        })

        await recomputeDerivedPermissions(
          { courseId: updatedCourse.id },
          prisma
        )
      }

      // migrate live quizzes to new owner
      let liveQuizCounter = 0
      for (const quizId of liveQuizIds) {
        console.log(
          `Transferring live quiz: ${quizId} (${++liveQuizCounter}/${liveQuizIds.length})`
        )

        const updatedLiveQuiz = await prisma.liveQuiz.update({
          where: { id: quizId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: updatedLiveQuiz.id,
        })

        await recomputeDerivedPermissions(
          { liveQuizId: updatedLiveQuiz.id },
          prisma
        )
      }

      // migrate practice quizzes to new owner
      let practiceQuizCounter = 0
      for (const quizId of practiceQuizIds) {
        console.log(
          `Transferring practice quiz: ${quizId} (${++practiceQuizCounter}/${practiceQuizIds.length})`
        )

        const updatedPracticeQuiz = await prisma.practiceQuiz.update({
          where: { id: quizId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'PracticeQuiz',
          id: updatedPracticeQuiz.id,
        })

        await recomputeDerivedPermissions(
          { practiceQuizId: updatedPracticeQuiz.id },
          prisma
        )
      }

      // migrate microlearnings to new owner
      let microLearningCounter = 0
      for (const mlId of microLearningIds) {
        console.log(
          `Transferring microlearning: ${mlId} (${++microLearningCounter}/${microLearningIds.length})`
        )

        const upatedMicroLearning = await prisma.microLearning.update({
          where: { id: mlId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'MicroLearning',
          id: upatedMicroLearning.id,
        })

        await recomputeDerivedPermissions(
          { microLearningId: upatedMicroLearning.id },
          prisma
        )
      }

      // migrate group activities to new owner
      let groupActivityCounter = 0
      for (const activityId of groupActivityIds) {
        console.log(
          `Transferring group activity: ${activityId} (${++groupActivityCounter}/${groupActivityIds.length})`
        )

        const updatedGroupActivity = await prisma.groupActivity.update({
          where: { id: activityId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'GroupActivity',
          id: updatedGroupActivity.id,
        })

        await recomputeDerivedPermissions(
          { groupActivityId: updatedGroupActivity.id },
          prisma
        )
      }

      // migrate element instances to new owner
      let instanceCounter = 0
      for (const instanceId of instanceIds) {
        console.log(
          `Transferring element instance: ${instanceId} (${++instanceCounter}/${instanceIds.length})`
        )

        const updatedInstance = await prisma.elementInstance.update({
          where: { id: instanceId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'ElementInstance',
          id: updatedInstance.id,
        })
      }

      // migrate elements to new owner
      let elementCounter = 0
      for (const elementId of elementIds) {
        console.log(
          `Transferring element: ${elementId} (${++elementCounter}/${elementIds.length})`
        )

        const updatedElement = await prisma.element.update({
          where: { id: elementId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'Element',
          id: updatedElement.id,
        })

        await recomputeDerivedPermissions(
          { elementId: updatedElement.id },
          prisma
        )
      }

      // migrate tags to new owner
      let tagCounter = 0
      for (const tagId of tagIds) {
        console.log(
          `Transferring tag: ${tagId} (${++tagCounter}/${tagIds.length})`
        )

        const updatedTag = await prisma.tag.update({
          where: { id: tagId },
          data: { ownerId: newUserId },
        })

        emitter.emit('invalidate', {
          typename: 'Tag',
          id: updatedTag.id,
        })
      }
    },
    { timeout: 500000 }
  )
}

await run()
