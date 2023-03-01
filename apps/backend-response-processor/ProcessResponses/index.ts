import type { AzureFunction, Context } from '@azure/functions'
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
import type { ChainableCommander } from 'ioredis'
import JWT from 'jsonwebtoken'
import md5 from 'md5'
import assert from 'node:assert/strict'
import { toLower, trim } from 'ramda'

import getRedis from './redis'

const MAX_BONUS_POINTS = 45 // maximum 45 bonus points for fastest answer
const TIME_TO_ZERO_BONUS = 20 // seconds until the bonus points are zero
const DEFAULT_POINTS = 10 // points a participant gets for participating in a poll
const DEFAULT_CORRECT_POINTS = 5 // points a participant gets for answering correctly (independent of time)

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the question options

Sentry.init()

const redisExec = getRedis()

const serviceBusTrigger: AzureFunction = async function (
  context: Context,
  queueItem
) {
  context.log('ProcessResponses function processed a message', queueItem)

  try {
    assert(!!redisExec)
  } catch (e) {
    context.log('Redis connection error', e)
    Sentry.captureException(e)
    await Sentry.flush(500)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  if (queueItem?.sessionId === 'ping') {
    // await fetch(
    //   'https://betteruptime.com/api/v1/heartbeat/pT3NjExsLvqufrtTGR3H15Mr'
    // )
    return { status: 200 }
  }

  let redisMulti: ChainableCommander
  redisMulti = redisExec.multi()

  try {
    const sessionKey = `s:${queueItem.sessionId}`
    const instanceKey = `${sessionKey}:i:${queueItem.instanceId}`
    const responseTimestamp = queueItem.responseTimestamp
    const response = queueItem.response
    if (!response) {
      context.log('Missing response', queueItem)
      return { status: 400 }
    }

    let participantData: { sub: string } | null = null
    if (queueItem.cookie) {
      try {
        const parsedCookie = queueItem.cookie
          .split(';')
          .map((v: string) => v.split('='))
          .reduce((acc: Record<string, string>, v: string) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(
              v[1].trim()
            )
            return acc
          }, {})
        participantData = JWT.verify(
          parsedCookie.participant_token,
          process.env.APP_SECRET as string
        ) as any
      } catch (e) {
        context.log('JWT verification failed', e, queueItem.cookie)
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
            maxBonus: MAX_BONUS_POINTS,
            timeToZeroBonus: TIME_TO_ZERO_BONUS,
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
            pointsPercentage,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage,
            multiplier: parseFloat(pointsMultiplier),
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
        const responseHash = md5(response.value)
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
            maxBonus: MAX_BONUS_POINTS,
            getsMaxPoints: parsedSolutions && answerCorrect,
            timeToZeroBonus: TIME_TO_ZERO_BONUS,
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage: answerCorrect ?? 0,
            multiplier: parseFloat(pointsMultiplier),
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
        const cleanResponseValue = toLower(trim(response.value))
        const responseHash = md5(cleanResponseValue)
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
            maxBonus: MAX_BONUS_POINTS,
            getsMaxPoints: Boolean(answerCorrect),
            timeToZeroBonus: TIME_TO_ZERO_BONUS,
            defaultPoints: DEFAULT_POINTS,
            defaultCorrectPoints: DEFAULT_CORRECT_POINTS,
            pointsMultiplier,
          })
          xpAwarded = computeAwardedXp({
            pointsPercentage: answerCorrect ?? 0,
            multiplier: parseFloat(pointsMultiplier),
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
    context.log('Error processing response', e, queueItem)
    Sentry.captureException(e)
    redisMulti?.discard()
    await Sentry.flush(500)
    return { status: 500 }
  }

  try {
    await redisMulti.exec()
    return { status: 200 }
  } catch (e) {
    context.log('Redis transaction failed', e, queueItem)
    Sentry.captureException(e)
    redisMulti?.discard()
    await Sentry.flush(500)
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}

export default serviceBusTrigger
