import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  applyPersonalElementRevision: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  applyPersonalElementRevision: mocks.applyPersonalElementRevision,
}))

import { settlePersonalElementRevision } from '../src/lib/server/personalElements/revisionSettlement'

const content = [
  {
    type: 'tool-call',
    toolName: 'revise_personal_element',
    toolCallId: 'revision-tool',
    result: {
      status: 'updated',
      id: '00000000-0000-0000-0000-000000000001',
      expectedVersion: 3,
      name: 'Revised card',
      content: 'Revised front',
      explanation: 'Revised back',
      sources: [{ sourceId: 'source-1' }],
    },
  },
]

const input = {
  prisma: {
    chatMessage: { updateMany: mocks.updateMany },
  } as never,
  participantId: 'participant-1',
  courseId: 'course-1',
  threadId: 'thread-1',
  assistantMessageId: 'assistant-1',
  assistantMessagePersisted: true,
  assistantMessageContent: content,
}

describe('personal-element revision settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  test('does nothing without a generated revision', async () => {
    await expect(
      settlePersonalElementRevision({
        ...input,
        assistantMessageContent: [],
      })
    ).resolves.toEqual({ status: 'none' })
    expect(mocks.applyPersonalElementRevision).not.toHaveBeenCalled()
  })

  test('applies the persisted linkage and records the resulting version', async () => {
    mocks.applyPersonalElementRevision.mockResolvedValue({ version: 4 })

    await expect(settlePersonalElementRevision(input)).resolves.toEqual({
      status: 'completed',
    })
    expect(mocks.applyPersonalElementRevision).toHaveBeenCalledWith(
      {
        courseId: 'course-1',
        messageId: 'assistant-1',
        toolCallId: 'revision-tool',
      },
      'participant-1'
    )
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          content: [
            expect.objectContaining({
              result: expect.objectContaining({ version: 4 }),
            }),
          ],
        },
      })
    )
  })

  test('retries an uncertain request using the same idempotent linkage', async () => {
    mocks.applyPersonalElementRevision
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ version: 4 })

    await expect(settlePersonalElementRevision(input)).resolves.toEqual({
      status: 'completed',
    })
    expect(mocks.applyPersonalElementRevision).toHaveBeenCalledTimes(2)
  })

  test('marks a definitively rejected revision as a conflict', async () => {
    mocks.applyPersonalElementRevision.mockRejectedValue(
      Object.assign(new Error('stale'), {
        extensions: { code: 'PERSONAL_ELEMENT_VERSION_CONFLICT' },
      })
    )

    await expect(settlePersonalElementRevision(input)).resolves.toEqual({
      status: 'failed',
      reason: 'rejected',
    })
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          content: [
            expect.objectContaining({
              result: expect.objectContaining({ status: 'conflict' }),
            }),
          ],
        },
      })
    )
  })
})
