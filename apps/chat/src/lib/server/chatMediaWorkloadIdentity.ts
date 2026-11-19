import { WorkloadIdentityCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'

const AZURE_STORAGE_ACCOUNT_NAME = /^[a-z0-9]{3,24}$/
const MAX_CACHED_CLIENTS = 8

type StorageEnvironment = Readonly<Record<string, string | undefined>>
type StorageAccountEnvironment =
  | 'COURSE_IMAGE_PROJECTION_STORAGE_ACCOUNT_NAME'
  | 'BLOB_STORAGE_ACCOUNT_NAME'

export type ChatMediaWorkloadIdentityStorage = Readonly<{
  accountName: string
  container: string
}>

const clients = new Map<string, BlobServiceClient>()

function azurePublicBlobOrigin(accountName: string) {
  if (!AZURE_STORAGE_ACCOUNT_NAME.test(accountName))
    throw new Error('Media workload identity storage unavailable')
  return `https://${accountName}.blob.core.windows.net`
}

export function chatMediaWorkloadIdentityEnabled(
  env: StorageEnvironment = process.env
) {
  return env.CHAT_MEDIA_WORKLOAD_IDENTITY_ENABLED === 'true'
}

export function resolveChatMediaWorkloadIdentityStorage(
  env: StorageEnvironment,
  accountVariable: StorageAccountEnvironment,
  container: string | undefined
): ChatMediaWorkloadIdentityStorage | undefined {
  if (!chatMediaWorkloadIdentityEnabled(env)) return undefined

  const accountName = env[accountVariable]
  if (!accountName || !AZURE_STORAGE_ACCOUNT_NAME.test(accountName))
    throw new Error('Media workload identity storage unavailable')
  if (!container?.trim())
    throw new Error('Media workload identity storage unavailable')

  return Object.freeze({
    accountName,
    container,
  })
}

export function chatMediaWorkloadIdentityStorageConfigured(
  env: StorageEnvironment,
  accountVariable: StorageAccountEnvironment,
  container: string | undefined
) {
  try {
    return Boolean(
      resolveChatMediaWorkloadIdentityStorage(env, accountVariable, container)
    )
  } catch {
    return false
  }
}

export function createChatMediaWorkloadIdentityBlobClient(accountName: string) {
  const accountUrl = azurePublicBlobOrigin(accountName)
  const key = JSON.stringify([
    accountName,
    process.env.AZURE_CLIENT_ID,
    process.env.AZURE_TENANT_ID,
    process.env.AZURE_FEDERATED_TOKEN_FILE,
  ])
  const cached = clients.get(key)
  if (cached) {
    clients.delete(key)
    clients.set(key, cached)
    return cached
  }

  const client = new BlobServiceClient(
    accountUrl,
    new WorkloadIdentityCredential()
  )
  clients.set(key, client)
  while (clients.size > MAX_CACHED_CLIENTS) {
    const oldest = clients.keys().next().value
    if (!oldest) break
    clients.delete(oldest)
  }
  return client
}
