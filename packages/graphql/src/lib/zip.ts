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
const DATA_DESCRIPTOR_FLAG = 0x0008
const UTF8_FILENAME_FLAG = 0x0800
const SUPPORTED_GENERAL_PURPOSE_FLAGS = UTF8_FILENAME_FLAG

export class InvalidZipError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message)
    this.name = 'InvalidZipError'
  }
}

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
  const segments = path.split('/')
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('\\') ||
    /^[A-Za-z]:/.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path !== path.normalize('NFC') ||
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..'
    )
  ) {
    throw new InvalidZipError(`Invalid ZIP entry path: ${path}`)
  }
}

function decodeZipPath(
  bytes: Buffer,
  usesUtf8: boolean,
  allowDirectories = false
) {
  if (!usesUtf8 && bytes.some((byte) => byte > 0x7f)) {
    throw new InvalidZipError('ZIP entry path must be UTF-8.')
  }

  let path: string
  try {
    path = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw new InvalidZipError('Invalid ZIP entry path encoding.', error)
  }

  validateZipPath(
    allowDirectories && path.endsWith('/') ? path.slice(0, -1) : path
  )
  return path
}

export function createZip(files: ZipFileInput[]) {
  if (files.length > 0xffff) {
    throw new InvalidZipError('ZIP archive contains too many files.')
  }

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  const paths = new Set<string>()
  let offset = 0

  for (const file of files) {
    validateZipPath(file.path)
    if (paths.has(file.path)) {
      throw new InvalidZipError('ZIP archive contains duplicate paths.')
    }
    paths.add(file.path)

    const data = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data, 'utf8')
    const fileName = Buffer.from(file.path, 'utf8')
    if (fileName.length > 0xffff || data.length > 0xffff_ffff) {
      throw new InvalidZipError('ZIP entry is too large.')
    }
    const checksum = crc32(data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(UTF8_FILENAME_FLAG, 6)
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
    centralHeader.writeUInt16LE(UTF8_FILENAME_FLAG, 8)
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
    if (offset > 0xffff_ffff) {
      throw new InvalidZipError('ZIP archive is too large.')
    }
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
  if (buffer.length < 22) {
    throw new InvalidZipError('Invalid ZIP archive.')
  }

  const minOffset = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (
      buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      return offset
    }
  }

  throw new InvalidZipError('Invalid ZIP archive.')
}

