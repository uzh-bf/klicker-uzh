import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import { createZip } from '../src/lib/zip.js'

function createMinimalImportPackage() {
  return createZip([
    {
      path: 'manifest.json',
      data: JSON.stringify({
        type: 'klicker-element-package',
        version: 3,
        createdAt: new Date(0).toISOString(),
        elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
        answerCollections: [],
        media: [],
      }),
    },
    {
      path: 'elements/element-1.json',
      data: JSON.stringify({
        ref: 'element-1',
        name: 'Durable import transaction',
        content: 'Imported content',
        type: ElementType.SC,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          choices: [
            { ix: 0, value: 'A' },
            { ix: 1, value: 'B' },
          ],
        },
        pointsMultiplier: 1,
        basePoints: true,
        explanation: null,
      }),
    },
  ])
}

function createMediaImportPackage() {
  const data = Buffer.from('durable transaction boundary media')
  const sha256 = createHash('sha256').update(data).digest('hex')
  const sourceHref = 'klicker-package-media://media-1'
  const markdownHref = sourceHref.replaceAll('-', '\\-')

  return {
    buffer: createZip([
      {
        path: 'manifest.json',
        data: JSON.stringify({
          type: 'klicker-element-package',
          version: 3,
          createdAt: new Date(0).toISOString(),
          elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
          answerCollections: [],
          media: [
            {
              ref: 'media-1',
              file: 'media/media-1.png',
              filename: 'media-1.png',
              contentType: 'image/png',
              bytes: data.length,
              sha256,
              sourceHref,
            },
          ],
        }),
      },
      {
        path: 'elements/element-1.json',
        data: JSON.stringify({
          ref: 'element-1',
          name: 'Durable import transaction with media',
          content: `Imported content ![media](${markdownHref})`,
          type: ElementType.SC,
          options: {
            displayMode: 'LIST',
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
            choices: [
              { ix: 0, value: 'A' },
              { ix: 1, value: 'B' },
            ],
          },
          pointsMultiplier: 1,
          basePoints: true,
          explanation: null,
        }),
      },
      { path: 'media/media-1.png', data },
    ]),
    sha256,
  }
}

function createSelectionImportPackage() {
  return createZip([
    {
      path: 'manifest.json',
      data: JSON.stringify({
        type: 'klicker-element-package',
        version: 3,
        createdAt: new Date(0).toISOString(),
        elements: [
          {
            ref: 'selection-1',
            file: 'elements/selection-1.json',
            answerCollectionRef: 'collection-1',
          },
        ],
        answerCollections: [
          {
            ref: 'collection-1',
            file: 'answer-collections/collection-1.json',
          },
        ],
        media: [],
      }),
    },
    {
      path: 'elements/selection-1.json',
      data: JSON.stringify({
        ref: 'selection-1',
        name: 'Durable selection import',
        content: 'Select the correct item',
        type: ElementType.SELECTION,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        pointsMultiplier: 1,
        basePoints: true,
        explanation: null,
        answerCollectionRef: 'collection-1',
        answerCollectionItemRefs: ['entry-1'],
      }),
    },
    {
      path: 'answer-collections/collection-1.json',
      data: JSON.stringify({
        ref: 'collection-1',
        name: 'Durable collection import',
        description: 'Collection created in the import transaction',
        entries: [
          { ref: 'entry-1', value: 'Correct item' },
          { ref: 'entry-2', value: 'Distractor item' },
        ],
      }),
    },
  ])
}

