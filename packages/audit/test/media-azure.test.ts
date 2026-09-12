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
  renewActiveAssessmentMediaPolicies,
  sha256Hex,
} from '../src/index.js'

type StoredMedia = {
  content: Buffer
  metadata: Record<string, string>
  contentType: string
  versionId: string
  expiresOn?: Date
  policyMode?: 'locked' | 'Locked' | 'unlocked'
}

class MemoryMediaContainer {
  stored = new Map<string, StoredMedia>()
  policyCalls: string[] = []
  versionReads: string[] = []
  persistPolicy = true

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
          metadata: Object.fromEntries(
            Object.entries(options.metadata).map(([key, value]) => [
              key.toLowerCase(),
              value,
            ])
          ),
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
      withVersion(versionId: string) {
        return {
          async setImmutabilityPolicy(policy: { expiriesOn?: Date }) {
            const stored = container.stored.get(name)!
            container.policyCalls.push(versionId)
            if (container.persistPolicy) {
              stored.expiresOn = policy.expiriesOn
              stored.policyMode = 'locked'
            }
            return {}
          },
          async getProperties() {
            container.versionReads.push(versionId)
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
  it.each([
    false,
    true,
  ])('preserves the longest horizon for shared media (active first: %s)', async (activeFirst) => {
    const container = new MemoryMediaContainer()
    const now = new Date('2026-09-10T00:00:00.000Z')
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient,
      () => now
    )
    const input = await mediaFixture(Buffer.from('shared assessment media'))
    input.retainUntil = new Date('2027-03-01T00:00:00.000Z')
    await store.createFromFile(input)
    const active = { blobName: input.blobName, contentHash: input.contentHash }
    const completed = { ...active, retainUntil: input.retainUntil }
    async function* references() {
      yield* activeFirst ? [active, completed] : [completed, active]
    }

    const summary = await renewActiveAssessmentMediaPolicies({
      references: references(),
      store,
      now,
    })

    expect(summary).toMatchObject({
      inspected: 2,
      extended: 1,
      alreadySufficient: 1,
    })
    expect(container.stored.get(input.blobName)?.expiresOn).toEqual(
      new Date('2027-10-01T00:00:00.000Z')
    )
  })

  it('creates, locks, verifies, and identically replays media', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('synthetic image bytes'))

    const created = await store.createFromFile(input)
    const replay = await store.createFromFile(input)

    expect(container.policyCalls).toEqual(['version-1'])
    expect(container.versionReads).toEqual(['version-1', 'version-1'])
    expect(container.stored.get(input.blobName)?.metadata).toEqual({
      sha256: input.contentHash,
      bytelength: String(input.byteLength),
    })
    expect(created.outcome).toBe('CREATED')
    expect(replay.outcome).toBe('IDENTICAL_REPLAY')
    expect(container.stored.get(input.blobName)?.policyMode).toBe('locked')
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

  it.each([
    'byteLength',
    'BYTELENGTH',
  ])('replays existing %s metadata without rewriting it', async (lengthKey) => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('metadata regression'))
    const first = await store.createFromFile(input)
    const stored = container.stored.get(first.blobName)!
    const metadata = {
      SHA256: first.contentHash,
      [lengthKey]: String(first.byteLength),
    }
    stored.metadata = metadata
    await expect(store.createFromFile(input)).resolves.toMatchObject({
      outcome: 'IDENTICAL_REPLAY',
    })
    expect(stored.metadata).toBe(metadata)
    expect(container.policyCalls).toHaveLength(1)
  })

  it.each([
    'missing length',
    'wrong length',
    'missing hash',
    'wrong hash',
    'conflicting length alias',
    'conflicting hash alias',
    'wrong MIME',
  ])('rejects %s before changing retention', async (conflict) => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('metadata regression'))
    const first = await store.createFromFile(input)
    const stored = container.stored.get(first.blobName)!
    if (conflict === 'missing length') delete stored.metadata.bytelength
    if (conflict === 'wrong length') stored.metadata.bytelength = '999'
    if (conflict === 'missing hash') delete stored.metadata.sha256
    if (conflict === 'wrong hash') stored.metadata.sha256 = 'wrong'
    if (conflict === 'conflicting length alias')
      stored.metadata.byteLength = '999'
    if (conflict === 'conflicting hash alias') stored.metadata.SHA256 = 'wrong'
    if (conflict === 'wrong MIME') stored.contentType = 'text/plain'
    await expect(store.createFromFile(input)).rejects.toBeInstanceOf(
      AuditMediaConflictError
    )
    expect(container.policyCalls).toHaveLength(1)
  })

  it('rejects a lock that was not persisted on the returned version', async () => {
    const container = new MemoryMediaContainer()
    container.persistPolicy = false
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('unlocked media'))
    await expect(store.createFromFile(input)).rejects.toThrow(
      'was not durably locked'
    )
    expect(container.policyCalls).toEqual(['version-1'])
    expect(container.versionReads).toEqual(['version-1'])
  })

  it('locks an existing lowercase copy left by a failed activation', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('metadata regression'))
    const first = await store.createFromFile(input)
    const stored = container.stored.get(first.blobName)!
    stored.policyMode = undefined
    stored.expiresOn = undefined
    await expect(store.createFromFile(input)).resolves.toMatchObject({
      outcome: 'IDENTICAL_REPLAY',
    })
    expect(container.policyCalls).toEqual(['version-1', 'version-1'])
    expect(stored.policyMode).toBe('locked')
  })

  it('validates case-insensitive hashes during retention renewal', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('metadata regression'))
    const first = await store.createFromFile(input)
    const stored = container.stored.get(first.blobName)!
    stored.metadata = {
      SHA256: first.contentHash,
      byteLength: String(first.byteLength),
    }
    const renewal = {
      blobName: first.blobName,
      contentHash: first.contentHash,
      retainUntil: new Date('2031-01-01T00:00:00.000Z'),
    }
    await expect(store.extendRetention(renewal)).resolves.toMatchObject({
      outcome: 'EXTENDED',
    })
    stored.metadata.sha256 = 'wrong'
    await expect(store.extendRetention(renewal)).rejects.toBeInstanceOf(
      AuditMediaConflictError
    )
    expect(container.policyCalls).toHaveLength(2)
  })
  it.each([
    'locked',
    'Locked',
  ] as const)('accepts a sufficient %s policy without another write', async (policyMode) => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('policy case compatibility'))
    await store.createFromFile(input)
    container.stored.get(input.blobName)!.policyMode = policyMode
    await expect(store.createFromFile(input)).resolves.toMatchObject({
      outcome: 'IDENTICAL_REPLAY',
    })
    await expect(store.extendRetention(input)).resolves.toMatchObject({
      outcome: 'ALREADY_SUFFICIENT',
    })
    expect(container.policyCalls).toHaveLength(1)
  })

  it('rejects an unlocked policy during verification and renewal', async () => {
    const container = new MemoryMediaContainer()
    const store = new AzureImmutableAuditMediaStore(
      container as unknown as ContainerClient
    )
    const input = await mediaFixture(Buffer.from('unlocked policy'))
    await store.createFromFile(input)
    container.stored.get(input.blobName)!.policyMode = 'unlocked'
    container.persistPolicy = false
    await expect(store.createFromFile(input)).rejects.toThrow(
      'was not durably locked'
    )
    await expect(store.extendRetention(input)).rejects.toBeInstanceOf(
      AuditMediaConflictError
    )
  })
})
