// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

import { createHash } from 'node:crypto'
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
import { type JWTPayload, verifyJWT } from '@klicker-uzh/util'
import { strict as assert } from 'assert'
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
import {
  ATOMIC_RESPONSE_SCRIPT,
  buildResponseScriptInvocation,
  createRedisOperationCollector,
  getAnonymousResponseField,
  getParticipantResponseField,
  getRedeliveryResponseField,
  isValidSubmissionId,
  type RedisHashOperation,
} from './responseScript.js'

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the element options

const redisExec = getRedis() // use standard redis instance for regular response processor

type TaskContext = Pick<Context<JsonObject, object>, 'logger'>

async function taskInfo(
  ctx: TaskContext,
  fields: Record<string, unknown>,
  message: string
) {
  await ctx.logger.info(message, fields)
}

async function taskDebug(
  ctx: TaskContext,
  fields: Record<string, unknown>,
  message: string
) {
  await ctx.logger.debug(message, fields)
}

async function taskWarn(
  ctx: TaskContext,
  fields: Record<string, unknown>,
  message: string
) {
  await ctx.logger.warn(message, { extra: fields })
}

async function taskError(
  ctx: TaskContext,
  fields: Record<string, unknown>,
  message: string
) {
  await ctx.logger.error(message, { extra: fields })
}

// cache the atomic response script server-side (EVALSHA with automatic
// EVAL fallback on NOSCRIPT) instead of transmitting the body per response
redisExec.defineCommand('addAtomicResponse', {
  lua: ATOMIC_RESPONSE_SCRIPT,
})
function addAtomicResponse(
  numKeys: number,
  ...args: unknown[]
): Promise<unknown> {
  return (redisExec as unknown as AtomicResponseCommand).addAtomicResponse(
    numKeys,
    ...args
  )
}

type AtomicResponseCommand = {
  addAtomicResponse(numKeys: number, ...args: unknown[]): Promise<unknown>
}

