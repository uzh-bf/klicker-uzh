import { ServiceBusClient } from '@azure/service-bus'
import * as Sentry from '@sentry/node'

let serviceBus: ServiceBusClient

function getServiceBus() {
  if (!serviceBus) {
    try {
      serviceBus = new ServiceBusClient(
        process.env.SERVICE_BUS_CONNECTION_STRING as string
      )
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  return serviceBus
}

export default getServiceBus
