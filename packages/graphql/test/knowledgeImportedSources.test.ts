import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  IMPORTED_KB_SOURCES_MANIFEST_VERSION,
  registerImportedKbSources,
  validateImportedKbSourcesManifest,
} from '../src/services/knowledgeImportedSources.js'

const KB_ID = '11111111-1111-4111-8111-111111111111'
const OWNER_ID = '22222222-2222-4222-8222-222222222222'

function source(overrides: Record<string, unknown> = {}) {
  return {
    sourceIdentityField: 'source_id',
    sourceIdentityValue: 'src-1',
    title: 'Synthetic source',
    kind: 'DOCUMENT',
    observedAt: '2026-09-12T08:00:00.000Z',
    ...overrides,
  }
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    version: IMPORTED_KB_SOURCES_MANIFEST_VERSION,
    kbId: KB_ID,
    expectedOwnerId: OWNER_ID,
    databaseName: 'klicker-kb',
    collectionName: 'course-1',
    sources: [source()],
    ...overrides,
  }
}

function expectValid(input: unknown) {
  const validation = validateImportedKbSourcesManifest(input)
  expect(validation.ok).toBe(true)
  if (!validation.ok) throw new Error(`invalid: ${validation.errorCode}`)
  return validation
}

function expectErrorCode(input: unknown, errorCode: string) {
  expect(validateImportedKbSourcesManifest(input)).toEqual({
    ok: false,
    errorCode,
  })
}

