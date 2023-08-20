import { app, InvocationContext } from '@azure/functions'
import getBlobClient from './blob'
import getMongoDB from './mongo'

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

  const db = await getMongoDB(context)

  const matchingUsers = await db
    .collection('users')
    .find({ email: messageData.originalEmail })
    .toArray()

  if (!matchingUsers?.[0]) {
    throw new Error('No matching user found')
  }

  const matchingUser = matchingUsers[0]

  if (matchingUser.runningSession) {
    // TODO: inform the user that the running session needs to be stopped before migration
    throw new Error('User has a running session')
  }

  const exportData: Record<string, any> = {
    user_id: matchingUser._id.toString(),
    user_email: matchingUser.email,
    sessions: [],
    tags: [],
    questions: [],
    questioninstances: [],
    files: [],
  }

  for (const collectionName of [
    'sessions',
    'tags',
    'questions',
    'questioninstances',
    'files',
  ]) {
    const documents = await db
      .collection(collectionName)
      .find({ user: matchingUser._id })
      .toArray()

    exportData[collectionName] = documents

    context.log(
      `Fetched ${documents.length} documents from collection '${collectionName}' for user '${matchingUser.email}'.`
    )
  }

  exportData.questions = exportData.questions.map((question: any) => {
    if (question.versions) {
      question.versions = question.versions[question.versions.length - 1]
    }

    return question
  })

  const blobClient = await getBlobClient(context)

  const blockBlobClient = blobClient.getBlockBlobClient(
    `migration_export_v2_${matchingUser._id}_${Date.now()}.json`
  )

  await blockBlobClient.uploadData(Buffer.from(JSON.stringify(exportData)), {
    blockSize: 4 * 1024 * 1024, // 4MB block size
  })

  return exportData
}

export default serviceBusTrigger

app.serviceBusQueue('MigrationV2Export', {
  connection: 'MIGRATION_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME as string,
  handler: serviceBusTrigger,
})
