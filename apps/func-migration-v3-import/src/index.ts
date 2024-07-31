import { app, InvocationContext, StorageBlobHandler } from '@azure/functions'
import { closeLegacyConnection } from './getLegacyResults'
import { importQuestionInstances } from './importQuestionInstances'
import { importQuestions } from './importQuestions'
import { importSessions } from './importSessions'
import { importTags } from './importTags'
import { migrateFiles } from './migrateFiles'
import getPrismaClient from './prisma'
import { sendEmailMigrationNotification, sendTeamsNotifications } from './utils'

const prisma = getPrismaClient()

const blobTrigger: StorageBlobHandler = async function (
  blob: unknown,
  context: InvocationContext
) {
  let email = ''
  try {
    const data = blob as Buffer

    const content = data.toString()

    context.log(context.triggerMetadata?.blobTrigger)

    const newUserId = (
      context.triggerMetadata?.blobTrigger
        ? (context.triggerMetadata?.blobTrigger as string)
        : undefined
    )
      .split('/')
      [process.env.NODE_ENV === 'development' ? 1 : 2].split('_')[0]

    const parsedContent = JSON.parse(content)

    context.log(
      `MigrationV3Import function processing a new exported blob with originalEmail: ${parsedContent['user_email']} and new user id: ${newUserId}`
    )

    const user = await prisma.user.findUnique({
      where: {
        id: newUserId,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    email = user.email

    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Started import of KlickerV2 data for user '${user.email}'`,
      context
    )

    // keep information in memory for more efficient lookup
    let mappedTags: Record<string, Record<string, string | number>> = {}
    let mappedFileURLs: Record<string, Record<string, string>> = {}
    let mappedQuestionIds: Record<string, number> = {}
    let mappedQuestionInstancesIds: Record<string, number> = {}
    let mappedSessionIds: Record<string, string> = {}

    mappedFileURLs = await migrateFiles(
      prisma,
      parsedContent.files,
      context,
      user
    )

    // context.log('mappedFileURLs: ', mappedFileURLs)

    const batchSize = 10

    const tags = parsedContent.tags
    mappedTags = await importTags(prisma, tags, user, batchSize, context)
    // context.log('mappedTags: ', mappedTags)

    const questions = parsedContent.questions
    mappedQuestionIds = await importQuestions(
      prisma,
      questions,
      mappedTags,
      user,
      batchSize,
      mappedFileURLs,
      context
    )
    // context.log('mappedQuestionIds: ', mappedQuestionIds)

    const questionInstances = parsedContent.questioninstances
    mappedQuestionInstancesIds = await importQuestionInstances(
      prisma,
      questionInstances,
      mappedQuestionIds,
      user,
      batchSize,
      context
    )
    // context.log('mappedQuestionInstancesIds: ', mappedQuestionInstancesIds)

    const sessions = parsedContent.sessions
    mappedSessionIds = await importSessions(
      prisma,
      sessions,
      mappedQuestionInstancesIds,
      user,
      batchSize,
      context
    )
    // context.log('mappedSessionIds: ', mappedSessionIds)

    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Successful import for user '${user.email}'`,
      context
    )
    await sendEmailMigrationNotification(user.email, true, context)
  } catch (e) {
    context.error('Something went wrong while importing data: ', e)
    await sendTeamsNotifications(
      'func/migration-v3-import',
      `Import of KlickerV2 data failed. Error: ${e.message}`,
      context
    )
    await sendEmailMigrationNotification(email, false, context)
    throw new Error('Something went wrong while importing data')
  } finally {
    await closeLegacyConnection()
    await prisma.$disconnect()
  }
}

export default blobTrigger

app.storageBlob('MigrationV3Import', {
  connection: 'MIGRATION_BLOB_IMPORT_CONNECTION_STRING',
  path: 'exports',
  handler: blobTrigger,
})
