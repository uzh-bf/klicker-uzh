// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

// TODO: add additional processor with assessment logic
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  LiveQuizResponseCollectionMode,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import {
  buildCorrelatedVoteKey,
  releaseCorrelatedResponse,
  verifyJWT,
  type CorrelatedResponseClaim,
  type JWTPayload,
} from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'
import { DEFAULT_POINTS } from '../constants.js'
import { getRedis } from '../redis.js'
import {
  buildCorrelatedResponseCreateData,
  CorrelatedResponseIdentityError,
  getCorrelatedProcessedKey,
  isPersistedResponseRetry,
  resolveCorrelatedResponseOwner,
  type CorrelatedResponseOwner,
} from './correlatedResponse.js'
import {
  getCaseStudyQuestionPoints,
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPoints,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPoints,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPoints,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPoints,
  getSelectionQuestionPointsDetails,
  updateLeaderboards,
  validateStudentResponse,
} from './helpers.js'

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the element options

const redisExec = getRedis() // use standard redis instance for regular response processor

function getCorrelatedResponsePoints({
  type,
  choiceCount,
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  defaultPoints,
  pointsMultiplier,
  parsedSolutions,
}: {
  type: string
  choiceCount?: string
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  firstResponseReceivedAt?: string
  responseTimestamp: number
  basePoints?: string
  defaultPoints?: string
  pointsMultiplier?: string
  parsedSolutions: any
}) {
  const awardedBasePoints =
    basePoints === 'true'
      ? parseInt(defaultPoints ?? String(DEFAULT_POINTS), 10)
      : 0

  let details: {
    correctnessPoints: number
    bonusPoints: number
    pointsPercentage: number | null
  }
  switch (type) {
    case 'SC':
    case 'MC':
    case 'KPRIM':
      details = getChoicesQuestionPointsDetails({
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
      break
    case 'NUMERICAL':
      details = getNumericalQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        basePoints,
        pointsMultiplier,
        parsedSolutions,
      })
      break
    case 'FREE_TEXT':
      details = getFreeTextQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        basePoints,
        pointsMultiplier,
        parsedSolutions,
      })
      break
    case 'SELECTION':
      details = getSelectionQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        basePoints,
        pointsMultiplier,
        parsedSolutions,
      })
      break
    case 'CASE_STUDY':
      details = getCaseStudyQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        basePoints,
        pointsMultiplier,
        parsedSolutions,
      })
      break
    case 'CONTENT':
      details = {
        correctnessPoints: 0,
        bonusPoints: 0,
        pointsPercentage: null,
      }
      break
    default:
      throw new Error(`Unsupported correlated response element type ${type}`)
  }

  return {
    basePoints: awardedBasePoints,
    correctnessPoints: details.correctnessPoints,
    bonusPoints: details.bonusPoints,
    correctnessPercentage: details.pointsPercentage,
  }
}

