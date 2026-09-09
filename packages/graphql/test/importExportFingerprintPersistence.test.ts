import { prisma } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  backfillFingerprintBatch,
  repairStaleImportExportFingerprints,
} from '../src/services/importExportFingerprintMaintenance.js'
import {
  computeAnswerCollectionDidacticFingerprintFromDb as computeAnswerCollectionDidacticFingerprintFromDbV1,
  computeElementDidacticFingerprintFromDb as computeElementDidacticFingerprintFromDbV1,
  persistAnswerCollectionDidacticFingerprintSnapshot,
  persistElementDidacticFingerprintSnapshot,
  refreshAnswerCollectionDidacticFingerprint as refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprint as refreshElementDidacticFingerprintV1,
  refreshLinkedElementDidacticFingerprintPages,
} from '../src/services/importExportFingerprintPersistence.js'
import { invalidateElementFingerprintsForFinalizedMediaV1 } from '../src/services/importExportFingerprints.js'

const TEST_RUN_ID = randomUUID()
const TEST_EMAIL_PREFIX = `fingerprint-v1-${TEST_RUN_ID}`
const HASH_A = 'a'.repeat(64)
const LEGACY_FINGERPRINT = 'c'.repeat(64)
const OTHER_FINGERPRINT = 'd'.repeat(64)
const PREVIOUS_STORAGE_ACCOUNT = process.env.BLOB_STORAGE_ACCOUNT_NAME

let testSequence = 0
let ownerId: string

