import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  KBResourceStatus,
  KBResourceType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { createHash, timingSafeEqual } from 'node:crypto'

const KB_SOURCE_GATEWAY_STORAGE_TIMEOUT_MS = 30_000

type KBSourceGatewayError = {
  statusCode: 401 | 404 | 502 | 503
  body: { error: string }
}

type KBSourceGatewaySuccess = {
  statusCode: 200
  contentLength: number
  contentType: string
  stream: NodeJS.ReadableStream
}

export type KBSourceGatewayResult =
  | KBSourceGatewayError
  | KBSourceGatewaySuccess

function isAuthorized(authorization: string | undefined, secret: string) {
  const expected = createHash('sha256')
    .update(`Bearer ${secret}`, 'utf8')
    .digest()
  const provided = createHash('sha256')
    .update(authorization ?? '', 'utf8')
    .digest()
  return timingSafeEqual(expected, provided)
}

function getBlobClient({
  accountName,
  accessKey,
  containerName,
  blobName,
}: {
  accountName: string
  accessKey: string
  containerName: string
  blobName: string
}) {
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const serviceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  )
  return serviceClient.getContainerClient(containerName).getBlobClient(blobName)
}

export async function handleKBSourceGateway({
  prisma,
  resourceId,
  resourceVersion,
  authorization,
  env = process.env,
}: {
  prisma: PrismaClient
  resourceId: string
  resourceVersion: number
  authorization?: string
  env?: NodeJS.ProcessEnv
}): Promise<KBSourceGatewayResult> {
  const gatewaySecret = env.KB_SOURCE_GATEWAY_KEY?.trim()
  const accountName = env.BLOB_STORAGE_ACCOUNT_NAME?.trim()
  const accessKey = env.BLOB_STORAGE_ACCESS_KEY?.trim()
  if (!gatewaySecret || !accountName || !accessKey) {
    return { statusCode: 503, body: { error: 'Service unavailable' } }
  }
  if (!isAuthorized(authorization, gatewaySecret)) {
    return { statusCode: 401, body: { error: 'Unauthorized' } }
  }

  const resource = await prisma.kBResource.findFirst({
    where: {
      id: resourceId,
      resourceVersion,
      deletedAt: null,
      type: KBResourceType.BLOB,
      contentSha256: { not: null },
      status: {
        in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
      },
    },
    select: {
      blobName: true,
      mimeType: true,
      sizeBytes: true,
      kb: { select: { ownerId: true } },
    },
  })
  if (
    !resource?.blobName ||
    !resource.mimeType ||
    resource.sizeBytes === null
  ) {
    return { statusCode: 404, body: { error: 'Resource not found' } }
  }

  try {
    const blobClient = getBlobClient({
      accountName,
      accessKey,
      containerName: `kb-${resource.kb.ownerId}`,
      blobName: resource.blobName,
    })
    const response = await blobClient.download(0, undefined, {
      abortSignal: AbortSignal.timeout(KB_SOURCE_GATEWAY_STORAGE_TIMEOUT_MS),
    })
    if (
      !response.readableStreamBody ||
      response.contentLength !== resource.sizeBytes ||
      response.contentType?.trim().toLowerCase() !== resource.mimeType
    ) {
      return { statusCode: 502, body: { error: 'Source unavailable' } }
    }

    return {
      statusCode: 200,
      contentLength: resource.sizeBytes,
      contentType: resource.mimeType,
      stream: response.readableStreamBody,
    }
  } catch {
    return { statusCode: 502, body: { error: 'Source unavailable' } }
  }
}
