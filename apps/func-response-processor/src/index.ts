import { app, InvocationContext } from '@azure/functions'
import {
  computeAwardedPoints,
  computeAwardedXp,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import * as Sentry from '@sentry/node'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'
import { verify } from 'jsonwebtoken'
import { toLowerCase } from 'remeda'
import getRedis from './redis'

const MAX_BONUS_POINTS = 45 // maximum 45 bonus points for fastest answer
const TIME_TO_ZERO_BONUS = 20 // seconds until the bonus points are zero
const DEFAULT_POINTS = 10 // points a participant gets for participating in a poll
const DEFAULT_CORRECT_POINTS = 5 // points a participant gets for answering correctly (independent of time)

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the question options

Sentry.init()

const redisExec = getRedis()

interface Message {
  messageId: string
  sessionId: string
  instanceId: string
  response: any
  cookie?: string
  responseTimestamp: number
}

const serviceBusTrigger = async function (
  message: any,
  context: InvocationContext
) {
  context.log('ProcessResponse function processing a message', message)

  const queueItem = message as Message

  try {
    assert(!!redisExec)
  } catch (e) {
    context.log('Redis connection error', e)
    Sentry.captureException(e)
    await Sentry.flush(500)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  if (queueItem.sessionId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  let redisMulti: ChainableCommander
  // redisMulti = redisExec.multi() -> transaction
  redisMulti = redisExec.pipeline() // -> pipeline (not atomic)

  try {
    const MD5 = createHash('md5')
    const sessionKey = `s:${queueItem.sessionId}`
    const instanceKey = `${sessionKey}:i:${queueItem.instanceId}`
    const responseTimestamp = queueItem.responseTimestamp
    const response = queueItem.response
    if (!response) {
      context.error('Missing response', queueItem)
      return { status: 400 }
    }

    let participantData: { sub: string; role: string } | null = null
    if (typeof queueItem.cookie === 'string') {
      try {
        const parsedCookies = queueItem.cookie
          .split(';')
          .map((v: string) => v.split('='))
          .reduce<Record<string, string>>((acc, v) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(
              v[1].trim()
            )
            return acc
          }, {})

        if (parsedCookies['participant_token'] !== undefined) {
          participantData = verify(
            parsedCookies['participant_token'],
            process.env.APP_SECRET
          ) as { sub: string; role: string }

          if (participantData.role !== 'PARTICIPANT') {
            participantData = null
          } else {
            context.log("Participant's JWT verified", participantData)
          }
        }
      } catch (e) {
        context.error('JWT verification failed', e, queueItem.cookie)
        Sentry.captureException(e)
      }
      // if the participant has already responded to the question instance, return instantly
      if (
        participantData &&
        (await redisExec.hexists(
          `${instanceKey}:responses`,
          participantData.sub
        ))
      ) {
        context.log(
          'Participant has already responded to this question instance'
        )
        return { status: 200 }
      }
    }
    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo) {
      context.log('Question instance metadata not found', queueItem)
      return { status: 400 }
    }

    context.log('Instance info', instanceInfo)

    const {
      type,
      solutions,
      startedAt,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
      pointsMultiplier,
    } = instanceInfo
    let parsedSolutions
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch (e) {
      context.log('Error parsing solutions', e, queueItem)
      Sentry.captureException(e)
    }

    let pointsAwarded: number | string = 0
    let xpAwarded: number = 0

    switch (type) {
      case 'SC':
      case 'MC':
      case 'KPRIM': {
        response.choices.forEach((choiceIndex: number) => {
          redisMulti.hincrby(`${instanceKey}:results`, String(choiceIndex), 1)
        })
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)
        if (participantData) {
          let pointsPercentage
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
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
            pointsPercentage,
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
            participantData.sub,
            response.choices
          )
          redisMulti.hincrby(
            `${sessionKey}:b:${sessionBlockId}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(
            `${sessionKey}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(`${sessionKey}:xp`, participantData.sub, xpAwarded)
        }
        break
      }
      // TODO: points based on distance to correct range?
      case 'NUMERICAL': {
        MD5.update(response.value)
        const responseHash = MD5.digest('hex')
        redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
        redisMulti.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          response.value
        )
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

        const answerCorrect = gradeQuestionNumerical({
          response: response.value,
          solutionRanges: parsedSolutions,
        })

        if (participantData) {
          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            getsMaxPoints: parsedSolutions && answerCorrect === 1,
            maxBonus: parseInt(instanceInfo.maxBonusPoints) ?? MAX_BONUS_POINTS,
            timeToZeroBonus:
              parseInt(instanceInfo.timeToZeroBonus) ?? TIME_TO_ZERO_BONUS,
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
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
            participantData.sub,
            response.value
          )
          redisMulti.hincrby(
            `${sessionKey}:b:${sessionBlockId}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(
            `${sessionKey}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(`${sessionKey}:xp`, participantData.sub, xpAwarded)
        }
        break
      }
      // TODO: future -> distance in embedding space?
      case 'FREE_TEXT': {
        const cleanResponseValue = toLowerCase(response.value.trim())
        MD5.update(cleanResponseValue)
        const responseHash = MD5.digest('hex')
        redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
        redisMulti.hset(
          `${instanceKey}:responseHashes`,
          responseHash,
          cleanResponseValue
        )
        redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)
        if (participantData) {
          const answerCorrect = gradeQuestionFreeText({
            response: cleanResponseValue,
            solutions: parsedSolutions,
          })

          pointsAwarded = computeAwardedPoints({
            firstResponseReceivedAt,
            responseTimestamp,
            getsMaxPoints: Boolean(answerCorrect),
            maxBonus: parseInt(instanceInfo.maxBonusPoints) ?? MAX_BONUS_POINTS,
            timeToZeroBonus:
              parseInt(instanceInfo.timeToZeroBonus) ?? TIME_TO_ZERO_BONUS,
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
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
            participantData.sub,
            cleanResponseValue
          )
          redisMulti.hincrby(
            `${sessionKey}:b:${sessionBlockId}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(
            `${sessionKey}:lb`,
            participantData.sub,
            pointsAwarded
          )
          redisMulti.hincrby(`${sessionKey}:xp`, participantData.sub, xpAwarded)
        }
        break
      }
    }
  } catch (e) {
    context.error('Error processing response', e, queueItem)
    Sentry.captureException(e)
    redisMulti?.discard()
    await Sentry.flush(500)
    return { status: 500 }
  }

  try {
    await redisMulti.exec()
    context.log("Successfully processed participant's response", queueItem)
    return { status: 200 }
  } catch (e) {
    context.error('Redis transaction failed', e, queueItem)
    Sentry.captureException(e)
    redisMulti?.discard()
    await Sentry.flush(500)
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}

export default serviceBusTrigger

// TODO: check how autoCompleteMessages needs to be applied in v4
app.serviceBusQueue('ProcessResponse', {
  connection: 'SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.SERVICE_BUS_QUEUE_NAME,
  isSessionsEnabled: true,
  //autoCompleteMessages: true,
  handler: serviceBusTrigger,
})
