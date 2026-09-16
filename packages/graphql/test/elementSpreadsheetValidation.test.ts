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
    const bytes = await writeKlickerWorkbook(tables, true)
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

    const elements = workbook.getWorksheet('Elements')!
    for (const address of ['H13', 'H14']) {
      const rule = elements.getCell(address).dataValidation
      expect(rule.type).toBe('list')
      // Excel's ignore-blank option would bypass a blank dependent source.
      expect(rule.allowBlank).not.toBe(true)
      expect(rule.errorStyle).toBe('stop')
      expect(rule.formulae![0]).toContain('KlickerUnused')
      expect(rule.formulae![0]).not.toMatch(/CONTENT|FLASHCARD/)
    }
    const feedback = elements.getCell('J8').dataValidation.formulae![0]
    expect(feedback).toContain('OR($H8=TRUE,$H8="TRUE")')
    expect(feedback).toContain('KlickerBooleans,KlickerFalse')
    expect(elements.getCell('G8').dataValidation.formulae![0]).toContain(
      'G8<=4'
    )
    expect(elements.getCell('L8').dataValidation.formulae![0]).toContain(
      'L8<=100'
    )
    expect(elements.getCell('Q107').dataValidation.formulae![0]).toContain(
      'Q107>0'
    )
    expect(elements.getCell('B107').dataValidation.type).toBe('list')
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
