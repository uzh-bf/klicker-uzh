import { SortByType } from '@klicker-uzh/types'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getUserActivities } from '../src/services/activities.js'

describe('getUserActivities pagination', () => {
  const findMany = vi.fn().mockResolvedValue([])
  const count = vi.fn().mockResolvedValue(0)
  const context = {
    prisma: { userActivities: { findMany, count } },
    user: { sub: 'user-id' },
  } as unknown as ContextWithUser
  const baseArguments = {
    sortByType: SortByType.TITLE,
    sortByAsc: true,
  }

  beforeEach(() => {
    findMany.mockClear()
    count.mockClear()
  })

  it('excludes hidden derived deleted activities before fetching and counting', async () => {
    await getUserActivities(baseArguments, context)

    const expectedFilter = {
      NOT: { derived: true, isDeleted: true },
    }
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expectedFilter),
      })
    )
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining(expectedFilter),
    })
  })
})
