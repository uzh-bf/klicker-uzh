import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { discoverBaselineMediaReferences } from '../src/baseline/media-references.js'

describe('baseline media reference discovery', () => {
  it('deduplicates known Klicker media and strips query material', () => {
    const mediaId = randomUUID()
    const href =
      'https://klicker-media.blob.core.windows.net/00000000-0000-4000-8000-000000000001/figure.png'
    const result = discoverBaselineMediaReferences({
      markdown: [`![first](${href}?sv=secret)`, `<img src="${href}" />`],
      knownMedia: [{ id: mediaId, href, mimeType: 'image/png' }],
    })

    expect(result.owned).toEqual([
      { mediaId, sourceUrl: href, mimeType: 'image/png' },
    ])
    expect(result.limitations).toEqual([])
  })

  it('records external URLs as hashed limitations without exposing the URL', () => {
    const result = discoverBaselineMediaReferences({
      markdown: [
        'Video: https://cdn.example.org/private/video.mp4?token=value',
      ],
      knownMedia: [],
    })

    expect(result.owned).toEqual([])
    expect(result.limitations).toEqual([
      {
        kind: 'LIMITATION',
        subjectType: 'EXTERNAL_MEDIA',
        subjectId: expect.stringMatching(/^[0-9a-f]{64}$/),
        reasonCode: 'EXTERNAL_MEDIA_NOT_CAPTURED',
      },
    ])
    expect(JSON.stringify(result)).not.toContain('example.org')
    expect(JSON.stringify(result)).not.toContain('token=value')
  })
})
