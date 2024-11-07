import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import {
  Element,
  ElementBlockStatus,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  PrismaClient,
  SessionBlockStatus,
} from '@klicker-uzh/prisma'
import {
  AllElementTypeData,
  ElementInstanceResults,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementResultsChoices,
  ElementResultsOpen,
} from '@klicker-uzh/types'
import { getInitialElementResults, processElementData } from '@klicker-uzh/util'
import { v4 as uuidv4 } from 'uuid'

// ? This script will migrate the old live sessions to the new live quiz table
// ? (liveSession -> liveQuiz, sessionBlock -> elementBlock, questionInstance -> elementInstance)

// ! Flags
const logFakedElement = false
const logQuestionDataConversion = false
const logResultsConversion = false
const logInstanceConversion = false

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

function convertOldResults({
  type,
  oldResults,
  elementData,
  totalParticipants,
}: {
  type: ElementType
  oldResults: any
  elementData: AllElementTypeData
  totalParticipants: number
}): ElementInstanceResults {
  if (logResultsConversion) {
    console.log('ELEMENT TYPE')
    console.log(type)
    console.log("ELEMENT DATA'S OPTIONS")
    console.log('options' in elementData ? elementData.options : 'no options')
    console.log('OLD RESULTS (QUESTION INSTANCE)')
    console.log(oldResults)
    console.log('NEW RESULTS (ELEMENT INSTANCE)')
  }

  if (
    type === ElementType.SC ||
    type === ElementType.MC ||
    type === ElementType.KPRIM
  ) {
    const newChoices = Object.entries(oldResults).reduce<
      ElementResultsChoices['choices']
    >((acc, [_, option]: [string, any]) => {
      acc[option.value] = option.count
      return acc
    }, {})

    const newResults = {
      total: totalParticipants,
      choices: newChoices,
    }

    if (logResultsConversion) {
      console.log(newResults)
      console.log('\n\n')
    }

    return newResults
  } else if (type === ElementType.NUMERICAL) {
    const withSolutions =
      'options' in elementData && 'solutionRanges' in elementData.options

    const newResponses = Object.entries(oldResults).reduce<
      ElementResultsOpen['responses']
    >((acc, [responseHash, response]: [string, any]) => {
      const grading = withSolutions
        ? gradeQuestionNumerical({
            response: response.value,
            solutionRanges:
              (elementData.options as ElementOptionsNumerical).solutionRanges ??
              [],
          })
        : null
      const correctness = grading !== null ? grading === 1 : null

      acc[responseHash] =
        correctness !== null
          ? {
              value: response.value,
              count: response.count,
              correct: correctness,
            }
          : { value: response.value, count: response.count }

      return acc
    }, {})

    const newResults = {
      total: totalParticipants,
      responses: newResponses,
    }

    if (logResultsConversion) {
      console.log(newResults)
      console.log('\n\n')
    }

    return newResults
  } else if (type === ElementType.FREE_TEXT) {
    const withSolutions =
      'options' in elementData && 'solutions' in elementData.options

    const newResponses = Object.entries(oldResults).reduce<
      ElementResultsOpen['responses']
    >((acc, [responseHash, response]: [string, any]) => {
      const grading = withSolutions
        ? gradeQuestionFreeText({
            response: response.value,
            solutions:
              (elementData.options as ElementOptionsFreeText).solutions ?? [],
          })
        : null
      const correctness = grading !== null ? grading === 1 : null

      acc[responseHash] =
        correctness !== null
          ? {
              value: response.value,
              count: response.count,
              correct: correctness,
            }
          : { value: response.value, count: response.count }

      return acc
    }, {})

    const newResults = {
      total: totalParticipants,
      responses: newResponses,
    }

    if (logResultsConversion) {
      console.log(newResults)
      console.log('\n\n')
    }

    return newResults
  }

  throw new Error('Invalid element type encountered during results conversion')
}