export function parseZip(
  buffer: Buffer,
  {
    maxEntries = 200,
    maxUncompressedBytes = 10 * 1024 * 1024,
    allowDirectories = false,
    allowDataDescriptors = false,
  }: {
    maxEntries?: number
    maxUncompressedBytes?: number
    allowDirectories?: boolean
    allowDataDescriptors?: boolean
  } = {}
) {
  if (
    !Number.isInteger(maxEntries) ||
    maxEntries < 0 ||
    !Number.isInteger(maxUncompressedBytes) ||
    maxUncompressedBytes < 0
  ) {
    throw new InvalidZipError('Invalid ZIP parser limits.')
  }

  const endOffset = findEndOfCentralDirectory(buffer)
  const diskNumber = buffer.readUInt16LE(endOffset + 4)
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6)
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8)
  const entryCount = buffer.readUInt16LE(endOffset + 10)
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12)
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount
  ) {
    throw new InvalidZipError('Multi-disk ZIP archives are unsupported.')
  }

  if (
    centralDirectoryOffset + centralDirectorySize !== endOffset ||
    centralDirectoryOffset > endOffset
  ) {
    throw new InvalidZipError('Invalid ZIP central directory bounds.')
  }

  if (entryCount > maxEntries) {
    throw new InvalidZipError('ZIP archive contains too many files.')
  }

  const entries: ParsedZipEntry[] = []
  let centralOffset = centralDirectoryOffset
  let totalUncompressedBytes = 0
  const paths = new Set<string>()
  const localHeaderOffsets = new Set<number>()
  const localRanges: Array<{ start: number; end: number }> = []
  const centralDirectoryEnd = endOffset

  for (let ix = 0; ix < entryCount; ix++) {
    if (
      centralOffset + 46 > centralDirectoryEnd ||
      buffer.readUInt32LE(centralOffset) !== CENTRAL_DIRECTORY_SIGNATURE
    ) {
      throw new InvalidZipError('Invalid ZIP central directory.')
    }

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10)
    const generalPurposeBitFlag = buffer.readUInt16LE(centralOffset + 8)
    const expectedChecksum = buffer.readUInt32LE(centralOffset + 16)
    const compressedSize = buffer.readUInt32LE(centralOffset + 20)
    const uncompressedSize = buffer.readUInt32LE(centralOffset + 24)
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28)
    const extraLength = buffer.readUInt16LE(centralOffset + 30)
    const commentLength = buffer.readUInt16LE(centralOffset + 32)
    const diskStart = buffer.readUInt16LE(centralOffset + 34)
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42)
    const fileNameStart = centralOffset + 46
    const fileNameEnd = fileNameStart + fileNameLength
    const centralEntryEnd = fileNameEnd + extraLength + commentLength

    if (centralEntryEnd > centralDirectoryEnd || diskStart !== 0) {
      throw new InvalidZipError('Invalid ZIP central directory entry.')
    }

    const hasDescriptor = Boolean(generalPurposeBitFlag & DATA_DESCRIPTOR_FLAG)
    if (hasDescriptor && !allowDataDescriptors) {
      throw new InvalidZipError('ZIP data descriptors are unsupported.')
    }

    const supportedFlags =
      SUPPORTED_GENERAL_PURPOSE_FLAGS |
      (allowDataDescriptors ? DATA_DESCRIPTOR_FLAG : 0)
    if ((generalPurposeBitFlag & ~supportedFlags) !== 0) {
      throw new InvalidZipError('Unsupported ZIP entry flags.')
    }

    if (compressionMethod !== STORE && compressionMethod !== DEFLATE) {
      throw new InvalidZipError('Unsupported ZIP compression method.')
    }

    const centralFileName = buffer.subarray(fileNameStart, fileNameEnd)
    const path = decodeZipPath(
      centralFileName,
      Boolean(generalPurposeBitFlag & UTF8_FILENAME_FLAG),
      allowDirectories
    )
    if (paths.has(path)) {
      throw new InvalidZipError('ZIP archive contains duplicate paths.')
    }
    paths.add(path)

    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > maxUncompressedBytes) {
      throw new InvalidZipError('ZIP archive is too large.')
    }

    if (
      localHeaderOffset + 30 > centralDirectoryOffset ||
      buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      throw new InvalidZipError('Invalid ZIP local file header.')
    }
    if (localHeaderOffsets.has(localHeaderOffset)) {
      throw new InvalidZipError('ZIP local file headers overlap.')
    }
    localHeaderOffsets.add(localHeaderOffset)

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const localFlags = buffer.readUInt16LE(localHeaderOffset + 6)
    const localCompressionMethod = buffer.readUInt16LE(localHeaderOffset + 8)
    const localChecksum = buffer.readUInt32LE(localHeaderOffset + 14)
    const localCompressedSize = buffer.readUInt32LE(localHeaderOffset + 18)
    const localUncompressedSize = buffer.readUInt32LE(localHeaderOffset + 22)
    const localFileNameStart = localHeaderOffset + 30
    const localFileNameEnd = localFileNameStart + localFileNameLength
    const dataStart = localFileNameEnd + localExtraLength
    const dataEnd = dataStart + compressedSize

    if (
      dataStart > centralDirectoryOffset ||
      dataEnd > centralDirectoryOffset
    ) {
      throw new InvalidZipError('Invalid ZIP local file name.')
    }

    const localFileName = buffer.subarray(localFileNameStart, localFileNameEnd)
    const localPath = decodeZipPath(
      localFileName,
      Boolean(localFlags & UTF8_FILENAME_FLAG),
      allowDirectories
    )

    if (!localFileName.equals(centralFileName) || localPath !== path) {
      throw new InvalidZipError('ZIP central and local paths do not match.')
    }

    if (
      localFlags !== generalPurposeBitFlag ||
      localCompressionMethod !== compressionMethod
    ) {
      throw new InvalidZipError('ZIP central and local metadata do not match.')
    }

    const localSizeMetadataMatches =
      localChecksum === expectedChecksum &&
      localCompressedSize === compressedSize &&
      localUncompressedSize === uncompressedSize

    const deferredSizeMetadata =
      hasDescriptor &&
      localChecksum === 0 &&
      localCompressedSize === 0 &&
      localUncompressedSize === 0
    if (!localSizeMetadataMatches && !deferredSizeMetadata) {
      throw new InvalidZipError('ZIP central and local metadata do not match.')
    }

    let localRecordEnd = dataEnd
    if (hasDescriptor) {
      // Descriptors immediately follow the bounded compressed payload. Accept
      // standard 32-bit signed/unsigned descriptors only, never scan for them.
      const signed =
        dataEnd + 4 <= centralDirectoryOffset &&
        buffer.readUInt32LE(dataEnd) === 0x08074b50
      const descriptorStart = dataEnd + (signed ? 4 : 0)
      localRecordEnd = descriptorStart + 12
      if (
        localRecordEnd > centralDirectoryOffset ||
        buffer.readUInt32LE(descriptorStart) !== expectedChecksum ||
        buffer.readUInt32LE(descriptorStart + 4) !== compressedSize ||
        buffer.readUInt32LE(descriptorStart + 8) !== uncompressedSize
      ) {
        throw new InvalidZipError('Invalid ZIP data descriptor.')
      }
    }

    if (compressionMethod === STORE && compressedSize !== uncompressedSize) {
      throw new InvalidZipError('Invalid stored ZIP entry size.')
    }

    const compressedData = buffer.subarray(dataStart, dataEnd)
    let data: Buffer
    try {
      if (compressionMethod === STORE) {
        data = Buffer.from(compressedData)
      } else {
        const inflated = inflateRawSync(compressedData, {
          info: true,
          maxOutputLength: Math.max(1, uncompressedSize),
        }) as unknown as {
          buffer: Buffer
          engine: { bytesWritten: number }
        }
        if (inflated.engine.bytesWritten !== compressedData.length) {
          throw new InvalidZipError('Invalid ZIP compressed data length.')
        }
        data = inflated.buffer
      }
    } catch (error) {
      if (error instanceof InvalidZipError) throw error
      throw new InvalidZipError('Invalid ZIP compressed data.', error)
    }

    if (data.length !== uncompressedSize) {
      throw new InvalidZipError('Invalid ZIP entry length.')
    }

    if (path.endsWith('/') && data.length !== 0) {
      throw new InvalidZipError('ZIP directory entry contains data.')
    }

    if (crc32(data) !== expectedChecksum) {
      throw new InvalidZipError('Invalid ZIP entry checksum.')
    }

    entries.push({
      path,
      data,
      compressedSize,
      uncompressedSize,
    })
    localRanges.push({ start: localHeaderOffset, end: localRecordEnd })

    centralOffset = centralEntryEnd
  }

  if (centralOffset !== centralDirectoryEnd) {
    throw new InvalidZipError('Invalid ZIP central directory size.')
  }

  localRanges.sort((left, right) => left.start - right.start)
  let expectedLocalOffset = 0
  for (const range of localRanges) {
    if (range.start !== expectedLocalOffset || range.end < range.start) {
      throw new InvalidZipError('ZIP local file ranges are not canonical.')
    }
    expectedLocalOffset = range.end
  }
  if (expectedLocalOffset !== centralDirectoryOffset) {
    throw new InvalidZipError('ZIP local file ranges are incomplete.')
  }

  return entries
}
