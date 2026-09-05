import { describe, expect, it } from 'vitest'
import { createZip, parseZip } from '../src/lib/zip.js'

function descriptorArchive(signed: boolean) {
  const source = createZip([{ path: 'sheet.xml', data: '<sheet />' }])
  const end = source.length - 22
  const central = source.readUInt32LE(end + 16)
  const descriptor = Buffer.alloc(signed ? 16 : 12)
  if (signed) descriptor.writeUInt32LE(0x08074b50)
  source.copy(descriptor, signed ? 4 : 0, 14, 26)
  const result = Buffer.concat([
    source.subarray(0, central),
    descriptor,
    source.subarray(central),
  ])
  result.writeUInt16LE(0x0808, 6)
  result.fill(0, 14, 26)
  result.writeUInt16LE(0x0808, central + descriptor.length + 8)
  result.writeUInt32LE(
    central + descriptor.length,
    end + descriptor.length + 16
  )
  return { result, central, descriptor }
}

describe('spreadsheet ZIP compatibility', () => {
  it.each([
    true,
    false,
  ])('accepts bounded descriptors only when opted in (signature: %s)', (signed) => {
    const { result } = descriptorArchive(signed)
    expect(() => parseZip(result)).toThrow('descriptors are unsupported')
    expect(
      parseZip(result, { allowDataDescriptors: true })[0]!.data.toString()
    ).toBe('<sheet />')
  })

  it('rejects descriptor checksum/size mismatches and truncation', () => {
    for (const signed of [true, false]) {
      for (const field of [0, 4, 8]) {
        const { result, central } = descriptorArchive(signed)
        result.writeUInt32LE(123, central + (signed ? 4 : 0) + field)
        expect(() => parseZip(result, { allowDataDescriptors: true })).toThrow()
      }
      const { result, central, descriptor } = descriptorArchive(signed)
      const truncated = Buffer.concat([
        result.subarray(0, central + descriptor.length - 1),
        result.subarray(central + descriptor.length),
      ])
      truncated.writeUInt32LE(
        central + descriptor.length - 1,
        truncated.length - 6
      )
      expect(() =>
        parseZip(truncated, { allowDataDescriptors: true })
      ).toThrow()
    }
  })

  it('still enforces the decompression budget for descriptors', () => {
    const { result } = descriptorArchive(true)
    expect(() =>
      parseZip(result, { allowDataDescriptors: true, maxUncompressedBytes: 1 })
    ).toThrow()
  })
})
