import type { ContainerClient } from '@azure/storage-blob'
import { sha256Hex } from '../canonical/hash.js'

export type ImmutableAuditBlob = {
  blobName: string
  contentHash: string
  byteLength: number
  versionId: string
  retainUntil: Date
  outcome: 'CREATED' | 'IDENTICAL_REPLAY'
}

export class AuditBlobConflictError extends Error {
  readonly blobName: string

  constructor(blobName: string) {
    super(`Immutable audit blob conflict for ${blobName}`)
    this.name = 'AuditBlobConflictError'
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

export function auditContentAddress(kind: string, contentHash: string): string {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(kind)) {
    throw new TypeError('Audit blob kind is invalid')
  }
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new TypeError('Audit blob content hash is invalid')
  }
  return `${kind}/sha256/${contentHash.slice(0, 2)}/${contentHash}`
}

export class AzureImmutableAuditBlobStore {
  private readonly container: ContainerClient
  private readonly now: () => Date

  constructor(container: ContainerClient, now: () => Date = () => new Date()) {
    this.container = container
    this.now = now
  }

  async create(input: {
    kind: 'manifest'
    content: Uint8Array
    contentType: string
    retainUntil: Date
  }): Promise<ImmutableAuditBlob> {
    if (
      Number.isNaN(input.retainUntil.getTime()) ||
      input.retainUntil.getTime() <= this.now().getTime()
    ) {
      throw new TypeError('Audit blob retainUntil must be in the future')
    }
    if (!/^[\w.+-]+\/[\w.+-]+(?:;[\w=.+-]+)*$/.test(input.contentType)) {
      throw new TypeError('Audit blob contentType is invalid')
    }

    const contentHash = sha256Hex(input.content)
    const blobName = auditContentAddress(input.kind, contentHash)
    const blob = this.container.getBlockBlobClient(blobName)
    let retainUntil = input.retainUntil
    let versionId: string | undefined
    let outcome: ImmutableAuditBlob['outcome'] = 'CREATED'

    try {
      const response = await blob.uploadData(input.content, {
        conditions: { ifNoneMatch: '*' },
        metadata: {
          sha256: contentHash,
          byteLength: String(input.content.byteLength),
        },
        blobHTTPHeaders: { blobContentType: input.contentType },
      })
      versionId = response.versionId
    } catch (error) {
      if (!statusCodeIs(error, 409, 412)) {
        throw error
      }
      outcome = 'IDENTICAL_REPLAY'
      const properties = await blob.getProperties()
      const existing = await blob.downloadToBuffer()
      if (
        sha256Hex(existing) !== contentHash ||
        properties.metadata?.sha256 !== contentHash ||
        properties.metadata?.byteLength !== String(input.content.byteLength) ||
        properties.contentType !== input.contentType
      ) {
        throw new AuditBlobConflictError(blobName)
      }
      versionId = properties.versionId
      const existingExpiry = properties.immutabilityPolicyExpiresOn
      const existingLocked = properties.immutabilityPolicyMode === 'Locked'
      if (
        existingLocked &&
        existingExpiry !== undefined &&
        existingExpiry.getTime() >= retainUntil.getTime()
      ) {
        return {
          blobName,
          contentHash,
          byteLength: input.content.byteLength,
          versionId: requireVersionId(versionId, blobName),
          retainUntil: existingExpiry,
          outcome,
        }
      }
      if (
        existingExpiry !== undefined &&
        existingExpiry.getTime() > retainUntil.getTime()
      ) {
        retainUntil = existingExpiry
      }
    }

    const requiredVersionId = requireVersionId(versionId, blobName)
    await blob.withVersion(requiredVersionId).setImmutabilityPolicy({
      expiriesOn: retainUntil,
      policyMode: 'Locked',
    })
    return {
      blobName,
      contentHash,
      byteLength: input.content.byteLength,
      versionId: requiredVersionId,
      retainUntil,
      outcome,
    }
  }
}

function requireVersionId(
  versionId: string | undefined,
  blobName: string
): string {
  if (versionId === undefined || versionId === '') {
    throw new Error(`Audit blob ${blobName} has no version identity`)
  }
  return versionId
}