async function loadDurableImportWithMocks({
  completeReceipt,
  manipulateError,
  mediaStorage,
  onPlanExecuted,
  onReceiptCompleted,
}: {
  completeReceipt: boolean
  manipulateError?: Error
  onPlanExecuted?: () => void
  onReceiptCompleted?: () => void
  mediaStorage?: {
    stageImportedMediaFile: ReturnType<typeof vi.fn>
    finalizeStagedImportedMediaFile: ReturnType<typeof vi.fn>
    deleteImportedMediaFile: ReturnType<typeof vi.fn>
  }
}) {
  const assertLiveElementImportReceiptLease = vi.fn(async () => ({
    id: randomUUID(),
  }))
  const completeElementImportReceipt = vi.fn(async () => {
    onReceiptCompleted?.()
    return completeReceipt
  })
  const executeElementImportExecutionPlan = vi.fn(async ({ plan, prisma }) => {
    const createdAnswerCollectionIds: number[] = []
    if (plan.answerCollections.length > 0) {
      const created = await prisma.answerCollection.create({ data: {} })
      createdAnswerCollectionIds.push(created.id)
    }
    if (manipulateError) throw manipulateError
    onPlanExecuted?.()
    return {
      createdElementIds: [123],
      createdAnswerCollectionIds,
      invalidations: [
        ...createdAnswerCollectionIds.map((id) => ({
          typename: 'AnswerCollection' as const,
          id,
        })),
        { typename: 'Element' as const, id: 123 },
      ],
    }
  })

  vi.doMock('../src/services/importExportPersistence.js', async () => ({
    ...(await vi.importActual<
      typeof import('../src/services/importExportPersistence.js')
    >('../src/services/importExportPersistence.js')),
    assertLiveElementImportReceiptLease,
    completeElementImportReceipt,
  }))
  vi.doMock('../src/services/elementImportExecution.js', () => ({
    executeElementImportExecutionPlan,
  }))
  if (mediaStorage) {
    vi.doMock('../src/services/mediaStorage.js', async () => ({
      ...(await vi.importActual<
        typeof import('../src/services/mediaStorage.js')
      >('../src/services/mediaStorage.js')),
      ...mediaStorage,
    }))
  }

  const { importElementPackageBuffer } = await import(
    '../src/services/elementImportExport.js'
  )

  return {
    assertLiveElementImportReceiptLease,
    completeElementImportReceipt,
    executeElementImportExecutionPlan,
    importElementPackageBuffer,
    mediaStorage,
  }
}

