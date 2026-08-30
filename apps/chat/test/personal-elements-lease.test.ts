import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  abort: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  claimCardGenerationLease: mocks.claim,
  completeCardGenerationLease: mocks.complete,
  abortCardGenerationLease: mocks.abort,
}))

import {
  abortGenerationLease,
  claimGenerationLease,
  completeGenerationLease,
  ensureGenerationTriggerMessage,
} from '../src/lib/server/personalElements/lease'

describe('personal-element generation lease adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.claim.mockResolvedValue({ id: 'lease-1' })
    mocks.complete.mockResolvedValue(true)
    mocks.abort.mockResolvedValue(true)
  })

  test('binds the accepted plan to the assistant attempt token', async () => {
    const lease = await claimGenerationLease({
      participantId: 'participant-1',
      courseId: 'course-1',
      planMessageId: '00000000-0000-0000-0000-000000000001',
      planToolCallId: 'plan-tool-1',
      attemptToken: '00000000-0000-0000-0000-000000000002',
    })

    expect(lease).toEqual({
      id: 'lease-1',
      attemptToken: '00000000-0000-0000-0000-000000000002',
    })
    expect(mocks.claim).toHaveBeenCalledWith(
      {
        courseId: 'course-1',
        planMessageId: '00000000-0000-0000-0000-000000000001',
        planToolCallId: 'plan-tool-1',
        attemptToken: '00000000-0000-0000-0000-000000000002',
      },
      'participant-1'
    )
  })

  test('uses the same participant and attempt token for settlement', async () => {
    const lease = { id: 'lease-1', attemptToken: 'assistant-attempt-1' }

    await expect(
      completeGenerationLease({
        participantId: 'participant-1',
        lease,
      })
    ).resolves.toBe(true)
    await expect(
      abortGenerationLease({
        participantId: 'participant-1',
        lease,
      })
    ).resolves.toBe(true)

    expect(mocks.complete).toHaveBeenCalledWith(
      'lease-1',
      'assistant-attempt-1',
      'participant-1'
    )
    expect(mocks.abort).toHaveBeenCalledWith(
      'lease-1',
      'assistant-attempt-1',
      'participant-1'
    )
  })

  test('creates and verifies the accepted-plan trigger message', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      threadId: 'thread-1',
      parentId: 'plan-message-1',
      role: 'user',
      content: [{ type: 'text', text: 'Generate the accepted cards.' }],
    })

    await ensureGenerationTriggerMessage({
      prisma: { chatMessage: { createMany, findUnique } } as never,
      userMessageId: 'user-message-1',
      threadId: 'thread-1',
      parentId: 'plan-message-1',
      content: 'Generate the accepted cards.',
    })

    expect(createMany).toHaveBeenCalledWith({
      data: {
        id: 'user-message-1',
        threadId: 'thread-1',
        parentId: 'plan-message-1',
        role: 'user',
        content: [{ type: 'text', text: 'Generate the accepted cards.' }],
      },
      skipDuplicates: true,
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-message-1' },
      select: { threadId: true, parentId: true, role: true, content: true },
    })
  })

  test('rejects a trigger message outside the accepted plan branch', async () => {
    const prisma = {
      chatMessage: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          threadId: 'thread-1',
          parentId: 'different-plan-message',
          role: 'user',
          content: [{ type: 'text', text: 'Generate the accepted cards.' }],
        }),
      },
    }

    await expect(
      ensureGenerationTriggerMessage({
        prisma: prisma as never,
        userMessageId: 'user-message-1',
        threadId: 'thread-1',
        parentId: 'plan-message-1',
        content: 'Generate the accepted cards.',
      })
    ).rejects.toThrow('The card generation trigger message is not available')
  })
})
