import type { AzureFunction, Context, HttpRequest } from '@azure/functions'
import JWT from 'jsonwebtoken'

import getServiceBus from './sbus'

// TODO: evaluate duplicate detection with session id / participant id

const serviceBusClient = getServiceBus()

const serviceBusSender = serviceBusClient.createSender(
  process.env.SERVICE_BUS_QUEUE_NAME as string
)

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  // immediately return on GET -> healthcheck
  if (req.method === 'GET') {
    return {
      status: 200,
    }
  }

  if (!req.body.response || !req.body.sessionId) {
    return {
      status: 400,
    }
  }

  let messageId = undefined
  if (req.headers?.cookie) {
    const token = req.headers.cookie.replace('participant_token=', '')
    const participantData = JWT.verify(
      token,
      process.env.APP_SECRET as string
    ) as any
    if (participantData.sub) {
      messageId = `${participantData.sub}-${req.body.sessionId}`
    }
  }

  serviceBusSender.sendMessages({
    sessionId: req.body.sessionId,
    messageId,
    body: {
      ...req.body,
      cookie: req.headers?.cookie,
      responseTimestamp: Number(new Date()),
    },
  })

  return {
    status: 200,
  }
}

export default httpTrigger
