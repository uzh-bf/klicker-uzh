// @ts-nocheck

// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

// TODO: add additional processor with assessment logic
import type {
  Context,
  DurableContext,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  computeAwardedPoints,
  computeAwardedXp,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import type { ResponseInput } from '@klicker-uzh/types'
import { verifyJWT } from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'
import {
  DEFAULT_CORRECT_POINTS,
  DEFAULT_POINTS,
  MAX_BONUS_POINTS,
  TIME_TO_ZERO_BONUS,
} from './constants.js'
import getRedis from './redis.js'

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the element options

export type Message = {
  messageId: string
  sessionId: string
  instanceId: string
  response: ResponseInput
  cookie?: string
  responseTimestamp: number
}

const redisExec = getRedis()

function updateLeaderboards({
  redisMulti,
  participantId,
  participantRole,
  sessionKey,
  sessionBlockId,
  pointsAwarded,
  xpAwarded,
}: {
  redisMulti: ChainableCommander
  participantId: string
  participantRole: string
  sessionKey: string
  sessionBlockId: string
  pointsAwarded: number
  xpAwarded: number
}) {
  // depending on the participant account type (permanent student account or
  // temporary pseudonym), set the correct points / experience points
  if (participantRole === 'PARTICIPANT') {
    redisMulti.hincrby(
      `${sessionKey}:b:${sessionBlockId}:lb`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(`${sessionKey}:lb`, participantId, pointsAwarded)
    redisMulti.hincrby(`${sessionKey}:xp`, participantId, xpAwarded)
  } else if (participantRole === 'TEMPORARY_PARTICIPANT') {
    // temporary participants are only granted points, xp cannot be collected
    redisMulti.hincrby(
      `${sessionKey}:b:${sessionBlockId}:lbTemporary`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(
      `${sessionKey}:lbTemporary`,
      participantId,
      pointsAwarded
    )
  }
}

export async function processResponseMessage(
  message: Message,
  ctx: Context | DurableContext
) {
  ctx.logger.info('ProcessResponse function processing a message', message)

  try {
    assert(!!redisExec)
  } catch (e) {
    ctx.logger.error('Redis connection error', e)
    throw new Error(`Redis connection error ${String(e)}`)
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
    const sessionKey = `lq:${message.sessionId}`
    const instanceKey = `${sessionKey}:i:${message.instanceId}`
    const responseTimestamp = message.responseTimestamp
    const response = message.response
    if (!response) {
      ctx.logger.error('Missing response', message)
      return { status: 400 }
    }

    let participantData: { sub: string; role: string } | null = null
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
            ctx.logger.info("Participant's JWT verified", participantData)
          }
        } else if (parsedCookies['temporary_participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['temporary_participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'TEMPORARY_PARTICIPANT') {
            participantData = null
          } else {
            ctx.logger.info(
              "Temporary Participant's JWT verified",
              participantData
            )
          }
        }
      } catch (e) {
        ctx.logger.error('JWT verification failed', e, message.cookie)
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
    if (!instanceInfo) {
      ctx.logger.info('Question instance metadata not found', message)
      return { status: 400 }
    }
    ctx.logger.info('Instance info', instanceInfo)

    const {
      type,
      solutions,
      startedAt,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
      basePoints,
      pointsMultiplier,
    } = instanceInfo
    let parsedSolutions = undefined
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch (e) {
      ctx.logger.info('Error parsing solutions', e, message)
    }

    let pointsAwarded: number | string = 0
    let xpAwarded: number = 0

    switch (type) {
      case 'SC':
      case 'MC':
      case 'KPRIM': {
        // add the vote to the aggregated results
        response.choices
          .filter((choice) => choice.selected)
          .forEach((choice) => {
            redisMulti.hincrby(`${instanceKey}:results`, String(choice.ix), 1)
          })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          let pointsPercentage: number | null
          if (type === 'SC') {
            pointsPercentage = gradeQuestionSC({
              responseCount: Number(choiceCount),
              response: response.choices,
              solution: parsedSolutions,
            })
          } else if (type === 'MC') {
            pointsPercentage = gradeQuestionMC({
              responseCount: Number(choiceCount),
              response: response.choices,
              solution: parsedSolutions,
            })
          } else {
            pointsPercentage = gradeQuestionKPRIM({
              responseCount: Number(choiceCount),
              response: response.choices,
              solution: parsedSolutions,
            })
          }
          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            maxBonus: isNaN(parseInt(instanceInfo.maxBonusPoints, 10))
              ? MAX_BONUS_POINTS
              : parseInt(instanceInfo.maxBonusPoints, 10),
            timeToZeroBonus: isNaN(parseInt(instanceInfo.timeToZeroBonus, 10))
              ? TIME_TO_ZERO_BONUS
              : parseInt(instanceInfo.timeToZeroBonus, 10),
            defaultPoints: isNaN(parseInt(instanceInfo.defaultPoints, 10))
              ? DEFAULT_POINTS
              : parseInt(instanceInfo.defaultPoints, 10),
            defaultCorrectPoints: isNaN(
              parseInt(instanceInfo.defaultCorrectPoints, 10)
            )
              ? DEFAULT_CORRECT_POINTS
              : parseInt(instanceInfo.defaultCorrectPoints, 10),
            pointsPercentage,
            basePoints: basePoints === 'false' ? false : true,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage,
          })

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

          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            `[${String(response.choices)}]`
          )

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role,
            sessionKey,
            sessionBlockId,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      // TODO: points based on distance to correct range?
      case 'NUMERICAL': {
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
          const exactSolutionsDefined =
            typeof parsedSolutions !== 'undefined' &&
            parsedSolutions.length > 0 &&
            (typeof parsedSolutions[0] === 'number' ||
              typeof parsedSolutions[0] === 'string')

          const answerCorrect = gradeQuestionNumerical({
            response: Number(response.value),
            solutionRanges: exactSolutionsDefined ? undefined : parsedSolutions,
            exactSolutions: exactSolutionsDefined ? parsedSolutions : undefined,
          })

          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            getsMaxPoints: parsedSolutions && answerCorrect === 1,
            maxBonus: isNaN(parseInt(instanceInfo.maxBonusPoints, 10))
              ? MAX_BONUS_POINTS
              : parseInt(instanceInfo.maxBonusPoints, 10),
            timeToZeroBonus: isNaN(parseInt(instanceInfo.timeToZeroBonus, 10))
              ? TIME_TO_ZERO_BONUS
              : parseInt(instanceInfo.timeToZeroBonus, 10),
            defaultPoints: isNaN(parseInt(instanceInfo.defaultPoints, 10))
              ? DEFAULT_POINTS
              : parseInt(instanceInfo.defaultPoints, 10),
            defaultCorrectPoints: isNaN(
              parseInt(instanceInfo.defaultCorrectPoints, 10)
            )
              ? DEFAULT_CORRECT_POINTS
              : parseInt(instanceInfo.defaultCorrectPoints, 10),
            basePoints: basePoints === 'false' ? false : true,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage: answerCorrect ?? 0,
          })

          if (parsedSolutions && answerCorrect && !firstResponseReceivedAt) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisExec.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            String(response.value)
          )

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role,
            sessionKey,
            sessionBlockId,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      // TODO: future -> distance in embedding space?
      case 'FREE_TEXT': {
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
          const answerCorrect = gradeQuestionFreeText({
            response: cleanResponseValue,
            solutions: parsedSolutions,
          })

          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            getsMaxPoints: Boolean(answerCorrect),
            maxBonus: isNaN(parseInt(instanceInfo.maxBonusPoints, 10))
              ? MAX_BONUS_POINTS
              : parseInt(instanceInfo.maxBonusPoints, 10),
            timeToZeroBonus: isNaN(parseInt(instanceInfo.timeToZeroBonus, 10))
              ? TIME_TO_ZERO_BONUS
              : parseInt(instanceInfo.timeToZeroBonus, 10),
            defaultPoints: isNaN(parseInt(instanceInfo.defaultPoints, 10))
              ? DEFAULT_POINTS
              : parseInt(instanceInfo.defaultPoints, 10),
            defaultCorrectPoints: isNaN(
              parseInt(instanceInfo.defaultCorrectPoints, 10)
            )
              ? DEFAULT_CORRECT_POINTS
              : parseInt(instanceInfo.defaultCorrectPoints, 10),
            basePoints: basePoints === 'false' ? false : true,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage: answerCorrect ?? 0,
          })

          if (answerCorrect && !firstResponseReceivedAt) {
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            redisExec.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }

          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            cleanResponseValue
          )

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role,
            sessionKey,
            sessionBlockId,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      case 'SELECTION': {
        // add the response to the aggregated results
        response.selection.forEach((answerId: number) => {
          // skipped input fields should not be considered
          if (answerId === -1) {
            return
          }

          redisMulti.hincrby(`${instanceKey}:results`, String(answerId), 1)
        })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        // if the participant was logged in, award points (and xp if regular student acount was used)
        if (participantData) {
          const pointsPercentage = gradeQuestionSelection({
            numberOfInputs: parseInt(instanceInfo.numberOfInputs),
            response: response.selection.filter((r: number) => r !== -1), // filter out skipped response fields
            correctAnswers: parsedSolutions,
          })

          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            maxBonus: isNaN(parseInt(instanceInfo.maxBonusPoints, 10))
              ? MAX_BONUS_POINTS
              : parseInt(instanceInfo.maxBonusPoints, 10),
            timeToZeroBonus: isNaN(parseInt(instanceInfo.timeToZeroBonus, 10))
              ? TIME_TO_ZERO_BONUS
              : parseInt(instanceInfo.timeToZeroBonus, 10),
            defaultPoints: isNaN(parseInt(instanceInfo.defaultPoints, 10))
              ? DEFAULT_POINTS
              : parseInt(instanceInfo.defaultPoints, 10),
            defaultCorrectPoints: isNaN(
              parseInt(instanceInfo.defaultCorrectPoints, 10)
            )
              ? DEFAULT_CORRECT_POINTS
              : parseInt(instanceInfo.defaultCorrectPoints, 10),
            pointsPercentage,
            basePoints: basePoints === 'false' ? false : true,
            pointsMultiplier,
          })

          xpAwarded = computeAwardedXp({
            pointsPercentage,
          })

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

          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            `[${String(response.selection.filter((r: number) => r !== -1))}]` // filter out skipped response fields
          )

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role,
            sessionKey,
            sessionBlockId,
            pointsAwarded,
            xpAwarded,
          })
        }
        break
      }
      case 'CASE_STUDY': {
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
          const pointsPercentage = gradeQuestionCaseStudy({
            response: response.assessment,
            solutions: parsedSolutions,
          })

          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            maxBonus: isNaN(parseInt(instanceInfo.maxBonusPoints, 10))
              ? MAX_BONUS_POINTS
              : parseInt(instanceInfo.maxBonusPoints, 10),
            timeToZeroBonus: isNaN(parseInt(instanceInfo.timeToZeroBonus, 10))
              ? TIME_TO_ZERO_BONUS
              : parseInt(instanceInfo.timeToZeroBonus, 10),
            defaultPoints: isNaN(parseInt(instanceInfo.defaultPoints, 10))
              ? DEFAULT_POINTS
              : parseInt(instanceInfo.defaultPoints, 10),
            defaultCorrectPoints: isNaN(
              parseInt(instanceInfo.defaultCorrectPoints, 10)
            )
              ? DEFAULT_CORRECT_POINTS
              : parseInt(instanceInfo.defaultCorrectPoints, 10),
            pointsPercentage,
            basePoints: basePoints === 'false' ? false : true,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage,
          })

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
          redisMulti.hset(
            `${instanceKey}:responses`,
            participantData.role === 'TEMPORARY_PARTICIPANT'
              ? `temporary-${participantData.sub}`
              : participantData.sub,
            JSON.stringify(response.assessment)
          )

          // update both the regular and temporary live quiz leaderboards
          updateLeaderboards({
            redisMulti,
            participantId: participantData.sub,
            participantRole: participantData.role,
            sessionKey,
            sessionBlockId,
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
  } catch (e) {
    ctx.logger.error('Error processing response', e, message)
    redisMulti?.discard()
    return { status: 500 }
  }

  try {
    await redisMulti.exec()
    ctx.logger.info("Successfully processed participant's response", message)
    return { status: 200 }
  } catch (e) {
    ctx.logger.error('Redis transaction failed', e, message)
    redisMulti?.discard()
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}
