import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ContainerClient } from '@azure/storage-blob'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AuditMediaConflictError,
  AzureImmutableAuditMediaStore,
  auditMediaContentAddress,
  sha256Hex,
} from '../src/index.js'

type StoredMedia = {
  content: Buffer
  metadata: Record<string, string>
  contentType: string
  versionId: string
  expiresOn?: Date
  policyMode?: 'Locked'
}

class MemoryMediaContainer {
  stored = new Map<string, StoredMedia>()

  getBlockBlobClient(name: string) {
    const container = this
    const client = {
      async uploadStream(
        stream: AsyncIterable<Uint8Array>,
        _bufferSize: number,
        _concurrency: number,
        options: {
          metadata: Record<string, string>
          blobHTTPHeaders: { blobContentType: string }
        }
      ) {
        if (container.stored.has(name)) {
          throw Object.assign(new Error('BlobAlreadyExists'), {
            statusCode: 409,
          })
        }
        const chunks: Buffer[] = []
        for await (const chunk of stream) chunks.push(Buffer.from(chunk))
        container.stored.set(name, {
          content: Buffer.concat(chunks),
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
          contentLength: stored.content.byteLength,
          versionId: stored.versionId,
          immutabilityPolicyExpiresOn: stored.expiresOn,
          immutabilityPolicyMode: stored.policyMode,
        }
      },
      async download() {
        return {
          readableStreamBody: Readable.from(
            container.stored.get(name)!.content
          ),
        }
      },
      withVersion() {
        return {
          async setImmutabilityPolicy(policy: { expiriesOn?: Date }) {
            const stored = container.stored.get(name)!
            stored.expiresOn = policy.expiriesOn
            stored.policyMode = 'Locked'
            return {}
          },
          async getProperties() {
            return client.getProperties()
          },
        }
      },
    }
    return client
  }
}

const tempDirectories: string[] = []

async function mediaFixture(content: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), 'audit-media-test-'))
  tempDirectories.push(directory)
  const filePath = join(directory, 'content')
  await writeFile(filePath, content)
  const contentHash = sha256Hex(content)
  return {
    filePath,
    blobName: auditMediaContentAddress(contentHash),
    contentHash,
    byteLength: content.byteLength,
    mimeType: 'image/png',
    retainUntil: new Date('2027-10-01T00:00:00.000Z'),
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('Azure immutable audit media store', () => {
  it('creates, locks, verifies, and identically replays media', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('synthetic image bytes'))

    const created = await store.createFromFile(input)
    const replay = await store.createFromFile(input)

    expect(created.outcome).toBe('CREATED')
    expect(replay.outcome).toBe('IDENTICAL_REPLAY')
    expect(container.stored.get(input.blobName)?.policyMode).toBe('Locked')
    expect(replay.retainUntil).toEqual(input.retainUntil)
  })

  it('rejects content that conflicts with its address', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('expected'))
    await store.createFromFile(input)
    container.stored.get(input.blobName)!.content = Buffer.from('tampered')

    await expect(store.createFromFile(input)).rejects.toBeInstanceOf(
      AuditMediaConflictError
    )
  })

  it('only extends locked media retention and never shortens it', async () => {
    const container = new MemoryMediaContainer()
    const now = new Date('2026-08-12T00:00:00.000Z')
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient,
      () => now
    )
    const input = await mediaFixture(Buffer.from('renewable media'))
    await store.createFromFile(input)
    const later = new Date('2028-03-01T00:00:00.000Z')

    expect(
      await store.extendRetention({
        blobName: input.blobName,
        contentHash: input.contentHash,
        retainUntil: later,
      })
    ).toMatchObject({ outcome: 'EXTENDED', retainUntil: later })
    expect(
      await store.extendRetention({
        blobName: input.blobName,
        contentHash: input.contentHash,
        retainUntil: input.retainUntil,
      })
    ).toMatchObject({ outcome: 'ALREADY_SUFFICIENT', retainUntil: later })
  })
})
