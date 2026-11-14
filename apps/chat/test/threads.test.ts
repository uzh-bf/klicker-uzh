import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  executeRaw: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => {
  const chatThread = { create: mocks.create, findFirst: mocks.findFirst }
  return {
    prisma: {
      chatThread,
      $transaction: (operation: (tx: unknown) => unknown) =>
        operation({ chatThread, $executeRaw: mocks.executeRaw }),
    },
  }
})

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

  describe('in assessment mode', () => {
    beforeEach(() => {
      vi.stubEnv('CHAT_ASSESSMENT_MODE', 'true')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test('returns the existing thread under the participant lock', async () => {
      mocks.findFirst.mockResolvedValue({
        id: 'thread-existing',
        title: 'Exam',
        origin: null,
        createdAt: new Date('2026-08-23T11:00:00.000Z'),
        updatedAt: new Date('2026-08-23T11:00:00.000Z'),
      })

      const result = await ThreadService.createThread(
        'participant-1',
        'chatbot-1'
      )

      expect(result.created).toBe(false)
      expect(result.thread.id).toBe('thread-existing')
      expect(mocks.executeRaw).toHaveBeenCalledOnce()
      expect(mocks.create).not.toHaveBeenCalled()
    })

    test('creates the first thread under the participant lock', async () => {
      mocks.findFirst.mockResolvedValue(null)

      const result = await ThreadService.createThread(
        'participant-1',
        'chatbot-1'
      )

      expect(result.created).toBe(true)
      expect(mocks.executeRaw).toHaveBeenCalledOnce()
      expect(mocks.create).toHaveBeenCalledOnce()
    })
  })
})
