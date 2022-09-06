import Redis from 'ioredis'
import JWT from 'jsonwebtoken'
import md5 from 'md5'

import { any, equals } from 'ramda'

import { AzureFunction, Context, HttpRequest } from '@azure/functions'

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: award points based on the timing and correctness of the response

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  const sessionKey = `s:${req.body.sessionId}`
  const instanceKey = `${sessionKey}:i:${req.body.instanceId}`

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

  const { id, type, solutions } = await redisExec.hgetall(`${instanceKey}:info`)

  // TODO: ensure that the following code can handle missing solutions
  let parsedSolutions
  try {
    parsedSolutions = JSON.parse(solutions)
  } catch (e) {
    console.error(e)
  }

  const redisMulti = redisExec.multi()

  const response = req.body.response

  switch (type) {
    // TODO: handle points for partial correct answers in MC (like KPRIM?)
    case 'SC':
    case 'MC': {
      response.choices.forEach((choiceIndex: number) => {
        redisMulti.hincrby(`${instanceKey}:results`, String(choiceIndex), 1)
      })
      redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

      if (participantData) {
        context.log(new Set(response.choices), new Set(parsedSolutions))
        if (parsedSolutions && equals(response.choices, parsedSolutions)) {
          context.log('right!')
        }
        redisMulti.hset(
          `${instanceKey}:responses`,
          participantData.sub,
          response.choices
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

          context.log(withinRanges)
          if (any(Boolean, withinRanges)) {
            context.log('right!')
          }
        }

        redisMulti.hset(
          `${instanceKey}:responses`,
          participantData.sub,
          response.value
        )
      }

      break
    }

    // TODO: what about points?
    // TODO: trim and lowercase the response and solution
    // TODO: future -> distance in embedding space?
    case 'FREE_TEXT': {
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
          if (parsedSolutions.includes(response.value)) {
            context.log('right!')
          }
        }

        redisMulti.hset(
          `${instanceKey}:responses`,
          participantData.sub,
          response.value
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
