import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PrismaClient,
  SessionBlockStatus,
} from '@klicker-uzh/prisma'
import { v4 as uuidv4 } from 'uuid'

// ? This script will migrate the old live sessions to the new live quiz table
// ? (liveSession -> liveQuiz, sessionBlock -> elementBlock, questionInstance -> elementInstance)

function computeElementType({ instance }: { instance: any }): ElementType {
  const qiType = instance.questionData.type as string
  let newElementType: ElementType | undefined
  if (qiType === 'SC') {
    newElementType = ElementType.SC
  } else if (qiType === 'MC') {
    newElementType = ElementType.MC
  } else if (qiType === 'KPRIM') {
    newElementType = ElementType.KPRIM
  } else if (qiType === 'NUMERICAL') {
    newElementType = ElementType.NUMERICAL
  } else if (qiType === 'FREE_TEXT') {
    newElementType = ElementType.FREE_TEXT
  } else {
    throw new Error(`Unknown question type: ${qiType}`)
  }

  return newElementType
}

async function run() {
  const prisma = new PrismaClient()

  // fetch all live sessions with associated question instances
  const liveSessions = await prisma.liveSession.findMany({
    include: {
      blocks: {
        include: {
          instances: true,
        },
      },
      activeBlock: {
        include: {
          instances: true,
        },
      },
    },
    take: 100, // TODO: remove this
  })

  for (const liveSession of liveSessions) {
    // check if the considered live session has already been migrated
    const existingLiveQuiz = await prisma.liveQuiz.findFirst({
      where: { originalId: liveSession.id },
    })

    if (existingLiveQuiz) {
      console.log(`Live session ${liveSession.id} has already been migrated`)
      continue
    }

    const elementBlockContent = liveSession.blocks.map((block) => {
      const elementInstanceContent = block.instances.map((instance) => {
        const newOptions = { pointsMultiplier: instance.pointsMultiplier }
        const newElementType = computeElementType({ instance })
        const newElementData = {} // TODO: parse from questionData
        const newResults = {} // TODO: initialize empty based on elementData / questionData
        const newAnonymousResults = {} // TODO: parse from results

        // TODO: figure out how to handle cases with missing element (questionId = null)
        // ? also extracting the questionId from the questionData does not work -> error on creation
        if (instance.order === null || instance.questionId === null) {
          console.log(instance)
          throw new Error(
            `Missing order or id for question instance ${instance.id}`
          )
        }

        return {
          originalId: String(instance.id),

          type: ElementInstanceType.LIVE_QUIZ,
          elementType: newElementType,
          order: instance.order,
          migrationId: uuidv4(),

          options: newOptions,
          elementData: newElementData,
          results: newResults,
          anonymousResults: newAnonymousResults,

          owner: {
            connect: {
              id: instance.ownerId,
            },
          },
          element: {
            connect: {
              id: instance.questionId,
            },
          },

          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        }
      })

      // compute element block properties based on session block properties
      let newBlockStatus: ElementBlockStatus = ElementBlockStatus.SCHEDULED
      if (block.status === SessionBlockStatus.ACTIVE) {
        newBlockStatus = ElementBlockStatus.ACTIVE
      } else if (block.status === SessionBlockStatus.EXECUTED) {
        newBlockStatus = ElementBlockStatus.EXECUTED
      }

      return {
        order: block.order,
        timeLimit: block.timeLimit ?? undefined,
        randomSelection: block.randomSelection ?? undefined,
        execution: block.execution,
        status: newBlockStatus,

        elements: {
          create: elementInstanceContent,
        },

        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      }
    })

    // compute updates for live quiz and execute modifications
    const newLiveQuiz = await prisma.liveQuiz.create({
      data: {
        originalId: liveSession.id,
        namespace: liveSession.namespace,
        pinCode: liveSession.pinCode,

        name: liveSession.name,
        displayName: liveSession.displayName,
        description: liveSession.description,

        startedAt: liveSession.startedAt,
        finishedAt: liveSession.finishedAt,
        pointsMultiplier: liveSession.pointsMultiplier,

        accessMode: liveSession.accessMode,
        maxBonusPoints: liveSession.maxBonusPoints,
        timeToZeroBonus: liveSession.timeToZeroBonus,
        isLiveQAEnabled: liveSession.isLiveQAEnabled,
        isConfusionFeedbackEnabled: liveSession.isConfusionFeedbackEnabled,
        isModerationEnabled: liveSession.isModerationEnabled,
        isGamificationEnabled: liveSession.isGamificationEnabled,
        isDeleted: liveSession.isDeleted,

        blocks: {
          create: elementBlockContent,
        },
        owner: {
          connect: {
            id: liveSession.ownerId,
          },
        },
        course: liveSession.courseId
          ? {
              connect: {
                id: liveSession.courseId,
              },
            }
          : undefined,

        createdAt: liveSession.createdAt,
        updatedAt: liveSession.updatedAt,
      },
      include: {
        blocks: true,
      },
    })

    if (liveSession.activeBlock) {
      // find id of new block that corresponds to the previous active block
      const newActiveBlock = newLiveQuiz.blocks.find(
        (block) => block.order === liveSession.activeBlock?.order
      )
      const activeBlockId = newActiveBlock?.id

      // update live quiz with active block id
      await prisma.liveQuiz.update({
        where: { id: newLiveQuiz.id },
        data: {
          activeBlockId,
        },
      })
    }

    console.log(
      `Migrated live session ${liveSession.id} to live quiz ${newLiveQuiz.id}`
    )

    // TODO: update redis cache based on originalId (same as in liveSession / questionInstance) and new ids
  }

  // TODO: set auto-increment values for instances and blocks
}

await run()
