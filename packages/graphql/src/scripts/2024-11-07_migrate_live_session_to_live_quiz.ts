import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import {
  Element,
  ElementBlock,
  ElementBlockStatus,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  LiveQuiz,
  LiveSession,
  PrismaClient,
  PublicationStatus,
  QuestionInstance,
  SessionBlock,
  SessionBlockStatus,
  SessionStatus,
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
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'

// ? This script will migrate the old live sessions to the new live quiz table
// ? (liveSession -> liveQuiz, sessionBlock -> elementBlock, questionInstance -> elementInstance)

// ! Flags
const logFakedElement = false
const logQuestionDataConversion = false
const logResultsConversion = false
const logInstanceConversion = false

/**
 * Computes the ElementType based on the provided question data
 *
 * @param params - Object containing question data
 * @param params.questionData - The question data containing type information
 * @returns The corresponding ElementType for the question
 * @throws Error if the question type is unknown
 */
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

/**
 * Generates a fake `Element` object from the provided question data.
 * This ensures that the data can be further processed by standard helper functions.
 *
 * @param {Object} params - The parameters object.
 * @param {any} params.questionData - The question data used to generate the fake element.
 * @returns {Element} The generated fake element.
 * @throws {Error} If the required question data properties are missing.
 */
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

  const elementId = questionData.id.split('-')[0]
  const elementVersion = Number(questionData.id.split('-')[1].slice(1))
  const elementType = computeElementType({ questionData })

  const fakedElement: Element = {
    id: elementId,
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

/**
 * Converts question data as seen in old `LiveSession` to element data format in new `LiveQuiz.
 *
 * @param {Object} params - The parameters object
 * @param {any} params.questionData - The question data to be converted
 * @returns {AllElementTypeData} The converted element data
 */
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

/**
 * Converts old format question results to the new ElementInstanceResults format.
 *
 * @param type - The type of element being converted (SC, MC, KPRIM, NUMERICAL, or FREE_TEXT)
 * @param oldResults - The legacy format results object to be converted
 * @param elementData - Data about the element including options and solutions
 * @param totalParticipants - Total number of participants who responded
 *
 * @returns ElementInstanceResults object in the new format:
 * - For SC/MC/KPRIM: Returns object with total participants and choices mapping
 * - For NUMERICAL/FREE_TEXT: Returns object with total participants and responses mapping
 *
 * @throws Error if an invalid element type is provided
 *
 * @example
 * For SC/MC/KPRIM elements, a new results object will look like:
 * {
 *   total: number,
 *   choices: { [key: string]: number }
 * }
 *
 * For NUMERICAL/FREE_TEXT elements, a new results object will look like:
 * {
 *   total: number,
 *   responses: {
 *     [responseHash: string]: {
 *       value: string | number,
 *       count: number,
 *       correct?: boolean
 *     }
 *   }
 * }
 */
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

/**
 * Applies cache updates for a live quiz by migrating data from the old live session format to the new live quiz format in Redis.
 *
 * This function performs the following operations:
 * 1. Checks if the quiz has already been migrated
 * 2. Updates meta cache data (namespace and startedAt)
 * 3. Migrates leaderboard data
 * 4. For the active block, migrates:
 *    - Block leaderboard data
 *    - For each element in the block:
 *      - Instance info
 *      - Response hashes
 *      - Responses
 *      - Results
 *
 * @param newLiveQuiz - The live quiz to migrate cache data for, including its active block and elements
 * @returns Promise<void>
 *
 * @remarks
 * All operations are performed using Redis pipeline for better performance.
 * The function uses key pattern 's:*' for old session data and 'lq:*' for new quiz data.
 */
async function applyCacheUpdatesForQuiz(
  redisExec: Redis,
  newLiveQuiz: LiveQuiz & {
    activeBlock?: ElementBlock & { elements: Element[] }
  }
) {
  // check if the key `lq:${newLiveQuiz.id}:meta` exists
  if (await redisExec.exists(`lq:${newLiveQuiz.id}:meta`)) {
    console.log(`Cache: Live quiz ${newLiveQuiz.id} already migrated`)
    return
  }

  const pipeline = redisExec.pipeline()

  // update the meta cache data related to live quiz (with keys namespace and startedAt)
  pipeline.hset(`lq:${newLiveQuiz.id}:meta`, {
    namespace: newLiveQuiz.namespace,
    startedAt: Number(newLiveQuiz.startedAt!),
  })

  // update redis cache data related to live quiz
  const lb = await redisExec.hgetall(`s:${newLiveQuiz.originalId}:lb`)
  if (typeof lb !== 'undefined' && lb !== null) {
    pipeline.hset(`lq:${newLiveQuiz.id}:lb`, { ...lb })
  }

  // update redis cache data related to active block
  const activeBlock = newLiveQuiz.activeBlock
  if (typeof activeBlock !== 'undefined' && activeBlock !== null) {
    const blb = await redisExec.hgetall(
      `s:${newLiveQuiz.originalId}:b:${activeBlock.originalId}:lb`
    )

    if (typeof blb !== 'undefined' && blb !== null) {
      pipeline.hset(`lq:${newLiveQuiz.id}:b:${activeBlock.id}:lb`, { ...blb })
    }

    activeBlock.elements.forEach(async (instance) => {
      const info = await redisExec.hgetall(
        `s:${newLiveQuiz.originalId}:i:${instance.originalId}:info`
      )
      const responseHashes = await redisExec.hgetall(
        `s:${newLiveQuiz.originalId}:i:${instance.originalId}:responseHashes`
      )
      const responses = await redisExec.hgetall(
        `s:${newLiveQuiz.originalId}:i:${instance.originalId}:responses`
      )
      const results = await redisExec.hgetall(
        `s:${newLiveQuiz.originalId}:i:${instance.originalId}:results`
      )

      if (typeof info !== 'undefined' && info !== null) {
        pipeline.hset(`lq:${newLiveQuiz.id}:i:${instance.id}:info`, { ...info })
      }

      if (typeof responseHashes !== 'undefined' && responseHashes !== null) {
        pipeline.hset(`lq:${newLiveQuiz.id}:i:${instance.id}:responseHashes`, {
          ...responseHashes,
        })
      }

      if (typeof responses !== 'undefined' && responses !== null) {
        pipeline.hset(`lq:${newLiveQuiz.id}:i:${instance.id}:responses`, {
          ...responses,
        })
      }

      if (typeof results !== 'undefined' && results !== null) {
        pipeline.hset(`lq:${newLiveQuiz.id}:i:${instance.id}:results`, {
          ...results,
        })
      }
    })
  }

  await pipeline.exec()

  // Cleanup: remove old live session cache data
  // await redisExec.del(`s:${newLiveQuiz.originalId}:*`)
}

/**
 * Migrates a LiveSession to a LiveQuiz by creating corresponding database entries.
 *
 * This function handles the migration process by:
 * 1. Checking if migration was already performed
 * 2. Converting session blocks to element blocks
 * 3. Converting question instances to element instances
 * 4. Mapping session status to quiz status
 * 5. Creating a new LiveQuiz with all related data
 * 6. Setting the active block if applicable
 *
 * @param prisma - Prisma client instance for database operations
 * @param liveSession - The live session to migrate, including its blocks and question instances
 * @returns Promise that resolves to the newly created LiveQuiz or undefined if already migrated
 *
 * @throws Error if a question instance is missing required order or id fields
 */
async function applyDBUpdatesForQuiz(
  prisma: PrismaClient,
  liveSession: LiveSession & {
    activeBlock?: (SessionBlock & { instances: QuestionInstance[] }) | null
    blocks: (SessionBlock & { instances: QuestionInstance[] })[]
  }
) {
  // check if the considered live session has already been migrated
  const existingLiveQuiz = await prisma.liveQuiz.findFirst({
    where: { originalId: liveSession.id },
  })

  if (existingLiveQuiz) {
    console.log(`DB: Live session ${liveSession.id} has already been migrated`)
    return existingLiveQuiz
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

  // compute live quiz status
  let liveQuizStatus: PublicationStatus | undefined
  if (liveSession.status === SessionStatus.PREPARED) {
    liveQuizStatus = PublicationStatus.DRAFT
  } else if (liveSession.status === SessionStatus.SCHEDULED) {
    liveQuizStatus = PublicationStatus.SCHEDULED
  } else if (liveSession.status === SessionStatus.RUNNING) {
    liveQuizStatus = PublicationStatus.PUBLISHED
  } else if (liveSession.status === SessionStatus.COMPLETED) {
    liveQuizStatus = PublicationStatus.ENDED
  }

  const newLiveQuizData = {
    data: {
      originalId: liveSession.id,
      namespace: liveSession.namespace,
      pinCode: liveSession.pinCode,

      name: liveSession.name,
      displayName: liveSession.displayName,
      description: liveSession.description,
      status: liveQuizStatus,

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
  }

  console.log(newLiveQuizData.data.name)

  // compute updates for live quiz and execute modifications
  let newLiveQuiz = await prisma.liveQuiz.create(newLiveQuizData)

  if (liveSession.activeBlock) {
    // find id of new block that corresponds to the previous active block
    const newActiveBlock = newLiveQuiz.blocks.find(
      (block) => block.order === liveSession.activeBlock?.order
    )
    const activeBlockId = newActiveBlock?.id

    // update live quiz with active block id
    newLiveQuiz = await prisma.liveQuiz.update({
      where: { id: newLiveQuiz.id },
      data: {
        activeBlockId,
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
  }

  return newLiveQuiz
}

/**
 * Migrates existing live sessions to the new live quiz format in the database.
 *
 * This function:
 * 1. Retrieves all live sessions with their associated blocks and instances
 * 2. For each live session:
 *    - Checks if migration was already performed
 *    - Converts blocks and their question instances to new element blocks/instances
 *    - Creates a new live quiz with converted data
 *    - Updates the active block reference if applicable
 *    - Optionally updates Redis cache data (commented out by default)
 *
 * The migration handles:
 * - Session/block/instance data conversion
 * - Status mapping between old and new models
 * - Results conversion for question instances
 * - Relationship preservation (owner, course connections)
 * - Timestamps preservation
 *
 * @throws {Error} If a question instance is missing required order or id fields
 * @async
 */
async function run() {
  const redisExec = new Redis({
    family: 4,
    host: process.env.REDIS_HOST ?? 'localhost',
    password: process.env.REDIS_PASS ?? '',
    port: Number(process.env.REDIS_PORT) ?? 6379,
    tls: process.env.REDIS_TLS ? {} : undefined,
  })

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
    take: 50,
  })

  for (const liveSession of liveSessions) {
    const newLiveQuiz = await applyDBUpdatesForQuiz(prisma, liveSession)

    if (newLiveQuiz.status === PublicationStatus.PUBLISHED) {
      await applyCacheUpdatesForQuiz(redisExec, newLiveQuiz)
    }

    console.log(
      `Migrated live session ${liveSession.id} to live quiz ${newLiveQuiz.id}`
    )
  }

  prisma.$disconnect()
  redisExec.quit()
}

await run()
