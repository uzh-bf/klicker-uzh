import Redis from 'ioredis'
import JWT from 'jsonwebtoken'
import md5 from 'md5'

import { any, equals, toLower, trim } from 'ramda'

import { AzureFunction, Context, HttpRequest } from '@azure/functions'

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the question options

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  const sessionKey = `s:${req.body.sessionId}`
  const instanceKey = `${sessionKey}:i:${req.body.instanceId}`
  const responseTimestamp = Number(new Date())
  const response = req.body.response

  if (!response) {
    return {
      status: 400,
    }
  }

  let participantData: { sub: string } | null = null
  if (req.headers?.cookie) {
    const token = req.headers?.cookie.replace('participant_token=', '')
    participantData = JWT.verify(token, process.env.APP_SECRET as string) as any

    // if the participant has already responded to the question instance, return instantly
    if (
      participantData &&
      (await redisExec.hexists(`${instanceKey}:responses`, participantData.sub))
    ) {
      // TODO: return some other status to display something on the frontend?
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
  } = instanceInfo

  // TODO: ensure that the following code can handle missing solutions
  let parsedSolutions
  try {
    parsedSolutions = JSON.parse(solutions)
  } catch (e) {
    console.error(e)
  }

  const redisMulti = redisExec.pipeline()

  // compute the timing of the response based on the first response received for the instance
  const responseTiming =
    responseTimestamp - Number(firstResponseReceivedAt ?? responseTimestamp) + 1
  let pointsAwarded: number | string = 10000 / responseTiming / 1000

  switch (type) {
    // TODO: handle points for partial correct answers in MC (like KPRIM?)
    case 'SC':
    case 'MC': {
      response.choices.forEach((choiceIndex: number) => {
        redisMulti.hincrby(`${instanceKey}:results`, String(choiceIndex), 1)
      })
      redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

      if (participantData) {
        if (parsedSolutions && equals(response.choices, parsedSolutions)) {
          pointsAwarded += 100

          // if we are processing a first response, set the timestamp on the instance
          // this will allow us to award points for response timing
          if (!firstResponseReceivedAt) {
            redisExec.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }
        } else {
          pointsAwarded = 0
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
        if (parsedSolutions?.length > 0) {
          const withinRanges = parsedSolutions.map(({ min, max }: any) => {
            if (min && response.value < min) return false
            if (max && response.value > max) return false
            return true
          })

          if (any(Boolean, withinRanges)) {
            pointsAwarded += 100

            // if we are processing a first response, set the timestamp on the instance
            // this will allow us to award points for response timing
            if (!firstResponseReceivedAt) {
              redisExec.hset(
                `${instanceKey}:info`,
                'firstResponseReceivedAt',
                responseTimestamp
              )
            }
          } else {
            pointsAwarded = 0
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
          parsedSolutions?.length > 0 &&
          parsedSolutions.includes(cleanResponseValue)
        ) {
          pointsAwarded += 100

          // if we are processing a first response, set the timestamp on the instance
          // this will allow us to award points for response timing
          if (!firstResponseReceivedAt) {
            redisExec.hset(
              `${instanceKey}:info`,
              'firstResponseReceivedAt',
              responseTimestamp
            )
          }
        } else {
          pointsAwarded = 0
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

  // TODO: what if the above fails?
  try {
    await redisMulti.exec()
  } catch (e) {
    console.error(e)
  }

  return {
    status: 200,
  }
}

export default httpTrigger