export async function processResponseMessage(
  message: {
    messageId: string
    sessionId: string
    instanceId: string
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
    submissionId?: string
    loggingContext?: HatchetLoggingContext
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  await taskInfo(
    ctx,
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
  } catch (e) {
    await taskError(
      ctx,
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

  const redisOperations: RedisHashOperation[] = []
  let participantResponseKey: string | undefined
  let participantResponseField: string | undefined
  // populated for authenticated responses; used after the atomic write to
  // correct the timing bonus when this response lost the first-response race
  let correctionContext:
    | {
        participantData: JWTPayload
        liveQuizKey: string
        instanceKey: string
        sessionBlockId: string
        firstResponseReceivedAt?: string
        responseTimestamp: number
      }
    | undefined
  let recomputePointsWithBaseline:
    | ((baseline: string) => number | string)
    | undefined
  let pointsAwarded: number | string = 0
  let xpAwarded: number = 0
  const redisMulti = createRedisOperationCollector(redisOperations)

  try {
    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const responseTimestamp = message.responseTimestamp
    const response = message.response
    if (!response) {
      await taskInfo(
        ctx,
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

    // a supplied submission id must be a valid bounded identifier; invalid
    // ones are rejected terminally instead of being silently ignored
    if (
      message.submissionId !== undefined &&
      !isValidSubmissionId(message.submissionId)
    ) {
      await taskInfo(
        ctx,
        {
          event: 'response.rejected',
          reason: 'invalid_submission_id',
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
          } else {
            await taskDebug(
              ctx,
              { event: 'response.authentication.verified' },
              'Participant JWT verified'
            )
          }
        } else if (parsedCookies['temporary_participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['temporary_participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'TEMPORARY_PARTICIPANT') {
            participantData = null
          } else {
            await taskDebug(
              ctx,
              { event: 'response.authentication.verified' },
              'Temporary participant JWT verified'
            )
          }
        }
      } catch {
        await taskInfo(
          ctx,
          {
            event: 'response.authentication.rejected',
            reason: 'invalid_token',
          },
          'Response authentication rejected'
        )
      }
    }

    participantResponseKey = `${instanceKey}:responses`
    // every response now carries a dedupe identity: the authenticated
    // participant, the client submission id, or — for legacy anonymous
    // events without a valid submission id — the event's message id, which
    // survives Hatchet redelivery and therefore protects against repeated
    // application of one queued submission
    if (participantData) {
      participantResponseField = getParticipantResponseField(participantData)
    } else if (message.submissionId) {
      participantResponseField = getAnonymousResponseField(message.submissionId)
    } else {
      participantResponseField = getRedeliveryResponseField(message.messageId)
    }

    if (
      await redisExec.hexists(participantResponseKey, participantResponseField)
    ) {
      await taskInfo(
        ctx,
        {
          event: 'response.rejected',
          reason: 'already_processed',
          instanceId: message.instanceId,
        },
        'Response already processed'
      )
      return { status: 200 }
    }

    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, the response either raced
    // the block activation cache initialization or arrived after the
    // instance was closed and purged; either way it must not be silently
    // discarded — fail the task so the retry path and failure visibility
    // apply
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      await taskError(
        ctx,
        {
          event: 'response.block_unavailable',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response arrived before cache initialization or after purge'
      )
      throw new Error('Element instance metadata unavailable')
    }
    await taskDebug(
      ctx,
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
      await taskInfo(
        ctx,
        {
          event: 'response.after_block_close',
          instanceId: message.instanceId,
        },
        'Response received after block closure'
      )
      ctx.cancel()
      return { status: 200 }
    }

    let parsedSolutions: any
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch {
      throw new Error('Error parsing stored solutions for question instance')
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
    } catch {
      throw new Error('Error parsing stored restrictions for question instance')
    }

    if (participantData) {
      correctionContext = {
        participantData,
        liveQuizKey,
        instanceKey,
        sessionBlockId: sessionBlockId!,
        firstResponseReceivedAt,
        responseTimestamp,
      }
    }

    const { valid, message: validationError } = validateStudentResponse({
      type: type as any,
      response,
      restrictions: parsedRestrictions,
      choiceCount,
    })

    if (!valid) {
      await taskInfo(
        ctx,
        {
          event: 'response.rejected',
          reason: 'validation_failed',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response rejected'
      )
      return { status: 400 }
    }

    if (!participantData) {
      redisMulti.hset(
        participantResponseKey,
        participantResponseField,
        message.messageId
      )
    }

    switch (type) {
      case 'SC':
      case 'MC':
      case 'KPRIM': {
        // if response choices are not defined, return early
        if (!response.choices) {
          await taskInfo(
            ctx,
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
            participantResponseKey,
            participantResponseField,
            JSON.stringify(response.choices)
          )

          const computePoints = (baseline: string | undefined) =>
            getChoicesQuestionPoints({
              type,
              choiceCount,
              response,
              instanceInfo,
              firstResponseReceivedAt: baseline,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            })
          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = computePoints(firstResponseReceivedAt)
          pointsAwarded = computedPoints
          xpAwarded = computedXp
          recomputePointsWithBaseline = (baseline) =>
            computePoints(baseline).pointsAwarded

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
          await taskInfo(
            ctx,
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
            participantResponseKey,
            participantResponseField,
            String(response.value)
          )

          const computePoints = (baseline: string | undefined) =>
            getNumericalQuestionPoints({
              response,
              instanceInfo,
              firstResponseReceivedAt: baseline,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            })
          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = computePoints(firstResponseReceivedAt)
          pointsAwarded = computedPoints
          xpAwarded = computedXp
          recomputePointsWithBaseline = (baseline) =>
            computePoints(baseline).pointsAwarded

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
          await taskInfo(
            ctx,
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
            participantResponseKey,
            participantResponseField,
            cleanResponseValue
          )

          const computePoints = (baseline: string | undefined) =>
            getFreeTextQuestionPoints({
              response,
              instanceInfo,
              firstResponseReceivedAt: baseline,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            })
          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = computePoints(firstResponseReceivedAt)
          pointsAwarded = computedPoints
          xpAwarded = computedXp
          recomputePointsWithBaseline = (baseline) =>
            computePoints(baseline).pointsAwarded

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
          await taskInfo(
            ctx,
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
            participantResponseKey,
            participantResponseField,
            `[${String(response.selection.filter((r: number) => r !== -1 && typeof r !== 'undefined' && r !== null))}]` // filter out skipped response fields
          )

          const computePoints = (baseline: string | undefined) =>
            getSelectionQuestionPoints({
              response,
              instanceInfo,
              firstResponseReceivedAt: baseline,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            })
          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = computePoints(firstResponseReceivedAt)
          pointsAwarded = computedPoints
          xpAwarded = computedXp
          recomputePointsWithBaseline = (baseline) =>
            computePoints(baseline).pointsAwarded

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
          await taskInfo(
            ctx,
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
            participantResponseKey,
            participantResponseField,
            JSON.stringify(response.assessment)
          )

          const computePoints = (baseline: string | undefined) =>
            getCaseStudyQuestionPoints({
              response,
              instanceInfo,
              firstResponseReceivedAt: baseline,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            })
          const {
            pointsAwarded: computedPoints,
            xpAwarded: computedXp,
            pointsPercentage,
          } = computePoints(firstResponseReceivedAt)
          pointsAwarded = computedPoints
          xpAwarded = computedXp
          recomputePointsWithBaseline = (baseline) =>
            computePoints(baseline).pointsAwarded

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
        if (participantData) {
          redisMulti.hset(
            participantResponseKey,
            participantResponseField,
            JSON.stringify(response)
          )
        }
        break
      }
    }
  } catch (e) {
    await taskError(
      ctx,
      {
        event: 'response.processing.failed',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Error processing response'
    )
    redisMulti.discard()
    throw new Error('Error processing response')
  }

  try {
    const { keys, args } = buildResponseScriptInvocation({
      operations: redisOperations,
      participantResponseKey: participantResponseKey!,
      participantResponseField: participantResponseField!,
    })

    const execResult = Number(
      await addAtomicResponse(keys.length, ...keys, ...args)
    )

    // only the documented script return codes are acceptable; anything else
    // is an unexpected state that must surface as a task failure
    if (execResult === -1) {
      await taskError(
        ctx,
        {
          event: 'response.redis_state.invalid_counter',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Invalid existing Redis counter value'
      )
      throw new Error('Invalid existing Redis counter value')
    }
    if (execResult === -2) {
      await taskError(
        ctx,
        {
          event: 'response.redis_state.wrong_type',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Wrong Redis key type for a response aggregation target'
      )
      throw new Error('Wrong Redis key type for a response aggregation target')
    }
    if (execResult === 0) {
      await taskInfo(
        ctx,
        {
          event: 'response.rejected',
          reason: 'already_processed',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Response already processed'
      )
      return { status: 200 }
    }
    if (execResult !== 1) {
      await taskError(
        ctx,
        {
          event: 'response.redis_state.unexpected_result',
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        },
        'Unexpected atomic response script result'
      )
      throw new Error('Unexpected atomic response script result')
    }

    // the timing-dependent bonus was computed against the first-response
    // snapshot taken before the atomic write; if another correct response
    // committed the baseline first, credit back the difference so the
    // loser of the race does not keep a full speed bonus
    if (
      correctionContext &&
      !correctionContext.firstResponseReceivedAt &&
      recomputePointsWithBaseline
    ) {
      const committedBaseline = await redisExec.hget(
        `${correctionContext.instanceKey}:info`,
        'firstResponseReceivedAt'
      )
      if (
        committedBaseline !== null &&
        committedBaseline !== String(correctionContext.responseTimestamp)
      ) {
        const correctedPoints = recomputePointsWithBaseline(committedBaseline)
        const overCredit = Number(pointsAwarded) - Number(correctedPoints)
        if (overCredit > 0) {
          await taskWarn(
            ctx,
            {
              event: 'leaderboard.timing_correction.attempted',
              messageId: message.messageId,
              sessionId: message.sessionId,
              instanceId: message.instanceId,
            },
            'Attempting timing-bonus correction after lost first-response race'
          )
          const correctionPipeline = redisExec.pipeline()
          updateLeaderboards({
            redisMulti: correctionPipeline,
            participantId: correctionContext.participantData.sub,
            participantRole: correctionContext.participantData.role!,
            liveQuizKey: correctionContext.liveQuizKey,
            sessionBlockId: correctionContext.sessionBlockId,
            pointsAwarded: -overCredit,
            xpAwarded: 0,
          })
          const correctionResults = await correctionPipeline.exec()
          const correctionErrors = (
            Array.isArray(correctionResults) ? correctionResults : []
          )
            .map(([error]) => error)
            .filter((error) => error !== null)
          if (
            !Array.isArray(correctionResults) ||
            correctionErrors.length > 0
          ) {
            // the response itself is committed and must not be retried; the
            // residual bonus over-credit is an accepted, logged inconsistency
            await taskError(
              ctx,
              {
                event: 'leaderboard.timing_correction.failed',
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              },
              'Timing-bonus correction failed to apply fully'
            )
          } else {
            await taskInfo(
              ctx,
              {
                event: 'leaderboard.timing_correction.applied',
                messageId: message.messageId,
                sessionId: message.sessionId,
                instanceId: message.instanceId,
              },
              'Timing-bonus correction applied'
            )
          }
        }
      }
    }

    await taskInfo(
      ctx,
      {
        event: 'response.processed',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Response processed'
    )
    return { status: 200 }
  } catch (e) {
    await taskError(
      ctx,
      {
        event: 'response.redis_transaction.failed',
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      },
      'Redis transaction failed'
    )
    redisMulti.discard()
    throw new Error('Redis transaction failed')
  }
}
