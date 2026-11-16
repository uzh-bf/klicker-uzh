import { crc32, inflateRawSync } from 'node:zlib'
import { expect } from 'vitest'

// Independent reader: follows the end record to the central directory and
// then each local header, as a standard unzip tool would.
export function readZip(archive: Buffer) {
  const endOffset = archive.length - 22
  expect(archive.readUInt32LE(endOffset)).toBe(0x06054b50)
  const count = archive.readUInt16LE(endOffset + 10)
  let central = archive.readUInt32LE(endOffset + 16)
  const files: Record<string, Buffer> = {}
  for (let i = 0; i < count; i += 1) {
    expect(archive.readUInt32LE(central)).toBe(0x02014b50)
    const method = archive.readUInt16LE(central + 10)
    const checksum = archive.readUInt32LE(central + 16)
    const compressedSize = archive.readUInt32LE(central + 20)
    const size = archive.readUInt32LE(central + 24)
    const nameLength = archive.readUInt16LE(central + 28)
    const localOffset = archive.readUInt32LE(central + 42)
    const name = archive
      .subarray(central + 46, central + 46 + nameLength)
      .toString('utf8')
    expect(archive.readUInt32LE(localOffset)).toBe(0x04034b50)
    const localName = archive.readUInt16LE(localOffset + 26)
    const start = localOffset + 30 + localName
    const body = archive.subarray(start, start + compressedSize)
    const data = method === 8 ? inflateRawSync(body) : body
    expect(data.length).toBe(size)
    expect(crc32(data)).toBe(checksum)
    files[name] = Buffer.from(data)
    central += 46 + nameLength
  }
  return files
}
