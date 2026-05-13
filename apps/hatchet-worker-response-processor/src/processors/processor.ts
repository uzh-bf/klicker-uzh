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
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'
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

const ADD_AUTHENTICATED_RESPONSE_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
  return 0
end

local index = 3
local incrementCount = tonumber(ARGV[index])
index = index + 1
for _ = 1, incrementCount do
  local keyIndex = tonumber(ARGV[index])
  local currentValue = redis.call('HGET', KEYS[keyIndex], ARGV[index + 1])
  if currentValue and not string.match(currentValue, '^-?%d+$') then
    return -1
  end
  if not string.match(ARGV[index + 2], '^-?%d+$') then
    return -1
  end
  index = index + 3
end

redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])

-- Replay the increment operations after validation. Base ARGV slots 1-3 are
-- participantResponseField, markerValue, and incrementCount, so increments
-- start at slot 4.
index = 4
for _ = 1, incrementCount do
  local keyIndex = tonumber(ARGV[index])
  redis.call('HINCRBY', KEYS[keyIndex], ARGV[index + 1], tonumber(ARGV[index + 2]))
  index = index + 3
end

local hsetCount = tonumber(ARGV[index])
index = index + 1
for _ = 1, hsetCount do
  local keyIndex = tonumber(ARGV[index])
  local mode = ARGV[index + 3]
  if mode == 'setnx' then
    redis.call('HSETNX', KEYS[keyIndex], ARGV[index + 1], ARGV[index + 2])
  else
    redis.call('HSET', KEYS[keyIndex], ARGV[index + 1], ARGV[index + 2])
  end
  index = index + 4
end

return 1
`

type RedisHashOperation =
  | {
      type: 'hincrby'
      key: string
      field: string
      increment: number
    }
  | {
      type: 'hset'
      key: string
      field: string
      value: string
      mode: 'set' | 'setnx'
    }

function getParticipantResponseField(participantData: JWTPayload) {
  return participantData.role === 'TEMPORARY_PARTICIPANT'
    ? `temporary-${participantData.sub}`
    : participantData.sub
}

type RedisOperationCollector = {
  hincrby(
    key: string,
    field: string,
    increment: number
  ): RedisOperationCollector
  hset(key: string, field: string, value: unknown): RedisOperationCollector
  hsetnx(key: string, field: string, value: unknown): RedisOperationCollector
  discard(): RedisOperationCollector
}

type RedisResponseOperations = ChainableCommander | RedisOperationCollector

function createRedisOperationCollector(
  operations: RedisHashOperation[]
): RedisOperationCollector {
  const collector = {
    hincrby(key: string, field: string, increment: number) {
      operations.push({ type: 'hincrby', key, field, increment })
      return collector
    },
    hset(key: string, field: string, value: unknown) {
      operations.push({
        type: 'hset',
        key,
        field,
        value: String(value),
        mode: 'set',
      })
      return collector
    },
    hsetnx(key: string, field: string, value: unknown) {
      operations.push({
        type: 'hset',
        key,
        field,
        value: String(value),
        mode: 'setnx',
      })
      return collector
    },
    discard() {
      operations.length = 0
      return collector
    },
  }

  return collector
}

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

  let redisMulti!: RedisResponseOperations
  const redisOperations: RedisHashOperation[] = []
  let participantResponseKey: string | undefined
  let participantResponseField: string | undefined

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
    }

    participantResponseKey = `${instanceKey}:responses`
    participantResponseField = participantData
      ? getParticipantResponseField(participantData)
      : undefined

    if (
      participantResponseField &&
      (await redisExec.hexists(
        participantResponseKey,
        participantResponseField
      ))
    ) {
      ctx.logger.info(
        'Participant has already responded to this question instance'
      )
      return { status: 200 }
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
      return { status: 400 }
    }

    let pointsAwarded: number | string = 0
    let xpAwarded: number = 0
    if (participantResponseField) {
      redisMulti = createRedisOperationCollector(redisOperations)
    } else {
      redisMulti = redisExec.pipeline()
    }

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
            redisMulti.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
          })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          // add the participant's response to the corresponding redis hash
          redisMulti.hset(
            participantResponseKey,
            participantResponseField!,
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
            participantResponseField!,
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
            participantResponseField!,
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
            participantResponseField!,
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
            participantResponseField!,
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
        if (participantData) {
          redisMulti.hset(
            participantResponseKey,
            participantResponseField!,
            JSON.stringify(response)
          )
        }
        break
      }
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
    redisMulti?.discard()
    return { status: 500 }
  }

  try {
    let execResult: unknown

    if (participantResponseKey && participantResponseField) {
      const markerOperation = redisOperations.find(
        (operation) =>
          operation.type === 'hset' &&
          operation.key === participantResponseKey &&
          operation.field === participantResponseField
      )

      if (!markerOperation || markerOperation.type !== 'hset') {
        throw new Error('Missing authenticated participant response marker')
      }

      const incrementOperations = redisOperations.filter(
        (
          operation
        ): operation is Extract<RedisHashOperation, { type: 'hincrby' }> =>
          operation.type === 'hincrby'
      )
      const invalidIncrementOperation = incrementOperations.find(
        (operation) => !Number.isInteger(Number(operation.increment))
      )
      if (invalidIncrementOperation) {
        throw new Error(
          `Invalid Redis integer increment ${invalidIncrementOperation.increment} for ${invalidIncrementOperation.key}:${invalidIncrementOperation.field}`
        )
      }

      const hsetOperations = redisOperations.filter(
        (
          operation
        ): operation is Extract<RedisHashOperation, { type: 'hset' }> =>
          operation.type === 'hset' &&
          (operation.key !== participantResponseKey ||
            operation.field !== participantResponseField)
      )
      const scriptKeys = [
        participantResponseKey,
        ...new Set(
          [...incrementOperations, ...hsetOperations]
            .map((operation) => operation.key)
            .filter((key) => key !== participantResponseKey)
        ),
      ]
      const keyIndexByKey = new Map(
        scriptKeys.map((key, index) => [key, index + 1])
      )

      execResult = await redisExec.eval(
        ADD_AUTHENTICATED_RESPONSE_SCRIPT,
        scriptKeys.length,
        ...scriptKeys,
        participantResponseField,
        markerOperation.value,
        String(incrementOperations.length),
        ...incrementOperations.flatMap((operation) => [
          String(keyIndexByKey.get(operation.key)!),
          operation.field,
          String(operation.increment),
        ]),
        String(hsetOperations.length),
        ...hsetOperations.flatMap((operation) => [
          String(keyIndexByKey.get(operation.key)!),
          operation.field,
          operation.value,
          operation.mode,
        ])
      )

      if (Number(execResult) === -1) {
        throw new Error('Invalid existing Redis counter value')
      }

      if (Number(execResult) === 0) {
        ctx.logger.info(
          'Participant has already responded to this question instance',
          {
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
          }
        )
        return { status: 200 }
      }
    } else {
      if (!('exec' in redisMulti)) {
        throw new Error('Missing Redis pipeline executor')
      }
      await redisMulti.exec()
    }
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
    redisMulti?.discard()
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}
