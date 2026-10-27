import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => ({
  prisma: {
    chatThread: {
      create: mocks.create,
    },
  },
}))

import { ThreadService } from '../src/services/threads'

describe('ThreadService.createThread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue({
      id: 'thread-preallocated',
      participantId: 'participant-1',
      chatbotId: 'chatbot-1',
      title: null,
      createdAt: new Date('2026-08-23T12:00:00.000Z'),
      updatedAt: new Date('2026-08-23T12:00:00.000Z'),
    })
  })

  test('persists a preallocated scope subject as the thread id', async () => {
    await ThreadService.createThread(
      'participant-1',
      'chatbot-1',
      null,
      'thread-preallocated'
    )

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        id: 'thread-preallocated',
        title: null,
        participant: { connect: { id: 'participant-1' } },
        chatbot: { connect: { id: 'chatbot-1' } },
      },
    })
  })
})
