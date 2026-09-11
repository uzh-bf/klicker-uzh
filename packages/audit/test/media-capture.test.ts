import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import {
  assertAllowedKlickerMediaSource,
  auditMediaContentAddress,
  captureAssessmentMedia,
  type ImmutableAuditMediaStore,
} from '../src/index.js'

const sourceUrl =
  'https://klicker-media.blob.core.windows.net/00000000-0000-4000-8000-000000000001/figure.png'

describe('assessment media capture', () => {
  it.each([
    ['image/png', 'application/octet-stream', Buffer.from('not an image')],
    ['image/jpeg', 'application/octet-stream', Buffer.from('GIF89a synthetic')],
    ['image/jpeg', 'image/png', Buffer.from('GIF89a synthetic')],
    ['application/pdf', 'application/octet-stream', Buffer.from('%PDF-1.7')],
    ['image/svg+xml', 'application/octet-stream', Buffer.from('<svg/>')],
  ])('rejects unsupported or mismatched %s / %s before persistence', async (expected, reported, bytes) => {
    const createFromFile = vi.fn<ImmutableAuditMediaStore['createFromFile']>()
    await expect(
      captureAssessmentMedia({
        reference: { mediaId: randomUUID(), sourceUrl, mimeType: expected },
        source: {
          async open() {
            return {
              mimeType: reported,
              contentLength: bytes.length,
              body: (async function* () {
                yield bytes
              })(),
            }
          },
        },
        store: { createFromFile },
        allowedHosts: ['klicker-media.blob.core.windows.net'],
        retainUntil: new Date('2027-10-01T00:00:00.000Z'),
      })
    ).rejects.toThrow(/MIME type/)
    expect(createFromFile).not.toHaveBeenCalled()
  })

  it.each([
    // Synthetic format fixtures: detection is not full decoding/validation.
    [
      'image/jpeg',
      Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'),
    ],
    [
      'image/png',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      ),
    ],
    [
      'image/gif',
      Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      ),
    ],
  ])('captures generic binary %s only after detecting its expected format', async (mimeType, bytes) => {
    let capturedPath = ''
    const result = await captureAssessmentMedia({
      reference: { mediaId: randomUUID(), sourceUrl, mimeType },
      source: {
        async open() {
          return {
            mimeType: 'application/octet-stream',
            contentLength: bytes.length,
            body: (async function* () {
              yield bytes.subarray(0, 2)
              yield bytes.subarray(2)
            })(),
          }
        },
      },
      store: {
        async createFromFile(input) {
          capturedPath = input.filePath
          expect(await readFile(input.filePath)).toEqual(bytes)
          expect(input.mimeType).toBe(mimeType)
          return { ...input, versionId: 'version-1', outcome: 'CREATED' }
        },
      },
      allowedHosts: ['klicker-media.blob.core.windows.net'],
      retainUntil: new Date('2027-10-01T00:00:00.000Z'),
    })
    expect(result.media).toMatchObject({
      mimeType,
    })
    expect(result.media).not.toHaveProperty('sourceMimeType')
    await expect(stat(capturedPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('streams source bytes through a temporary file and verifies the result', async () => {
    const chunks = [Buffer.from('large '), Buffer.from('synthetic media')]
    let opened = 0
    const created: Array<{ content: Buffer; blobName: string }> = []
    const store: ImmutableAuditMediaStore = {
      async createFromFile(input) {
        const content = await readFile(input.filePath)
        created.push({ content, blobName: input.blobName })
        return {
          blobName: input.blobName,
          contentHash: input.contentHash,
          byteLength: input.byteLength,
          mimeType: input.mimeType,
          versionId: 'version-1',
          retainUntil: input.retainUntil,
          outcome: 'CREATED',
        }
      },
    }

    const result = await captureAssessmentMedia({
      reference: {
        mediaId: randomUUID(),
        sourceUrl,
        mimeType: 'image/png',
      },
      source: {
        async open() {
          opened++
          return {
            mimeType: 'image/png',
            contentLength: chunks.reduce(
              (length, chunk) => length + chunk.byteLength,
              0
            ),
            body: (async function* () {
              for (const chunk of chunks) yield chunk
            })(),
          }
        },
      },
      store,
      allowedHosts: ['klicker-media.blob.core.windows.net'],
      retainUntil: new Date('2027-10-01T00:00:00.000Z'),
    })

    expect(opened).toBe(1)
    expect(created[0]?.content.toString()).toBe('large synthetic media')
    expect(result.media.blobName).toBe(
      auditMediaContentAddress(result.media.contentHash)
    )
    expect(result.media.sourceUrl).toBe(sourceUrl)
    expect(result.media.sourceReferenceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.media).not.toHaveProperty('sourceMimeType')
  })

  it('fails before persistence for an untrusted URL or corrupted length', async () => {
    expect(() =>
      assertAllowedKlickerMediaSource('https://example.org/private.png', [
        'klicker-media.blob.core.windows.net',
      ])
    ).toThrow('host is not allowlisted')

    await expect(
      captureAssessmentMedia({
        reference: {
          mediaId: randomUUID(),
          sourceUrl,
          mimeType: 'image/png',
        },
        source: {
          async open() {
            return {
              mimeType: 'image/png',
              contentLength: 100,
              body: (async function* () {
                yield Buffer.from('short')
              })(),
            }
          },
        },
        store: {
          async createFromFile() {
            throw new Error('store must not be called')
          },
        },
        allowedHosts: ['klicker-media.blob.core.windows.net'],
        retainUntil: new Date('2027-10-01T00:00:00.000Z'),
      })
    ).rejects.toThrow('length changed during capture')
  })
})
