import { AzureMediaStorage } from './azure.js'
import { S3MediaStorage } from './s3.js'
import type { MediaStorage } from './types.js'

export function createMediaStorage(
  env: NodeJS.ProcessEnv = process.env
): MediaStorage {
  const provider = env.MEDIA_STORAGE_PROVIDER?.trim() || 'azure'
  if (provider === 'azure') return new AzureMediaStorage(env)
  if (provider === 's3') return new S3MediaStorage(env)
  throw new Error('MEDIA_STORAGE_PROVIDER must be azure or s3')
}
