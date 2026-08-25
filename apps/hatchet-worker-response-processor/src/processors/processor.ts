// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

// TODO: add additional processor with assessment logic
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizLegacyResponseProcessedKey,
  getLiveQuizResponseCountKey,
  getLiveQuizResponseReplayClaimKey,
  type JWTPayload,
  LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
  LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS,
  verifyJWT,
} from '@klicker-uzh/util'
import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { getRedis } from '../redis.js'
import {
  createRedisCommandCollector,
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

export async function processResponseMessage(
  message: {
    messageId: string
    sessionId: string
    instanceId: string
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
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

  const replayClaimKey = getLiveQuizResponseReplayClaimKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
  })
  const legacyProcessedKey = getLiveQuizLegacyResponseProcessedKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
  })
  const processedResponseCountKey = getLiveQuizResponseCountKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    status: 'processed',
  })
  const transaction = createRedisCommandCollector()

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
        ctx.logger.info(
          'Participant has already responded to this question instance'
        )
        return { status: 200 }
      }
    }

    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      ctx.logger.info('Element instance metadata not found', {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      })
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
      blockClosedAt,
    } = instanceInfo

    if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
      ctx.logger.error(
        `[CANCEL] [AddResponse Assessment] Response received at ${new Date(Number(responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(blockClosedAt))}.`
      )
      ctx.cancel()
      return { status: 200 }
    }

    let parsedSolutions: unknown
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
      return { status: 400 }
    }

    let pointsAwarded: number | string = 0
    let xpAwarded: number = 0

    // Collect commands locally; the processing script claims the marker and
    // applies this batch atomically after response validation completes.
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
          return { status: 400 }
        }

        // add the vote to the aggregated results
        response.choices
          .filter((choice) => choice.selected)
          .forEach((choice) => {
            transaction.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
          })
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          transaction.hset(
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
            transaction.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisCommands: transaction,
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
          return { status: 400 }
        }

        // add the response to the aggregated results
        const MD5 = createHash('md5')
        MD5.update(response.value)
        const responseHash = MD5.digest('hex')
        transaction.hincrby(`${instanceKey}:results`, responseHash, 1)
        transaction.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          response.value
        )
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          transaction.hset(
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
            transaction.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisCommands: transaction,
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
          return { status: 400 }
        }

        // add the response to the aggregated results
        const cleanResponseValue = response.value.trim()
        const MD5 = createHash('md5')
        MD5.update(cleanResponseValue)
        const responseHash = MD5.digest('hex')
        transaction.hincrby(`${instanceKey}:results`, responseHash, 1)
        transaction.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          cleanResponseValue
        )
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          transaction.hset(
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
            transaction.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisCommands: transaction,
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

          transaction.hincrby(`${instanceKey}:results`, String(answerId), 1)
        })
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          transaction.hset(
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
            transaction.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisCommands: transaction,
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
                transaction.hincrby(`${instanceKey}:results`, combinedHash, 1)
                transaction.hset(
                  `${instanceKey}:responseHashes`,
                  combinedHash,
                  String(criterionResponse)
                )
              }
            )
          })
        })

        // increment participant count
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          transaction.hset(
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
            transaction.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisCommands: transaction,
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
        transaction.hincrby(`${instanceKey}:results`, 'participants', 1)
        break
      }
    }
  } catch (e) {
    ctx.logger.error('Error processing response', {
      error: e instanceof Error ? e : new Error(String(e)),
      extra: {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
    })
    return { status: 500 }
  }

  try {
    const processingResult = JSON.parse(
      String(
        await redisExec.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          4,
          replayClaimKey,
          processedResponseCountKey,
          getLiveQuizInstanceInfoKey({
            liveQuizId: message.sessionId,
            instanceId: message.instanceId,
          }),
          legacyProcessedKey,
          message.messageId,
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          JSON.stringify(transaction.commands)
        )
      )
    ) as {
      status:
        | 'already_processed'
        | 'processed'
        | 'aggregation_failed'
        | 'reconciliation_required'
      counted?: boolean
      commandErrors?: string[]
      trackingErrors?: string[]
    }

    if (processingResult.status === 'already_processed') {
      ctx.logger.info('Response already processed, skipping', {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      })
      return { status: 200 }
    }
    if (processingResult.status === 'reconciliation_required') {
      ctx.logger.error(
        'Redis response aggregation requires reconciliation; replay claim retained',
        {
          extra: {
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
            commandErrors: processingResult.commandErrors ?? [],
          },
        }
      )
      return { status: 200 }
    }
    if (
      processingResult.status !== 'processed' &&
      processingResult.status !== 'aggregation_failed'
    ) {
      throw new Error('Redis response processing returned an invalid status')
    }

    if (
      processingResult.status === 'aggregation_failed' ||
      processingResult.commandErrors?.length
    ) {
      const commandErrors = processingResult.commandErrors ?? []
      ctx.logger.error(
        'Redis results aggregation commands failed; retrying response processing',
        {
          extra: {
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
            commandErrors,
          },
        }
      )
      throw new Error(
        `Redis response aggregation failed: ${commandErrors.join('; ') || 'unknown command error'}`
      )
    }

    if (processingResult.trackingErrors?.length) {
      ctx.logger.error('Failed to track processed response', {
        extra: {
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
          trackingErrors: processingResult.trackingErrors,
        },
      })
    }

    if (
      processingResult.status === 'processed' &&
      !processingResult.commandErrors?.length
    ) {
      ctx.logger.info("Successfully processed participant's response", {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      })
    }
    return { status: 200 }
  } catch (e) {
    ctx.logger.error('Redis transaction failed', {
      error: e instanceof Error ? e : new Error(String(e)),
      extra: {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
    })
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}
