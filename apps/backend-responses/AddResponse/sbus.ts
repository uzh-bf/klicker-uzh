import { ServiceBusClient } from '@azure/service-bus'

let serviceBus: ServiceBusClient

function getServiceBus() {
  if (!serviceBus) {
    serviceBus = new ServiceBusClient(
      process.env.SERVICE_BUS_CONNECTION_STRING as string
    )
  }

  return serviceBus
}

export default getServiceBus