async function createTestOwner() {
  testSequence += 1
  const owner = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}-${testSequence}@example.invalid`,
      shortname: `fpv1-${testSequence}-${TEST_RUN_ID.slice(0, 6)}`,
    },
  })
  ownerId = owner.id
}

async function cleanupTestOwners() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  })
}

async function createAnswerCollection({
  importFingerprint,
  importFingerprintVersion,
}: {
  importFingerprint?: string | null
  importFingerprintVersion?: number | null
} = {}) {
  return await prisma.answerCollection.create({
    data: {
      name: `Collection ${testSequence}`,
      description: 'Excluded collection metadata',
      ownerId,
      importFingerprint,
      importFingerprintVersion,
      entries: {
        create: [{ value: 'Alpha' }, { value: 'Beta' }],
      },
    },
    include: { entries: { orderBy: { value: 'asc' } } },
  })
}

async function createContentElement({
  content = 'Authored content',
  importFingerprint,
  importFingerprintVersion,
}: {
  content?: string
  importFingerprint?: string | null
  importFingerprintVersion?: number | null
} = {}) {
  return await prisma.element.create({
    data: {
      type: ElementType.CONTENT,
      name: `Content ${testSequence}`,
      content,
      options: {},
      basePoints: false,
      pointsMultiplier: 1,
      ownerId,
      importFingerprint,
      importFingerprintVersion,
    },
  })
}

async function createSelectionElement({
  collectionId,
  selectedEntryId,
  content = 'Select one',
  importFingerprint,
  importFingerprintVersion,
}: {
  collectionId: number
  selectedEntryId: number
  content?: string
  importFingerprint?: string | null
  importFingerprintVersion?: number | null
}) {
  return await prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name: `Selection ${testSequence}`,
      content,
      explanation: 'Choose the matching value.',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
      basePoints: true,
      pointsMultiplier: 2,
      ownerId,
      answerCollectionId: collectionId,
      answerCollectionItems: { connect: { id: selectedEntryId } },
      importFingerprint,
      importFingerprintVersion,
    },
  })
}

describe('DB-only didactic fingerprint persistence', () => {
  beforeAll(() => {
    process.env.BLOB_STORAGE_ACCOUNT_NAME = 'testaccount'
  })

  beforeEach(async () => {
    await createTestOwner()
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await cleanupTestOwners()
    if (typeof PREVIOUS_STORAGE_ACCOUNT === 'undefined') {
      delete process.env.BLOB_STORAGE_ACCOUNT_NAME
    } else {
      process.env.BLOB_STORAGE_ACCOUNT_NAME = PREVIOUS_STORAGE_ACCOUNT
    }
  })

  it('matches the equivalent package fingerprint using DB pool and selected values', async () => {
    const storedHref = `https://testaccount.blob.core.windows.net/${ownerId}/stored.png`
    const authoredHref = `${storedHref}?download=1`
    const packageHref = 'klicker-package-media://package-image'
    const collection = await createAnswerCollection()
    const selectedEntry = collection.entries.find(
      (entry) => entry.value === 'Alpha'
    )!
    const element = await createSelectionElement({
      collectionId: collection.id,
      selectedEntryId: selectedEntry.id,
      content: `Select one ![diagram](<${authoredHref}>)`,
    })
    await prisma.mediaFile.create({
      data: {
        ownerId,
        href: storedHref,
        name: 'stored-name.png',
        type: 'image/png',
        contentHash: HASH_A,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })

    const dbSnapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    const packageFingerprint = computeElementDidacticFingerprint({
      type: ElementType.SELECTION,
      content: `Select one ![diagram](<${packageHref}>)`,
      explanation: 'Choose the matching value.',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
      basePoints: true,
      pointsMultiplier: 2,
      answerPoolValues: ['Beta', 'Alpha'],
      selectedAnswerValues: ['Alpha'],
      media: {
        verifiedByHref: new Map([[packageHref, { sha256: HASH_A }]]),
      },
    })

    expect(dbSnapshot).toMatchObject({
      elementVersion: element.version,
      answerCollection: {
        id: collection.id,
        version: collection.version,
      },
    })
    expect(dbSnapshot?.computed).toEqual(packageFingerprint)
  })

  it('bulk-persists linked fingerprints across nullable and unchanged prior states', async () => {
    const collection = await createAnswerCollection()
    const selectedEntry = collection.entries[0]!
    const nullState = await createSelectionElement({
      collectionId: collection.id,
      selectedEntryId: selectedEntry.id,
      importFingerprint: null,
      importFingerprintVersion: null,
    })
    const legacyState = await createSelectionElement({
      collectionId: collection.id,
      selectedEntryId: selectedEntry.id,
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 7,
    })
    const unchangedState = await createSelectionElement({
      collectionId: collection.id,
      selectedEntryId: selectedEntry.id,
    })
    await refreshElementDidacticFingerprintV1(unchangedState.id, prisma)
    const unchangedBefore = await prisma.element.findUniqueOrThrow({
      where: { id: unchangedState.id },
      select: { updatedAt: true },
    })

    await expect(
      refreshLinkedElementDidacticFingerprintPages(collection.id, prisma)
    ).resolves.toEqual({ staleElementIds: [] })

    const persisted = await prisma.element.findMany({
      where: {
        id: { in: [nullState.id, legacyState.id, unchangedState.id] },
      },
      select: {
        id: true,
        importFingerprint: true,
        importFingerprintVersion: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    })
    expect(persisted).toHaveLength(3)
    for (const element of persisted) {
      expect(element).toMatchObject({
        importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      })
    }
    expect(
      persisted.find(({ id }) => id === unchangedState.id)?.updatedAt
    ).toEqual(unchangedBefore.updatedAt)
  })

  it('rollout-revisits a scheduled null fingerprint after media classification', async () => {
    const href = `https://testaccount.blob.core.windows.net/${ownerId}/unhashed.png`
    const mediaFile = await prisma.mediaFile.create({
      data: {
        ownerId,
        href,
        name: 'unhashed.png',
        type: 'image/png',
        contentHash: null,
      },
    })
    const element = await createContentElement({
      content: `![diagram](<${href}>)`,
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 99,
    })

    const unresolved = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    expect(unresolved?.computed.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 1,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    await expect(
      prisma.element.findUniqueOrThrow({
        where: { id: element.id },
        select: {
          importFingerprint: true,
          importFingerprintVersion: true,
          updatedAt: true,
        },
      })
    ).resolves.toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    const afterFirstRefresh = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { updatedAt: true },
    })
    await expect(
      refreshElementDidacticFingerprintV1(element.id, prisma)
    ).resolves.toMatchObject({
      status: 'unchanged',
      computed: {
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    })
    await expect(
      prisma.element.findUniqueOrThrow({
        where: { id: element.id },
        select: { updatedAt: true },
      })
    ).resolves.toEqual(afterFirstRefresh)

    await prisma.mediaFile.update({
      where: { id: mediaFile.id },
      data: {
        contentHash: HASH_A,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })
    await expect(
      backfillFingerprintBatch({ resource: 'ELEMENT' }, prisma)
    ).resolves.toEqual({ processed: 1, nextAfterId: undefined })
    await expect(
      prisma.element.findUniqueOrThrow({
        where: { id: element.id },
        select: {
          importFingerprint: true,
          importFingerprintVersion: true,
        },
      })
    ).resolves.toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })

    await prisma.mediaFile.delete({ where: { id: mediaFile.id } })
    const omitted = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    expect(omitted?.computed?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('matches package omission identity for media classified as unbundled', async () => {
    const storedHref = `https://testaccount.blob.core.windows.net/${ownerId}/unbundled.svg`
    await prisma.mediaFile.create({
      data: {
        ownerId,
        href: storedHref,
        name: 'unbundled.svg',
        type: 'image/svg+xml',
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })
    const element = await createContentElement({
      content: `![diagram](<${storedHref}>)`,
    })

    const dbSnapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    const packageFingerprint = computeElementDidacticFingerprint({
      type: ElementType.CONTENT,
      content: `![diagram](<${storedHref}>)`,
      explanation: null,
      options: {},
      basePoints: false,
      pointsMultiplier: 1,
    })

    expect(dbSnapshot?.computed).toEqual(packageFingerprint)
    expect(dbSnapshot?.computed?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('queries media only for auto-loading references and has no storage dependency', async () => {
    const href = `https://storage.invalid/${ownerId}/ordinary-link.png`
    await prisma.mediaFile.create({
      data: {
        ownerId,
        href,
        name: 'ordinary-link.png',
        type: 'image/png',
        contentHash: null,
      },
    })
    const element = await createContentElement({
      content: `[ordinary link](<${href}>)`,
    })

    const snapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    const source = await readFile(
      new URL(
        '../src/services/importExportFingerprintPersistence.ts',
        import.meta.url
      ),
      'utf8'
    )

    expect(snapshot?.computed?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(source).not.toMatch(/mediaStorage|@azure\/storage|downloadKlicker/i)
  })

  it('does not persist an element computation after the element version changes', async () => {
    const element = await createContentElement({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 7,
    })
    const snapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    expect(snapshot).not.toBeNull()

    await prisma.element.update({
      where: { id: element.id },
      data: { content: 'Newer authored content', version: { increment: 1 } },
    })
    const result = await persistElementDidacticFingerprintSnapshot(
      snapshot!,
      prisma
    )
    const persisted = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { importFingerprint: true, importFingerprintVersion: true },
    })

    expect(result.status).toBe('stale')
    expect(persisted).toEqual({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 7,
    })
  })

  it('invalidates a media-dependent fingerprint without changing authored revision metadata', async () => {
    const href = `https://testaccount.blob.core.windows.net/${ownerId}/pending-direct-upload.png`
    await prisma.mediaFile.create({
      data: {
        ownerId,
        href,
        name: 'pending-direct-upload.png',
        type: 'image/png',
        contentHash: null,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })
    const element = await createContentElement({
      content: `![pending upload](<${href}>)`,
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    const staleSnapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    expect(staleSnapshot?.computed).not.toBeNull()

    await expect(
      invalidateElementFingerprintsForFinalizedMediaV1({ href }, prisma)
    ).resolves.toEqual([{ id: element.id }])
    const firstInvalidation = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: {
        version: true,
        updatedAt: true,
        importFingerprint: true,
        importFingerprintVersion: true,
      },
    })
    expect(firstInvalidation).toEqual({
      version: element.version,
      updatedAt: element.updatedAt,
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: null,
    })
    await expect(
      invalidateElementFingerprintsForFinalizedMediaV1({ href }, prisma)
    ).resolves.toEqual([{ id: element.id }])
    const secondInvalidation = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: {
        version: true,
        updatedAt: true,
        importFingerprint: true,
        importFingerprintVersion: true,
      },
    })
    expect(secondInvalidation).toEqual({
      version: element.version,
      updatedAt: element.updatedAt,
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: null,
    })
    expect(secondInvalidation.importFingerprint).not.toBe(
      firstInvalidation.importFingerprint
    )
    await expect(
      persistElementDidacticFingerprintSnapshot(staleSnapshot!, prisma)
    ).resolves.toMatchObject({ status: 'stale' })
  })

  it('does not persist element or collection snapshots after a collection edit', async () => {
    const collection = await createAnswerCollection({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 8,
    })
    const element = await createSelectionElement({
      collectionId: collection.id,
      selectedEntryId: collection.entries[0]!.id,
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 8,
    })
    const elementSnapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    const collectionSnapshot =
      await computeAnswerCollectionDidacticFingerprintFromDbV1(
        collection.id,
        prisma
      )
    expect(elementSnapshot).not.toBeNull()
    expect(collectionSnapshot).not.toBeNull()

    await prisma.$transaction([
      prisma.answerCollectionEntry.update({
        where: { id: collection.entries[0]!.id },
        data: { value: 'Newer pool value' },
      }),
      prisma.answerCollection.update({
        where: { id: collection.id },
        data: { version: { increment: 1 } },
      }),
    ])
    const [elementResult, collectionResult] = await Promise.all([
      persistElementDidacticFingerprintSnapshot(elementSnapshot!, prisma),
      persistAnswerCollectionDidacticFingerprintSnapshot(
        collectionSnapshot!,
        prisma
      ),
    ])

    expect(elementResult.status).toBe('stale')
    expect(collectionResult.status).toBe('stale')
  })

  it('does not overwrite fingerprint state written after a snapshot', async () => {
    const element = await createContentElement({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 7,
    })
    const snapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    expect(snapshot).not.toBeNull()

    await prisma.element.update({
      where: { id: element.id },
      data: {
        importFingerprint: OTHER_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      },
    })
    const result = await persistElementDidacticFingerprintSnapshot(
      snapshot!,
      prisma
    )
    const persisted = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { importFingerprint: true, importFingerprintVersion: true },
    })

    expect(result.status).toBe('stale')
    expect(persisted).toEqual({
      importFingerprint: OTHER_FINGERPRINT,
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
  })

  it('does not overwrite collection fingerprint state written after a snapshot', async () => {
    const collection = await createAnswerCollection({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 7,
    })
    const snapshot = await computeAnswerCollectionDidacticFingerprintFromDbV1(
      collection.id,
      prisma
    )
    expect(snapshot).not.toBeNull()

    await prisma.answerCollection.update({
      where: { id: collection.id },
      data: {
        importFingerprint: OTHER_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
      },
    })
    const result = await persistAnswerCollectionDidacticFingerprintSnapshot(
      snapshot!,
      prisma
    )
    const persisted = await prisma.answerCollection.findUniqueOrThrow({
      where: { id: collection.id },
      select: { importFingerprint: true, importFingerprintVersion: true },
    })

    expect(result.status).toBe('stale')
    expect(persisted).toEqual({
      importFingerprint: OTHER_FINGERPRINT,
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
  })

  it('validates stale guards before reporting an already-current snapshot unchanged', async () => {
    const collection = await createAnswerCollection()
    const element = await createContentElement()
    await refreshElementDidacticFingerprintV1(element.id, prisma)
    await refreshAnswerCollectionDidacticFingerprintV1(collection.id, prisma)

    const elementSnapshot = await computeElementDidacticFingerprintFromDbV1(
      element.id,
      prisma
    )
    const collectionSnapshot =
      await computeAnswerCollectionDidacticFingerprintFromDbV1(
        collection.id,
        prisma
      )
    expect(elementSnapshot).not.toBeNull()
    expect(collectionSnapshot).not.toBeNull()

    await Promise.all([
      prisma.element.update({
        where: { id: element.id },
        data: { version: { increment: 1 } },
      }),
      prisma.answerCollection.update({
        where: { id: collection.id },
        data: {
          importFingerprint: OTHER_FINGERPRINT,
          importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        },
      }),
    ])

    await expect(
      persistElementDidacticFingerprintSnapshot(elementSnapshot!, prisma)
    ).resolves.toMatchObject({ status: 'stale' })
    await expect(
      persistAnswerCollectionDidacticFingerprintSnapshot(
        collectionSnapshot!,
        prisma
      )
    ).resolves.toMatchObject({ status: 'stale' })
  })

  it('refreshes null and mismatched versions and reruns idempotently', async () => {
    const collection = await createAnswerCollection({
      importFingerprint: LEGACY_FINGERPRINT,
      importFingerprintVersion: 99,
    })
    const element = await createContentElement()

    const firstElement = await refreshElementDidacticFingerprintV1(
      element.id,
      prisma
    )
    const firstCollection = await refreshAnswerCollectionDidacticFingerprintV1(
      collection.id,
      prisma
    )
    expect(firstElement.status).toBe('updated')
    expect(firstCollection.status).toBe('updated')

    const afterFirst = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: {
        importFingerprint: true,
        importFingerprintVersion: true,
        updatedAt: true,
      },
    })
    expect(afterFirst).toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })
    await expect(
      prisma.answerCollection.findUniqueOrThrow({
        where: { id: collection.id },
        select: { importFingerprint: true, importFingerprintVersion: true },
      })
    ).resolves.toMatchObject({
      importFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
    })

    const transactionSnapshot = await prisma.$transaction((tx) =>
      computeElementDidacticFingerprintFromDbV1(element.id, tx)
    )
    expect(transactionSnapshot?.computed).toEqual(firstElement.computed)

    const secondElement = await refreshElementDidacticFingerprintV1(
      element.id,
      prisma
    )
    const secondCollection = await refreshAnswerCollectionDidacticFingerprintV1(
      collection.id,
      prisma
    )
    const afterSecond = await prisma.element.findUniqueOrThrow({
      where: { id: element.id },
      select: { updatedAt: true },
    })

    expect(secondElement.status).toBe('unchanged')
    expect(secondCollection.status).toBe('unchanged')
    expect(afterSecond.updatedAt).toEqual(afterFirst.updatedAt)
  })
})
