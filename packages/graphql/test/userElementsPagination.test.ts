import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { SortByType } from '@klicker-uzh/types'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getUserElements } from '../src/services/elements.js'

describe('getUserElements pagination', () => {
  const findUnique = vi.fn().mockResolvedValue({
    _count: { objects: 1 },
    objects: [
      {
        element: { id: 1 },
        permissionLevel: PermissionLevel.OWNER,
        derived: false,
      },
    ],
  })
  const context = {
    prisma: { user: { findUnique } },
    user: { sub: 'user-id' },
  } as unknown as ContextWithUser
  const baseArguments = {
    hasSampleSolution: false,
    hasAnswerFeedbacks: false,
    tagIds: [],
    showUntagged: false,
    sortByType: SortByType.TITLE,
    sortByAsc: true,
    showArchived: false,
  }

  beforeEach(() => {
    findUnique.mockClear()
  })

  it('omits take and skip when pagination is not requested', async () => {
    await getUserElements(baseArguments, context)

    const query = findUnique.mock.calls[0]?.[0]
    expect(query.include.objects.take).toBeUndefined()
    expect(query.include.objects.skip).toBeUndefined()
  })

  it('uses finite take and skip values when pagination is requested', async () => {
    await getUserElements(
      { ...baseArguments, numEntries: 10, offset: 20 },
      context
    )

    const query = findUnique.mock.calls[0]?.[0]
    expect(query.include.objects.take).toBe(10)
    expect(query.include.objects.skip).toBe(20)
  })
})
