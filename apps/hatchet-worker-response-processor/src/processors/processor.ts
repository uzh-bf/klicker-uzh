// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

// TODO: add additional processor with assessment logic
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import type {
  FreeTextRestrictions,
  HatchetLoggingContext,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'
import { loggerForInput } from '../logger.js'
import { getRedis } from '../redis.js'
import {
  getCaseStudyQuestionPoints,
  getChoicesQuestionPoints,
  getFreeTextQuestionPoints,
  getNumericalQuestionPoints,
  getSelectionQuestionPoints,
  updateLeaderboards,
  validateStudentResponse,
} from './helpers.js'

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the element options

const redisExec = getRedis() // use standard redis instance for regular response processor

export type ResponseMessage = {
  messageId: string
  sessionId: string
  instanceId: string
  response: LiveQuizResponseInput
  cookie?: string
  responseTimestamp: number
  loggingContext?: HatchetLoggingContext
}

export async function processResponseMessage(
  message: ResponseMessage,
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  const log = loggerForInput(message)

  log.info(
    {
      event: 'response.processing.started',
      messageId: message.messageId,
      sessionId: message.sessionId,
      instanceId: message.instanceId,
    },
    'Processing response'
  )

  try {
    assert(!!redisExec)
  } catch {
    log.error(
      { event: 'dependency.unavailable', dependency: 'redis' },
      'Redis is unavailable'
    )
    throw new Error('Redis connection unavailable')
  }

  if (message.sessionId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  let redisMulti: ChainableCommander
  // redisMulti = redisExec.multi() -> transaction
  redisMulti = redisExec.pipeline() // -> pipeline (not atomic)

  try {
    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const responseTimestamp = message.responseTimestamp
    const response = message.response
    if (!response) {
      log.info(
        {
          event: 'response.rejected',
          reason: 'missing_response',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response rejected'
      )
      return { status: 400 }
    }

    let participantData: JWTPayload | null = null
    if (typeof message.cookie === 'string') {
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
          }
        } else if (parsedCookies['temporary_participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['temporary_participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'TEMPORARY_PARTICIPANT') {
            participantData = null
          }
        }
      } catch {
        log.info(
          {
            event: 'response.authentication.rejected',
            reason: 'invalid_token',
          },
          'Response authentication rejected'
        )
      }

      // if the participant has already responded to the question instance, return instantly
      if (
        participantData &&
        (await redisExec.hexists(
          `${instanceKey}:responses`,
          participantData.role === 'TEMPORARY_PARTICIPANT'
            ? `temporary-${participantData.sub}`
            : participantData.sub
        ))
      ) {
        log.info(
          {
            event: 'response.rejected',
            reason: 'already_processed',
            instanceId: message.instanceId,
          },
          'Response already processed'
        )
        return { status: 200 }
      }
    }

    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      log.info(
        {
          event: 'response.block_closed',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response block is no longer available'
      )
      return { status: 400 }
    }
    log.debug(
      {
        event: 'response.instance.loaded',
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Response instance loaded'
    )

    const {
      type,
      solutions,
      restrictions,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
      basePoints,
      pointsMultiplier,
      blockClosedAt,
    } = instanceInfo

    if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
      log.info(
        {
          event: 'response.block_closed',
          instanceId: message.instanceId,
        },
        'Response received after block closure'
      )
      ctx.cancel()
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

    const { valid } = validateStudentResponse({
      type: type as any,
      response,
      restrictions: parsedRestrictions,
    })

    if (!valid) {
      log.info(
        {
          event: 'response.rejected',
          reason: 'validation_failed',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response validation failed'
      )
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
          log.info(
            {
              event: 'response.rejected',
              reason: 'missing_choices',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Response rejected'
          )
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
            redisExec.hset(
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
          log.info(
            {
              event: 'response.rejected',
              reason: 'missing_value',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Response rejected'
          )
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
            redisExec.hset(
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
          log.info(
            {
              event: 'response.rejected',
              reason: 'missing_value',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Response rejected'
          )
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
            redisExec.hset(
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
          log.info(
            {
              event: 'response.rejected',
              reason: 'missing_selection',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Response rejected'
          )
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
            redisExec.hset(
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
          log.info(
            {
              event: 'response.rejected',
              reason: 'missing_assessment',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Response rejected'
          )
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
            redisExec.hset(
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
  } catch {
    log.error(
      {
        event: 'response.processing.failed',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Response processing failed'
    )
    redisMulti?.discard()
    throw new Error('Response processing failed')
  }

  try {
    await redisMulti.exec()
    log.info(
      {
        event: 'response.processed',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Response processed'
    )
    return { status: 200 }
  } catch {
    log.error(
      {
        event: 'dependency.unavailable',
        dependency: 'redis',
        operation: 'response_pipeline',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Redis response pipeline failed'
    )
    redisMulti?.discard()
    throw new Error('Redis response pipeline failed')
  }
}
