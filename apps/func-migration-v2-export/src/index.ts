import { app, InvocationContext } from '@azure/functions'

interface Message {
  messageId: string
}

const serviceBusTrigger = async function (
  message: any,
  context: InvocationContext
) {
  context.log('MigrationV2Export function processing a message', message)

  const queueItem = message as Message
}

export default serviceBusTrigger

app.serviceBusQueue('MigrationV2Export', {
  connection: 'MIGRATION_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME as string,
  handler: serviceBusTrigger,
})
