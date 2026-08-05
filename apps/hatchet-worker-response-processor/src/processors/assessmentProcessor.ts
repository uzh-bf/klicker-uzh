import {
  type Context,
  type DurableContext,
  type JsonObject,
  NonRetryableError,
  type UnknownInputType,
} from '@hatchet-dev/typescript-sdk/index.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import {
  getLiveQuizResponseTrackingKey,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import { DEFAULT_POINTS } from '../constants.js'
import { getAssessmentRedis } from '../redis.js'
import {
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPointsDetails,
  updateLeaderboards,
  validateStudentResponse,
} from './helpers.js'

const redisExec = getAssessmentRedis() // use assessment redis instance for assessment response processor

export async function processAssessmentResponse(
  message: {
    correlationId: string
    participantId: string
    liveQuizId: string
    instanceId: string
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
  },
  ctx: DurableContext<UnknownInputType, {}>
) {
  const receivedMessage = `[INFO] [AddResponse Assessment] Processing response for instance ${message.instanceId} by participant ${message.participantId}.`
  ctx.logger.info(receivedMessage)
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: receivedMessage,
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

  if (message.liveQuizId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  // extract the relevant information from the redis cache
  const liveQuizKey = `lq:${message.liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
  const responseTimestamp = message.responseTimestamp
  const response = message.response

  // get live quiz and instance information from redis cache
  const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)

  if (!response && instanceInfo.type !== ElementType.CONTENT) {
    ctx.logger.error(
      'Missing response ' +
        JSON.stringify({
          correlationId: message.correlationId,
          liveQuizId: message.liveQuizId,
          instanceId: message.instanceId,
        })
    )
    throw new NonRetryableError('Missing response')
  }

  // ! Step 1: Validation of answer timestamp (from message before block closure)
  // if the instance info is not available, return that the corresponding cache data is not available
  if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
    throw new Error(
      `Instance metadata for instance ${message.instanceId} not found.`
    )
  }

  // verify that the student answer was submitted before the block was closed
  const {
    type,
    solutions,
    restrictions,
    firstResponseReceivedAt,
    sessionBlockId,
    courseId,
    choiceCount,
    basePoints,
    defaultPoints,
    pointsMultiplier,
    blockExecution,
    blockClosedAt,
  } = instanceInfo

  // instances in assessment live quizzes always need to have a type, course linked to the activity and session block id
  if (!type || !courseId || !sessionBlockId) {
    throw new NonRetryableError(
      `Instance ${message.instanceId} does not have a type (${type}) or is not linked to a course (${courseId}) or session block (${sessionBlockId}).`
    )
  }

  if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
    ctx.logger.error(
      `[CANCEL] [AddResponse Assessment] Response received at ${new Date(Number(responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(blockClosedAt))}.`
    )
    ctx.cancel()
    return { status: 200 }
  }

  // ! Step 1.2 Validation of response format
  let parsedRestrictions:
    | NumericalRestrictions
    | FreeTextRestrictions
    | undefined
  try {
    if (restrictions) {
      parsedRestrictions = restrictions
        ? typeof restrictions === 'string'
          ? JSON.parse(restrictions)
          : restrictions
        : undefined
    }
  } catch (e) {
    throw new NonRetryableError(
      `Error ${String(e)} occurred when parsing restrictions: ${restrictions}`
    )
  }

  const { valid, message: validationError } = validateStudentResponse({
    type: type as any,
    response,
    restrictions: parsedRestrictions,
  })

  if (!valid) {
    throw new NonRetryableError(
      `Response to question instance ${message.instanceId} is not valid: ${validationError}`
    )
  }

  // ! Step 2: Switch between different types, validate response and compute awarded points and XP
  let parsedSolutions = undefined
  try {
    if (solutions) {
      parsedSolutions = JSON.parse(solutions)
    }
  } catch (e) {
    throw new Error(`Error parsing solutions: ${String(e)}`)
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
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // if response choices are not defined, return early
      if (!response.choices) {
        throw new NonRetryableError(
          `Response to choices question (instance id ${message.instanceId}) does not contain choices.`
        )
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
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.NUMERICAL: {
      // if response value is not defined, return early
      if (typeof response.value === 'undefined' || response.value === null) {
        throw new NonRetryableError(
          `Response to numerical question (instance id ${message.instanceId}) does not contain value.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getNumericalQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.FREE_TEXT: {
      // if response value is not defined, return early
      if (typeof response.value !== 'string') {
        throw new NonRetryableError(
          `Response to free text question (instance id ${message.instanceId}) does not contain value.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getFreeTextQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.SELECTION: {
      // if response selection is not defined, return early
      if (!response.selection) {
        throw new NonRetryableError(
          `Response to selection question (instance id ${message.instanceId}) does not contain selection.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getSelectionQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.CASE_STUDY: {
      // if response assessment is not defined, return early
      if (!response.assessment) {
        throw new NonRetryableError(
          `Response to case study question (instance id ${message.instanceId}) does not contain assessments.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getCaseStudyQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.CONTENT: {
      // content elements do not have a correct solution, award default points and 0 xp
      computedCorrectness = null
      awardedCorrectnessPoints = 0
      awardedBonusPoints = 0
      awardedXp = 0
      break
    }

    default: {
      throw new NonRetryableError(
        `Element type ${type} not recognized for instance ${message.instanceId}.`
      )
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
    await redisExec.hsetnx(
      `${instanceKey}:info`,
      'firstResponseReceivedAt',
      responseTimestamp
    )
  }

  // send audit-log event for computed points and XP
  const gradingLog = `[INFO] [AddResponse Assessment] Computed points for instance ${message.instanceId}. Base Points: ${awardedBasePoints}, Correctness Points: ${awardedCorrectnessPoints}, Bonus Points: ${awardedBonusPoints}, XP: ${awardedXp}.`
  ctx.logger.info(gradingLog)
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: gradingLog,
  })

  // ! Step 3: Validate that the submitting user has a valid participation in the assessment course (requirement for assessment responses)
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: message.participantId,
      },
    },
  })

  if (!participation) {
    throw new NonRetryableError(
      `Participant ${message.participantId} does not have a participation in course ${courseId} linked to assessment live quiz ${message.liveQuizId}.`
    )
  }

  // ! Step 4: Directly store the submitted response in the live quiz responses table and add entry to redis votes list for successful response
  // verify that the participant has not votes on the same question before
  const existingVote = await prisma.liveQuizResponse.findUnique({
    where: {
      instanceId_elementBlockExecution_participantId: {
        instanceId: Number(message.instanceId),
        elementBlockExecution: parseInt(blockExecution ?? '0', 10),
        participantId: message.participantId,
      },
    },
  })

  if (existingVote) {
    ctx.logger.error(
      `[CANCEL] [AddResponse Assessment] Participant ${message.participantId} has already submitted a response for instance ${message.instanceId} and block execution ${blockExecution}.`
    )
    ctx.cancel()
    return { status: 208 }
  }

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
        basePoints: Number.isNaN(awardedBasePoints) ? 0 : awardedBasePoints,
        correctnessPoints: Number.isNaN(awardedCorrectnessPoints)
          ? 0
          : awardedCorrectnessPoints,
        bonusPoints: Number.isNaN(awardedBonusPoints) ? 0 : awardedBonusPoints,
        elementBlockExecution: parseInt(blockExecution ?? '0', 10),
        instance: { connect: { id: Number(message.instanceId) } },
        participant: { connect: { id: message.participantId } },
      },
    })
  } catch (e) {
    throw new Error(
      `Failed to create live quiz response for instance ${message.instanceId} and participant ${message.participantId}.`
    )
  }

  // add the participant to the list of participants that have answered this question instance
  redisExec.hset(
    `lq:${message.liveQuizId}:i:${message.instanceId}:votes`,
    message.correlationId,
    'true'
  )

  // ! Step 5: Schedule additional hatchet task with response details to update aggregated results in redis & update leaderboard if gamification is enabled
  const quizInfo = await redisExec.hgetall(`${instanceKey}:info`)
  ctx.v1.events.push('response-processed:aggregation', {
    correlationId: message.correlationId,
    participantId: message.participantId,
    liveQuizId: message.liveQuizId,
    blockId: sessionBlockId,
    instanceId: message.instanceId,
    elementType: type,
    isGamificationEnabled: quizInfo?.isGamificationEnabled === 'true',
    pointsAwarded: awardedBasePoints,
    xpAwarded: awardedXp,
    response,
  })

  return {
    status: 200,
    pointsAwarded: awardedBasePoints,
    correctnessPoints: awardedCorrectnessPoints,
    bonusPoints: awardedBonusPoints,
    xpAwarded: awardedXp,
  }
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
    response: LiveQuizResponseInput
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  // destructure message into components required for results aggregation
  const {
    correlationId,
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
  if (isGamificationEnabled && elementType !== ElementType.CONTENT) {
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
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      response
        .choices!.filter((choice) => choice.selected)
        .forEach((choice) => {
          redis.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
        })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case ElementType.NUMERICAL: {
      const MD5 = createHash('md5')
      MD5.update(response.value!)
      const responseHash = MD5.digest('hex')
      redis.hincrby(`${instanceKey}:results`, responseHash, 1)
      redis.hset(`${instanceKey}:responseHashes`, responseHash, response.value!)
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case ElementType.FREE_TEXT: {
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

    case ElementType.SELECTION: {
      response.selection!.forEach((answerId: number) => {
        if (
          answerId === -1 ||
          typeof answerId === 'undefined' ||
          answerId === null
        ) {
          return // skipped input fields should not be considered
        }

        redis.hincrby(`${instanceKey}:results`, String(answerId), 1)
      })
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }

    case ElementType.CASE_STUDY: {
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

    case ElementType.CONTENT: {
      // increase number of participants on element (do not award points / ... for content elements)
      redis.hincrby(`${instanceKey}:results`, 'participants', 1)
      break
    }
  }

  const processedResponseTrackingKey = getLiveQuizResponseTrackingKey({
    liveQuizId,
    instanceId,
    status: 'processed',
  })
  redis.sadd(processedResponseTrackingKey, correlationId)
  redis.expire(
    processedResponseTrackingKey,
    LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
  )

  try {
    await redis.exec()
    ctx.logger.info("Successfully aggregated a participant's results", {
      correlationId: message.correlationId,
      liveQuizId: message.liveQuizId,
      instanceId: message.instanceId,
    })
    return { status: 200 }
  } catch (e) {
    ctx.logger.error(
      `Redis pipeline for results aggregation failed: ${String(e)}` +
        JSON.stringify({
          correlationId: message.correlationId,
          liveQuizId: message.liveQuizId,
          instanceId: message.instanceId,
        })
    )
    redis.discard()
    throw new Error(
      `Redis pipeline for results aggregation failed ${String(e)}`
    )
  }
}
