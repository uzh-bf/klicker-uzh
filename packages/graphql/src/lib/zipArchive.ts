// Minimal ZIP writer (PKZIP 2.0 features: store or deflate, no ZIP64, no
// encryption) so archives can be produced without an extra dependency.
import { crc32, deflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  data: Buffer | string
  modifiedAt?: Date
}

const MAX_ENTRIES = 0xffff
const MAX_BYTES = 0xffffffff

function dosDateTime(date: Date) {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107)
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      (date.getUTCSeconds() >> 1),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  }
}

function assertSafeName(name: string) {
  if (
    !name ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('Unsafe ZIP entry name')
  }
}

export function createZipArchive(entries: ZipEntry[]): Buffer {
  if (entries.length > MAX_ENTRIES) throw new Error('Too many ZIP entries')
  const seen = new Set<string>()
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    assertSafeName(entry.name)
    if (seen.has(entry.name)) throw new Error('Duplicate ZIP entry name')
    seen.add(entry.name)

    const name = Buffer.from(entry.name, 'utf8')
    const raw =
      typeof entry.data === 'string'
        ? Buffer.from(entry.data, 'utf8')
        : entry.data
    const deflated = deflateRawSync(raw)
    const useDeflate = deflated.length < raw.length
    const body = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const checksum = crc32(raw)
    const { time, date } = dosDateTime(entry.modifiedAt ?? new Date())
    // bit 11: file name is UTF-8
    const flags = 0x0800

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)

    localParts.push(local, name, body)
    centralParts.push(central, name)
    offset += local.length + name.length + body.length
    if (offset > MAX_BYTES) throw new Error('ZIP archive too large')
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  if (offset + centralSize > MAX_BYTES) throw new Error('ZIP archive too large')

  return Buffer.concat([...localParts, ...centralParts, end])
}
