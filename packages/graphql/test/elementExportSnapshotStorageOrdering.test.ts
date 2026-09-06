import {
  ElementStatus,
  ElementType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_CONTENT_LENGTH } from '../src/lib/importExportPackageConfig.js'
import type { ElementExportSnapshot } from '../src/services/elementExportSnapshot.js'

const MEDIA_HREF = 'https://media.test/owner/image.png'
const BARRIER_TIMEOUT_MS = 4_000

function createSnapshot(): ElementExportSnapshot {
  return {
    elements: [
      {
        id: 1,
        name: 'Snapshot ordering proof',
        content: `![packaged image](${MEDIA_HREF})`,
        options: {},
        type: ElementType.CONTENT,
        pointsMultiplier: 1,
        explanation: null,
        version: 1,
        status: ElementStatus.READY,
        answerCollectionId: null,
        basePoints: false,
        updatedAt: new Date('2026-07-13T12:00:00.000Z'),
        answerCollectionItems: [],
        exportPermission: PermissionLevel.OWNER,
      },
    ],
    answerCollections: [],
    revision: {
      token: '0'.repeat(64),
      elementIds: [1],
      answerCollectionIds: [],
    },
  }
}

function createEscapingSnapshot() {
  const snapshot = createSnapshot()
  snapshot.elements[0]!.content = '\u0001'.repeat(
    MAX_IMPORT_EXPORT_CONTENT_LENGTH
  )
  snapshot.elements[0]!.explanation = '\u0001'.repeat(
    MAX_IMPORT_EXPORT_CONTENT_LENGTH
  )
  return snapshot
}

function createBoundedSnapshotBarrier(snapshot: ElementExportSnapshot) {
  let settled = false
  let resolve!: (value: ElementExportSnapshot) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<ElementExportSnapshot>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    }
  )
  const timeout = setTimeout(() => {
    if (settled) return
    settled = true
    reject(new Error('Snapshot ordering barrier timed out.'))
  }, BARRIER_TIMEOUT_MS)

  return {
    promise,
    release() {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(snapshot)
    },
    dispose() {
      clearTimeout(timeout)
      if (!settled) {
        settled = true
        resolve(snapshot)
      }
    },
  }
}

const MODULES_TO_UNMOCK = [
  '../src/services/importExportAuthorization.js',
  '../src/services/importExportConcurrency.js',
  '../src/services/importExportRateLimit.js',
  '../src/services/elementExportSnapshot.js',
  '../src/services/mediaStorage.js',
  '../src/services/packageStorage.js',
] as const

function installExportAdapterMocks(
  barrier: ReturnType<typeof createBoundedSnapshotBarrier>,
  events: string[]
) {
  const loadSnapshot = vi.fn(async () => {
    events.push('snapshot:pending')
    const snapshot = await barrier.promise
    events.push('snapshot:resolved')
    return snapshot
  })
  const classifyMedia = vi.fn((href: string) => {
    events.push('media:classify')
    return href === MEDIA_HREF
      ? { containerName: 'owner', blobName: 'image.png' }
      : null
  })
  const downloadMedia = vi.fn(async () => {
    events.push('media:download')
    return {
      buffer: Buffer.from('snapshot-safe media'),
      contentType: 'image/png',
      filename: 'image.png',
      originalId: 'media-1',
    }
  })
  const loadMediaMetadata = vi.fn(async () => {
    events.push('media:metadata')
    return new Map([
      [
        MEDIA_HREF,
        {
          bytes: Buffer.byteLength('snapshot-safe media'),
          contentType: 'image/png',
          filename: 'image.png',
          originalId: 'media-1',
          sha256: createHash('sha256')
            .update('snapshot-safe media')
            .digest('hex'),
        },
      ],
    ])
  })
  const reservePackageStorage = vi.fn(async () => {
    events.push('package:reserve')
    return {
      artifactId: '00000000-0000-4000-8000-000000000001',
      target: {
        storageContainer: 'klicker-import-export',
        storageBlob: 'exports/owner/export.zip',
      },
      reservedBytes: 10 * 1024 * 1024,
    }
  })
  const uploadPackageStorage = vi.fn(async () => {
    events.push('package:upload')
    return {
      artifactId: '00000000-0000-4000-8000-000000000001',
      downloadLink: 'https://download.test/export.zip',
      filename: 'export.zip',
      expiresAt: new Date('2026-07-13T13:00:00.000Z'),
    }
  })
  const discardPackageStorage = vi.fn(async () => {
    events.push('package:discard')
  })

  vi.doMock('../src/services/importExportAuthorization.js', () => ({
    assertCanUseElementImportExport: vi.fn(async () => undefined),
  }))
  vi.doMock('../src/services/importExportConcurrency.js', () => ({
    withImportExportConcurrencyLease: vi.fn(
      async (_ctx, _operation, callback) => await callback(() => undefined)
    ),
  }))
  vi.doMock('../src/services/importExportRateLimit.js', async () => ({
    ...(await vi.importActual<
      typeof import('../src/services/importExportRateLimit.js')
    >('../src/services/importExportRateLimit.js')),
    assertImportExportRateLimit: vi.fn(async () => undefined),
  }))
  vi.doMock('../src/services/elementExportSnapshot.js', () => ({
    loadElementExportSnapshot: loadSnapshot,
    assertElementExportSnapshotPublishable: vi.fn(async () => undefined),
  }))
  vi.doMock('../src/services/mediaStorage.js', () => ({
    cleanupPendingImportedMediaFile: vi.fn(async () => undefined),
    deleteImportedMediaFile: vi.fn(async () => undefined),
    downloadKlickerMediaFile: downloadMedia,
    finalizeStagedImportedMediaFile: vi.fn(async () => undefined),
    getKlickerMediaFilesExportMetadata: loadMediaMetadata,
    parseKlickerMediaUrl: classifyMedia,
    reconcileAbandonedImportMediaStaging: vi.fn(async () => undefined),
    stageImportedMediaFile: vi.fn(async () => undefined),
  }))
  vi.doMock('../src/services/packageStorage.js', () => ({
    discardElementExportPackageReservation: discardPackageStorage,
    downloadPreparedElementImportPackage: vi.fn(async () => undefined),
    prepareElementImportPackageUpload: vi.fn(async () => undefined),
    reserveElementExportPackageArtifact: reservePackageStorage,
    uploadElementExportPackage: uploadPackageStorage,
  }))

  return {
    loadSnapshot,
    classifyMedia,
    downloadMedia,
    loadMediaMetadata,
    reservePackageStorage,
    uploadPackageStorage,
    discardPackageStorage,
  }
}

