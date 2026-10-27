import type { ContainerClient } from '@azure/storage-blob'
import { canonicalizeJson } from '../src/canonical/canonicalize.js'
import { sha256Hex } from '../src/canonical/hash.js'
import {
  type AuditManifest,
  AzureAuditManifestStore,
} from '../src/sealing/manifest.js'

const quiz = '11111111-1111-4111-8111-111111111111'
const event = '22222222-2222-4222-8222-222222222222'
const fixedNow = () => new Date('2026-09-01T00:00:00.000Z')

function manifest(
  sequence = 1,
  previousManifestHash: string | null = null
): AuditManifest {
  return {
    format: 'KLICKER_ASSESSMENT_AUDIT_MANIFEST',
    formatVersion: 1,
    liveQuizId: quiz,
    lifecycleEpoch: 0,
    sequence,
    previousManifestHash,
    createdAt: '2026-09-01T00:00:00.000Z',
    retainUntil: '2030-01-01T00:00:00.000Z',
    events: [
      {
        eventId: event,
        eventHash: 'a'.repeat(64),
        canonicalHash: 'b'.repeat(64),
      },
    ],
  }
}

type BlobRecord = {
  bytes: Buffer
  metadata: Record<string, string>
  versionId: string
  contentType: string
  expiresOn?: Date
  mode?: string
}
class MemoryContainer {
  records = new Map<string, BlobRecord[]>()
  failReadback = false
  ignoreLock = false
  version = 0
  getBlockBlobClient(name: string) {
    const owner = this
    const lookup = (version?: string) => {
      const records = owner.records.get(name)!
      return version
        ? records.find((record) => record.versionId === version)!
        : records.at(-1)!
    }
    const client = (versionId?: string) => ({
      async uploadData(
        bytes: Uint8Array,
        options: {
          metadata: Record<string, string>
          blobHTTPHeaders: { blobContentType: string }
        }
      ) {
        if (owner.records.has(name))
          throw Object.assign(new Error('exists'), { statusCode: 409 })
        const version = `v${++owner.version}`
        owner.records.set(name, [
          {
            bytes: Buffer.from(bytes),
            metadata: options.metadata,
            versionId: version,
            contentType: options.blobHTTPHeaders.blobContentType,
          },
        ])
        return { versionId: version }
      },
      async getProperties() {
        const record = lookup(versionId)
        return {
          metadata: record.metadata,
          contentType: record.contentType,
          versionId: record.versionId,
          immutabilityPolicyExpiresOn: record.expiresOn,
          immutabilityPolicyMode: record.mode,
        }
      },
      async downloadToBuffer() {
        if (owner.failReadback) throw new Error('readback failed')
        return Buffer.from(lookup(versionId).bytes)
      },
      withVersion(version: string) {
        return client(version)
      },
      async setImmutabilityPolicy(policy: { expiriesOn: Date }) {
        if (owner.ignoreLock) return
        const record = lookup(versionId)
        record.expiresOn = policy.expiriesOn
        record.mode = 'Locked'
      },
    })
    return client()
  }
  async *listBlobsFlat({
    prefix,
    includeVersions,
  }: {
    prefix: string
    includeVersions?: boolean
  }) {
    for (const [name, records] of this.records)
      if (name.startsWith(prefix))
        for (const record of includeVersions ? records : records.slice(-1))
          yield { name, versionId: record.versionId }
  }
}

function fixture() {
  const container = new MemoryContainer()
  return {
    container,
    store: new AzureAuditManifestStore(
      container as unknown as ContainerClient,
      fixedNow
    ),
  }
}
function put(
  container: MemoryContainer,
  value: AuditManifest,
  versionId = 'crashed'
) {
  const name = `manifest/v1/${quiz}/0/${String(value.sequence).padStart(12, '0')}.json`
  const bytes = Buffer.from(canonicalizeJson(value))
  container.records.set(name, [
    {
      bytes,
      metadata: { sha256: sha256Hex(bytes), bytelength: String(bytes.length) },
      versionId,
      contentType: 'application/json',
    },
  ])
  return name
}

