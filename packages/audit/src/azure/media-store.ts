import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { ContainerClient } from '@azure/storage-blob'
import type {
  ImmutableAuditMedia,
  ImmutableAuditMediaStore,
} from '../media/capture.js'
import { auditMediaContentAddress } from '../media/content-address.js'

export class AuditMediaConflictError extends Error {
  readonly blobName: string

  constructor(blobName: string) {
    super(`Immutable audit media conflict for ${blobName}`)
    this.name = 'AuditMediaConflictError'
    this.blobName = blobName
  }
}

function statusCodeIs(error: unknown, ...statusCodes: number[]): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    statusCodes.includes(error.statusCode)
  )
}

async function hashBlobDownload(
  blob: ReturnType<ContainerClient['getBlockBlobClient']>
): Promise<string> {
  const response = await blob.download()
  const body = response.readableStreamBody
  if (body === undefined) {
    throw new Error('Immutable audit media download returned no body')
  }
  const hash = createHash('sha256')
  for await (const chunk of body) hash.update(Buffer.from(chunk))
  return hash.digest('hex')
}

function requireVersionId(
  versionId: string | undefined,
  blobName: string
): string {
  if (versionId === undefined || versionId === '') {
    throw new Error(`Immutable audit media ${blobName} has no version identity`)
  }
  return versionId
}

export class AzureImmutableAuditMediaStore implements ImmutableAuditMediaStore {
  private readonly container: ContainerClient
  private readonly now: () => Date

  constructor(container: ContainerClient, now: () => Date = () => new Date()) {
    this.container = container
    this.now = now
  }

  async createFromFile(input: {
    filePath: string
    blobName: string
    contentHash: string
    byteLength: number
    mimeType: string
    retainUntil: Date
  }): Promise<ImmutableAuditMedia> {
    if (input.blobName !== auditMediaContentAddress(input.contentHash)) {
      throw new TypeError('Audit media address does not match its content hash')
    }
    if (!Number.isSafeInteger(input.byteLength) || input.byteLength <= 0) {
      throw new TypeError('Audit media byte length is invalid')
    }
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(input.mimeType)) {
      throw new TypeError('Audit media MIME type is invalid')
    }
    if (
      Number.isNaN(input.retainUntil.getTime()) ||
      input.retainUntil.getTime() <= this.now().getTime()
    ) {
      throw new TypeError('Audit media retainUntil must be in the future')
    }

    const blob = this.container.getBlockBlobClient(input.blobName)
    let outcome: ImmutableAuditMedia['outcome'] = 'CREATED'
    let versionId: string | undefined

    try {
      const response = await blob.uploadStream(
        createReadStream(input.filePath),
        4 * 1024 * 1024,
        4,
        {
          conditions: { ifNoneMatch: '*' },
          metadata: {
            sha256: input.contentHash,
            byteLength: String(input.byteLength),
          },
          blobHTTPHeaders: { blobContentType: input.mimeType },
        }
      )
      versionId = response.versionId
    } catch (error) {
      if (!statusCodeIs(error, 409, 412)) throw error
      outcome = 'IDENTICAL_REPLAY'
    }

    const properties = await blob.getProperties()
    versionId ??= properties.versionId
    const storedHash = await hashBlobDownload(blob)
    if (
      storedHash !== input.contentHash ||
      properties.metadata?.sha256 !== input.contentHash ||
      properties.metadata?.byteLength !== String(input.byteLength) ||
      properties.contentLength !== input.byteLength ||
      properties.contentType !== input.mimeType
    ) {
      throw new AuditMediaConflictError(input.blobName)
    }

    const requiredVersionId = requireVersionId(versionId, input.blobName)
    const version = blob.withVersion(requiredVersionId)
    const existingExpiry = properties.immutabilityPolicyExpiresOn
    const alreadyLocked = properties.immutabilityPolicyMode === 'Locked'
    if (
      !alreadyLocked ||
      existingExpiry === undefined ||
      existingExpiry.getTime() < input.retainUntil.getTime()
    ) {
      await version.setImmutabilityPolicy({
        expiriesOn:
          existingExpiry !== undefined &&
          existingExpiry.getTime() > input.retainUntil.getTime()
            ? existingExpiry
            : input.retainUntil,
        policyMode: 'Locked',
      })
    }

    const lockedProperties = await version.getProperties()
    const lockedUntil = lockedProperties.immutabilityPolicyExpiresOn
    if (
      lockedProperties.immutabilityPolicyMode !== 'Locked' ||
      lockedUntil === undefined ||
      lockedUntil.getTime() < input.retainUntil.getTime()
    ) {
      throw new Error(
        `Immutable audit media ${input.blobName} was not durably locked`
      )
    }

    return {
      blobName: input.blobName,
      contentHash: input.contentHash,
      byteLength: input.byteLength,
      mimeType: input.mimeType,
      versionId: requiredVersionId,
      retainUntil: lockedUntil,
      outcome,
    }
  }
}
