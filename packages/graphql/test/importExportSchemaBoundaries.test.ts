import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { graphql } from 'graphql/index.js'
import { schema } from '../src/index.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_ELEMENTS } from '../src/lib/importExportPackageConfig.js'
import {
  resolveElementExportPackageLinkAtBoundary,
  resolveElementExportPackagePreviewAtBoundary,
  resolveImportElementPackageAtBoundary,
} from '../src/schema/elementImportExport.js'
import * as ElementImportExportService from '../src/services/elementImportExport.js'

const context = {} as Parameters<
  typeof ElementImportExportService.getElementExportPackageLink
>[1]

describe('import/export raw GraphQL list boundaries', () => {
  it('wires stable raw-cap outcomes through the executable schema', async () => {
    const elementIds = Array(MAX_IMPORT_EXPORT_ELEMENTS + 1).fill(1)
    const selectedElementRefs = Array(MAX_IMPORT_EXPORT_ELEMENTS + 1).fill(
      'element-1'
    )
    const contextValue = {
      user: {
        sub: 'user-1',
        role: UserRole.USER,
        scope: UserLoginScope.FULL_ACCESS,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    }

    const link = await graphql({
      schema,
      source: `query Link($elementIds: [Int!]!) {
        getElementExportPackageLink(elementIds: $elementIds) { downloadLink }
      }`,
      variableValues: { elementIds },
      contextValue,
    })
    expect(link.errors?.[0]?.extensions.code).toBe(
      ImportExportErrorCode.TOO_MANY_ELEMENTS
    )

    const preview = await graphql({
      schema,
      source: `query Preview($elementIds: [Int!]!) {
        getElementExportPackagePreview(elementIds: $elementIds) { errors }
      }`,
      variableValues: { elementIds },
      contextValue,
    })
    expect(preview.errors).toBeUndefined()
    expect(preview.data).toEqual({
      getElementExportPackagePreview: {
        errors: [ImportExportErrorCode.TOO_MANY_ELEMENTS],
      },
    })

    const imported = await graphql({
      schema,
      source: `mutation Import($selectedElementRefs: [String!]!) {
        importElementPackage(
          importToken: "not-read"
          selectedElementRefs: $selectedElementRefs
        ) { importedElements }
      }`,
      variableValues: { selectedElementRefs },
      contextValue,
    })
    expect(imported.errors?.[0]?.extensions.code).toBe(
      ImportExportErrorCode.INVALID_SELECTION
    )
  })

  it('rejects more than 100 raw export ids before link service work', async () => {
    const service =
      vi.fn<typeof ElementImportExportService.getElementExportPackageLink>()

    await expect(
      resolveElementExportPackageLinkAtBoundary(
        { elementIds: Array(MAX_IMPORT_EXPORT_ELEMENTS + 1).fill(1) },
        context,
        service
      )
    ).rejects.toMatchObject({
      extensions: { code: ImportExportErrorCode.TOO_MANY_ELEMENTS },
    })
    expect(service).not.toHaveBeenCalled()
  })

  it('returns the stable preview error before service work for more than 100 raw export ids', async () => {
    const service =
      vi.fn<typeof ElementImportExportService.getElementExportPackagePreview>()

    await expect(
      resolveElementExportPackagePreviewAtBoundary(
        { elementIds: Array(MAX_IMPORT_EXPORT_ELEMENTS + 1).fill(1) },
        context,
        service
      )
    ).resolves.toEqual({
      elements: [],
      answerCollections: [],
      warnings: [],
      errors: [ImportExportErrorCode.TOO_MANY_ELEMENTS],
    })
    expect(service).not.toHaveBeenCalled()
  })

  it('rejects more than 100 raw selected refs before token, receipt, or download work', async () => {
    const service =
      vi.fn<typeof ElementImportExportService.importElementPackage>()

    await expect(
      resolveImportElementPackageAtBoundary(
        {
          importToken: 'not-read',
          selectedElementRefs: Array(MAX_IMPORT_EXPORT_ELEMENTS + 1).fill(
            'element-1'
          ),
        },
        context,
        service
      )
    ).rejects.toMatchObject({
      extensions: { code: ImportExportErrorCode.INVALID_SELECTION },
    })
    expect(service).not.toHaveBeenCalled()
  })

  it('delegates raw lists at the exact 100-item boundary', async () => {
    const elementIds = Array(MAX_IMPORT_EXPORT_ELEMENTS).fill(1)
    const selectedElementRefs = Array(MAX_IMPORT_EXPORT_ELEMENTS).fill(
      'element-1'
    )
    const linkService = vi
      .fn<typeof ElementImportExportService.getElementExportPackageLink>()
      .mockResolvedValue(undefined as never)
    const previewService = vi
      .fn<typeof ElementImportExportService.getElementExportPackagePreview>()
      .mockResolvedValue(undefined as never)
    const importService = vi
      .fn<typeof ElementImportExportService.importElementPackage>()
      .mockResolvedValue(undefined as never)

    await resolveElementExportPackageLinkAtBoundary(
      { elementIds },
      context,
      linkService
    )
    await resolveElementExportPackagePreviewAtBoundary(
      { elementIds },
      context,
      previewService
    )
    await resolveImportElementPackageAtBoundary(
      { importToken: 'token', selectedElementRefs },
      context,
      importService
    )

    expect(linkService).toHaveBeenCalledOnce()
    expect(previewService).toHaveBeenCalledOnce()
    expect(importService).toHaveBeenCalledOnce()
  })
})
