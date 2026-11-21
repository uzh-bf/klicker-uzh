import { prisma } from '@klicker-uzh/prisma'
import type { CourseImage } from '@/src/lib/sources/courseImages'
import { readCourseImage } from './courseImageStore'

/** Model previews require the same live resource/version as student display. */
export async function readCourseImagePreview(
  image: CourseImage,
  kbIds: readonly string[]
): Promise<Buffer> {
  if (!kbIds.includes(image.kb_id)) throw new Error('Course image unavailable')
  const resource = await prisma.kBResource.findFirst({
    where: {
      id: image.external_resource_id,
      kbId: image.kb_id,
      resourceVersion: image.resource_version,
      activeResourceVersion: image.resource_version,
      status: 'READY',
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!resource) throw new Error('Course image unavailable')
  return readCourseImage(image)
}
