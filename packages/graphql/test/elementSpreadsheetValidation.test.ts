import { describe, expect, it } from 'vitest'
import { createElementSpreadsheetExamples } from '../src/lib/elementSpreadsheetExamples.js'
import { ELEMENT_SPREADSHEET_TABLES } from '../src/lib/elementSpreadsheetTables.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../src/lib/elementSpreadsheetWorkbook.js'
import { parseZip } from '../src/lib/zip.js'

function address(
  sheet: { getColumn: (index: number) => { letter: string } },
  headers: readonly string[],
  field: string,
  row = 8
) {
  return `${sheet.getColumn(headers.indexOf(field) + 1).letter}${row}`
}

describe('Excel one-row editing checks', () => {
  it('uses English headings, Yes/No lists, and local formula dependencies', async () => {
    const tables = createElementSpreadsheetExamples()
    const bytes = await writeKlickerWorkbook(tables)
    const workbook = await loadElementWorkbook(bytes)
    expect(readKlickerWorkbook(workbook).issues).toEqual([])

    const sc = workbook.getWorksheet('Single choice')!
    const scHeaders = ELEMENT_SPREADSHEET_TABLES['Single choice']
    expect(sc.getCell(address(sc, scHeaders, 'answer1', 6)).value).toBe(
      'Answer 1'
    )
    expect(sc.getCell(address(sc, scHeaders, 'correct1', 6)).value).toBe(
      'Correct 1?'
    )
    const correct10 = sc.getCell(
      address(sc, scHeaders, 'correct10')
    ).dataValidation
    expect(correct10.type).toBe('list')
    expect(correct10.formulae![0]).toContain('KlickerBooleans')
    expect(correct10.formulae![0]).toMatch(/^INDIRECT\(IFERROR\(/)

    const numerical = workbook.getWorksheet('Numerical')!
    const numericalHeaders = ELEMENT_SPREADSHEET_TABLES.Numerical
    expect(
      numerical.getCell(address(numerical, numericalHeaders, 'solution6'))
        .dataValidation.formulae![0]
    ).toContain('IFERROR')
    expect(
      numerical.getCell(address(numerical, numericalHeaders, 'accuracy'))
        .dataValidation.formulae![0]
    ).toContain('<=100')
    const freeText = workbook.getWorksheet('Free text')!
    expect(
      freeText.getCell(
        address(
          freeText,
          ELEMENT_SPREADSHEET_TABLES['Free text'],
          'solution6',
          1007
        )
      ).dataValidation.formulae![0]
    ).toContain('IFERROR')

    for (const worksheet of workbook.worksheets) {
      worksheet.eachRow((row) =>
        row.eachCell((cell) => {
          for (const formula of cell.dataValidation?.formulae ?? []) {
            expect(formula).not.toContain('MATCH(')
            expect(formula.length).toBeLessThanOrEqual(255)
          }
        })
      )
    }
    expect(workbook.getWorksheet('Instructions')!.getColumn('E').hidden).toBe(
      true
    )
    expect(workbook.getWorksheet('Instructions')!.getCell('E1').value).toBe(
      'Yes'
    )
    expect(workbook.getWorksheet('Instructions')!.getCell('E2').value).toBe(
      'No'
    )
  })

  it('retains validation formatting in serialized XLSX', async () => {
    const bytes = await writeKlickerWorkbook(createElementSpreadsheetExamples())
    const styles = parseZip(bytes, {
      maxEntries: 250,
      maxUncompressedBytes: 20 * 1024 * 1024,
      allowDirectories: true,
      allowDataDescriptors: true,
    })
      .find((entry) => entry.path === 'xl/styles.xml')!
      .data.toString('utf8')
    expect(styles).toContain('<bgColor rgb="FFFFDBCC"/>')
    expect(styles).toContain('<bgColor rgb="FFE9E9E9"/>')
  })
})
