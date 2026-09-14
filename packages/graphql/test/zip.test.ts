import { deflateRawSync } from 'node:zlib'

import { createZip, InvalidZipError, parseZip } from '../src/lib/zip.js'

const END_OF_CENTRAL_DIRECTORY_LENGTH = 22

type ParseZipOptions = Parameters<typeof parseZip>[1]

type SingleEntryLayout = {
  centralDirectoryOffset: number
  endOfCentralDirectoryOffset: number
  localHeaderOffset: number
  dataStart: number
}

function getSingleEntryLayout(buffer: Buffer): SingleEntryLayout {
  const endOfCentralDirectoryOffset =
    buffer.length - END_OF_CENTRAL_DIRECTORY_LENGTH
  const centralDirectoryOffset = buffer.readUInt32LE(
    endOfCentralDirectoryOffset + 16
  )
  const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42)
  const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
  const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)

  return {
    centralDirectoryOffset,
    endOfCentralDirectoryOffset,
    localHeaderOffset,
    dataStart: localHeaderOffset + 30 + localFileNameLength + localExtraLength,
  }
}

function expectInvalidZip(
  buffer: Buffer,
  label: string,
  options?: ParseZipOptions
) {
  let thrown: unknown

  try {
    parseZip(buffer, options)
  } catch (error) {
    thrown = error
  }

  expect(thrown, label).toBeInstanceOf(InvalidZipError)
}

function expectInvalidZipCall(operation: () => unknown, label: string) {
  let thrown: unknown

  try {
    operation()
  } catch (error) {
    thrown = error
  }

  expect(thrown, label).toBeInstanceOf(InvalidZipError)
}

function replaceArchivePath(buffer: Buffer, from: string, to: string): Buffer {
  const fromBytes = Buffer.from(from, 'utf8')
  const toBytes = Buffer.from(to, 'utf8')
  if (fromBytes.length !== toBytes.length) {
    throw new Error('ZIP path replacements must preserve byte length.')
  }

  const rewritten = Buffer.from(buffer)
  let cursor = 0
  let replacements = 0
  while ((cursor = rewritten.indexOf(fromBytes, cursor)) !== -1) {
    toBytes.copy(rewritten, cursor)
    cursor += toBytes.length
    replacements++
  }

  if (replacements !== 2) {
    throw new Error(
      `Expected one local and one central path, found ${replacements}.`
    )
  }

  return rewritten
}

function addArchiveComment(buffer: Buffer, comment: Buffer): Buffer {
  const rewritten = Buffer.from(buffer)
  rewritten.writeUInt16LE(
    comment.length,
    rewritten.length - END_OF_CENTRAL_DIRECTORY_LENGTH + 20
  )
  return Buffer.concat([rewritten, comment])
}

function addPrefix(buffer: Buffer, prefix: Buffer): Buffer {
  const layout = getSingleEntryLayout(buffer)
  const rewritten = Buffer.concat([prefix, buffer])
  const shiftedCentralOffset = layout.centralDirectoryOffset + prefix.length
  const shiftedEndOffset = layout.endOfCentralDirectoryOffset + prefix.length

  rewritten.writeUInt32LE(
    layout.localHeaderOffset + prefix.length,
    shiftedCentralOffset + 42
  )
  rewritten.writeUInt32LE(shiftedCentralOffset, shiftedEndOffset + 16)

  return rewritten
}

function addLocalCentralGap(buffer: Buffer, gap: Buffer): Buffer {
  const layout = getSingleEntryLayout(buffer)
  const rewritten = Buffer.concat([
    buffer.subarray(0, layout.centralDirectoryOffset),
    gap,
    buffer.subarray(layout.centralDirectoryOffset),
  ])
  const shiftedEndOffset = layout.endOfCentralDirectoryOffset + gap.length

  rewritten.writeUInt32LE(
    layout.centralDirectoryOffset + gap.length,
    shiftedEndOffset + 16
  )

  return rewritten
}

