import { describe, expect, it } from 'vitest'
import { createZipArchive } from '../src/lib/zipArchive.js'
import { readZip } from './fixtures/readZip.js'

describe('createZipArchive', () => {
  it('round-trips compressed and stored entries', () => {
    const big = 'synthetic line\n'.repeat(500)
    const files = readZip(
      createZipArchive([
        { name: 'a.json', data: big },
        { name: 'b.bin', data: Buffer.from([1]) },
        { name: 'ümlaut.txt', data: 'ä' },
      ])
    )
    expect(Object.keys(files)).toEqual(['a.json', 'b.bin', 'ümlaut.txt'])
    expect(files['a.json']?.toString()).toBe(big)
    expect(files['b.bin']).toEqual(Buffer.from([1]))
    expect(files['ümlaut.txt']?.toString()).toBe('ä')
  })

  it('refuses path traversal and duplicate names', () => {
    for (const name of ['../x', '/x', 'a/../b', 'a\\b', '', 'a//b']) {
      expect(() => createZipArchive([{ name, data: 'x' }])).toThrow()
    }
    expect(() =>
      createZipArchive([
        { name: 'x', data: '1' },
        { name: 'x', data: '2' },
      ])
    ).toThrow()
  })
})
