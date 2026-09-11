import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  assertAllowedKlickerMediaSource,
  auditMediaContentAddress,
  captureAssessmentMedia,
  type ImmutableAuditMediaStore,
} from '../src/index.js'

const sourceUrl =
  'https://klicker-media.blob.core.windows.net/00000000-0000-4000-8000-000000000001/figure.png'

describe('assessment media capture', () => {
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
