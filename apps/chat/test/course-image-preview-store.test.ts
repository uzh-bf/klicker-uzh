import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), readImage: vi.fn() }))
vi.mock('@klicker-uzh/prisma', () => ({
  prisma: { kBResource: { findFirst: mocks.findFirst } },
}))
vi.mock('../src/lib/server/courseImageStore', () => ({
  readCourseImage: mocks.readImage,
}))

import { readCourseImagePreview } from '../src/lib/server/courseImagePreviewStore'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

const fixture = JSON.parse(
  await readFile('scripts/fixtures/course-images/query-result.json', 'utf8')
)
const image = courseImageCandidates(fixture)[0]!
const activeResource = {
  id: image.external_resource_id,
  kbId: image.kb_id,
  resourceVersion: image.resource_version,
  activeResourceVersion: image.resource_version,
  status: 'READY',
  deletedAt: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.readImage.mockResolvedValue(Buffer.from('validated reader result'))
})

describe('model preview resource access', () => {
  it('denies a foreign KB before accessing the database or storage', async () => {
    await expect(readCourseImagePreview(image, [])).rejects.toThrow(
      'Course image unavailable'
    )
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.readImage).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', null],
    ['withdrawn', { ...activeResource, deletedAt: new Date() }],
    ['failed', { ...activeResource, status: 'FAILED' }],
    ['replacement requested', { ...activeResource, resourceVersion: 999 }],
    [
      'different active version',
      { ...activeResource, activeResourceVersion: 999 },
    ],
    ['foreign KB', { ...activeResource, kbId: 'foreign' }],
    ['other resource', { ...activeResource, id: 'other' }],
  ])('does not read %s resource bytes', async (_name, resource) => {
    mocks.findFirst.mockImplementation(({ where }) =>
      resource &&
      Object.entries(where).every(
        ([key, value]) => Reflect.get(resource, key) === value
      )
        ? { id: resource.id }
        : null
    )
    await expect(readCourseImagePreview(image, [image.kb_id])).rejects.toThrow()
    expect(mocks.readImage).not.toHaveBeenCalled()
  })

  it('uses the verified reader only for the exact live resource/version', async () => {
    mocks.findFirst.mockResolvedValue({ id: activeResource.id })
    const bytes = await readCourseImagePreview(image, [image.kb_id])
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: activeResource,
      select: { id: true },
    })
    expect(mocks.readImage).toHaveBeenCalledWith(image)
    expect(bytes).toEqual(Buffer.from('validated reader result'))
  })

  it('does not hide reader integrity failures from the preview fallback', async () => {
    mocks.findFirst.mockResolvedValue({ id: activeResource.id })
    mocks.readImage.mockRejectedValue(
      new Error('Image artifact integrity failed')
    )
    await expect(readCourseImagePreview(image, [image.kb_id])).rejects.toThrow(
      'Image artifact integrity failed'
    )
  })
})
