import type { ContainerClient } from '@azure/storage-blob'
import {
  AuditBlobConflictError,
  AzureImmutableAuditBlobStore,
  auditContentAddress,
} from '../src/index.js'

type StoredBlob = {
  content: Buffer
  metadata: Record<string, string>
  contentType: string
  versionId: string
  expiresOn?: Date
  policyMode?: 'Locked'
}

class MemoryContainer {
  stored = new Map<string, StoredBlob>()
  policyCalls: Array<{ name: string; versionId: string; expiresOn: Date }> = []

  getBlockBlobClient(name: string) {
    const container = this
    return {
      async uploadData(
        content: Uint8Array,
        options: {
          metadata: Record<string, string>
          conditions: { ifNoneMatch: string }
          blobHTTPHeaders: { blobContentType: string }
        }
      ) {
        if (container.stored.has(name)) {
          throw Object.assign(new Error('BlobAlreadyExists'), {
            statusCode: 409,
          })
        }
        container.stored.set(name, {
          content: Buffer.from(content),
          metadata: options.metadata,
          contentType: options.blobHTTPHeaders.blobContentType,
          versionId: 'version-1',
        })
        return { versionId: 'version-1' }
      },
      async getProperties() {
        const stored = container.stored.get(name)!
        return {
          metadata: stored.metadata,
          contentType: stored.contentType,
          versionId: stored.versionId,
          immutabilityPolicyExpiresOn: stored.expiresOn,
          immutabilityPolicyMode: stored.policyMode,
        }
      },
      async downloadToBuffer() {
        return Buffer.from(container.stored.get(name)!.content)
      },
      withVersion(versionId: string) {
        return {
          async setImmutabilityPolicy(policy: {
            expiriesOn?: Date
            policyMode?: string
          }) {
            const stored = container.stored.get(name)!
            stored.expiresOn = policy.expiriesOn
            stored.policyMode = 'Locked'
            container.policyCalls.push({
              name,
              versionId,
              expiresOn: policy.expiriesOn!,
            })
            return {}
          },
        }
      },
    }
  }
}

function storeFixture() {
  const container = new MemoryContainer()
  const store = new AzureImmutableAuditBlobStore(
    container as unknown as ContainerClient,
    () => new Date('2026-08-11T08:00:00.000Z')
  )
  return { container, store }
}

describe('immutable audit blob store', () => {
  it('uses a deterministic content address and locks the created version', async () => {
    const { container, store } = storeFixture()
    const retainUntil = new Date('2030-10-01T00:00:00.000Z')

    const result = await store.create({
      kind: 'manifest',
      content: Buffer.from('synthetic media'),
      contentType: 'text/plain',
      retainUntil,
    })

    expect(result.outcome).toBe('CREATED')
    expect(result.blobName).toBe(
      auditContentAddress('manifest', result.contentHash)
    )
    expect(container.policyCalls).toEqual([
      { name: result.blobName, versionId: 'version-1', expiresOn: retainUntil },
    ])
  })

  it('accepts an identical replay and extends but never shortens retention', async () => {
    const { container, store } = storeFixture()
    const first = await store.create({
      kind: 'manifest',
      content: Buffer.from('synthetic manifest'),
      contentType: 'application/json',
      retainUntil: new Date('2030-03-01T00:00:00.000Z'),
    })
    const replay = await store.create({
      kind: 'manifest',
      content: Buffer.from('synthetic manifest'),
      contentType: 'application/json',
      retainUntil: new Date('2030-10-01T00:00:00.000Z'),
    })

    expect(replay.outcome).toBe('IDENTICAL_REPLAY')
    expect(replay.retainUntil.toISOString()).toBe('2030-10-01T00:00:00.000Z')
    expect(container.policyCalls).toHaveLength(2)
    expect(first.blobName).toBe(replay.blobName)
  })

  it('raises an integrity conflict when a content-addressed blob differs', async () => {
    const { container, store } = storeFixture()
    const content = Buffer.from('expected')
    const first = await store.create({
      kind: 'manifest',
      content,
      contentType: 'text/plain',
      retainUntil: new Date('2030-03-01T00:00:00.000Z'),
    })
    container.stored.get(first.blobName)!.content = Buffer.from('tampered')

    await expect(
      store.create({
        kind: 'manifest',
        content,
        contentType: 'text/plain',
        retainUntil: new Date('2030-03-01T00:00:00.000Z'),
      })
    ).rejects.toBeInstanceOf(AuditBlobConflictError)
  })

  it('raises an integrity conflict when replay metadata differs', async () => {
    const { store } = storeFixture()
    const content = Buffer.from('synthetic manifest')
    await store.create({
      kind: 'manifest',
      content,
      contentType: 'application/json',
      retainUntil: new Date('2030-03-01T00:00:00.000Z'),
    })

    await expect(
      store.create({
        kind: 'manifest',
        content,
        contentType: 'text/plain',
        retainUntil: new Date('2030-03-01T00:00:00.000Z'),
      })
    ).rejects.toBeInstanceOf(AuditBlobConflictError)
  })
})
