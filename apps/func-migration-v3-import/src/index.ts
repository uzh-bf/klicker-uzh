import { app, InvocationContext, StorageBlobHandler } from '@azure/functions'
import { closeLegacyConnection } from './getLegacyResults'
import { importQuestionInstances } from './importQuestionInstances'
import { importQuestions } from './importQuestions'
import { importSessions } from './importSessions'
import { importTags } from './importTags'
import { migrateFiles } from './migrateFiles'
import getPrismaClient from './prisma'

const prisma = getPrismaClient()

const blobTrigger: StorageBlobHandler = async function (
  blob: unknown,
  context: InvocationContext
) {
  try {
    const data = blob as Buffer

    const content = data.toString()

    const newUserId = context.triggerMetadata?.blobTrigger
      ?.split('/')[2]
      .split('_')[0]

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

    // keep information in memory for more efficient lookup
    let mappedTags: Record<string, Record<string, string | number>> = {}
    let mappedFileURLs: Record<string, Record<string, string>> = {}
    let mappedQuestionIds: Record<string, number> = {}
    let mappedQuestionInstancesIds: Record<string, number> = {}
    let mappedSessionIds: Record<string, string> = {}

    mappedFileURLs = await migrateFiles(parsedContent.files, context)
    context.log('mappedFileURLs: ', mappedFileURLs)

    const batchSize = 50

    const tags = parsedContent.tags
    mappedTags = await importTags(prisma, tags, user, batchSize, context)
    context.log('mappedTags: ', mappedTags)

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
    context.log('mappedQuestionIds: ', mappedQuestionIds)

    const questionInstances = parsedContent.questioninstances
    mappedQuestionInstancesIds = await importQuestionInstances(
      prisma,
      questionInstances,
      mappedQuestionIds,
      user,
      batchSize,
      context
    )
    context.log('mappedQuestionInstancesIds: ', mappedQuestionInstancesIds)

    const sessions = parsedContent.sessions
    mappedSessionIds = await importSessions(
      prisma,
      sessions,
      mappedQuestionInstancesIds,
      user,
      batchSize,
      context
    )
    context.log('mappedSessionIds: ', mappedSessionIds)

    closeLegacyConnection()
  } catch (e) {
    context.error('Something went wrong while importing data: ', e)
  }
}

export default blobTrigger

app.storageBlob('MigrationV3Import', {
  connection: 'MIGRATION_BLOB_IMPORT_CONNECTION_STRING',
  path: process.env.MIGRATION_BLOB_STORAGE_PATH as string,
  handler: blobTrigger,
})