function createDeflatedZip(
  path: string,
  data: Buffer,
  compressedSuffix = Buffer.alloc(0)
) {
  const stored = createZip([{ path, data }])
  const layout = getSingleEntryLayout(stored)
  const fileName = Buffer.from(path, 'utf8')
  const compressedData = Buffer.concat([deflateRawSync(data), compressedSuffix])

  const localHeader = Buffer.from(stored.subarray(0, 30))
  localHeader.writeUInt16LE(8, 8)
  localHeader.writeUInt32LE(compressedData.length, 18)

  const centralHeader = Buffer.from(
    stored.subarray(
      layout.centralDirectoryOffset,
      layout.centralDirectoryOffset + 46
    )
  )
  centralHeader.writeUInt16LE(8, 10)
  centralHeader.writeUInt32LE(compressedData.length, 20)

  const centralDirectory = Buffer.concat([centralHeader, fileName])
  const centralDirectoryOffset =
    localHeader.length + fileName.length + compressedData.length
  const endOfCentralDirectory = Buffer.from(
    stored.subarray(layout.endOfCentralDirectoryOffset)
  )
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16)

  return Buffer.concat([
    localHeader,
    fileName,
    compressedData,
    centralDirectory,
    endOfCentralDirectory,
  ])
}

function createDeterministicBytes(seed: number, length: number) {
  const buffer = Buffer.alloc(length)
  let state = seed >>> 0

  for (let index = 0; index < length; index++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    buffer[index] = state & 0xff
  }

  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  let signatureOffset = buffer.indexOf(endSignature)
  while (signatureOffset !== -1) {
    buffer[signatureOffset] = buffer[signatureOffset]! ^ 0xff
    signatureOffset = buffer.indexOf(endSignature, signatureOffset + 1)
  }

  return buffer
}