async function run() {
  const prisma = new PrismaClient()

  // TODO: initialize redis cache when its content should be updated
  // const redisExec = new Redis({
  //   family: 4,
  //   host: process.env.REDIS_HOST ?? 'localhost',
  //   password: process.env.REDIS_PASS ?? '',
  //   port: Number(process.env.REDIS_PORT) ?? 6379,
  //   tls: process.env.REDIS_TLS ? {} : undefined,
  // })

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
      const elementInstanceContent = block.instances
        .map((instance) => {
          const newOptions = { pointsMultiplier: instance.pointsMultiplier }
          const questionData = instance.questionData

          const newElementType = computeElementType({ questionData })
          const newElementData = questionDataToElementData({ questionData })

          const emptyResults = getInitialElementResults(
            fakeElementFromQuestionData({ questionData })
          )

          const oldResults = instance.results as any
          const newAnonymousResults =
            instance.participants === 0
              ? emptyResults
              : convertOldResults({
                  type: newElementType,
                  oldResults,
                  elementData: newElementData,
                  totalParticipants: instance.participants,
                })

          if (instance.order === null || instance.questionId === null) {
            throw new Error(
              `Missing order or id for question instance ${instance.id}`
            )
          }

          const newInstance = {
            originalId: String(instance.id),

            type: ElementInstanceType.LIVE_QUIZ,
            elementType: newElementType,
            order: instance.order,
            migrationId: uuidv4(),

            options: newOptions,
            elementData: newElementData,
            results: emptyResults,
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

          if (logInstanceConversion) {
            console.log('INSTANCE (QUESTION INSTANCE)')
            console.log(instance)
            console.log('NEW INSTANCE (ELEMENT INSTANCE)')
            console.log(newInstance)
            console.log('\n\n')
          }

          return newInstance
        })
        .filter((instance) => instance !== null)

      // compute element block properties based on session block properties
      let newBlockStatus: ElementBlockStatus = ElementBlockStatus.SCHEDULED
      if (block.status === SessionBlockStatus.ACTIVE) {
        newBlockStatus = ElementBlockStatus.ACTIVE
      } else if (block.status === SessionBlockStatus.EXECUTED) {
        newBlockStatus = ElementBlockStatus.EXECUTED
      }

      return {
        originalId: block.id,
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
        activeBlock: {
          include: {
            elements: true,
          },
        },
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

    // TODO: uncomment to apply cache updates
    // // update redis cache data related to live quiz
    // const lb = await redisExec.hgetall(`s:${newLiveQuiz.originalId}:lb`)
    // if (typeof lb !== 'undefined' && lb !== null) {
    //   await redisExec.hmset(`lq:${newLiveQuiz.id}:lb`, lb)
    // }

    // // update redis cache data related to active block
    // const activeBlock = newLiveQuiz.activeBlock
    // if (typeof activeBlock !== 'undefined' && activeBlock !== null) {
    //   const blb = await redisExec.hgetall(
    //     `s:${newLiveQuiz.originalId}:b:${activeBlock.originalId}:lb`
    //   )

    //   if (typeof blb !== 'undefined' && blb !== null) {
    //     await redisExec.hmset(
    //       `lq:${newLiveQuiz.id}:eb:${activeBlock.id}:lb`,
    //       blb
    //     )
    //   }

    //   activeBlock.elements.forEach(async (instance) => {
    //     const info = await redisExec.hgetall(
    //       `s:${newLiveQuiz.originalId}:i:${instance.originalId}:info`
    //     )
    //     const responseHashes = await redisExec.hgetall(
    //       `s:${newLiveQuiz.originalId}:i:${instance.originalId}:responseHashes`
    //     )
    //     const responses = await redisExec.hgetall(
    //       `s:${newLiveQuiz.originalId}:i:${instance.originalId}:responses`
    //     )
    //     const results = await redisExec.hgetall(
    //       `s:${newLiveQuiz.originalId}:i:${instance.originalId}:results`
    //     )

    //     if (typeof info !== 'undefined' && info !== null) {
    //       await redisExec.hmset(
    //         `lq:${newLiveQuiz.id}:ei:${instance.id}:info`,
    //         info
    //       )
    //     }
    //     if (typeof responseHashes !== 'undefined' && responseHashes !== null) {
    //       await redisExec.hmset(
    //         `lq:${newLiveQuiz.id}:ei:${instance.id}:responseHashes`,
    //         responseHashes
    //       )
    //     }
    //     if (typeof responses !== 'undefined' && responses !== null) {
    //       await redisExec.hmset(
    //         `lq:${newLiveQuiz.id}:ei:${instance.id}:responses`,
    //         responses
    //       )
    //     }
    //     if (typeof results !== 'undefined' && results !== null) {
    //       await redisExec.hmset(
    //         `lq:${newLiveQuiz.id}:ei:${instance.id}:results`,
    //         results
    //       )
    //     }
    //   })
    // }

    // TODO: uncomment to apply
    // ! Cleanup: remove old live session cache data
    // await redisExec.del(`s:${newLiveQuiz.originalId}:*`)
  }
}

await run()
