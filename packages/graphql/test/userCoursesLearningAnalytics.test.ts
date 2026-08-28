import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getUserCourses } from '../src/services/courses.js'

describe('getUserCourses learning-analytics filter', () => {
  const findUnique = vi.fn().mockResolvedValue({ objects: [] })
  const context = {
    prisma: { user: { findUnique } },
    user: { sub: 'user-id' },
  } as unknown as ContextWithUser

  beforeEach(() => {
    findUnique.mockClear()
  })

  it('bounds eligible learning-analytics courses for the global header', async () => {
    await getUserCourses({ learningAnalyticsOnly: true }, context)

    const objects = findUnique.mock.calls[0]?.[0].include.objects
    expect(objects.where).toEqual({
      courseId: { not: null },
      course: {
        isLearningAnalyticsEnabled: true,
        areAnalyticsValid: true,
        isArchived: false,
      },
    })
    expect(objects.orderBy).toEqual([{ course: { endDate: 'desc' } }])
    expect(objects.take).toBe(5)
  })

  it('keeps the existing complete course list unfiltered and unbounded', async () => {
    await getUserCourses({}, context)

    const objects = findUnique.mock.calls[0]?.[0].include.objects
    expect(objects.where).toEqual({ courseId: { not: null } })
    expect(objects.orderBy).toEqual([{ course: { endDate: 'desc' } }])
    expect(objects.take).toBeUndefined()
  })
})
