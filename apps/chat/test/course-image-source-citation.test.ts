import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type CourseImage,
  courseImageCandidates,
  courseImageSourceMap,
} from '../src/lib/sources/courseImages'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '../src/lib/sources/normalizeSources'

const root = path.resolve('scripts/fixtures/course-images')
const fixture = JSON.parse(
  await readFile(path.join(root, 'query-result.json'), 'utf8')
)

function figureFrom(payload: unknown): CourseImage {
  const image = courseImageCandidates(payload)[0]
  if (!image) throw new Error('payload produced no course image candidate')
  return image
}

function docQueryPart(
  result: unknown,
  toolName = 'KB_doc_query'
): ChatSourcePart {
  return { type: 'tool-call', toolName, result }
}

function selectionPart(image: CourseImage): ChatSourcePart {
  return {
    type: 'tool-call',
    toolName: 'show_course_image',
    result: { status: 'selected', image, reason: 'fixture' },
  }
}

function sourcesFor(parts: readonly ChatSourcePart[]) {
  return normalizeSourcesFromParts(parts)
}

describe('course image source citation', () => {
  it('links the figure to the source card its asset came from', () => {
    const payload = structuredClone(fixture)
    const image = figureFrom(payload)
    const parts = [docQueryPart(payload), selectionPart(image)]
    const sources = sourcesFor(parts)
    expect(sources).toHaveLength(1)

    const match = courseImageSourceMap(sources, parts).get(image.asset_id)
    expect(match?.index).toBe(1)
    expect(match?.title).toBe('Synthetic learning cycle')
  })

  it('links a figure from a later source to that source, not the first one', () => {
    const payload = structuredClone(fixture)
    // First document retrieved no figure at all; the second one carries it.
    const textOnly = structuredClone(payload.sources[0])
    delete textOnly.chunks[0].visual_assets
    textOnly.reference = 'https://synthetic.invalid/text-only.pdf'
    textOnly.source_url = textOnly.reference
    const illustrated = structuredClone(payload.sources[0])
    illustrated.reference = 'https://synthetic.invalid/illustrated.pdf'
    illustrated.source_url = illustrated.reference
    payload.sources = [textOnly, illustrated]

    const image = figureFrom(payload)
    const parts = [docQueryPart(payload)]
    const sources = sourcesFor(parts)
    expect(sources).toHaveLength(2)

    expect(
      courseImageSourceMap(sources, parts).get(image.asset_id)?.index
    ).toBe(2)
  })

  it('keeps same-titled documents apart', () => {
    const payload = structuredClone(fixture)
    const first = payload.sources[0]
    const second = structuredClone(first)
    second.reference = 'https://synthetic.invalid/learning-cycle-part-two.pdf'
    second.source_url = second.reference
    second.chunks[0].visual_assets.assets[0].asset_id = 'b'.repeat(64)
    second.chunks[0].visual_assets.assets[0].image_sha256 = 'c'.repeat(64)
    payload.sources = [first, second]

    const images = courseImageCandidates(payload)
    expect(images).toHaveLength(2)
    const parts = [docQueryPart(payload)]
    const sources = sourcesFor(parts)
    // Same title on both cards, so only the recorded identity can separate them.
    expect(sources.map((source) => source.title)).toEqual([
      'Synthetic learning cycle',
      'Synthetic learning cycle',
    ])

    expect(
      courseImageSourceMap(sources, parts).get(images[0]!.asset_id)?.index
    ).toBe(1)
    expect(
      courseImageSourceMap(sources, parts).get(images[1]!.asset_id)?.index
    ).toBe(2)
    expect(
      [...courseImageSourceMap(sources, parts)].map(([assetId, source]) => [
        assetId,
        source.index,
      ])
    ).toEqual([
      [images[0]!.asset_id, 1],
      [images[1]!.asset_id, 2],
    ])
  })

  it('omits the citation when the asset is in no retrieval at all', () => {
    const payload = structuredClone(fixture)
    const orphan: CourseImage = {
      ...figureFrom(payload),
      asset_id: 'e'.repeat(64),
    }
    const parts = [docQueryPart(payload)]

    expect(
      courseImageSourceMap(sourcesFor(parts), parts).get(orphan.asset_id)
    ).toBeUndefined()
  })

  it('omits the citation when the message has no sources', () => {
    const payload = structuredClone(fixture)
    const image = figureFrom(payload)
    const parts = [selectionPart(image)]

    expect(courseImageSourceMap([], parts).get(image.asset_id)).toBeUndefined()
  })

  it('omits the citation when retrievals disagree about the identity', () => {
    const payload = structuredClone(fixture)
    const copy = structuredClone(fixture)
    copy.sources[0].reference =
      'https://synthetic.invalid/learning-cycle-copy.pdf'
    copy.sources[0].source_url = copy.sources[0].reference
    const image = figureFrom(payload)
    const parts = [docQueryPart(payload), docQueryPart(copy, 'KB2_doc_query')]
    const sources = sourcesFor(parts)
    expect(sources).toHaveLength(2)

    expect(
      courseImageSourceMap(sources, parts).get(image.asset_id)
    ).toBeUndefined()
  })

  it('ignores errored retrieval parts when resolving the identity', () => {
    const payload = structuredClone(fixture)
    const failing = structuredClone(fixture)
    failing.sources[0].reference = 'https://synthetic.invalid/other.pdf'
    const image = figureFrom(payload)
    const parts = [
      docQueryPart(payload),
      { ...docQueryPart(failing), isError: true },
    ]

    expect(
      courseImageSourceMap(sourcesFor(parts), parts).get(image.asset_id)?.index
    ).toBe(1)
  })
})
