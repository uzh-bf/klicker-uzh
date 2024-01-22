import { app, InvocationContext } from '@azure/functions'
import getBlobClient from './blob'
import getMongoDB from './mongo'
import { sendEmailMigrationNotification, sendTeamsNotifications } from './utils'

interface Message {
  messageId: string
  newUserId: string
  newEmail: string
  originalEmail: string
}

const serviceBusTrigger = async function (
  message: any,
  context: InvocationContext
) {
  context.log('MigrationV2Export function processing a message', message)

  try {
    const messageData = message as Message

    await sendTeamsNotifications(
      'func/migration-v2-export',
      `Started export of KlickerV2 data for '${messageData.originalEmail}' -> '${messageData.newEmail}'`,
      context
    )

    const db = await getMongoDB(context)

    const matchingUsers = await db
      .collection('users')
      .find({ email: messageData.originalEmail.toLowerCase() })
      .toArray()

    if (!matchingUsers?.[0]) {
      await sendEmailMigrationNotification(
        messageData.newEmail,
        process.env.LISTMONK_TEMPLATE_MIGRATION_EMAIL_NOT_FOUND as string,
        context
      )
      throw new Error(
        `No matching V2 user found for ${messageData.originalEmail}`
      )
    }

    const matchingUser = matchingUsers[0]

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
      `${messageData.newUserId}_${Date.now()}.json`
    )

    await blockBlobClient.uploadData(Buffer.from(JSON.stringify(exportData)), {
      blockSize: 4 * 1024 * 1024, // 4MB block size
    })

    await sendTeamsNotifications(
      'func/migration-v2-export',
      `Successful export for user '${messageData.originalEmail}' (${matchingUser.email})`,
      context
    )

    return exportData
  } catch (e) {
    context.error('Something went wrong while exporting data: ', e)

    await sendTeamsNotifications(
      'func/migration-v2-export',
      `Export of KlickerV2 data failed. Error: ${e.message}`,
      context
    )

    throw new Error('Something went wrong while exporting data')
  }
}

export default serviceBusTrigger

app.serviceBusQueue('MigrationV2Export', {
  connection: 'MIGRATION_SERVICE_BUS_CONNECTION_STRING',
  queueName: process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME as string,
  handler: serviceBusTrigger,
})
