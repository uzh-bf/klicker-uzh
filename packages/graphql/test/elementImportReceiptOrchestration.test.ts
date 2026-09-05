import { ImportExportWarningCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_ELEMENTS } from '../src/lib/importExportPackageConfig.js'
import {
  getElementImportResultWarnings,
  prepareElementImportSelection,
} from '../src/services/elementImportReceiptOrchestration.js'

describe('element import receipt orchestration boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('canonicalizes duplicate refs before enforcing the selected-element cap', () => {
    const refs = Array.from(
      { length: MAX_IMPORT_EXPORT_ELEMENTS },
      (_, index) => `element-${String(index).padStart(3, '0')}`
    )

    expect(
      prepareElementImportSelection([...refs].reverse().concat(refs[0]!))
        .selectedElementRefs
    ).toEqual(refs)
    expect(() =>
      prepareElementImportSelection([...refs, 'element-over-limit'])
    ).toThrowError(
      expect.objectContaining({ code: 'IMPORT_INVALID_SELECTION' })
    )
  })

  it('returns the durable cleanup warning when cleanup is pending', async () => {
    const count = vi.fn(async () => 1)

    await expect(
      getElementImportResultWarnings('receipt-id', {
        prisma: { importMediaStaging: { count } },
      } as any)
    ).resolves.toEqual([ImportExportWarningCode.CLEANUP_PENDING])
  })

  it('fails soft with a conservative warning when the post-commit lookup fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      getElementImportResultWarnings('receipt-id', {
        prisma: {
          importMediaStaging: {
            count: vi.fn(async () => {
              throw new Error('database unavailable')
            }),
          },
        },
      } as any)
    ).resolves.toEqual([ImportExportWarningCode.CLEANUP_PENDING])
    expect(consoleError).toHaveBeenCalledWith(
      '[ImportExportPackage] Cleanup warning lookup failed'
    )
  })
})
