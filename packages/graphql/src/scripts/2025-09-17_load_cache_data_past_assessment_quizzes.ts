import { prisma } from '@klicker-uzh/prisma'
import {
  ElementBlock,
  ElementInstance,
  ElementType,
  LiveQuiz,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  ElementData,
  ElementResultsChoices,
  ElementResultsSelection,
} from '@klicker-uzh/types'
import { signJWT } from '@klicker-uzh/util'
import { ChainableCommander, Redis } from 'ioredis'
import { createHash } from 'node:crypto'

// ! IMPORTANT INFORMATION
// This script loads the instance cache data (and the results -> not relevant, will be ignored) for all ended assessment live quizzes
// This data is required to be able to re-run certain hatchet operations, relying on the corresponding cache data to be present

const DRY_RUN = true

async function run() {
  // connect to the assessment live quiz
  const redis = new Redis({
    family: 4,
    host: process.env.REDIS_ASSESSMENT_HOST ?? 'localhost',
    password: process.env.REDIS_ASSESSMENT_PASS ?? '',
    port: Number(process.env.REDIS_ASSESSMENT_PORT ?? 6381),
    tls: process.env.REDIS_ASSESSMENT_TLS ? {} : undefined,
  })

  // find all ended assessment live quizzes
  const endedAssessmentLiveQuizzes = await prisma.liveQuiz.findMany({
    where: {
      isAssessmentEnabled: true,
      finishedAt: { lt: new Date() },
      status: PublicationStatus.ENDED,
    },
    include: {
      blocks: {
        include: {
          elements: {
            include: { liveQuizResponses: { orderBy: { submittedAt: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
  console.log(
    `Found ${endedAssessmentLiveQuizzes.length} ended assessment live quizzes.`
  )

  // add the metadata of each quiz to the redis cache
  const redisMultiMeta = redis.pipeline()
  for (const quiz of endedAssessmentLiveQuizzes) {
    // if a quiz does not have a startedAt, we need to throw an error
    if (!quiz.startedAt) {
      throw new Error(`Quiz ${quiz.id} does not have a startedAt.`)
    }

    // set the meta data of the quiz
    if (!DRY_RUN) {
      redisMultiMeta.hmset(`lq:${quiz.id}:meta`, {
        namespace: quiz.namespace,
        startedAt: String(quiz.startedAt.getTime()),
        isGamificationEnabled: quiz.isGamificationEnabled,
        isAssessmentEnabled: quiz.isAssessmentEnabled,
      })
    }
  }

  if (!DRY_RUN) {
    await redisMultiMeta.exec()
  }

  // set the instance cache data for each instance of each block of each quiz
  for (const quiz of endedAssessmentLiveQuizzes) {
    console.log(
      `Setting instance cache data for quiz ${quiz.id} (${quiz.blocks.length} blocks).`
    )

    for (const block of quiz.blocks) {
      // if the block has no startedAt timestamp, return early
      if (!block.startedAt || !block.closedAt) {
        throw new Error(
          `Block ${block.id} of quiz ${quiz.id} does not have a startedAt or closedAt.`
        )
      }

      for (const instance of block.elements) {
        const redisMultiInstances = redis.pipeline()
        const instanceKey = `lq:${quiz.id}:i:${instance.id}`

        // set instance metadata and initialize the corresponding results
        if (!DRY_RUN) {
          setInstanceCacheData({
            quiz,
            block,
            instance,
            redisMulti: redisMultiInstances,
          })
        }

        // obtain the correlation key of the instance
        const correlationKey = await signJWT(
          {
            instanceId: instance.id,
            execution: block.execution,
            liveQuizId: quiz.id,
            sub: '', // dummy sub, since this value is required
          },
          process.env.APP_SECRET as string,
          {
            issuer: process.env.APP_ORIGIN_ASSESSMENT_API,
            issuedAt: block.startedAt,
          }
        )

        // set the votes for all students that have stored live quiz responses in the database for this instance
        for (const response of instance.liveQuizResponses) {
          const combinedCorrelationKey = `${correlationKey}:${response.participantId}`
          const MD5 = createHash('md5')
          MD5.update(combinedCorrelationKey)
          const correlationId = MD5.digest('hex')

          // set the votes entry for the student
          if (!DRY_RUN) {
            redisMultiInstances.hset(
              `lq:${quiz.id}:i:${instance.id}:votes`,
              correlationId,
              'true'
            )
          }
        }

        // set the timestamp of the first response for the instance
        if (instance.liveQuizResponses.length > 0 && !DRY_RUN) {
          redisMultiInstances.hset(
            `${instanceKey}:info`,
            'firstResponseReceivedAt',
            String(instance.liveQuizResponses[0].submittedAt.getTime())
          )
        }

        // set the block closure date on the instance info
        if (!DRY_RUN) {
          redis.hset(
            `${instanceKey}:info`,
            'blockClosedAt',
            String(block.closedAt.getTime())
          )

          await redisMultiInstances.exec()
        }
      }
    }
  }

  // return / exit the process
  return process.exit(0)
}

// ? copy of function logic from live quiz service
function setInstanceCacheData({
  quiz,
  block,
  instance,
  redisMulti,
}: {
  quiz: LiveQuiz
  block: ElementBlock
  instance: ElementInstance
  redisMulti: ChainableCommander
}) {
  const elementData = instance.elementData as ElementData
  const commonInfo = {
    namespace: quiz.namespace,
    startedAt: String(block.startedAt!.getTime() ?? 0), // existence of start date is asserted outside of the function
    sessionBlockId: block.id,
    liveQuizId: quiz.id,
    courseId: quiz.courseId ?? '',
    type: elementData.type,
    basePoints: instance.options.basePoints,
    pointsMultiplier: instance.options.pointsMultiplier,
    defaultPoints: quiz.defaultPoints,
    defaultCorrectPoints: quiz.defaultCorrectPoints,
    maxBonusPoints: quiz.maxBonusPoints,
    timeToZeroBonus: quiz.timeToZeroBonus,
    blockExecution: block.execution,
    blockStartedAt: Number(block.startedAt),
  }

  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
        ...commonInfo,
        choiceCount: elementData.options.choices.length,
        solutions: elementData.options.hasSampleSolution
          ? JSON.stringify(
              elementData.options.choices
                .map((choice, ix) => ({ ix, correct: choice.correct }))
                .filter((choice) => choice.correct)
                .map((choice) => choice.ix)
            )
          : undefined,
      })
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
        ...(instance.results as ElementResultsChoices).choices,
      })

      break
    }

    case ElementType.NUMERICAL: {
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
        ...commonInfo,
        ...(elementData.options.restrictions &&
        Object.keys(elementData.options.restrictions).length > 0
          ? { restrictions: JSON.stringify(elementData.options.restrictions) }
          : {}),
        solutions:
          elementData.options.exactSolutions &&
          elementData.options.exactSolutions.length > 0
            ? JSON.stringify(elementData.options.exactSolutions)
            : elementData.options.solutionRanges
              ? JSON.stringify(elementData.options.solutionRanges)
              : undefined,
      })
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
      })

      break
    }

    case ElementType.FREE_TEXT: {
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
        ...commonInfo,
        ...(elementData.options.restrictions &&
        Object.keys(elementData.options.restrictions).length > 0
          ? { restrictions: JSON.stringify(elementData.options.restrictions) }
          : {}),
        solutions: elementData.options.hasSampleSolution
          ? JSON.stringify(elementData.options.solutions)
          : undefined,
      })
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
      })

      break
    }

    case ElementType.SELECTION: {
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
        ...commonInfo,
        solutions: JSON.stringify(
          elementData.options.answerCollectionSolutionIds
        ),
        numberOfInputs: elementData.options.numberOfInputs,
      })
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
        ...(instance.results as ElementResultsSelection).selections,
      })

      break
    }

    case ElementType.CASE_STUDY: {
      // convert solutions to object for faster access
      const validSolutions = elementData.options.cases.every(
        (caseItem) => caseItem.solutions
      )
      const solutions =
        elementData.options.hasSampleSolution && validSolutions
          ? elementData.options.cases.map((caseItem) => ({
              caseId: caseItem.id,
              itemSolutions: caseItem.solutions,
            }))
          : undefined

      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
        ...commonInfo,
        solutions: solutions ? JSON.stringify(solutions) : undefined,
      })
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
      })

      break
    }

    case ElementType.CONTENT: {
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, commonInfo)
      redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
        participants: 0,
      })

      break
    }
  }
}

await run()
