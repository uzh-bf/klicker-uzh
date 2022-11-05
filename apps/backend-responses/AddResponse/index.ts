import type { AzureFunction, Context, HttpRequest } from '@azure/functions'
import * as Sentry from '@sentry/node'

import getServiceBus from './sbus'

Sentry.init()

const serviceBusClient = getServiceBus()

const serviceBusSender = serviceBusClient.createSender(
  process.env.SERVICE_BUS_QUEUE_NAME as string
)

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  context.log('AddResponse function processed a request', req.body)

  // immediately return on GET -> healthcheck
  if (req.method === 'GET') {
    await serviceBusSender.sendMessages({
      sessionId: 'ping',
      body: {}
    })

    return { status: 200 }
  }

  if (!req.body.response || !req.body.sessionId) {
    context.log('Missing response or sessionId', req.body)
    return { status: 400 }
  }

  try {
    // let messageId = undefined
    // if (req.headers?.cookie) {
    //   const token = req.headers.cookie.replace('participant_token=', '')
    //   const participantData = JWT.verify(
    //     token,
    //     process.env.APP_SECRET as string
    //   ) as any

    //   if (participantData.sub) {
    //     messageId = `${participantData.sub}-${req.body.sessionId}`
    //   }
    // }

    await serviceBusSender.sendMessages({
      sessionId: req.body.sessionId,
      // messageId,
      body: {
        ...req.body,
        cookie: req.headers?.cookie,
        responseTimestamp: Number(new Date()),
      },
    })
  } catch (e) {
    context.log('Error sending message to service bus', e)
    Sentry.captureException(e)
    await Sentry.flush(500)
    return { status: 500 }
  }

  return { status: 200 }
}

export default httpTrigger
