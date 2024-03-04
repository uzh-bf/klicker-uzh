import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions'
import * as Sentry from '@sentry/node'
import JWT from 'jsonwebtoken'

import getServiceBus from './sbus'

Sentry.init()

const serviceBusClient = getServiceBus()

const serviceBusSender = serviceBusClient.createSender(
  process.env.SERVICE_BUS_QUEUE_NAME
)

const httpTrigger = async function (
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('AddResponse function processed a request', req.method, req.body)

  // immediately return on GET -> healthcheck
  if (req.method === 'GET') {
    await serviceBusSender.sendMessages({
      sessionId: 'ping',
      body: {
        sessionId: 'ping',
      },
    })

    if (process.env.FUNCTION_HEARTBEAT_URL) {
      // @ts-ignore
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }

    return { status: 200 }
  }

  const body: any = await req.json()
  context.log('body: ', body)

  if (!body.response || !body.sessionId) {
    context.warn('Missing response or sessionId', body)
    return { status: 400 }
  }

  try {
    let messageId = undefined

    const cookie = req.headers.get('cookie')

    if (cookie) {
      try {
        const parsedCookies = cookie
          .split(';')
          .map((v: string) => v.split('='))
          .reduce<Record<string, string>>((acc, v) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(
              v[1].trim()
            )
            return acc
          }, {})

        if (parsedCookies['participant_token'] !== undefined) {
          const participantData = JWT.verify(
            parsedCookies['participant_token'],
            process.env.APP_SECRET
          )

          if (participantData.sub && participantData.role === 'PARTICIPANT') {
            messageId = `${participantData.sub}-${body.sessionId}`
          }
        }
      } catch (e) {
        context.error('JWT verification failed', e, cookie)
        Sentry.captureException(e)
      }
    }

    const message = {
      sessionId: body.sessionId,
      messageId,
      body: {
        ...body,
        cookie: cookie ?? undefined,
        responseTimestamp: Number(new Date()),
      },
    }

    context.log('message: ', message)

    await serviceBusSender.sendMessages(message, {})

    context.log('Submitted message to service bus')
    return { status: 200 }
  } catch (e) {
    context.error('Error sending message to service bus', e)
    Sentry.captureException(e)
    await Sentry.flush(500)
    return { status: 500 }
  }
}

app.http('AddResponse', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'AddResponse',
  handler: httpTrigger,
})
