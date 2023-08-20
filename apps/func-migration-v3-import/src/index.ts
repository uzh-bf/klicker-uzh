import { app, InvocationContext } from '@azure/functions'

const blobTrigger = async function (message: any, context: InvocationContext) {
  context.log('MigrationV3Import function processing a message', message)
}

export default blobTrigger

app.storageBlob('MigrationV3Import', {
  connection: 'MIGRATION_BLOB_IMPORT_CONNECTION_STRING',
  path: process.env.MIGRATION_BLOB_STORAGE_PATH as string,
  handler: blobTrigger,
})
