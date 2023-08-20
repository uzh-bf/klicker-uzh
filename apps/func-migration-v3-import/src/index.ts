import { app, InvocationContext, StorageBlobHandler } from '@azure/functions'

const blobTrigger: StorageBlobHandler = async function (
  blob: unknown,
  context: InvocationContext
) {
  try {
    const data = blob as Buffer

    const content = data.toString()

    const parsedContent = JSON.parse(content)

    context.log(
      'MigrationV3Import function processing a new exported blob',
      parsedContent['user_email']
    )
  } catch (e) {
    context.error(e)
  }
}

export default blobTrigger

app.storageBlob('MigrationV3Import', {
  connection: 'MIGRATION_BLOB_IMPORT_CONNECTION_STRING',
  path: process.env.MIGRATION_BLOB_STORAGE_PATH as string,
  handler: blobTrigger,
})
