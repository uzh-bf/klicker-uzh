import type { AzureFunction, Context } from '@azure/functions'
import {
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

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the question options

Sentry.init()

const redisExec = getRedis()

const serviceBusTrigger: AzureFunction = async function (
  context: Context,
  queueItem
) {
  context.log('ProcessResponses function processed a message', queueItem)

  let redisMulti: ChainableCommander

  try {
    assert(!!redisExec)

    const sessionKey = `s:${queueItem.sessionId}`
    const instanceKey = `${sessionKey}:i:${queueItem.instanceId}`
    const responseTimestamp = queueItem.responseTimestamp
    const response = queueItem.response
    if (!response) {
      return {
        status: 400,
      }
    }

    let participantData: { sub: string } | null = null
    if (queueItem.cookie) {
      const token = queueItem.cookie.replace('participant_token=', '')
      try {
        participantData = JWT.verify(
          token,
          process.env.APP_SECRET as string
        ) as any
      } catch (e) {
        context.log('JWT verification failed', e)
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
        return { status: 200 }
      }
    }
    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo) {
      return {
        status: 400,
      }
    }

    const {
      type,
      solutions,
      startedAt,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
    } = instanceInfo
    let parsedSolutions
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch (e) {
      context.log('Error parsing solutions', e)
      Sentry.captureException(e)
    }

    redisMulti = redisExec.multi()
    // compute the timing of the response based on the first response received for the instance
    const responseTiming =
      (responseTimestamp -
        Number(firstResponseReceivedAt ?? responseTimestamp)) /
      1000
    let pointsAwarded: number | string = 10
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
          if (pointsPercentage !== null) {
            pointsAwarded += (20 * pointsPercentage) / responseTiming
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            if (!firstResponseReceivedAt) {
              redisExec.hset(
                `${instanceKey}:info`,
                'firstResponseReceivedAt',
                responseTimestamp
              )
            }
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
        if (participantData) {
          if (
            parsedSolutions &&
            gradeQuestionNumerical({
              response: response.value,
              solutionRanges: parsedSolutions,
            })
          ) {
            pointsAwarded += 20 / responseTiming
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            if (!firstResponseReceivedAt) {
              redisExec.hset(
                `${instanceKey}:info`,
                'firstResponseReceivedAt',
                responseTimestamp
              )
            }
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
          if (
            gradeQuestionFreeText({
              response: cleanResponseValue,
              solutions: parsedSolutions,
            })
          ) {
            pointsAwarded += 20 / responseTiming
            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            if (!firstResponseReceivedAt) {
              redisExec.hset(
                `${instanceKey}:info`,
                'firstResponseReceivedAt',
                responseTimestamp
              )
            }
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
        }
        break
      }
    }
  } catch (e) {
    Sentry.captureException(e)
    return {
      status: 500,
    }
  }

  try {
    await redisMulti.exec()
    return { status: 200 }
  } catch (e) {
    context.log('Redis transaction failed', e)
    Sentry.captureException(e)
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}

export default serviceBusTrigger
