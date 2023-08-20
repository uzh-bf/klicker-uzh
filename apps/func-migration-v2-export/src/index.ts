import { app, InvocationContext } from '@azure/functions'
import { MongoClient } from 'mongodb'

interface Message {
  messageId: string
  sub: string
  originalEmail: string
}

const serviceBusTrigger = async function (
  message: any,
  context: InvocationContext
) {
  context.log('MigrationV2Export function processing a message', message)

  const messageData = message as Message

  const mongoURL = 'mongodb://klicker:klicker@localhost:27017'

  const mongoClient = new MongoClient(mongoURL)
  await mongoClient.connect()

  const db = mongoClient.db('klicker-prod')

  const matchingUser = await db
    .collection('users')
    .find({ email: messageData.originalEmail })
    .toArray()

  if (!matchingUser?.[0]) {
    throw new Error('No matching user found')
  }

  const exportData = {
    user_id: matchingUser.id,
    user_email: matchingUser.email as string,
    sessions: [],
    tags: [],
    questions: [],
    questioninstances: [],
    files: [],
  }

  context.log(exportData)

  return exportData
}

export default serviceBusTrigger

app.serviceBusQueue('MigrationV2Export', {
  connection: 'MIGRATION_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME as string,
  handler: serviceBusTrigger,
})