describe('imported KB sources offline validation', () => {
  it('accepts a bounded, versioned manifest and returns a sha256 fingerprint', () => {
    const validation = expectValid(manifest())
    expect(validation.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(validation.manifest.sources).toHaveLength(1)
  })

  it('rejects a manifest that omits the required observation time', () => {
    const { observedAt, ...withoutObservedAt } = source()
    void observedAt
    expectErrorCode(
      manifest({ sources: [withoutObservedAt] }),
      'MANIFEST_INVALID'
    )
  })

  it('rejects raw transcript and video fields on the manifest or its sources', () => {
    expectErrorCode(
      manifest({ sources: [source({ transcript: 'raw transcript body' })] }),
      'MANIFEST_INVALID'
    )
    expectErrorCode(
      manifest({
        sources: [source({ videoUrl: 'https://example.org/v.mp4' })],
      }),
      'MANIFEST_INVALID'
    )
    expectErrorCode(
      manifest({ videoBlob: 'kb-import/segment.mp4' }),
      'MANIFEST_INVALID'
    )
  })

  it('rejects an unsupported manifest version', () => {
    expectErrorCode(
      { ...manifest(), version: 2 },
      'MANIFEST_VERSION_UNSUPPORTED'
    )
  })

  it('rejects an empty source list and malformed coordinates', () => {
    expectErrorCode(manifest({ sources: [] }), 'MANIFEST_INVALID')
    expectErrorCode(manifest({ kbId: 'not-a-uuid' }), 'MANIFEST_INVALID')
    expectErrorCode(
      manifest({ sources: [source({ sourceIdentityField: 'chunk_id' })] }),
      'MANIFEST_INVALID'
    )
  })

  it.each([
    ['https://example.org/doc?token=secret'],
    ['https://example.org/doc#section'],
    ['https://user:pass@example.org/doc'],
    ['ftp://example.org/doc'],
  ])('rejects an unsafe original URL: %s', (sourceUrl) => {
    expectErrorCode(
      manifest({ sources: [source({ sourceUrl })] }),
      'SOURCE_URL_UNSAFE'
    )
  })

  it('accepts a plain http(s) original URL and normalizes it', () => {
    const validation = expectValid(
      manifest({ sources: [source({ sourceUrl: 'https://example.org/doc' })] })
    )
    expect(validation.manifest.sources[0]!.sourceUrl).toBe(
      'https://example.org/doc'
    )
  })

  it('rejects a repeated identity within one manifest', () => {
    expectErrorCode(
      manifest({ sources: [source(), source({ title: 'Other' })] }),
      'DUPLICATE_SOURCE_IDENTITY'
    )
  })

  it('produces the same fingerprint regardless of source order', () => {
    const forward = expectValid(
      manifest({
        sources: [
          source({ sourceIdentityValue: 'src-a' }),
          source({
            sourceIdentityField: 'video_source_id',
            sourceIdentityValue: 'vid-b',
            kind: 'VIDEO',
          }),
        ],
      })
    )
    const reversed = expectValid(
      manifest({
        sources: [
          source({
            sourceIdentityField: 'video_source_id',
            sourceIdentityValue: 'vid-b',
            kind: 'VIDEO',
          }),
          source({ sourceIdentityValue: 'src-a' }),
        ],
      })
    )
    expect(reversed.fingerprint).toBe(forward.fingerprint)
  })

  it('normalizes equivalent timestamps to the same fingerprint', () => {
    const utc = expectValid(manifest())
    const offset = expectValid(
      manifest({
        sources: [
          source({
            ingestedAt: '2026-09-11T22:00:00+02:00',
            observedAt: '2026-09-12T10:00:00+02:00',
          }),
        ],
      })
    )
    const utcEquivalent = expectValid(
      manifest({
        sources: [
          source({
            ingestedAt: '2026-09-11T20:00:00.000Z',
            observedAt: '2026-09-12T08:00:00.000Z',
          }),
        ],
      })
    )
    expect(offset.fingerprint).toBe(utcEquivalent.fingerprint)
    expect(utc.fingerprint).not.toBe(offset.fingerprint)
  })

  it('treats omitted and explicit null optional fields the same', () => {
    const omitted = expectValid(manifest())
    const explicitNull = expectValid(
      manifest({
        sources: [
          source({ projectId: null, producerId: null, sourceUrl: null }),
        ],
      })
    )
    expect(explicitNull.fingerprint).toBe(omitted.fingerprint)
  })

  it('changes the fingerprint when immutable metadata changes', () => {
    const original = expectValid(manifest())
    const changed = expectValid(
      manifest({ sources: [source({ title: 'Changed title' })] })
    )
    expect(changed.fingerprint).not.toBe(original.fingerprint)
  })

  it('rejects an unreviewed fingerprint before touching the database', async () => {
    const unusedPrisma = {
      $transaction: () => {
        throw new Error('database must not be used for a fingerprint mismatch')
      },
    } as unknown as PrismaClient

    const result = await registerImportedKbSources({
      prisma: unusedPrisma,
      input: manifest(),
      reviewedFingerprint: 'f'.repeat(64),
    })
    expect(result).toEqual({ ok: false, errorCode: 'FINGERPRINT_MISMATCH' })
  })
})

describe('imported KB sources disposable database registration', () => {
  let prisma: PrismaClient
  let createdOwnerIds: string[] = []

  beforeAll(async () => {
    prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
  })

  afterEach(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.kBImportedSource.deleteMany({
      where: { kb: { ownerId: { in: createdOwnerIds } } },
    })
    await prisma.kB.deleteMany({ where: { ownerId: { in: createdOwnerIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdOwnerIds } } })
    createdOwnerIds = []
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  async function createOwnerWithKb() {
    const ownerId = randomUUID()
    const kbId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `imported-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Synthetic imported-source KB' },
    })
    createdOwnerIds.push(ownerId)
    return { ownerId, kbId }
  }

  async function apply(input: unknown) {
    const validation = expectValid(input)
    return registerImportedKbSources({
      prisma,
      input,
      reviewedFingerprint: validation.fingerprint,
    })
  }

  it('inserts missing sources and treats an exact replay as a no-op', async () => {
    const { ownerId, kbId } = await createOwnerWithKb()
    const input = manifest({
      kbId,
      expectedOwnerId: ownerId,
      sources: [
        source({ sourceIdentityValue: 'src-a' }),
        source({
          sourceIdentityField: 'video_source_id',
          sourceIdentityValue: 'vid-b',
          kind: 'VIDEO',
          title: 'Synthetic video source',
        }),
      ],
    })

    expect(await apply(input)).toMatchObject({
      ok: true,
      status: 'applied',
      insertedCount: 2,
      existingCount: 0,
    })

    const before = await prisma.kBImportedSource.findMany({
      where: { kbId },
      select: { id: true, createdAt: true },
      orderBy: { id: 'asc' },
    })

    expect(await apply(input)).toMatchObject({
      ok: true,
      status: 'noop',
      insertedCount: 0,
      existingCount: 2,
    })

    const after = await prisma.kBImportedSource.findMany({
      where: { kbId },
      select: { id: true, createdAt: true },
      orderBy: { id: 'asc' },
    })
    expect(after).toEqual(before)
    expect(await prisma.kBImportedSource.count({ where: { kbId } })).toBe(2)
  })

  it('rejects conflicting metadata atomically without partial inserts', async () => {
    const { ownerId, kbId } = await createOwnerWithKb()
    await apply(
      manifest({
        kbId,
        expectedOwnerId: ownerId,
        sources: [
          source({
            sourceIdentityValue: 'zzz-existing',
            title: 'Original title',
          }),
        ],
      })
    )

    // The new source sorts first, so a partially applied insertion would be
    // visible if the conflict did not roll the whole manifest back.
    const conflicted = await apply(
      manifest({
        kbId,
        expectedOwnerId: ownerId,
        sources: [
          source({ sourceIdentityValue: 'aaa-new', title: 'New source' }),
          source({
            sourceIdentityValue: 'zzz-existing',
            title: 'Changed title',
          }),
        ],
      })
    )
    expect(conflicted).toEqual({
      ok: false,
      errorCode: 'SOURCE_METADATA_CONFLICT',
    })

    const rows = await prisma.kBImportedSource.findMany({
      where: { kbId },
      select: { sourceIdentityValue: true, title: true },
    })
    expect(rows).toEqual([
      { sourceIdentityValue: 'zzz-existing', title: 'Original title' },
    ])
  })

  it('converges when the same manifest is applied concurrently', async () => {
    const { ownerId, kbId } = await createOwnerWithKb()
    const input = manifest({
      kbId,
      expectedOwnerId: ownerId,
      sources: [
        source({ sourceIdentityValue: 'src-a' }),
        source({ sourceIdentityValue: 'src-b' }),
        source({ sourceIdentityValue: 'src-c' }),
      ],
    })

    const [first, second] = await Promise.all([apply(input), apply(input)])
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)

    const insertedCounts = [first, second].map((result) =>
      result.ok ? result.insertedCount : -1
    )
    const existingCounts = [first, second].map((result) =>
      result.ok ? result.existingCount : -1
    )
    expect(insertedCounts.reduce((sum, count) => sum + count, 0)).toBe(3)
    expect(existingCounts.reduce((sum, count) => sum + count, 0)).toBe(3)
    expect(insertedCounts.filter((count) => count === 0)).toHaveLength(1)
    expect(await prisma.kBImportedSource.count({ where: { kbId } })).toBe(3)
  })

  it('rejects a mismatched expected owner without inserting rows', async () => {
    const { kbId } = await createOwnerWithKb()
    const result = await apply(
      manifest({ kbId, expectedOwnerId: randomUUID() })
    )
    expect(result).toEqual({ ok: false, errorCode: 'KB_NOT_FOUND' })
    expect(await prisma.kBImportedSource.count({ where: { kbId } })).toBe(0)
  })

  it('rejects a soft-deleted knowledge base', async () => {
    const { ownerId, kbId } = await createOwnerWithKb()
    await prisma.kB.update({
      where: { id: kbId },
      data: { deletedAt: new Date() },
    })
    const result = await apply(manifest({ kbId, expectedOwnerId: ownerId }))
    expect(result).toEqual({ ok: false, errorCode: 'KB_DELETED' })
    expect(await prisma.kBImportedSource.count({ where: { kbId } })).toBe(0)
  })

  it('rejects an invalid manifest without contacting the database', async () => {
    const result = await registerImportedKbSources({
      prisma,
      input: { version: IMPORTED_KB_SOURCES_MANIFEST_VERSION },
      reviewedFingerprint: 'a'.repeat(64),
    })
    expect(result).toEqual({ ok: false, errorCode: 'MANIFEST_INVALID' })
  })
})
