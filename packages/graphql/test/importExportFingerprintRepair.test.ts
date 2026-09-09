import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import { repairStaleImportExportFingerprints } from '../src/services/importExportFingerprintMaintenance.js'
import {
  createFingerprintPrisma,
  isDirtyFingerprint,
  markFingerprintCurrent,
  type FakeFingerprintResource,
} from './importExportFingerprintTestSupport.js'

const mocks = vi.hoisted(() => ({
  refreshAnswerCollectionDidacticFingerprintV1:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
  refreshElementDidacticFingerprintV1:
    vi.fn<(id: number, prisma: unknown) => Promise<unknown>>(),
}))

vi.mock('../src/services/importExportFingerprintPersistence.js', () => ({
  refreshAnswerCollectionDidacticFingerprint:
    mocks.refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprint: mocks.refreshElementDidacticFingerprintV1,
}))

function persistFakeFingerprint(
  resources: FakeFingerprintResource[],
  id: number
) {
  markFingerprintCurrent(resources, id)
  return {
    status: 'updated' as const,
    computed: {
      version: IMPORT_EXPORT_FINGERPRINT_VERSION,
      fingerprint: `fingerprint-${id}`,
    },
  }
}

describe('automatic import/export fingerprint repair', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('stops between chunks with exact counts and fresh backlog flags', async () => {
    const dirtyResources = () =>
      Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      }))
    const answerCollections = dirtyResources()
    const elements = dirtyResources()
    const { prisma } = createFingerprintPrisma({
      answerCollections,
      elements,
    })
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => persistFakeFingerprint(answerCollections, id)
    )
    let stopChecks = 0

    await expect(
      repairStaleImportExportFingerprints(prisma, () =>
        ++stopChecks >= 4 ? 'budget' : null
      )
    ).resolves.toEqual({
      processedAnswerCollections: 10,
      processedElements: 0,
      answerCollectionBacklogRemaining: true,
      elementBacklogRemaining: true,
      stoppedEarly: true,
    })
    expect(
      mocks.refreshAnswerCollectionDidacticFingerprintV1
    ).toHaveBeenCalledTimes(10)
    expect(mocks.refreshElementDidacticFingerprintV1).not.toHaveBeenCalled()
  })

  it('does not start backlog queries after repair cancellation', async () => {
    const dirtyResources = () => [
      {
        id: 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
    ]
    const { answerCollectionFindFirst, elementFindFirst, prisma } =
      createFingerprintPrisma({
        answerCollections: dirtyResources(),
        elements: dirtyResources(),
      })

    await expect(
      repairStaleImportExportFingerprints(prisma, () => 'cancelled')
    ).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 0,
      answerCollectionBacklogRemaining: true,
      elementBacklogRemaining: true,
      stoppedEarly: true,
    })
    expect(answerCollectionFindFirst).not.toHaveBeenCalled()
    expect(elementFindFirst).not.toHaveBeenCalled()
  })

  it('repairs stale answer collections before stale elements in bounded pages', async () => {
    const answerCollections: FakeFingerprintResource[] = Array.from(
      { length: 101 },
      (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      })
    )
    const elements: FakeFingerprintResource[] = Array.from(
      { length: 101 },
      (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      })
    )
    const events: string[] = []
    const { prisma } = createFingerprintPrisma({
      answerCollections,
      elements,
    })
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => {
        events.push(`collection:${id}`)
        return persistFakeFingerprint(answerCollections, id)
      }
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) => {
      events.push(`element:${id}`)
      return persistFakeFingerprint(elements, id)
    })

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 101,
      processedElements: 101,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(events).toHaveLength(202)
    expect(
      events.slice(0, 101).every((event) => event.startsWith('collection:'))
    ).toBe(true)
    expect(
      events.slice(101).every((event) => event.startsWith('element:'))
    ).toBe(true)
  })

  it('stops after the configured batch cap and reports remaining backlog', async () => {
    const dirtyResources = () =>
      Array.from({ length: 501 }, (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      }))
    const answerCollections = dirtyResources()
    const elements = dirtyResources()
    const { answerCollectionFindMany, elementFindMany, prisma } =
      createFingerprintPrisma({ answerCollections, elements })
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => persistFakeFingerprint(answerCollections, id)
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 500,
      processedElements: 500,
      answerCollectionBacklogRemaining: true,
      elementBacklogRemaining: true,
    })
    expect(answerCollectionFindMany).toHaveBeenCalledTimes(5)
    expect(elementFindMany).toHaveBeenCalledTimes(5)
  })

  it('reports no backlog when the batch cap lands on the final stale row', async () => {
    const elements: FakeFingerprintResource[] = Array.from(
      { length: 500 },
      (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      })
    )
    const { prisma } = createFingerprintPrisma({ elements })
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 500,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
  })

  it('retries an optimistic refresh that loses its stale guard', async () => {
    const elements: FakeFingerprintResource[] = [
      {
        id: 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
    ]
    const { prisma } = createFingerprintPrisma({ elements })
    mocks.refreshElementDidacticFingerprintV1
      .mockResolvedValueOnce({
        status: 'stale',
        computed: {
          version: IMPORT_EXPORT_FINGERPRINT_VERSION,
          fingerprint: 'computed-but-lost-race',
        },
      })
      .mockImplementation(async (id) => persistFakeFingerprint(elements, id))

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 1,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(2)
  })

  it('repairs more than five pages of legacy rows with total fingerprints', async () => {
    const elements: FakeFingerprintResource[] = Array.from(
      { length: 601 },
      (_, index) => ({
        id: index + 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      })
    )
    const { prisma } = createFingerprintPrisma({ elements })
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 500,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: true,
    })
    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 101,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(601)
    expect(elements.every((element) => !isDirtyFingerprint(element))).toBe(true)
  })

  it('repairs a null fingerprint even when its version is current', async () => {
    const elements: FakeFingerprintResource[] = [
      {
        id: 1,
        importFingerprint: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 2,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
      {
        id: 3,
        importFingerprint: 'legacy',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION + 1,
        isDeleted: false,
      },
    ]
    const { prisma } = createFingerprintPrisma({ elements })
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 3,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      2,
      expect.anything()
    )
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      3,
      expect.anything()
    )
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      1,
      expect.anything()
    )
  })

  it('reruns idempotently after all stale markers are current', async () => {
    const answerCollections: FakeFingerprintResource[] = [
      {
        id: 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
    ]
    const elements: FakeFingerprintResource[] = [
      {
        id: 1,
        importFingerprint: 'legacy',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION - 1,
        isDeleted: false,
      },
    ]
    const { prisma } = createFingerprintPrisma({
      answerCollections,
      elements,
    })
    mocks.refreshAnswerCollectionDidacticFingerprintV1.mockImplementation(
      async (id) => persistFakeFingerprint(answerCollections, id)
    )
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 1,
      processedElements: 1,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 0,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(
      mocks.refreshAnswerCollectionDidacticFingerprintV1
    ).toHaveBeenCalledOnce()
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledOnce()
  })

  it('does not select deleted or complete current-version resources', async () => {
    const elements: FakeFingerprintResource[] = [
      {
        id: 1,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: true,
      },
      {
        id: 2,
        importFingerprint: 'current',
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 3,
        importFingerprint: null,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        isDeleted: false,
      },
      {
        id: 4,
        importFingerprint: null,
        importFingerprintVersion: null,
        isDeleted: false,
      },
    ]
    const { prisma } = createFingerprintPrisma({ elements })
    mocks.refreshElementDidacticFingerprintV1.mockImplementation(async (id) =>
      persistFakeFingerprint(elements, id)
    )

    await expect(repairStaleImportExportFingerprints(prisma)).resolves.toEqual({
      processedAnswerCollections: 0,
      processedElements: 2,
      answerCollectionBacklogRemaining: false,
      elementBacklogRemaining: false,
    })
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledTimes(2)
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      3,
      expect.anything()
    )
    expect(mocks.refreshElementDidacticFingerprintV1).toHaveBeenCalledWith(
      4,
      expect.anything()
    )
  })
})
