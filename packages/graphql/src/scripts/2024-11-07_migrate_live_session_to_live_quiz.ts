import {
  Element,
  ElementBlockStatus,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  PrismaClient,
  SessionBlockStatus,
} from '@klicker-uzh/prisma'
import { AllElementTypeData } from '@klicker-uzh/types'
import { getInitialElementResults, processElementData } from '@klicker-uzh/util'
import { v4 as uuidv4 } from 'uuid'

// ? This script will migrate the old live sessions to the new live quiz table
// ? (liveSession -> liveQuiz, sessionBlock -> elementBlock, questionInstance -> elementInstance)

// ! Flags
const logFakedElement = false
const logQuestionDataConversion = false

function computeElementType({
  questionData,
}: {
  questionData: any
}): ElementType {
  const qiType = questionData.type as string
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

function fakeElementFromQuestionData({
  questionData,
}: {
  questionData: any
}): Element {
  if (!questionData.id || !questionData.name || !questionData.content) {
    console.log('QUESTION DATA')
    console.log(questionData)
    throw new Error('Missing required question data properties')
  }

  const elemnetId = questionData.id.split('-')[0]
  const elementVersion = Number(questionData.id.split('-')[1].slice(1))
  const elementType = computeElementType({ questionData })

  const fakedElement = {
    id: elemnetId,
    name: questionData.name,
    version: elementVersion,
    type: elementType,
    content: questionData.content,
    explanation: questionData.explanation ?? null,
    pointsMultiplier: questionData.pointsMultiplier ?? 1,
    options: questionData.options,
    originalId: '', // unused
    isArchived: false, // unused
    isDeleted: false, // unused
    status: ElementStatus.READY, // unused
    ownerId: '', // unused
    createdAt: new Date(), // unused
    updatedAt: new Date(), // unused
  }

  if (logFakedElement) {
    console.log('QUESTION DATA')
    console.log(questionData)
    console.log('FAKED ELEMENT')
    console.log(fakedElement)
    console.log('\n\n')
  }

  return fakedElement
}

function questionDataToElementData({
  questionData,
}: {
  questionData: any
}): AllElementTypeData {
  const fakedElement = fakeElementFromQuestionData({ questionData })

  if (logQuestionDataConversion) {
    console.log('QUESTION DATA')
    console.log(questionData)
    console.log('FAKED ELEMENT')
    console.log(fakedElement)
    console.log('\n\n')
  }

  const elementData = processElementData(fakedElement)
  return elementData
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
    skip: 0, // TODO: remove this
    take: 10, // TODO: remove this
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
        const questionData = instance.questionData

        const newElementType = computeElementType({ questionData })
        const newElementData = questionDataToElementData({ questionData })
        const newResults = getInitialElementResults(
          fakeElementFromQuestionData({ questionData })
        )
        const newAnonymousResults = {} // TODO: parse from existing results on question instance

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
