import { inflateRawSync } from 'zlib'

type ZipFileInput = {
  path: string
  data: Buffer | string
}

type ParsedZipEntry = {
  path: string
  data: Buffer
  compressedSize: number
  uncompressedSize: number
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const STORE = 0
const DEFLATE = 8

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function validateZipPath(path: string) {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('..') ||
    path.includes('\\')
  ) {
    throw new Error(`Invalid ZIP entry path: ${path}`)
  }
}

export function createZip(files: ZipFileInput[]) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const file of files) {
    validateZipPath(file.path)

    const data = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data, 'utf8')
    const fileName = Buffer.from(file.path, 'utf8')
    const checksum = crc32(data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(STORE, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(fileName.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, fileName, data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(STORE, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(data.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(fileName.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, fileName)
    offset += localHeader.length + fileName.length + data.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const centralDirectoryOffset = offset
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(centralDirectoryOffset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset
    }
  }

  throw new Error('Invalid ZIP archive.')
}

export function parseZip(
  buffer: Buffer,
  {
    maxEntries = 200,
    maxUncompressedBytes = 10 * 1024 * 1024,
  }: { maxEntries?: number; maxUncompressedBytes?: number } = {}
) {
  const endOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)

  if (entryCount > maxEntries) {
    throw new Error('ZIP archive contains too many files.')
  }

  const entries: ParsedZipEntry[] = []
  let centralOffset = centralDirectoryOffset
  let totalUncompressedBytes = 0

  for (let ix = 0; ix < entryCount; ix++) {
    if (
      centralOffset + 46 > buffer.length ||
      buffer.readUInt32LE(centralOffset) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      throw new Error('Invalid ZIP central directory.')
    }

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10)
    const compressedSize = buffer.readUInt32LE(centralOffset + 20)
    const uncompressedSize = buffer.readUInt32LE(centralOffset + 24)
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28)
    const extraLength = buffer.readUInt16LE(centralOffset + 30)
    const commentLength = buffer.readUInt16LE(centralOffset + 32)
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42)
    const fileNameStart = centralOffset + 46
    const fileNameEnd = fileNameStart + fileNameLength

    if (fileNameEnd > buffer.length) {
      throw new Error('Invalid ZIP central directory entry.')
    }

    const path = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8')

    validateZipPath(path)

    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > maxUncompressedBytes) {
      throw new Error('ZIP archive is too large.')
    }

    if (
      localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new Error('Invalid ZIP local file header.')
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const localFileNameStart = localHeaderOffset + 30
    const localFileNameEnd = localFileNameStart + localFileNameLength
    const dataStart = localFileNameEnd + localExtraLength
    const dataEnd = dataStart + compressedSize

    if (localFileNameEnd > buffer.length) {
      throw new Error('Invalid ZIP local file name.')
    }

    const localPath = buffer
      .subarray(localFileNameStart, localFileNameEnd)
      .toString('utf8')

    if (localPath !== path) {
      throw new Error('ZIP central and local paths do not match.')
    }

    if (dataEnd > buffer.length) {
      throw new Error('Invalid ZIP entry size.')
    }

    const compressedData = buffer.subarray(dataStart, dataEnd)
    const data =
      compressionMethod === STORE
        ? Buffer.from(compressedData)
        : compressionMethod === DEFLATE
          ? inflateRawSync(compressedData)
          : null

    if (!data) {
      throw new Error('Unsupported ZIP compression method.')
    }

    if (data.length !== uncompressedSize) {
      throw new Error('Invalid ZIP entry length.')
    }

    entries.push({
      path,
      data,
      compressedSize,
      uncompressedSize,
    })

    centralOffset = fileNameEnd + extraLength + commentLength
  }

  return entries
}
