import { describe, expect, it } from 'vitest'
import { createElementSpreadsheetExamples } from '../src/lib/elementSpreadsheetExamples.js'
import { ELEMENT_SPREADSHEET_TABLES } from '../src/lib/elementSpreadsheetTables.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../src/lib/elementSpreadsheetWorkbook.js'
import { parseZip } from '../src/lib/zip.js'

describe('Excel editing checks', () => {
  it('preserves dependent lists and numeric checks without changing imported data', async () => {
    const tables = createElementSpreadsheetExamples()
    const bytes = await writeKlickerWorkbook(tables)
    const workbook = await loadElementWorkbook(bytes)
    const read = readKlickerWorkbook(workbook)
    expect(read.issues).toEqual([])
    for (const name of Object.keys(tables) as (keyof typeof tables)[]) {
      expect(read.tables[name].map((row) => row.values)).toEqual(
        tables[name].map((row) =>
          Object.fromEntries(
            ELEMENT_SPREADSHEET_TABLES[name].map((field) => [
              field,
              row.values[field] ?? null,
            ])
          )
        )
      )
    }

    const elements = workbook.getWorksheet('Single choice')!
    for (const address of ['G8', 'G9']) {
      const rule = elements.getCell(address).dataValidation
      expect(rule.type).toBe('list')
      expect(rule.allowBlank).not.toBe(true)
      expect(rule.errorStyle).toBe('stop')
      expect(rule.formulae![0]).toContain('KlickerUnused')
    }
    expect(elements.getCell('I8').dataValidation.formulae![0]).toContain(
      'KlickerFalse'
    )
    expect(elements.getCell('F8').dataValidation.formulae![0]).toContain(
      'F8<=4'
    )
    const numerical = workbook.getWorksheet('Numerical')!
    expect(numerical.getCell('I8').dataValidation.formulae![0]).toContain(
      'I8<=100'
    )
    expect(
      workbook.getWorksheet('Free text')!.getCell('H1007').dataValidation
        .formulae![0]
    ).toContain('H8>0')
    expect(workbook.getWorksheet('Content')!.getRow(6).values).toEqual([
      ,
      'ref',
      'name',
      'content',
      'explanation',
    ])
    expect(workbook.getWorksheet('Flashcards')!.getRow(6).values).toEqual([
      ,
      'ref',
      'name',
      'content',
      'explanation',
    ])
    // Native Excel uses the differential fill's background color.
    const styles = parseZip(bytes, {
      maxEntries: 250,
      maxUncompressedBytes: 20 * 1024 * 1024,
      allowDirectories: true,
      allowDataDescriptors: true,
    })
      .find((entry) => entry.path === 'xl/styles.xml')!
      .data.toString('utf8')
    const differentialStyles = styles.match(/<dxfs[\s\S]*?<\/dxfs>/)![0]
    expect(differentialStyles).toContain('<bgColor rgb="FFFFDBCC"/>')
    expect(differentialStyles).toContain('<bgColor rgb="FFE9E9E9"/>')
    expect(workbook.getWorksheet('Instructions')!.getColumn('E').hidden).toBe(
      true
    )
    expect(workbook.getWorksheet('Instructions')!.getColumn('H').hidden).toBe(
      true
    )
  })
})
