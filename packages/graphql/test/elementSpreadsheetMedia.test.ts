import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyElementSpreadsheetTables } from '../src/lib/elementSpreadsheetTables.js'
import { writeKlickerWorkbook } from '../src/lib/elementSpreadsheetWorkbook.js'
import { parseElementSpreadsheet } from '../src/services/elementSpreadsheet.js'

afterEach(() => vi.unstubAllEnvs())

describe('spreadsheet image reference policy', () => {
  it('retains first-party URLs without requiring a blob or media record and rejects other auto-loading URLs per element', async () => {
    vi.stubEnv('BLOB_STORAGE_ACCOUNT_NAME', 'syntheticspreadsheet')
    const tables = emptyElementSpreadsheetTables()
    const hrefs = [
      'https://syntheticspreadsheet.blob.core.windows.net/source-owner/unavailable.png',
      'https://unrelated.invalid/picture.png',
      'http://127.0.0.1/private.png',
    ]
    tables.Content = hrefs.map((href, index) => ({
      sheet: 'Content',
      row: index + 2,
      values: {
        name: `Image ${index}`,
        content: `![Image](${href})`,
      },
    }))
    const result = await parseElementSpreadsheet(
      await writeKlickerWorkbook(tables)
    )
    expect(result.elements).toHaveLength(1)
    expect(result.elements[0]!.content).toContain(hrefs[0])
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        ref: 'excel-content-8',
        code: 'SOURCE_IMAGE_DEPENDENCY',
      })
    )
    expect(
      result.issues
        .filter((issue) => issue.code === 'INVALID_IMAGE_URL')
        .map((issue) => issue.row)
    ).toEqual([9, 10])
  })
})
