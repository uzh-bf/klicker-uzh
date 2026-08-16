import { prisma } from '@klicker-uzh/prisma'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createPrismaAnalysisRecordProvider } from './prismaProvider.js'

const COURSE_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_COURSE_ID = '00000000-0000-4000-8000-000000000002'
const CHATBOT_ID = '00000000-0000-4000-8000-000000000003'
const THREAD_ID = '00000000-0000-4000-8000-000000000004'
const USER_ID = '00000000-0000-4000-8000-000000000005'

afterAll(async () => {
  await prisma.$disconnect()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Prisma chatbot analysis provider', () => {
  it('fails closed while authoritative eligibility is unavailable', async () => {
    const provider = createPrismaAnalysisRecordProvider('course-1')

    await expect(
      provider.loadEligibility({
        participantIds: ['participant-1'],
        purpose: 'learning-analytics',
        courseIds: ['course-1'],
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-02T00:00:00.000Z'),
      })
    ).resolves.toEqual([])
  })

  it('loads only the selected course window and its direct assistant replies', async () => {
    const from = new Date('2026-08-01T00:00:00.000Z')
    const to = new Date('2026-08-02T00:00:00.000Z')
    const selected = [
      {
        id: USER_ID,
        parentId: null,
        role: 'user',
        chatMode: 'tutor',
        modelId: null,
        rating: null,
        creditsUsed: null,
        createdAt: from,
        attachments: [],
        thread: {
          id: THREAD_ID,
          participantId: '00000000-0000-4000-8000-000000000006',
          chatbot: { id: CHATBOT_ID, courseId: COURSE_ID },
        },
      },
    ]
    const findMany = vi
      .spyOn(prisma.chatMessage, 'findMany')
      .mockResolvedValueOnce(selected as never)
      .mockResolvedValueOnce([] as never)

    const provider = createPrismaAnalysisRecordProvider(COURSE_ID)
    await provider.loadMessages({ from, to })

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          createdAt: { gte: from, lte: to },
          thread: { chatbot: { courseId: COURSE_ID } },
        },
      })
    )
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          parentId: { in: [USER_ID] },
          role: 'assistant',
          createdAt: { gt: to },
          thread: { chatbot: { courseId: COURSE_ID } },
        },
      })
    )
    expect(JSON.stringify(findMany.mock.calls)).not.toContain(OTHER_COURSE_ID)
  })
})
