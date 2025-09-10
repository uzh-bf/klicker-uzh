import {
  NonRetryableError,
  type Context,
  type DurableContext,
  type JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ResponseInput } from '@klicker-uzh/types'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import { DEFAULT_POINTS } from './constants.js'
import {
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPointsDetails,
  updateLeaderboards,
} from './helpers.js'
import getRedis from './redis.js'

// TODO: Consider the following improvements
// - ensure that the response meets the restrictions specified in the element options (as for standard processor)

const redisExec = getRedis()

export async function processAssessmentResponse(
  message: {
    correlationId: string
    participantId: string
    sessionId: string
    instanceId: string
    response: ResponseInput
    cookie?: string
    responseTimestamp: number
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  ctx.logger.info(
    'ProcessAssessmentResponse function processing a message',
    message
  )
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: `[AddResponse Assessment] Processing response for instance ${message.instanceId} by participant ${message.participantId}.`,
  })

  try {
    assert(!!redisExec)
  } catch (e) {
    ctx.logger.error(`Redis connection error: ${JSON.stringify(e)}`)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  try {
    assert(!!prisma)
  } catch (e) {
    ctx.logger.error(`Prisma client error: ${JSON.stringify(e)}`)
    throw new Error(`Prisma client error ${String(e)}`)
  }

  if (message.sessionId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  // extract the relevant information from the redis cache
  const liveQuizKey = `lq:${message.sessionId}`
  const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
  const responseTimestamp = message.responseTimestamp
  const response = message.response

  if (!response) {
    ctx.logger.error(`Missing response: ${JSON.stringify(message)}`)
    throw new Error('Missing response')
  }

  // ! Step 1: Validation of answer timestamp (from message before block closure)
  // get live quiz and instance information from redis cache
  const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)

  // if the instance info is not available, return that the corresponding cache data is not available
  if (!instanceInfo) {
    ctx.logger.info(
      `Element instance metadata for instance ${message.instanceId} not found.`
    )
    ctx.v1.events.push('create-audit-log-entry', {
      correlationId: message.correlationId,
      info: `[AddResponse Assessment] Instance metadata for instance ${message.instanceId} not found.`,
    })
    throw new Error('Instance metadata not found')
  }

  // verify that the student answer was submitted before the block was closed
  const {
    type,
    solutions,
    firstResponseReceivedAt,
    sessionBlockId,
    choiceCount,
    basePoints,
    defaultPoints,
    pointsMultiplier,
    blockExecution,
    blockClosedAt,
  } = instanceInfo

  if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
    ctx.logger.info('Response received after element block was closed')
    ctx.v1.events.push('create-audit-log-entry', {
      correlationId: message.correlationId,
      info: `[AddResponse Assessment] Response received after block of element instance ${message.instanceId} was closed at ${new Date(blockClosedAt)}.`,
    })
    throw new NonRetryableError('Response received after block was closed')
  }

  // ! Step 2: Switch between different types, validate response and compute awarded points and XP

  let parsedSolutions = undefined
  try {
    if (solutions) {
      parsedSolutions = JSON.parse(solutions)
    }
  } catch (e) {
    ctx.logger.error(
      `Error parsing solutions (Error: ${JSON.stringify(e)}, Message: ${JSON.stringify(message)})`
    )
    throw new Error('Error parsing solutions')
  }

  const awardedBasePoints =
    basePoints === 'true'
      ? parseInt(defaultPoints ?? String(DEFAULT_POINTS), 10)
      : 0
  let computedCorrectness: number | null = null
  let awardedCorrectnessPoints = 0
  let awardedBonusPoints = 0
  let awardedXp = 0

  switch (type) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      // if response choices are not defined, return early
      if (!response.choices) {
        ctx.logger.error(`Missing response choices: ${JSON.stringify(message)}`)
        ctx.v1.events.push('create-audit-log-entry', {
          correlationId: message.correlationId,
          info: `[AddResponse Assessment] Response to choices question (instance id ${message.instanceId}) does not contain choices.`,
        })
        throw new Error('Missing response choices')
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getChoicesQuestionPointsDetails({
          type,
          choiceCount,
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          basePoints,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case 'NUMERICAL': {
      // if response value is not defined, return early
      if (typeof response.value === 'undefined' || response.value === null) {
        ctx.logger.error(`Missing response value: ${JSON.stringify(message)}`)
        ctx.v1.events.push('create-audit-log-entry', {
          correlationId: message.correlationId,
          info: `[AddResponse Assessment] Response to numerical question (instance id ${message.instanceId}) does not contain value.`,
        })
        throw new Error('Missing response value')
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getNumericalQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          basePoints,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case 'FREE_TEXT': {
      // if response value is not defined, return early
      if (typeof response.value !== 'string') {
        ctx.logger.error(`Missing response value: ${JSON.stringify(message)}`)
        ctx.v1.events.push('create-audit-log-entry', {
          correlationId: message.correlationId,
          info: `[AddResponse Assessment] Response to free text question (instance id ${message.instanceId}) does not contain value.`,
        })
        throw new Error('Missing response value')
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getFreeTextQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          basePoints,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }
    case 'SELECTION': {
      // if response selection is not defined, return early
      if (!response.selection) {
        ctx.logger.error(
          `Missing response selection: ${JSON.stringify(message)}`
        )
        ctx.v1.events.push('create-audit-log-entry', {
          correlationId: message.correlationId,
          info: `[AddResponse Assessment] Response to selection question (instance id ${message.instanceId}) does not contain selection.`,
        })
        throw new Error('Missing response selection')
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getSelectionQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          basePoints,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }
    case 'CASE_STUDY': {
      // if response assessment is not defined, return early
      if (!response.assessment) {
        ctx.logger.error(
          `Missing response assessment: ${JSON.stringify(message)}`
        )
        ctx.v1.events.push('create-audit-log-entry', {
          correlationId: message.correlationId,
          info: `[AddResponse Assessment] Response to case study question (instance id ${message.instanceId}) does not contain assessments.`,
        })
        throw new Error('Missing response assessment')
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getCaseStudyQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          basePoints,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }
  }

  // if the response was correct, set the corresponding timestamp on the instance
  if (
    computedCorrectness !== null &&
    computedCorrectness === 1 &&
    !firstResponseReceivedAt
  ) {
    // if we are processing a first response, set the timestamp on the instance
    // this will allow us to award points for response timing
    redisExec.hset(
      `${instanceKey}:info`,
      'firstResponseReceivedAt',
      responseTimestamp
    )
  }

  // send audit-log event for computed points and XP
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: `[AddResponse Assessment] Computed points for instance ${message.instanceId}. Base Points: ${awardedBasePoints}, Correctness Points: ${awardedCorrectnessPoints}, Bonus Points: ${awardedBonusPoints}, XP: ${awardedXp}.`,
  })

  // ! Step 3: Directly store the submitted response in the live quiz responses table and add entry to redis votes list for successful response
  try {
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(responseTimestamp),
        response,
        timeSpent: -1, // TODO: set this in future improvements
        correctness:
          computedCorrectness === null || computedCorrectness === 1
            ? ResponseCorrectness.CORRECT
            : computedCorrectness === 0
              ? ResponseCorrectness.WRONG
              : ResponseCorrectness.PARTIAL,
        basePoints: awardedBasePoints,
        correctnessPoints: awardedCorrectnessPoints,
        bonusPoints: awardedBonusPoints,
        elementBlockExecution: parseInt(blockExecution ?? '0', 10),
        instance: { connect: { id: Number(message.instanceId) } },
        participant: { connect: { id: message.participantId } },
      },
    })
  } catch (e) {
    ctx.logger.error(
      `Error during live quiz response creation: ${JSON.stringify(e)}`
    )
    ctx.v1.events.push('create-audit-log-entry', {
      correlationId: message.correlationId,
      info: `[AddResponse Assessment] Failed to create live quiz response for instance ${message.instanceId} and participant ${message.participantId}.`,
    })
    throw new NonRetryableError(
      `Live quiz response creation failed with the following error: ${JSON.stringify(e)}`
    )
  }

  // add the participant to the list of participants that have answered this question instance
  redisExec.hset(
    `lq:${message.sessionId}:i:${message.instanceId}:votes`,
    message.correlationId,
    'true'
  )

  // ! Step 4: Schedule additional hatchet task with response details to update aggregated results in redis & update leaderboard if gamification is enabled
  const quizInfo = await redisExec.hgetall(`${instanceKey}:info`)
  ctx.v1.events.push('response-processed:aggregation', {
    correlationId: message.correlationId,
    participantId: message.participantId,
    liveQuizId: message.sessionId,
    blockId: sessionBlockId,
    instanceId: message.instanceId,
    elementType: type,
    isGamificationEnabled: quizInfo?.isGamificationEnabled === 'true',
    pointsAwarded: awardedBasePoints,
    xpAwarded: awardedXp,
    response,
  })
}

export async function aggregateAssessmentResponses(
  message: {
    correlationId: string
    participantId: string
    liveQuizId: string
    blockId: string
    instanceId: string
    elementType: ElementType
    isGamificationEnabled: boolean
    pointsAwarded: number
    xpAwarded: number
    response: ResponseInput
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  // destructure message into components required for results aggregation
  const {
    participantId,
    liveQuizId,
    blockId,
    instanceId,
    elementType,
    isGamificationEnabled,
    pointsAwarded,
    xpAwarded,
    response,
  } = message

  // set up redis pipeline for batched execution
  const redis = redisExec.pipeline()

  // compose cache keys
  const liveQuizKey = `lq:${liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${instanceId}`

  // for gamified live quizzes, update the leaderboard and the participant xp
  if (isGamificationEnabled) {
    updateLeaderboards({
      redisMulti: redis,
      participantId,
      participantRole: UserRole.PARTICIPANT,
      liveQuizKey,
      sessionBlockId: blockId,
      pointsAwarded,
      xpAwarded,
    })
  }

  // step through the different element types, responses do not need to be verified anymore, since this was done by preceding task
  // aggregate the passed student response into the responses stored in the redis cache (for evaluation during quiz execution)
  switch (elementType) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      response
        .choices!.filter((choice) => choice.selected)
        .forEach((choice) => {
          redis.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
        })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case 'NUMERICAL': {
      const MD5 = createHash('md5')
      MD5.update(response.value!)
      const responseHash = MD5.digest('hex')
      redis.hincrby(`${instanceKey}:results`, responseHash, 1)
      redis.hset(`${instanceKey}:responseHashes`, responseHash, response.value!)
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case 'FREE_TEXT': {
      const cleanResponseValue = response.value!.trim()
      const MD5 = createHash('md5')
      MD5.update(cleanResponseValue)
      const responseHash = MD5.digest('hex')
      redis.hincrby(`${instanceKey}:results`, responseHash, 1)
      redis.hset(
        `${instanceKey}:responseHashes`,
        responseHash,
        cleanResponseValue
      )
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case 'SELECTION': {
      response.selection!.forEach((answerId: number) => {
        if (answerId === -1) return // skipped input fields should not be considered
        redis.hincrby(`${instanceKey}:results`, String(answerId), 1)
      })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case 'CASE_STUDY': {
      Object.entries(response.assessment!).forEach(([caseId, caseData]) => {
        Object.entries(caseData).forEach(([itemId, itemData]) => {
          Object.entries(itemData).forEach(
            ([criterionId, criterionResponse]) => {
              if (
                criterionResponse === null ||
                typeof criterionResponse !== 'number'
              ) {
                return
              }

              // compute the hash of the response
              const MD5 = createHash('md5')
              MD5.update(String(criterionResponse))
              const responseHash = MD5.digest('hex')
              const combinedHash = `${caseId}:${itemId}:${criterionId}:${responseHash}`

              // add the response hash / valid combination and/or increment the corresponding count
              redis.hincrby(`${instanceKey}:results`, combinedHash, 1)
              redis.hset(
                `${instanceKey}:responseHashes`,
                combinedHash,
                String(criterionResponse)
              )
            }
          )
        })
      })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case 'CONTENT': {
      // increase number of participants on element (do not award points / ... for content elements)
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }
  }

  try {
    await redis.exec()
    ctx.logger.info("Successfully aggregated a participant's results", message)
    return { status: 200 }
  } catch (e) {
    ctx.logger.error(
      `Redis pipeline for results aggregation failed: ${JSON.stringify(e)} (Message: ${JSON.stringify(message)})`
    )
    redis.discard()
    throw new Error(
      `Redis pipeline for results aggregation failed ${String(e)}`
    )
  }
}
