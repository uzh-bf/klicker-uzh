import Redis from 'ioredis'
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
// TODO: verify the participant cookie (if available)
// TODO: add the participant response to redis (aggregated and separately)
// TODO: award points based on the timing and correctness of the response

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  const instanceKey = `s:${req.body.sessionId}:i:${req.body.instanceId}`

  const { type, namespace, solutions } = await redisExec.hgetall(
    `${instanceKey}:info`
  )

  const parsedSolutions = JSON.parse(solutions)

  const redisMulti = redisExec.multi()

  context.log(instanceKey, type, namespace, parsedSolutions)

  const response = req.body.response

  switch (type) {
    case 'SC':
    case 'MC': {
      response.choices.forEach((choiceIndex: number) => {
        redisMulti.hincrby(`${instanceKey}:results`, String(choiceIndex), 1)
      })
      redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

      context.log(new Set(response.choices), new Set(parsedSolutions))
      if (equals(response.choices, parsedSolutions)) {
        context.log('right!')
      }

      break
    }

    case 'NUMERICAL': {
      const responseHash = md5(response.value)
      redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
      redisMulti.hset(
        `${instanceKey}:responseHashes`,
        responseHash,
        response.value
      )
      redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

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

      break
    }

    case 'FREE_TEXT': {
      const responseHash = md5(response.value)
      redisMulti.hincrby(`${instanceKey}:results`, responseHash, 1)
      redisMulti.hset(
        `${instanceKey}:responseHashes`,
        responseHash,
        response.value
      )
      redisMulti.hincrby(`${instanceKey}:results`, 'participants', 1)

      if (parsedSolutions?.length > 0) {
        if (parsedSolutions.includes(response.value)) {
          context.log('right!')
        }
      }

      break
    }
  }

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