function expectNoExportBlobOrPublicationCalls(
  adapters: ReturnType<typeof installExportAdapterMocks>
) {
  expect(adapters.classifyMedia).not.toHaveBeenCalled()
  expect(adapters.downloadMedia).not.toHaveBeenCalled()
  expect(adapters.loadMediaMetadata).not.toHaveBeenCalled()
  expect(adapters.uploadPackageStorage).not.toHaveBeenCalled()
  expect(adapters.discardPackageStorage).not.toHaveBeenCalled()
}

async function cleanupTest(
  barrier: ReturnType<typeof createBoundedSnapshotBarrier>,
  operation: Promise<unknown> | undefined
) {
  barrier.dispose()
  await operation?.catch(() => undefined)
  for (const modulePath of MODULES_TO_UNMOCK) vi.doUnmock(modulePath)
  vi.restoreAllMocks()
  vi.resetModules()
}

describe('element export snapshot storage ordering', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('does not classify or download media while the final export snapshot is pending', async () => {
    const snapshot = createSnapshot()
    const barrier = createBoundedSnapshotBarrier(snapshot)
    const events: string[] = []
    const adapters = installExportAdapterMocks(barrier, events)
    let operation: Promise<unknown> | undefined

    try {
      const { getElementExportPackageLink } = await import(
        '../src/services/elementImportExport.js'
      )
      operation = getElementExportPackageLink({ elementIds: [1] }, {
        user: { sub: 'owner' },
        prisma: {},
      } as any)

      await vi.waitFor(
        () => expect(adapters.loadSnapshot).toHaveBeenCalledOnce(),
        {
          timeout: 1_000,
        }
      )
      // Artifact quota reservation is database-only and deliberately happens
      // before source loading. Blob publication must still wait for the full
      // coherent snapshot and media hydration.
      expect(events).toEqual(['package:reserve', 'snapshot:pending'])
      expect(adapters.reservePackageStorage).toHaveBeenCalledOnce()
      expectNoExportBlobOrPublicationCalls(adapters)

      barrier.release()
      await expect(operation).resolves.toMatchObject({
        downloadLink: 'https://download.test/export.zip',
      })
      expect(adapters.classifyMedia).toHaveBeenCalledWith(MEDIA_HREF)
      expect(adapters.downloadMedia).toHaveBeenCalledWith(
        MEDIA_HREF,
        expect.any(Object)
      )
      expect(adapters.loadMediaMetadata).toHaveBeenCalledWith(
        [MEDIA_HREF],
        expect.any(Object),
        expect.any(Function)
      )
      expect(events.indexOf('snapshot:resolved')).toBeLessThan(
        events.indexOf('media:classify')
      )
      expect(events.indexOf('media:classify')).toBeLessThan(
        events.indexOf('media:metadata')
      )
      expect(events.indexOf('media:metadata')).toBeLessThan(
        events.indexOf('media:download')
      )
      expect(adapters.uploadPackageStorage).toHaveBeenCalledOnce()
      expect(adapters.discardPackageStorage).not.toHaveBeenCalled()
      expect(events.indexOf('media:download')).toBeLessThan(
        events.indexOf('package:upload')
      )
    } finally {
      await cleanupTest(barrier, operation)
    }
  })

  it('does not classify media or load preview metadata while its snapshot is pending', async () => {
    const snapshot = createSnapshot()
    const barrier = createBoundedSnapshotBarrier(snapshot)
    const events: string[] = []
    const adapters = installExportAdapterMocks(barrier, events)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    let operation: Promise<unknown> | undefined

    try {
      const { getElementExportPackagePreview } = await import(
        '../src/services/elementImportExport.js'
      )
      operation = getElementExportPackagePreview({ elementIds: [1] }, {
        user: { sub: 'owner' },
        prisma: {},
      } as any)

      await vi.waitFor(
        () => expect(adapters.loadSnapshot).toHaveBeenCalledOnce(),
        {
          timeout: 1_000,
        }
      )
      expect(events).toEqual(['snapshot:pending'])
      expectNoExportBlobOrPublicationCalls(adapters)
      expect(adapters.reservePackageStorage).not.toHaveBeenCalled()

      barrier.release()
      await expect(operation).resolves.toMatchObject({
        elements: [{ id: 1, name: 'Snapshot ordering proof' }],
        warnings: [],
        errors: [],
      })
      expect(adapters.classifyMedia).toHaveBeenCalledWith(MEDIA_HREF)
      expect(adapters.loadMediaMetadata).toHaveBeenCalledWith(
        [MEDIA_HREF],
        expect.any(Object),
        expect.any(Function)
      )
      expect(adapters.downloadMedia).not.toHaveBeenCalled()
      expect(events.indexOf('snapshot:resolved')).toBeLessThan(
        events.indexOf('media:classify')
      )
      expect(events.indexOf('media:classify')).toBeLessThan(
        events.indexOf('media:metadata')
      )
      expect(adapters.reservePackageStorage).not.toHaveBeenCalled()
      expect(adapters.uploadPackageStorage).not.toHaveBeenCalled()
      expect(adapters.discardPackageStorage).not.toHaveBeenCalled()
      expect(consoleInfo).toHaveBeenCalled()
    } finally {
      await cleanupTest(barrier, operation)
    }
  })

  it('rejects an escape-expanded final source as non-portable before blob publication', async () => {
    const snapshot = createEscapingSnapshot()
    const barrier = createBoundedSnapshotBarrier(snapshot)
    const events: string[] = []
    const adapters = installExportAdapterMocks(barrier, events)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    let operation: Promise<unknown> | undefined

    try {
      const { getElementExportPackageLink } = await import(
        '../src/services/elementImportExport.js'
      )
      operation = getElementExportPackageLink({ elementIds: [1] }, {
        user: { sub: 'owner' },
        prisma: {},
      } as any)

      await vi.waitFor(
        () => expect(adapters.loadSnapshot).toHaveBeenCalledOnce(),
        { timeout: 1_000 }
      )
      barrier.release()

      await expect(operation).rejects.toMatchObject({
        extensions: { code: ImportExportErrorCode.ELEMENT_NOT_PORTABLE },
      })
      expect(adapters.uploadPackageStorage).not.toHaveBeenCalled()
      expect(adapters.discardPackageStorage).toHaveBeenCalledOnce()
      expect(consoleInfo).toHaveBeenCalled()
    } finally {
      await cleanupTest(barrier, operation)
    }
  })

  it('returns a stable non-portable preview error for escape-expanded JSON', async () => {
    const snapshot = createEscapingSnapshot()
    const barrier = createBoundedSnapshotBarrier(snapshot)
    const events: string[] = []
    const adapters = installExportAdapterMocks(barrier, events)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    let operation: Promise<unknown> | undefined

    try {
      const { getElementExportPackagePreview } = await import(
        '../src/services/elementImportExport.js'
      )
      operation = getElementExportPackagePreview({ elementIds: [1] }, {
        user: { sub: 'owner' },
        prisma: {},
      } as any)

      await vi.waitFor(
        () => expect(adapters.loadSnapshot).toHaveBeenCalledOnce(),
        { timeout: 1_000 }
      )
      barrier.release()

      await expect(operation).resolves.toMatchObject({
        errors: [ImportExportErrorCode.ELEMENT_NOT_PORTABLE],
      })
      expect(adapters.reservePackageStorage).not.toHaveBeenCalled()
      expect(adapters.uploadPackageStorage).not.toHaveBeenCalled()
      expect(consoleInfo).toHaveBeenCalled()
    } finally {
      await cleanupTest(barrier, operation)
    }
  })
})
