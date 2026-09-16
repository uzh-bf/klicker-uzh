import { describe, expect, it } from 'vitest'
import { createZip, parseZip } from '../src/lib/zip.js'
import { parseElementImportFile } from '../src/services/elementFileImportParser.js'
import { createNineTypeImportPackage } from './fixtures/importExportNineTypes.js'

const fixture = () => createNineTypeImportPackage()
const loose = (entries: ReturnType<typeof parseZip>) =>
  Buffer.from(
    JSON.stringify({
      type: 'klicker-json-files',
      version: 1,
      files: entries.map(({ path, data }) => ({
        name: path.split('/').pop(),
        content: data.toString('utf8'),
      })),
    })
  )
describe('JSON-only file import', () => {
  it('imports all nine types and their collection from an exported ZIP', async () => {
    const result = await parseElementImportFile(fixture().buffer)
    expect(result.elements).toHaveLength(9)
    expect(result.answerCollections).toHaveLength(1)
    expect(result.issues).toEqual([])
    expect(
      result.sources.every(
        (source) => source.row === 0 && source.sheet.endsWith('.json')
      )
    ).toBe(true)
  })
  it('imports extracted files independent of selection order', async () => {
    const entries = parseZip(fixture().buffer).reverse()
    const result = await parseElementImportFile(loose(entries))
    expect(result.elements).toHaveLength(9)
    expect(result.answerCollections).toHaveLength(1)
    expect(result.issues).toEqual([])
  })
  it('imports one JSON element with its original arbitrary ref', async () => {
    const entry = parseZip(fixture().buffer).find(
      ({ path, data }) =>
        path.startsWith('elements/') &&
        JSON.parse(data.toString()).type === 'CONTENT'
    )!
    const result = await parseElementImportFile(entry.data)
    expect(result.elements[0]?.ref).toBe(JSON.parse(entry.data.toString()).ref)
    expect(result.elements).toHaveLength(1)
  })
  it('requires a collection file for a selected case-study subset', async () => {
    const entries = parseZip(fixture().buffer)
    const element = entries.find(
      ({ path, data }) =>
        path.startsWith('elements/') &&
        JSON.parse(data.toString()).type === 'CASE_STUDY'
    )!
    const collection = entries.find(({ path }) =>
      path.startsWith('answer-collections/')
    )!
    await expect(parseElementImportFile(loose([element]))).rejects.toThrow()
    const result = await parseElementImportFile(loose([element, collection]))
    expect(result.elements[0]?.type).toBe('CASE_STUDY')
    expect(result.answerCollections).toHaveLength(1)
  })
  it('rejects duplicate refs, unsafe refs, unknown fields and invalid UTF-8', async () => {
    const entry = parseZip(fixture().buffer).find(
      ({ path, data }) =>
        path.startsWith('elements/') &&
        JSON.parse(data.toString()).type === 'CONTENT'
    )!
    await expect(
      parseElementImportFile(loose([entry, entry]))
    ).rejects.toThrow()
    const original = JSON.parse(entry.data.toString())
    for (const value of [
      { ...original, ref: '../escape' },
      { ...original, unexpected: true },
    ]) {
      await expect(
        parseElementImportFile(Buffer.from(JSON.stringify(value)))
      ).rejects.toThrow()
    }
    await expect(parseElementImportFile(Buffer.from([0xff]))).rejects.toThrow()
  })
  it('rejects oversized individual JSON documents before canonical parsing', async () => {
    const value = Buffer.from(
      JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024) })
    )
    await expect(parseElementImportFile(value)).rejects.toThrow()
  })
  it('rejects ZIP entries outside the declared JSON closure', async () => {
    const entries = parseZip(fixture().buffer)
    await expect(
      parseElementImportFile(
        createZip([...entries, { path: 'extra.json', data: '{}' }])
      )
    ).rejects.toThrow()
  })
})