describe('AzureAuditManifestStore', () => {
  it('writes a deterministic canonical manifest, locks it, then validates readback', async () => {
    const { container, store } = fixture()
    const stored = await store.create(manifest())
    expect(stored.blobName).toBe(`manifest/v1/${quiz}/0/000000000001.json`)
    expect(container.records.get(stored.blobName)?.[0]?.mode).toBe('Locked')
    expect(stored.manifestHash).toBe(sha256Hex(canonicalizeJson(manifest())))
  })
  it('refuses success when the provider does not actually lock the version', async () => {
    const { container, store } = fixture()
    container.ignoreLock = true
    await expect(store.create(manifest())).rejects.toThrow('not locked')
  })
  it('fails if post-lock readback fails', async () => {
    const { container, store } = fixture()
    container.failReadback = true
    await expect(store.create(manifest())).rejects.toThrow('readback failed')
  })
  it('repairs a valid unlocked upload after a crash only through explicit recovery', async () => {
    const { container, store } = fixture()
    const name = put(container, manifest())
    await expect(store.list(quiz)).rejects.toThrow('not locked')
    await expect(
      store.list(quiz, { repairPending: true })
    ).resolves.toMatchObject([{ versionId: 'crashed' }])
    expect(container.records.get(name)?.[0]?.mode).toBe('Locked')
  })
  it('returns the concurrent winner after validating its own batch', async () => {
    const { store } = fixture()
    const winner = manifest()
    const other = {
      ...manifest(),
      events: [{ ...manifest().events[0]!, eventHash: 'c'.repeat(64) }],
    }
    await store.create(winner)
    await expect(store.create(other)).resolves.toMatchObject({
      manifest: winner,
    })
  })
  it('rejects tampered bytes before locking a pending upload', async () => {
    const { container, store } = fixture()
    const name = put(container, manifest())
    container.records.get(name)![0]!.bytes = Buffer.from('{"tampered":true}')
    await expect(store.create(manifest())).rejects.toThrow('invalid')
    expect(container.records.get(name)?.[0]?.mode).toBeUndefined()
  })
  it('detects conflicting retained versions and chain gaps', async () => {
    const { container, store } = fixture()
    const first = await store.create(manifest())
    const name = first.blobName
    const conflict = manifest()
    conflict.events = [{ ...conflict.events[0]!, eventHash: 'c'.repeat(64) }]
    const bytes = Buffer.from(canonicalizeJson(conflict))
    container.records.get(name)!.push({
      bytes,
      metadata: {
        sha256: sha256Hex(bytes),
        bytelength: String(bytes.length),
      },
      versionId: 'old-conflict',
      contentType: 'application/json',
      expiresOn: new Date('2030-01-01T00:00:00.000Z'),
      mode: 'Locked',
    })
    await expect(store.list(quiz)).rejects.toThrow(
      'Conflicting manifest versions'
    )
    const clean = fixture()
    const prior = await clean.store.create(manifest())
    await clean.store.create(manifest(3, prior.manifestHash))
    await expect(clean.store.list(quiz)).rejects.toThrow('broken')
  })
  it('extends a locked policy only on the explicit recovery path and never repairs an expired one', async () => {
    const { container, store } = fixture()
    const name = put(container, manifest())
    const record = container.records.get(name)![0]!
    record.mode = 'Locked'
    record.expiresOn = new Date('2029-01-01T00:00:00.000Z')
    await store.list(quiz, {
      repairPending: true,
      minimumRetainUntil: new Date('2031-01-01T00:00:00.000Z'),
    })
    expect(record.expiresOn?.toISOString()).toBe('2031-01-01T00:00:00.000Z')
    record.expiresOn = new Date('2020-01-01T00:00:00.000Z')
    await expect(store.list(quiz, { repairPending: true })).rejects.toThrow(
      'expired retention'
    )
  })
})
