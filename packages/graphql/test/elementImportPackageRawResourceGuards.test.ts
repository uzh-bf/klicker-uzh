import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_OPTIONS_BYTES } from '../src/lib/importExportPackageConfig.js'
import { validateElementImportPackageBuffer } from '../src/services/elementImportExport.js'
import { createValidationPackage } from './elementImportExportTestSupport.js'

function expectImportError(buffer: Buffer, code: ImportExportErrorCode) {
  let thrown: unknown
  try {
    validateElementImportPackageBuffer(buffer)
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(ImportExportDomainError)
  expect(thrown).toMatchObject({ code })
}

describe('element import package raw resource guards', () => {
  it('rejects oversized case-study options before domain canonicalization', () => {
    expectImportError(
      createValidationPackage(
        {},
        {
          type: ElementType.CASE_STUDY,
          options: {
            hasSampleSolution: false,
            criteria: [],
            cases: [],
            padding: 'x'.repeat(MAX_IMPORT_EXPORT_OPTIONS_BYTES),
          },
        }
      ),
      ImportExportErrorCode.PACKAGE_TOO_LARGE
    )
  })

  it('rejects an empty media file before checksum comparison', () => {
    const data = Buffer.alloc(0)
    const media = {
      ref: 'media-1',
      file: 'media/media-1.png',
      filename: 'media-1.png',
      contentType: 'image/png',
      bytes: 1,
      sha256: createHash('sha256').update(data).digest('hex'),
      sourceHref: 'klicker-package-media://media-1',
    }

    expectImportError(
      createValidationPackage({ media: [media] }, {}, [
        { path: media.file, data },
      ]),
      ImportExportErrorCode.INVALID_PACKAGE
    )
  })
})