describe('durable element import transaction seam', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('../src/services/importExportPersistence.js')
    vi.doUnmock('../src/services/elementImportExecution.js')
    vi.doUnmock('../src/services/mediaStorage.js')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('aborts the transaction and suppresses invalidation when receipt completion loses the lease', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    let transactionCallbackError: unknown
    const txPrisma = {
      element: { update: vi.fn(async () => ({})) },
    }
    const transaction = vi.fn(
      async (callback: (prisma: typeof txPrisma) => Promise<unknown>) => {
        try {
          return await callback(txPrisma)
        } catch (error) {
          transactionCallbackError = error
          throw error
        }
      }
    )
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: false,
    })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createMinimalImportPackage(),
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: randomUUID() },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })

    expect(transactionCallbackError).toMatchObject({
      code: ImportExportErrorCode.IMPORT_IN_PROGRESS,
    })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(mocked.assertLiveElementImportReceiptLease).toHaveBeenCalledTimes(1)
    expect(mocked.completeElementImportReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId,
        leaseId,
        createdElementIds: [123],
        createdAnswerCollectionIds: [],
      })
    )
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('rolls back transaction writes when the combined lease is lost during plan execution', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    let leaseLost = false
    const leaseError = new ImportExportDomainError(
      ImportExportErrorCode.IMPORT_IN_PROGRESS
    )
    const leaseGuard = {
      assertLease: vi.fn(() => {
        if (leaseLost) throw leaseError
      }),
      renewNow: vi.fn(async () => undefined),
    }
    let transactionCallbackError: unknown
    const txPrisma = {
      element: { update: vi.fn(async () => ({})) },
    }
    const transaction = vi.fn(
      async (callback: (prisma: typeof txPrisma) => Promise<unknown>) => {
        try {
          return await callback(txPrisma)
        } catch (error) {
          transactionCallbackError = error
          throw error
        }
      }
    )
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: true,
      onPlanExecuted: () => {
        leaseLost = true
      },
    })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createMinimalImportPackage(),
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
          leaseGuard,
        },
        {
          user: { sub: randomUUID() },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(leaseError)

    expect(transactionCallbackError).toBe(leaseError)
    expect(mocked.executeElementImportExecutionPlan).toHaveBeenCalledTimes(1)
    expect(mocked.completeElementImportReceipt).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('rolls back transaction writes when the combined lease is lost during receipt completion', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    let leaseLost = false
    const leaseError = new ImportExportDomainError(
      ImportExportErrorCode.IMPORT_IN_PROGRESS
    )
    const leaseGuard = {
      assertLease: vi.fn(() => {
        if (leaseLost) throw leaseError
      }),
      renewNow: vi.fn(async () => undefined),
    }
    let transactionCallbackError: unknown
    const txPrisma = {
      element: { update: vi.fn(async () => ({})) },
    }
    const transaction = vi.fn(
      async (callback: (prisma: typeof txPrisma) => Promise<unknown>) => {
        try {
          return await callback(txPrisma)
        } catch (error) {
          transactionCallbackError = error
          throw error
        }
      }
    )
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: true,
      onReceiptCompleted: () => {
        leaseLost = true
      },
    })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createMinimalImportPackage(),
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
          leaseGuard,
        },
        {
          user: { sub: randomUUID() },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(leaseError)

    expect(transactionCallbackError).toBe(leaseError)
    expect(mocked.executeElementImportExecutionPlan).toHaveBeenCalledTimes(1)
    expect(mocked.completeElementImportReceipt).toHaveBeenCalledTimes(1)
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('leaves durable staged media for reconciliation when the transaction cannot start', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    const transactionError = new Error('database unavailable')
    const mediaPackage = createMediaImportPackage()
    const stagingId = randomUUID()
    const stageImportedMediaFile = vi.fn(async () => ({
      id: stagingId,
      href: `https://example.invalid/imported/${stagingId}.png`,
      ownerId: 'importer',
      contentType: 'image/png',
      filename: 'media-1.png',
      originalId: `import-media:${mediaPackage.sha256}`,
      contentHash: mediaPackage.sha256,
      createdBlob: true,
      stagingId,
      operationId: leaseId,
    }))
    const finalizeStagedImportedMediaFile = vi.fn()
    const deleteImportedMediaFile = vi.fn()
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: true,
      mediaStorage: {
        stageImportedMediaFile,
        finalizeStagedImportedMediaFile,
        deleteImportedMediaFile,
      },
    })
    const transaction = vi.fn(async () => {
      throw transactionError
    })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: mediaPackage.buffer,
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: 'importer' },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(transactionError)

    expect(stageImportedMediaFile).toHaveBeenCalledTimes(1)
    expect(finalizeStagedImportedMediaFile).not.toHaveBeenCalled()
    expect(mocked.completeElementImportReceipt).not.toHaveBeenCalled()
    expect(deleteImportedMediaFile).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('rolls back and retains durable media when staging finalization fails', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    const finalizationError = new Error('media row finalization failed')
    const mediaPackage = createMediaImportPackage()
    const stagingId = randomUUID()
    const stageImportedMediaFile = vi.fn(async () => ({
      id: stagingId,
      href: `https://example.invalid/imported/${stagingId}.png`,
      ownerId: 'importer',
      contentType: 'image/png',
      filename: 'media-1.png',
      originalId: `import-media:${mediaPackage.sha256}`,
      contentHash: mediaPackage.sha256,
      createdBlob: true,
      stagingId,
      operationId: leaseId,
    }))
    const finalizeStagedImportedMediaFile = vi.fn(async () => {
      throw finalizationError
    })
    const deleteImportedMediaFile = vi.fn()
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: true,
      mediaStorage: {
        stageImportedMediaFile,
        finalizeStagedImportedMediaFile,
        deleteImportedMediaFile,
      },
    })
    const txPrisma = { element: { update: vi.fn() } }
    const transaction = vi.fn(async (callback) => await callback(txPrisma))

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: mediaPackage.buffer,
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: 'importer' },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(finalizationError)

    expect(finalizeStagedImportedMediaFile).toHaveBeenCalledTimes(1)
    expect(mocked.executeElementImportExecutionPlan).not.toHaveBeenCalled()
    expect(mocked.completeElementImportReceipt).not.toHaveBeenCalled()
    expect(deleteImportedMediaFile).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('rolls back finalized media and suppresses completion when element creation fails', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    const elementError = new Error('element insert failed')
    const mediaPackage = createMediaImportPackage()
    const stagingId = randomUUID()
    const stageImportedMediaFile = vi.fn(async () => ({
      id: stagingId,
      href: `https://example.invalid/imported/${stagingId}.png`,
      ownerId: 'importer',
      contentType: 'image/png',
      filename: 'media-1.png',
      originalId: `import-media:${mediaPackage.sha256}`,
      contentHash: mediaPackage.sha256,
      createdBlob: true,
      stagingId,
      operationId: leaseId,
    }))
    const finalizeStagedImportedMediaFile = vi.fn(async (staged) => ({
      href: staged.href,
      unusedStagedHref: null,
    }))
    const deleteImportedMediaFile = vi.fn()
    const mocked = await loadDurableImportWithMocks({
      completeReceipt: true,
      manipulateError: elementError,
      mediaStorage: {
        stageImportedMediaFile,
        finalizeStagedImportedMediaFile,
        deleteImportedMediaFile,
      },
    })
    const txPrisma = { element: { update: vi.fn() } }
    const transaction = vi.fn(async (callback) => await callback(txPrisma))

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: mediaPackage.buffer,
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: 'importer' },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(elementError)

    expect(finalizeStagedImportedMediaFile).toHaveBeenCalledTimes(1)
    expect(mocked.executeElementImportExecutionPlan).toHaveBeenCalledTimes(1)
    expect(mocked.completeElementImportReceipt).not.toHaveBeenCalled()
    expect(deleteImportedMediaFile).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('rolls back before element creation when answer-collection creation fails', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    const collectionError = new Error('answer collection insert failed')
    const mocked = await loadDurableImportWithMocks({ completeReceipt: true })
    const txPrisma = {
      answerCollection: {
        create: vi.fn(async () => {
          throw collectionError
        }),
      },
      element: { update: vi.fn() },
    }
    const transaction = vi.fn(async (callback) => await callback(txPrisma))

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createSelectionImportPackage(),
          selectedElementRefs: ['selection-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: 'importer' },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).rejects.toBe(collectionError)

    expect(txPrisma.answerCollection.create).toHaveBeenCalledTimes(1)
    expect(mocked.executeElementImportExecutionPlan).toHaveBeenCalledTimes(1)
    expect(mocked.completeElementImportReceipt).not.toHaveBeenCalled()
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('completes with created IDs and emits deferred invalidation only after the transaction resolves', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = { emit: vi.fn() }
    const txPrisma = {
      element: { update: vi.fn(async () => ({})) },
    }
    const transaction = vi.fn(
      async (callback: (prisma: typeof txPrisma) => Promise<unknown>) => {
        const result = await callback(txPrisma)
        expect(emitter.emit).not.toHaveBeenCalled()
        return result
      }
    )
    const mocked = await loadDurableImportWithMocks({ completeReceipt: true })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createMinimalImportPackage(),
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: randomUUID() },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).resolves.toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
    })

    expect(mocked.completeElementImportReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId,
        leaseId,
        createdElementIds: [123],
        createdAnswerCollectionIds: [],
      })
    )
    expect(emitter.emit).toHaveBeenCalledTimes(1)
    expect(emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Element',
      id: 123,
    })
  })

  it('keeps a committed import successful when post-commit invalidation throws', async () => {
    const receiptId = randomUUID()
    const leaseId = randomUUID()
    const emitter = {
      emit: vi.fn(() => {
        throw new Error('cache unavailable')
      }),
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const txPrisma = {
      element: { update: vi.fn(async () => ({})) },
    }
    const transaction = vi.fn(
      async (callback: (prisma: typeof txPrisma) => Promise<unknown>) =>
        await callback(txPrisma)
    )
    const mocked = await loadDurableImportWithMocks({ completeReceipt: true })

    await expect(
      mocked.importElementPackageBuffer(
        {
          buffer: createMinimalImportPackage(),
          selectedElementRefs: ['element-1'],
          durableExecution: { receiptId, leaseId },
        },
        {
          user: { sub: randomUUID() },
          emitter,
          prisma: { $transaction: transaction },
        } as any
      )
    ).resolves.toEqual({
      importedElements: 1,
      importedAnswerCollections: 0,
      skippedElements: 0,
    })

    expect(emitter.emit).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      '[ImportExportPackage] Post-commit invalidation failed'
    )
  })
})
