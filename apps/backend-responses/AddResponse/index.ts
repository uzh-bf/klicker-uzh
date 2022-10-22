import { AzureFunction, Context, HttpRequest } from '@azure/functions'

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

  if (!req.body.response) {
    return {
      status: 400,
    }
  }

  serviceBusSender.sendMessages({
    sessionId: req.body.sessionId,
    // messageId: req.body.sessionId,
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
