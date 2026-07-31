import { HATCHET_EVENTS } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'

import {
  recomputeCourseAnalytics,
  type RecomputeAnalyticsMode,
} from '../courses.js'

describe('recomputeCourseAnalytics event routing', () => {
  it.each([
    ['incremental', HATCHET_EVENTS.adminRecomputeAnalytics],
    ['finalize', HATCHET_EVENTS.adminRecomputeAnalytics],
    ['full', HATCHET_EVENTS.adminRecomputeAnalyticsFull],
  ] satisfies [RecomputeAnalyticsMode, string][])(
    'routes %s through %s',
    async (mode, event) => {
      const push = vi.fn().mockResolvedValue(undefined)
      const ctx = {
        prisma: {
          course: {
            findUnique: vi.fn().mockResolvedValue({ id: 'course-1' }),
          },
        },
        hatchet: { events: { push } },
      }

      await expect(
        recomputeCourseAnalytics({ courseId: 'course-1', mode }, ctx as never)
      ).resolves.toBe(true)
      expect(push).toHaveBeenCalledWith(event, {
        mode,
        courseId: 'course-1',
      })
    }
  )
})