describe('strict ZIP archive parser', () => {
  it('round-trips canonical stored and deflated entries', () => {
    const stored = createZip([
      { path: 'manifest.json', data: '{"version":3}' },
      { path: 'elements/file..json', data: Buffer.from([0, 1, 2, 255]) },
      { path: 'media/caf\u00e9.png', data: 'media' },
    ])

    expect(parseZip(stored)).toEqual([
      {
        path: 'manifest.json',
        data: Buffer.from('{"version":3}'),
        compressedSize: 13,
        uncompressedSize: 13,
      },
      {
        path: 'elements/file..json',
        data: Buffer.from([0, 1, 2, 255]),
        compressedSize: 4,
        uncompressedSize: 4,
      },
      {
        path: 'media/caf\u00e9.png',
        data: Buffer.from('media'),
        compressedSize: 5,
        uncompressedSize: 5,
      },
    ])

    const deflatedData = Buffer.from('compressible '.repeat(64))
    const deflated = createDeflatedZip('elements/deflated.json', deflatedData)
    expect(parseZip(deflated)).toEqual([
      expect.objectContaining({
        path: 'elements/deflated.json',
        data: deflatedData,
        uncompressedSize: deflatedData.length,
      }),
    ])
  })

  it('rejects data-descriptor entries instead of interpreting descriptor bytes', () => {
    const buffer = createZip([{ path: 'file.txt', data: 'content' }])
    const rewritten = Buffer.from(buffer)
    const { centralDirectoryOffset, localHeaderOffset } =
      getSingleEntryLayout(rewritten)

    rewritten.writeUInt16LE(
      rewritten.readUInt16LE(localHeaderOffset + 6) | 0x0008,
      localHeaderOffset + 6
    )
    rewritten.writeUInt16LE(
      rewritten.readUInt16LE(centralDirectoryOffset + 8) | 0x0008,
      centralDirectoryOffset + 8
    )

    expectInvalidZip(rewritten, 'data-descriptor flag')
  })

  it('validates all EOCD disk, count, size, offset, and comment bounds', () => {
    const valid = createZip([{ path: 'file.txt', data: 'content' }])
    const layout = getSingleEntryLayout(valid)
    const mutations: Array<[string, (buffer: Buffer) => void]> = [
      [
        'non-zero disk number',
        (buffer) =>
          buffer.writeUInt16LE(1, layout.endOfCentralDirectoryOffset + 4),
      ],
      [
        'non-zero central-directory disk',
        (buffer) =>
          buffer.writeUInt16LE(1, layout.endOfCentralDirectoryOffset + 6),
      ],
      [
        'per-disk entry-count mismatch',
        (buffer) =>
          buffer.writeUInt16LE(0, layout.endOfCentralDirectoryOffset + 8),
      ],
      [
        'declared extra central entry',
        (buffer) => {
          buffer.writeUInt16LE(2, layout.endOfCentralDirectoryOffset + 8)
          buffer.writeUInt16LE(2, layout.endOfCentralDirectoryOffset + 10)
        },
      ],
      [
        'central-directory size too small',
        (buffer) =>
          buffer.writeUInt32LE(
            buffer.readUInt32LE(layout.endOfCentralDirectoryOffset + 12) - 1,
            layout.endOfCentralDirectoryOffset + 12
          ),
      ],
      [
        'central-directory size too large',
        (buffer) =>
          buffer.writeUInt32LE(
            buffer.readUInt32LE(layout.endOfCentralDirectoryOffset + 12) + 1,
            layout.endOfCentralDirectoryOffset + 12
          ),
      ],
      [
        'central-directory offset too small',
        (buffer) =>
          buffer.writeUInt32LE(
            layout.centralDirectoryOffset - 1,
            layout.endOfCentralDirectoryOffset + 16
          ),
      ],
      [
        'central-directory offset too large',
        (buffer) =>
          buffer.writeUInt32LE(
            layout.centralDirectoryOffset + 1,
            layout.endOfCentralDirectoryOffset + 16
          ),
      ],
      [
        'comment declared but absent',
        (buffer) =>
          buffer.writeUInt16LE(1, layout.endOfCentralDirectoryOffset + 20),
      ],
    ]

    for (const [label, mutate] of mutations) {
      const rewritten = Buffer.from(valid)
      mutate(rewritten)
      expectInvalidZip(rewritten, label)
    }

    expectInvalidZip(
      Buffer.concat([valid, Buffer.from([0])]),
      'undeclared trailing byte'
    )

    const withComment = addArchiveComment(valid, Buffer.from('comment'))
    expect(parseZip(withComment)).toEqual(parseZip(valid))

    const truncatedComment = withComment.subarray(0, withComment.length - 1)
    expectInvalidZip(truncatedComment, 'truncated declared comment')
  })

  it('rejects duplicate, non-canonical, and ambiguously encoded paths', () => {
    expectInvalidZipCall(
      () =>
        createZip([
          { path: 'same.txt', data: 'one' },
          { path: 'same.txt', data: 'two' },
        ]),
      'duplicate writer path'
    )

    const duplicate = replaceArchivePath(
      createZip([
        { path: 'one.txt', data: 'one' },
        { path: 'two.txt', data: 'two' },
      ]),
      'two.txt',
      'one.txt'
    )
    expectInvalidZip(duplicate, 'duplicate parser path')

    const invalidPaths = [
      '',
      '/absolute.txt',
      '\\absolute.txt',
      'C:/absolute.txt',
      'safe\\windows.txt',
      'safe/../escape.txt',
      'safe/./file.txt',
      'safe//file.txt',
      'safe/directory/',
      'safe/null\u0000.txt',
      'safe/control\n.txt',
      'media/cafe\u0301.png',
    ]

    for (const path of invalidPaths) {
      expectInvalidZipCall(
        () => createZip([{ path, data: 'content' }]),
        `non-canonical writer path ${JSON.stringify(path)}`
      )
    }

    const invalidUtf8 = createZip([{ path: 'x', data: 'content' }])
    const invalidUtf8Layout = getSingleEntryLayout(invalidUtf8)
    invalidUtf8[invalidUtf8Layout.localHeaderOffset + 30] = 0xff
    invalidUtf8[invalidUtf8Layout.centralDirectoryOffset + 46] = 0xff
    expectInvalidZip(invalidUtf8, 'invalid UTF-8 path')

    const missingUtf8Flag = createZip([
      { path: 'media/caf\u00e9.png', data: 'content' },
    ])
    const missingUtf8FlagLayout = getSingleEntryLayout(missingUtf8Flag)
    missingUtf8Flag.writeUInt16LE(
      missingUtf8Flag.readUInt16LE(
        missingUtf8FlagLayout.localHeaderOffset + 6
      ) & ~0x0800,
      missingUtf8FlagLayout.localHeaderOffset + 6
    )
    missingUtf8Flag.writeUInt16LE(
      missingUtf8Flag.readUInt16LE(
        missingUtf8FlagLayout.centralDirectoryOffset + 8
      ) & ~0x0800,
      missingUtf8FlagLayout.centralDirectoryOffset + 8
    )
    expectInvalidZip(missingUtf8Flag, 'non-ASCII path without UTF-8 flag')
  })

  it('rejects archive prefixes, local gaps, unclaimed records, and overlaps', () => {
    const valid = createZip([{ path: 'file.txt', data: 'content' }])

    expectInvalidZip(addPrefix(valid, Buffer.from('SFX!')), 'archive prefix')
    expectInvalidZip(
      addLocalCentralGap(valid, Buffer.from([0])),
      'local-to-central gap'
    )

    const extraArchive = createZip([{ path: 'extra.txt', data: 'extra' }])
    const extraLocalRecord = extraArchive.subarray(
      0,
      getSingleEntryLayout(extraArchive).centralDirectoryOffset
    )
    expectInvalidZip(
      addLocalCentralGap(valid, extraLocalRecord),
      'unclaimed local record'
    )

    const centralOverlap = Buffer.from(valid)
    const centralOverlapLayout = getSingleEntryLayout(centralOverlap)
    centralOverlap.writeUInt32LE(
      0,
      centralOverlapLayout.endOfCentralDirectoryOffset + 16
    )
    centralOverlap.writeUInt32LE(
      centralOverlapLayout.endOfCentralDirectoryOffset,
      centralOverlapLayout.endOfCentralDirectoryOffset + 12
    )
    expectInvalidZip(centralOverlap, 'central directory overlaps local data')

    const localPointsIntoCentral = Buffer.from(valid)
    const localPointsIntoCentralLayout = getSingleEntryLayout(
      localPointsIntoCentral
    )
    localPointsIntoCentral.writeUInt32LE(
      localPointsIntoCentralLayout.centralDirectoryOffset,
      localPointsIntoCentralLayout.centralDirectoryOffset + 42
    )
    expectInvalidZip(
      localPointsIntoCentral,
      'local header points into central directory'
    )

    const overlappingLocals = createZip([
      { path: 'one.txt', data: 'one' },
      { path: 'two.txt', data: 'two' },
    ])
    const firstCentralOffset = overlappingLocals.readUInt32LE(
      overlappingLocals.length - END_OF_CENTRAL_DIRECTORY_LENGTH + 16
    )
    const secondCentralOffset = firstCentralOffset + 46 + 'one.txt'.length
    overlappingLocals.writeUInt32LE(0, secondCentralOffset + 42)
    expectInvalidZip(overlappingLocals, 'overlapping local records')
  })

  it('rejects STORE metadata mismatches before accepting ambiguous bytes', () => {
    const valid = createZip([{ path: 'x', data: Buffer.from([1]) }])
    const rewritten = Buffer.from(valid)
    const { centralDirectoryOffset, localHeaderOffset } =
      getSingleEntryLayout(rewritten)

    rewritten.writeUInt32LE(2, localHeaderOffset + 22)
    rewritten.writeUInt32LE(2, centralDirectoryOffset + 24)

    expectInvalidZip(rewritten, 'STORE compressed/uncompressed mismatch')
  })

  it('rejects trailing bytes in a DEFLATE stream and wraps zlib failures', () => {
    const data = Buffer.from('compressible '.repeat(64))
    const withTrailingCompressedBytes = createDeflatedZip(
      'file.txt',
      data,
      Buffer.from([0xde, 0xad, 0xbe, 0xef])
    )
    expectInvalidZip(
      withTrailingCompressedBytes,
      'trailing DEFLATE stream bytes'
    )

    const corrupted = createDeflatedZip('file.txt', data)
    const { dataStart } = getSingleEntryLayout(corrupted)
    corrupted[dataStart] = corrupted[dataStart]! ^ 0xff
    expectInvalidZip(corrupted, 'corrupted DEFLATE stream')
  })

  it('rejects hostile declared sizes, record lengths, counts, and limits safely', () => {
    const valid = createZip([{ path: 'x', data: Buffer.from([1]) }])
    const layout = getSingleEntryLayout(valid)
    const mutations: Array<[string, (buffer: Buffer) => void]> = [
      [
        'maximum uncompressed size',
        (buffer) => {
          buffer.writeUInt32LE(0xffff_ffff, layout.localHeaderOffset + 22)
          buffer.writeUInt32LE(0xffff_ffff, layout.centralDirectoryOffset + 24)
        },
      ],
      [
        'maximum compressed size',
        (buffer) => {
          buffer.writeUInt32LE(0xffff_ffff, layout.localHeaderOffset + 18)
          buffer.writeUInt32LE(0xffff_ffff, layout.centralDirectoryOffset + 20)
        },
      ],
      [
        'maximum central filename length',
        (buffer) =>
          buffer.writeUInt16LE(0xffff, layout.centralDirectoryOffset + 28),
      ],
      [
        'maximum central extra length',
        (buffer) =>
          buffer.writeUInt16LE(0xffff, layout.centralDirectoryOffset + 30),
      ],
      [
        'maximum central comment length',
        (buffer) =>
          buffer.writeUInt16LE(0xffff, layout.centralDirectoryOffset + 32),
      ],
      [
        'maximum local filename length',
        (buffer) => buffer.writeUInt16LE(0xffff, layout.localHeaderOffset + 26),
      ],
      [
        'maximum local extra length',
        (buffer) => buffer.writeUInt16LE(0xffff, layout.localHeaderOffset + 28),
      ],
    ]

    for (const [label, mutate] of mutations) {
      const rewritten = Buffer.from(valid)
      mutate(rewritten)
      expectInvalidZip(rewritten, label)
    }

    const hostileCount = Buffer.from(valid)
    hostileCount.writeUInt16LE(0xffff, layout.endOfCentralDirectoryOffset + 8)
    hostileCount.writeUInt16LE(0xffff, layout.endOfCentralDirectoryOffset + 10)
    expectInvalidZip(hostileCount, 'maximum entry count')

    const parserLimitCases: Array<[string, ParseZipOptions]> = [
      ['negative entry limit', { maxEntries: -1 }],
      ['fractional entry limit', { maxEntries: 1.5 }],
      ['infinite entry limit', { maxEntries: Number.POSITIVE_INFINITY }],
      ['negative byte limit', { maxUncompressedBytes: -1 }],
      ['fractional byte limit', { maxUncompressedBytes: 1.5 }],
      [
        'infinite byte limit',
        { maxUncompressedBytes: Number.POSITIVE_INFINITY },
      ],
    ]
    for (const [label, options] of parserLimitCases) {
      expectInvalidZip(valid, label, options)
    }

    expectInvalidZip(
      createZip([
        { path: 'one.txt', data: '1' },
        { path: 'two.txt', data: '2' },
      ]),
      'cumulative uncompressed byte limit',
      { maxUncompressedBytes: 1 }
    )
  })

  it('turns every truncation and deterministic random buffer into InvalidZipError', () => {
    const valid = createZip([{ path: 'file.txt', data: 'content' }])

    for (let length = 0; length < valid.length; length++) {
      expectInvalidZip(valid.subarray(0, length), `truncation at ${length}`)
    }

    for (let seed = 1; seed <= 64; seed++) {
      expectInvalidZip(
        createDeterministicBytes(seed, (seed * 37) % 1024),
        `deterministic random buffer ${seed}`
      )
    }
  })
})
