import { prisma } from '@klicker-uzh/prisma'
import {
  Element,
  ElementInstance,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'

const DEBUG = false

// ! Script to compute whether an instance is outdated w.r.t. the latest version of the element
async function run() {
  // get the activity counts
  const liveQuizCount = await prisma.liveQuiz.count({
    where: { isDeleted: false },
  })
  const practiceQuizCount = await prisma.practiceQuiz.count({
    where: { isDeleted: false },
  })
  const microLearningCount = await prisma.microLearning.count({
    where: { isDeleted: false },
  })
  const groupActivityCount = await prisma.groupActivity.count({
    where: { isDeleted: false },
  })

  // process the live quizzes in batches of 100
  for (let i = 0; i < liveQuizCount; i += 100) {
    const liveQuizzes = await prisma.liveQuiz.findMany({
      skip: i,
      take: 100,
      where: { isDeleted: false },
      include: {
        blocks: { include: { elements: { include: { element: true } } } },
      },
    })

    let batchCounter = 0
    for (const liveQuiz of liveQuizzes) {
      console.log(`Processing live quiz ${i + ++batchCounter}/${liveQuizCount}`)
      const instances = liveQuiz.blocks.flatMap((block) => block.elements)
      const anyInstanceOutdated = await processInstances(instances, prisma)

      if (anyInstanceOutdated) {
        await prisma.liveQuiz.update({
          where: { id: liveQuiz.id },
          data: { areInstancesOutdated: true },
        })
      }
    }
  }

  // process the practice quizzes in batches of 100
  for (let i = 0; i < practiceQuizCount; i += 100) {
    const practiceQuizzes = await prisma.practiceQuiz.findMany({
      skip: i,
      take: 100,
      where: { isDeleted: false },
      include: {
        stacks: { include: { elements: { include: { element: true } } } },
      },
    })

    let batchCounter = 0
    for (const practiceQuiz of practiceQuizzes) {
      console.log(
        `Processing practice quiz ${i + ++batchCounter}/${practiceQuizCount}`
      )
      const instances = practiceQuiz.stacks.flatMap((stack) => stack.elements)
      const anyInstanceOutdated = await processInstances(instances, prisma)

      if (anyInstanceOutdated) {
        await prisma.practiceQuiz.update({
          where: { id: practiceQuiz.id },
          data: { areInstancesOutdated: true },
        })
      }
    }
  }

  // process the micro learnings in batches of 100
  for (let i = 0; i < microLearningCount; i += 100) {
    const microLearnings = await prisma.microLearning.findMany({
      skip: i,
      take: 100,
      where: { isDeleted: false },
      include: {
        stacks: { include: { elements: { include: { element: true } } } },
      },
    })

    let batchCounter = 0
    for (const microLearning of microLearnings) {
      console.log(
        `Processing micro learning ${i + ++batchCounter}/${microLearningCount}`
      )
      const instances = microLearning.stacks.flatMap((stack) => stack.elements)
      const anyInstanceOutdated = await processInstances(instances, prisma)

      if (anyInstanceOutdated) {
        await prisma.microLearning.update({
          where: { id: microLearning.id },
          data: { areInstancesOutdated: true },
        })
      }
    }
  }

  // process the group activities in batches of 100
  for (let i = 0; i < groupActivityCount; i += 100) {
    const groupActivities = await prisma.groupActivity.findMany({
      skip: i,
      take: 100,
      where: { isDeleted: false },
      include: {
        stacks: { include: { elements: { include: { element: true } } } },
      },
    })

    let batchCounter = 0
    for (const groupActivity of groupActivities) {
      console.log(
        `Processing group activity ${i + ++batchCounter}/${groupActivityCount}`
      )
      const instances = groupActivity.stacks.flatMap((stack) => stack.elements)
      const anyInstanceOutdated = await processInstances(instances, prisma)

      if (anyInstanceOutdated) {
        await prisma.groupActivity.update({
          where: { id: groupActivity.id },
          data: { areInstancesOutdated: true },
        })
      }
    }
  }
}

async function processInstances(
  instances: (ElementInstance & { element: Element })[],
  prisma: PrismaClient
) {
  let anyInstanceOutdated = false

  for (const instance of instances) {
    const [_, instanceVersion] = instance.elementData.id.split('-v')
    const elementVersion = instance.element.version

    if (!instanceVersion) {
      throw new Error(
        `Instance ${instance.id} does not have a version number in its elementData.id`
      )
    }

    if (!elementVersion) {
      throw new Error(
        `Element ${instance.element.id} does not have a version number`
      )
    }

    // check if the currently considered instance is outdated
    if (parseInt(instanceVersion) !== elementVersion) {
      if (DEBUG) {
        console.log(
          `Instance ${instance.id} is outdated: version ${instanceVersion} != element version ${elementVersion}`
        )
      }

      // mark the instance as outdated
      await prisma.elementInstance.update({
        where: { id: instance.id },
        data: { isVersionOutdated: true },
      })

      // make sure that the associated activity is marked as containing outdated instances
      anyInstanceOutdated = true
    }
  }

  return anyInstanceOutdated // if no instances are outdated, return false
}

await run()