export async function processResponseMessage(
  message: {
    messageId: string
    sessionId: string
    instanceId: string
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
    correlatedClaim?: CorrelatedResponseClaim
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  ctx.logger.info('ProcessResponse: received message', {
    messageId: message.messageId,
    sessionId: message.sessionId,
    instanceId: message.instanceId,
  })

  try {
    assert(!!redisExec)
  } catch (e) {
    ctx.logger.error(`Redis connection error: ${JSON.stringify(e)}`)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  if (message.sessionId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  const releaseClaim = async () => {
    if (!message.correlatedClaim) return

    await releaseCorrelatedResponse({
      redis: redisExec,
      ...message.correlatedClaim,
      messageId: message.messageId,
    })
  }

  let redisMulti: ChainableCommander = redisExec.pipeline()
  let isCorrelated = false
  let correlatedOwner: CorrelatedResponseOwner | undefined
  let correlatedProcessedKey: string | undefined
  let correlatedInstanceId: number | undefined
  let correlatedBlockExecution: number | undefined
  let responsePersisted = false

  try {
    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const responseTimestamp = message.responseTimestamp
    const response = message.response
    if (!response) {
      ctx.logger.error(
        'Missing response ' +
          JSON.stringify({
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
          })
      )
      await releaseClaim()
      return { status: 400 }
    }

    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      ctx.logger.info('Element instance metadata not found', {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      })
      await releaseClaim()
      return { status: 400 }
    }
    ctx.logger.info('Instance info loaded', {
      sessionId: message.sessionId,
      instanceId: message.instanceId,
    })

    const {
      type,
      solutions,
      restrictions,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
      basePoints,
      pointsMultiplier,
      defaultPoints,
      blockExecution,
      blockClosedAt,
    } = instanceInfo

    const cachedResponseCollectionMode = instanceInfo.responseCollectionMode
    const responseCollectionMode =
      cachedResponseCollectionMode ===
        LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
      cachedResponseCollectionMode ===
        LiveQuizResponseCollectionMode.CORRELATED_EXPORT
        ? cachedResponseCollectionMode
        : (
            await prisma.liveQuiz.findUnique({
              where: { id: message.sessionId },
              select: { responseCollectionMode: true },
            })
          )?.responseCollectionMode
    if (!responseCollectionMode) {
      await releaseClaim()
      return { status: 400 }
    }

    isCorrelated =
      responseCollectionMode ===
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
    redisMulti = isCorrelated ? redisExec.multi() : redisExec.pipeline()

    let participantData: JWTPayload | null = null
    if (isCorrelated) {
      if (
        !message.correlatedClaim ||
        !blockExecution ||
        !type ||
        !sessionBlockId
      ) {
        await releaseClaim()
        return { status: 400 }
      }

      correlatedInstanceId = Number(message.instanceId)
      correlatedBlockExecution = Number(blockExecution)
      if (
        !Number.isInteger(correlatedInstanceId) ||
        !Number.isInteger(correlatedBlockExecution)
      ) {
        await releaseClaim()
        return { status: 400 }
      }

      const secret = process.env.APP_SECRET
      const issuer = process.env.APP_ORIGIN_API
      if (!secret || !issuer) {
        throw new Error(
          'APP_SECRET and APP_ORIGIN_API are required for correlated live quiz responses'
        )
      }

      correlatedOwner = await resolveCorrelatedResponseOwner({
        cookieHeader: message.cookie,
        liveQuizId: message.sessionId,
        secret,
        issuer,
        database: prisma,
      })

      const expectedClaimKey = buildCorrelatedVoteKey({
        liveQuizId: message.sessionId,
        instanceId: message.instanceId,
        blockExecution,
      })
      if (
        message.correlatedClaim.key !== expectedClaimKey ||
        message.correlatedClaim.identityKey !== correlatedOwner.identityKey
      ) {
        await releaseClaim()
        return { status: 400 }
      }

      const claimOwnerMessageId = await redisExec.hget(
        message.correlatedClaim.key,
        message.correlatedClaim.identityKey
      )
      if (claimOwnerMessageId !== message.messageId) {
        await releaseClaim()
        return { status: 400 }
      }

      correlatedProcessedKey = getCorrelatedProcessedKey({
        liveQuizId: message.sessionId,
        instanceId: message.instanceId,
        blockExecution: correlatedBlockExecution,
      })
      const processedMessageId = await redisExec.hget(
        correlatedProcessedKey,
        correlatedOwner.identityKey
      )
      if (processedMessageId === message.messageId) {
        return { status: 200 }
      }
      if (processedMessageId) {
        await releaseClaim()
        return { status: 208 }
      }

      const existingResponse =
        correlatedOwner.kind === 'participant'
          ? await prisma.liveQuizResponse.findUnique({
              where: {
                instanceId_elementBlockExecution_participantId: {
                  instanceId: correlatedInstanceId,
                  elementBlockExecution: correlatedBlockExecution,
                  participantId: correlatedOwner.id,
                },
              },
            })
          : await prisma.liveQuizResponse.findUnique({
              where: {
                instanceId_elementBlockExecution_respondentId: {
                  instanceId: correlatedInstanceId,
                  elementBlockExecution: correlatedBlockExecution,
                  respondentId: correlatedOwner.id,
                },
              },
            })
      if (existingResponse) {
        if (
          !isPersistedResponseRetry({
            existingSubmittedAt: existingResponse.submittedAt,
            responseTimestamp,
            claimOwnerMessageId,
            messageId: message.messageId,
          })
        ) {
          await releaseClaim()
          return { status: 208 }
        }
        responsePersisted = true
      }

      participantData =
        correlatedOwner.kind === 'participant'
          ? { sub: correlatedOwner.id, role: UserRole.PARTICIPANT }
          : correlatedOwner.kind === 'temporary'
            ? { sub: correlatedOwner.id, role: UserRole.TEMPORARY_PARTICIPANT }
            : null
    } else if (typeof message.cookie === 'string') {
      try {
        const parsedCookies = message.cookie
          .split(';')
          .map((v: string) => v.split('='))
          .reduce<Record<string, string>>((acc, v) => {
            acc[decodeURIComponent(v[0]!.trim())] = decodeURIComponent(
              v[1]!.trim()
            )
            return acc
          }, {})

        if (parsedCookies['participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'PARTICIPANT') {
            participantData = null
          } else {
            ctx.logger.info("Participant's JWT verified")
          }
        } else if (parsedCookies['temporary_participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['temporary_participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'TEMPORARY_PARTICIPANT') {
            participantData = null
          } else {
            ctx.logger.info("Temporary Participant's JWT verified")
          }
        }
      } catch (e) {
        ctx.logger.error(`JWT verification failed: ${String(e)}`)
      }

      if (
        participantData &&
        (await redisExec.hexists(
          `${instanceKey}:responses`,
          participantData.role === 'TEMPORARY_PARTICIPANT'
            ? `temporary-${participantData.sub}`
            : participantData.sub
        ))
      ) {
        ctx.logger.info(
          'Participant has already responded to this question instance'
        )
        return { status: 200 }
      }
    }

    if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
      ctx.logger.error(
        `[CANCEL] [AddResponse Assessment] Response received at ${new Date(Number(responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(blockClosedAt))}.`
      )
      ctx.cancel()
      await releaseClaim()
      return { status: 200 }
    }

    let parsedSolutions = undefined
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch (e) {
      throw new Error('Error parsing solutions: ' + String(e))
    }

    // validate the incoming response
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
      throw new Error(
        `Error ${String(e)} occurred when parsing restrictions: ${restrictions}`
      )
    }

    const { valid, message: validationError } = validateStudentResponse({
      type: type as any,
      response,
      restrictions: parsedRestrictions,
    })

    if (!valid) {
      ctx.logger.error(
        'Response validation failed: ' +
          validationError +
          JSON.stringify({
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
          })
      )
      await releaseClaim()
      return { status: 400 }
    }

    let pointsAwarded: number | string = 0
    let xpAwarded: number = 0

    switch (type) {
      case 'SC':
      case 'MC':
      case 'KPRIM': {
        // if response choices are not defined, return early
        if (!response.choices) {
          ctx.logger.error(
            'Missing response choices ' +
              JSON.stringify({
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              })
          )
          await releaseClaim()
          return { status: 400 }
        }

        // add the vote to the aggregated results
        response.choices
          .filter((choice) => choice.selected)
          .forEach((choice) => {
            redisMulti.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
          })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            JSON.stringify(response.choices)
          )

          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = getChoicesQuestionPoints({
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
          pointsAwarded = computedPoints
          xpAwarded = computedXp

          if (
            pointsPercentage !== null &&
            pointsPercentage === 1 &&
            !firstResponseReceivedAt
          ) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisMulti.hsetnx(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role!,
            liveQuizKey,
            sessionBlockId: sessionBlockId!,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      // TODO: points based on distance to correct range?
      case 'NUMERICAL': {
        // if response value is not defined, return early
        if (typeof response.value === 'undefined' || response.value === null) {
          ctx.logger.error(
            'Missing response value ' +
              JSON.stringify({
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              })
          )
          await releaseClaim()
          return { status: 400 }
        }

        // add the response to the aggregated results
        const MD5 = createHash('md5')
        MD5.update(response.value)
        const responseHash = MD5.digest('hex')
        redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
        redisMulti.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          response.value
        )
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            String(response.value)
          )

          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = getNumericalQuestionPoints({
            response,
            instanceInfo,
            firstResponseReceivedAt,
            responseTimestamp,
            basePoints,
            pointsMultiplier,
            parsedSolutions,
          })
          pointsAwarded = computedPoints
          xpAwarded = computedXp

          if (parsedSolutions && pointsPercentage && !firstResponseReceivedAt) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisMulti.hsetnx(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role!,
            liveQuizKey,
            sessionBlockId: sessionBlockId!,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      // TODO: future -> distance in embedding space?
      case 'FREE_TEXT': {
        // if response value is not defined, return early
        if (typeof response.value !== 'string') {
          ctx.logger.error(
            'Missing response value ' +
              JSON.stringify({
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              })
          )
          await releaseClaim()
          return { status: 400 }
        }

        // add the response to the aggregated results
        const cleanResponseValue = response.value.trim()
        const MD5 = createHash('md5')
        MD5.update(cleanResponseValue)
        const responseHash = MD5.digest('hex')
        redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
        redisMulti.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          cleanResponseValue
        )
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            cleanResponseValue
          )

          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = getFreeTextQuestionPoints({
            response,
            instanceInfo,
            firstResponseReceivedAt,
            responseTimestamp,
            basePoints,
            pointsMultiplier,
            parsedSolutions,
          })
          pointsAwarded = computedPoints
          xpAwarded = computedXp

          if (pointsPercentage && !firstResponseReceivedAt) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisMulti.hsetnx(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role!,
            liveQuizKey,
            sessionBlockId: sessionBlockId!,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      case 'SELECTION': {
        // if response selection is not defined, return early
        if (!response.selection) {
          ctx.logger.error(
            'Missing response selection ' +
              JSON.stringify({
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              })
          )
          await releaseClaim()
          return { status: 400 }
        }

        // add the response to the aggregated results
        response.selection.forEach((answerId: number) => {
          // skipped input fields should not be considered
          if (
            answerId === -1 ||
            typeof answerId === 'undefined' ||
            answerId === null
          ) {
            return
          }

          redisMulti.hincrby(`${instanceKey}:results`, String(answerId), 1)
        })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            `[${String(response.selection.filter((r: number) => r !== -1 && typeof r !== 'undefined' && r !== null))}]` // filter out skipped response fields
          )

          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = getSelectionQuestionPoints({
            response,
            instanceInfo,
            firstResponseReceivedAt,
            responseTimestamp,
            basePoints,
            pointsMultiplier,
            parsedSolutions,
          })
          pointsAwarded = computedPoints
          xpAwarded = computedXp

          if (
            pointsPercentage !== null &&
            pointsPercentage === 1 &&
            !firstResponseReceivedAt
          ) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisMulti.hsetnx(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role!,
            liveQuizKey,
            sessionBlockId: sessionBlockId!,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      case 'CASE_STUDY': {
        // if response assessment is not defined, return early
        if (!response.assessment) {
          ctx.logger.error(
            'Missing response assessment ' +
              JSON.stringify({
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              })
          )
          await releaseClaim()
          return { status: 400 }
        }

        // add the response to the aggregated results
        Object.entries(response.assessment).forEach(([caseId, caseData]) => {
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
                redisMulti.hincrby(`${instanceKey}:results`, combinedHash, 1)
                redisMulti.hset(
                  `${instanceKey}:responseHashes`,
                  combinedHash,
                  String(criterionResponse)
                )
              }
            )
          })
        })

        // increment participant count
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            JSON.stringify(response.assessment)
          )

          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = getCaseStudyQuestionPoints({
            response,
            instanceInfo,
            firstResponseReceivedAt,
            responseTimestamp,
            basePoints,
            pointsMultiplier,
            parsedSolutions,
          })
          pointsAwarded = computedPoints
          xpAwarded = computedXp

          if (
            pointsPercentage !== null &&
            pointsPercentage === 1 &&
            !firstResponseReceivedAt
          ) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisMulti.hsetnx(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role!,
            liveQuizKey,
            sessionBlockId: sessionBlockId!,
            pointsAwarded,
            xpAwarded,
          })
        }

        break
      }
      case 'CONTENT': {
        // increase number of participants on element (do not award points / ... for content elements)
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)
        break
      }
    }

    if (
      isCorrelated &&
      correlatedOwner &&
      correlatedProcessedKey &&
      correlatedInstanceId !== undefined &&
      correlatedBlockExecution !== undefined &&
      type
    ) {
      const grading = getCorrelatedResponsePoints({
        type,
        choiceCount,
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        basePoints,
        defaultPoints,
        pointsMultiplier,
        parsedSolutions,
      })
      if (grading.correctnessPercentage === 1 && !firstResponseReceivedAt) {
        redisMulti.hsetnx(
          `${instanceKey}:info`,
          'firstResponseReceivedAt',
          responseTimestamp
        )
      }

      if (!responsePersisted) {
        try {
          await prisma.liveQuizResponse.create({
            data: buildCorrelatedResponseCreateData({
              owner: correlatedOwner,
              instanceId: correlatedInstanceId,
              blockExecution: correlatedBlockExecution,
              response,
              submittedAt: responseTimestamp,
              ...grading,
            }),
          })
          responsePersisted = true
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
          ) {
            redisMulti.discard()
            await releaseClaim()
            return { status: 208 }
          }
          throw error
        }
      }

      redisMulti.hset(
        correlatedProcessedKey,
        correlatedOwner.identityKey,
        message.messageId
      )
    }
  } catch (e) {
    ctx.logger.error(
      `Error processing response: ${String(e)} ` +
        JSON.stringify({
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        })
    )
    redisMulti.discard()
    if (responsePersisted) {
      throw new Error(
        `Response persisted but aggregation failed for message ${message.messageId}: ${String(e)}`
      )
    }

    await releaseClaim()
    return {
      status: e instanceof CorrelatedResponseIdentityError ? 400 : 500,
    }
  }

  try {
    await redisMulti.exec()
    ctx.logger.info("Successfully processed participant's response", {
      messageId: message.messageId,
      sessionId: message.sessionId,
      instanceId: message.instanceId,
    })
    return { status: 200 }
  } catch (e) {
    ctx.logger.error(
      `Redis transaction failed: ${String(e)} ` +
        JSON.stringify({
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        })
    )
    redisMulti.discard()
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}
